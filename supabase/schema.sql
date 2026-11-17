-- =====================================================================
-- Citiway Real Estate Back-Office CRM — Supabase schema
-- Run in the Supabase SQL editor (or `supabase db push`). Idempotent.
-- =====================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------
-- Roles & profiles (Supabase Auth users → role)
-- ---------------------------------------------------------------------
-- super_admin is the sole owner of company settings, brand/stamp assets, admin-tier accounts
-- and document sign-off; it is a strict superset of admin everywhere else (see is_admin_or_above()
-- near the end of this file). On an EXISTING database, adding an enum value must be committed
-- before it's used — see supabase/migrations/20261117030000_add_super_admin_enum.sql.
do $$ begin
  create type public.app_role as enum ('super_admin', 'admin', 'accountant', 'agent');
exception when duplicate_object then null; end $$;

create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  full_name   text,
  role        public.app_role not null default 'agent',
  created_at  timestamptz not null default now()
);

-- New sign-ups get the least-privileged role. Promote the first admin manually:
--   update public.profiles set role = 'admin' where id = '<auth user uuid>';
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users for each row execute function public.handle_new_user();

create or replace function public.current_app_role()
returns public.app_role language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid()
$$;

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

-- ---------------------------------------------------------------------
-- 1. company_settings  (single row, id = 1)
-- ---------------------------------------------------------------------
create table if not exists public.company_settings (
  id               int primary key default 1 check (id = 1),
  company_name     text not null default 'Citiway Real Estate',
  trade_license    text not null default '726153',
  rera_orn         text,
  trn              text,
  address          text default 'Dubai, United Arab Emirates',
  phone            text,
  email            text,
  admin_alert_email text,
  next_letter_seq  int  not null default 1 check (next_letter_seq >= 1),
  letter_seq_year  int  not null default extract(year from now())::int,
  updated_at       timestamptz not null default now()
);
insert into public.company_settings (id) values (1) on conflict (id) do nothing;
drop trigger if exists trg_company_settings_updated on public.company_settings;
create trigger trg_company_settings_updated before update on public.company_settings
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------
-- 2. developers
-- ---------------------------------------------------------------------
create table if not exists public.developers (
  id                uuid primary key default gen_random_uuid(),
  developer_name    text not null,
  start_date        date not null,
  end_date          date not null,
  has_noc           boolean not null default false,
  agreement_pdf_url text,            -- object path inside the private `agreements` bucket
  noc_pdf_url       text,            -- object path inside the private `agreements` bucket
  notes             text,
  last_reminded_at  timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint developers_dates_chk check (end_date >= start_date)
);
create index if not exists developers_end_date_idx on public.developers (end_date);
drop trigger if exists trg_developers_updated on public.developers;
create trigger trg_developers_updated before update on public.developers
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------
-- 3. agents
-- ---------------------------------------------------------------------
create table if not exists public.agents (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid unique references auth.users(id) on delete set null,
  full_name        text not null,
  email            text,
  phone            text,
  rera_brn         text,
  brn_expiry_date  date,
  emirates_id      text,
  passport_no      text,
  commission_split numeric(5,2) not null default 50 check (commission_split between 0 and 100),
  is_active        boolean not null default true,
  created_at       timestamptz not null default now()
);
create index if not exists agents_brn_expiry_idx on public.agents (brn_expiry_date);

-- ---------------------------------------------------------------------
-- 4. clients
-- ---------------------------------------------------------------------
create table if not exists public.clients (
  id             uuid primary key default gen_random_uuid(),
  full_name      text not null,
  email          text,
  phone          text,
  id_passport_no text,
  nationality    text,
  created_at     timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 5. letters
-- ---------------------------------------------------------------------
create table if not exists public.letters (
  id            uuid primary key default gen_random_uuid(),
  ref_no        text not null unique,                -- CW-LTR-YYYY-XXXX
  template_type text not null,
  language      text not null default 'en' check (language in ('en', 'ar')),
  recipient     text,
  subject       text,
  body_html     text,
  developer_id  uuid references public.developers(id) on delete set null,
  agent_id      uuid references public.agents(id) on delete set null,
  created_by    uuid references auth.users(id) on delete set null default auth.uid(),
  created_at    timestamptz not null default now()
);
create index if not exists letters_created_idx on public.letters (created_at desc);

-- ---------------------------------------------------------------------
-- 6. finance_documents  (invoices, receipts, contracts, vouchers; also the shared archive for
--    Deals & Marketing documents — deal_proposal, unit_handover, marketing_approval — which
--    have no amount/VAT and are gated by modules.deals instead of the finance_docs toggles)
-- ---------------------------------------------------------------------
create table if not exists public.finance_documents (
  id           uuid primary key default gen_random_uuid(),
  doc_type     text not null check (doc_type in ('tax_invoice','receipt','rental_contract','payment_voucher','other','deal_proposal','unit_handover','marketing_approval')),
  doc_no       text not null,
  client_id    uuid references public.clients(id) on delete set null,
  developer_id uuid references public.developers(id) on delete set null,
  agent_id     uuid references public.agents(id) on delete set null,
  amount_aed   numeric(14,2) not null default 0,
  vat_aed      numeric(14,2) not null default 0,
  total_aed    numeric(14,2) not null default 0,
  status       text not null default 'draft',
  due_date     date,
  created_by   uuid references auth.users(id) on delete set null default auth.uid(),
  created_at   timestamptz not null default now(),
  unique (doc_type, doc_no)
);
create index if not exists finance_documents_created_idx on public.finance_documents (created_at desc);

-- ---------------------------------------------------------------------
-- 7. deals  (commission collection pipeline — Module 4 / Module 6)
-- ---------------------------------------------------------------------
do $$ begin
  create type public.commission_stage as enum ('spa_signed','invoice_submitted','pending_transfer','collected');
exception when duplicate_object then null; end $$;

create table if not exists public.deals (
  id               uuid primary key default gen_random_uuid(),
  client_id        uuid references public.clients(id) on delete set null,
  developer_id     uuid references public.developers(id) on delete set null,
  agent_id         uuid references public.agents(id) on delete set null,
  project_name     text,
  unit_no          text,
  sale_price_aed   numeric(14,2),
  commission_pct   numeric(5,2),
  commission_aed   numeric(14,2) not null default 0,
  stage            public.commission_stage not null default 'spa_signed',
  spa_date         date,
  collected_at     timestamptz,
  notes            text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index if not exists deals_stage_idx on public.deals (stage);
drop trigger if exists trg_deals_updated on public.deals;
create trigger trg_deals_updated before update on public.deals
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------
-- Letter reference numbers: CW-LTR-YYYY-XXXX (atomic, resets each year)
-- ---------------------------------------------------------------------
create or replace function public.peek_letter_ref()
returns text language plpgsql stable security definer set search_path = public as $$
declare y int := extract(year from (now() at time zone 'Asia/Dubai'))::int; s int;
begin
  select case when letter_seq_year = y then next_letter_seq else 1 end into s
    from public.company_settings where id = 1;
  return format('CW-LTR-%s-%s', y, lpad(coalesce(s, 1)::text, 4, '0'));
end $$;

-- Called after a letter is printed/exported: moves the counter past the used number.
create or replace function public.advance_letter_seq(p_year int, p_seq int)
returns text language plpgsql security definer set search_path = public as $$
declare y int := extract(year from (now() at time zone 'Asia/Dubai'))::int;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  update public.company_settings set
    next_letter_seq = case when letter_seq_year = p_year then greatest(next_letter_seq, p_seq + 1) else p_seq + 1 end,
    letter_seq_year = p_year
  where id = 1 and p_year = y;
  return public.peek_letter_ref();
end $$;

grant execute on function public.peek_letter_ref() to authenticated;
grant execute on function public.advance_letter_seq(int, int) to authenticated;
grant execute on function public.current_app_role() to authenticated;

-- ---------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------
alter table public.profiles          enable row level security;
alter table public.company_settings  enable row level security;
alter table public.developers        enable row level security;
alter table public.agents            enable row level security;
alter table public.clients           enable row level security;
alter table public.letters           enable row level security;
alter table public.finance_documents enable row level security;
alter table public.deals             enable row level security;

-- helper: drop+create so the file can be re-run
do $$
declare t text;
begin
  for t in select unnest(array['profiles','company_settings','developers','agents','clients','letters','finance_documents','deals']) loop
    execute format('drop policy if exists %I on public.%I', t || '_select', t);
    execute format('drop policy if exists %I on public.%I', t || '_insert', t);
    execute format('drop policy if exists %I on public.%I', t || '_update', t);
    execute format('drop policy if exists %I on public.%I', t || '_delete', t);
  end loop;
end $$;

-- profiles: read own row (admins read all); only admins change roles
create policy profiles_select on public.profiles for select to authenticated
  using (id = auth.uid() or public.current_app_role() = 'admin');
create policy profiles_update on public.profiles for update to authenticated
  using (public.current_app_role() = 'admin') with check (public.current_app_role() = 'admin');

-- company_settings: everyone signed-in reads (letterheads need it); admin writes
create policy company_settings_select on public.company_settings for select to authenticated using (true);
create policy company_settings_update on public.company_settings for update to authenticated
  using (public.current_app_role() = 'admin') with check (public.current_app_role() = 'admin');

-- developers: all roles read (letter validation); admin writes
create policy developers_select on public.developers for select to authenticated using (true);
create policy developers_insert on public.developers for insert to authenticated with check (public.current_app_role() = 'admin');
create policy developers_update on public.developers for update to authenticated
  using (public.current_app_role() = 'admin') with check (public.current_app_role() = 'admin');
create policy developers_delete on public.developers for delete to authenticated using (public.current_app_role() = 'admin');

-- agents: all roles read; admin writes
create policy agents_select on public.agents for select to authenticated using (true);
create policy agents_insert on public.agents for insert to authenticated with check (public.current_app_role() = 'admin');
create policy agents_update on public.agents for update to authenticated
  using (public.current_app_role() = 'admin') with check (public.current_app_role() = 'admin');
create policy agents_delete on public.agents for delete to authenticated using (public.current_app_role() = 'admin');

-- clients: all roles read/create/edit; admin deletes
create policy clients_select on public.clients for select to authenticated using (true);
create policy clients_insert on public.clients for insert to authenticated with check (true);
create policy clients_update on public.clients for update to authenticated using (true) with check (true);
create policy clients_delete on public.clients for delete to authenticated using (public.current_app_role() = 'admin');

-- letters: admin/accountant see all, agents see their own; anyone creates their own
create policy letters_select on public.letters for select to authenticated
  using (public.current_app_role() in ('admin','accountant') or created_by = auth.uid());
create policy letters_insert on public.letters for insert to authenticated with check (created_by = auth.uid());
create policy letters_update on public.letters for update to authenticated
  using (public.current_app_role() = 'admin') with check (public.current_app_role() = 'admin');
create policy letters_delete on public.letters for delete to authenticated using (public.current_app_role() = 'admin');

-- finance_documents + deals: admin & accountant full access; agents read their own deals
create policy finance_documents_select on public.finance_documents for select to authenticated
  using (public.current_app_role() in ('admin','accountant'));
create policy finance_documents_insert on public.finance_documents for insert to authenticated
  with check (public.current_app_role() in ('admin','accountant'));
create policy finance_documents_update on public.finance_documents for update to authenticated
  using (public.current_app_role() in ('admin','accountant')) with check (public.current_app_role() in ('admin','accountant'));
create policy finance_documents_delete on public.finance_documents for delete to authenticated
  using (public.current_app_role() = 'admin');

create policy deals_select on public.deals for select to authenticated
  using (public.current_app_role() in ('admin','accountant')
         or agent_id in (select id from public.agents where user_id = auth.uid()));
create policy deals_insert on public.deals for insert to authenticated
  with check (public.current_app_role() in ('admin','accountant'));
create policy deals_update on public.deals for update to authenticated
  using (public.current_app_role() in ('admin','accountant')) with check (public.current_app_role() in ('admin','accountant'));
create policy deals_delete on public.deals for delete to authenticated using (public.current_app_role() = 'admin');

-- ---------------------------------------------------------------------
-- Storage: private `agreements` bucket (developer agreement + NOC PDFs)
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('agreements', 'agreements', false, 20971520, array['application/pdf'])
on conflict (id) do update set public = false, file_size_limit = 20971520, allowed_mime_types = array['application/pdf'];

drop policy if exists agreements_read   on storage.objects;
drop policy if exists agreements_insert on storage.objects;
drop policy if exists agreements_update on storage.objects;
drop policy if exists agreements_delete on storage.objects;

create policy agreements_read on storage.objects for select to authenticated
  using (bucket_id = 'agreements' and public.current_app_role() in ('admin','accountant','agent'));
create policy agreements_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'agreements' and public.current_app_role() = 'admin');
create policy agreements_update on storage.objects for update to authenticated
  using (bucket_id = 'agreements' and public.current_app_role() = 'admin');
create policy agreements_delete on storage.objects for delete to authenticated
  using (bucket_id = 'agreements' and public.current_app_role() = 'admin');

-- =====================================================================
-- Permissions (also available as supabase/migrations/20261116000000_permissions.sql)
-- =====================================================================
-- =====================================================================
-- Granular per-user permissions (Team & Permissions management)
-- Idempotent: safe to run on a database that already has the column.
-- Shape of profiles.permissions:
--   { "modules": {developers,agents,deals,letters,finance: bool},
--     "finance_docs": {rental_contract,receipt,tax_invoice,payment_voucher,other: bool},
--     "can_create_finance": bool, "scope": "own" | "all" }
-- =====================================================================

alter table public.profiles add column if not exists permissions jsonb not null default '{}'::jsonb;
alter table public.clients  add column if not exists created_by uuid references auth.users(id) on delete set null default auth.uid();

-- Backfill users that have no permissions yet, from their role preset
update public.profiles set permissions = case role
  when 'agent' then '{"modules":{"developers":true,"agents":false,"deals":true,"letters":true,"finance":true},"finance_docs":{"rental_contract":true,"receipt":true,"tax_invoice":false,"payment_voucher":false,"other":false},"can_create_finance":true,"scope":"own"}'::jsonb
  else '{"modules":{"developers":true,"agents":true,"deals":true,"letters":true,"finance":true},"finance_docs":{"rental_contract":true,"receipt":true,"tax_invoice":true,"payment_voucher":true,"other":true},"can_create_finance":true,"scope":"all"}'::jsonb
end
where permissions is null or permissions = '{}'::jsonb;

-- New sign-ups start with the Agent preset
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, permissions)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
    '{"modules":{"developers":true,"agents":false,"deals":true,"letters":true,"finance":true},"finance_docs":{"rental_contract":true,"receipt":true,"tax_invoice":false,"payment_voucher":false,"other":false},"can_create_finance":true,"scope":"own"}'::jsonb
  )
  on conflict (id) do nothing;
  return new;
end $$;

-- ---------------------------------------------------------------------
-- Permission helpers (admins always pass)
-- ---------------------------------------------------------------------
create or replace function public.has_module(m text)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(public.current_app_role() = 'admin', false)
      or coalesce((select (permissions -> 'modules' ->> m)::boolean from public.profiles where id = auth.uid()), false)
$$;

create or replace function public.has_doc(t text)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(public.current_app_role() = 'admin', false)
      or coalesce((select (permissions -> 'finance_docs' ->> t)::boolean from public.profiles where id = auth.uid()), false)
$$;

create or replace function public.can_create_finance()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(public.current_app_role() = 'admin', false)
      or coalesce((select (permissions ->> 'can_create_finance')::boolean from public.profiles where id = auth.uid()), false)
$$;

create or replace function public.scope_all()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(public.current_app_role() = 'admin', false)
      or coalesce((select permissions ->> 'scope' from public.profiles where id = auth.uid()) = 'all', false)
$$;

create or replace function public.my_agent_id()
returns uuid language sql stable security definer set search_path = public as $$
  select id from public.agents where user_id = auth.uid() limit 1
$$;

grant execute on function public.has_module(text), public.has_doc(text), public.can_create_finance(),
  public.scope_all(), public.my_agent_id() to authenticated;

-- ---------------------------------------------------------------------
-- Policies that honour permissions + scope
-- ---------------------------------------------------------------------
do $$
declare t text;
begin
  for t in select unnest(array['developers','agents','clients','letters','finance_documents','deals']) loop
    execute format('drop policy if exists %I on public.%I', t || '_select', t);
    execute format('drop policy if exists %I on public.%I', t || '_insert', t);
    execute format('drop policy if exists %I on public.%I', t || '_update', t);
    execute format('drop policy if exists %I on public.%I', t || '_delete', t);
  end loop;
end $$;

-- developers / agents: reference data used by letters, deals and documents
create policy developers_select on public.developers for select to authenticated
  using (public.has_module('developers') or public.has_module('letters') or public.has_module('finance') or public.has_module('deals'));
create policy developers_insert on public.developers for insert to authenticated with check (public.current_app_role() = 'admin');
create policy developers_update on public.developers for update to authenticated
  using (public.current_app_role() = 'admin') with check (public.current_app_role() = 'admin');
create policy developers_delete on public.developers for delete to authenticated using (public.current_app_role() = 'admin');

create policy agents_select on public.agents for select to authenticated
  using (public.has_module('agents') or public.has_module('letters') or public.has_module('finance') or public.has_module('deals') or user_id = auth.uid());
create policy agents_insert on public.agents for insert to authenticated with check (public.current_app_role() = 'admin');
create policy agents_update on public.agents for update to authenticated
  using (public.current_app_role() = 'admin') with check (public.current_app_role() = 'admin');
create policy agents_delete on public.agents for delete to authenticated using (public.current_app_role() = 'admin');

-- clients
create policy clients_select on public.clients for select to authenticated using (
  public.current_app_role() = 'admin'
  or ((public.has_module('deals') or public.has_module('letters') or public.has_module('finance'))
      and (public.scope_all() or created_by = auth.uid()
           or id in (select client_id from public.deals where agent_id = public.my_agent_id())))
);
create policy clients_insert on public.clients for insert to authenticated
  with check (public.has_module('deals') or public.has_module('letters') or public.has_module('finance'));
create policy clients_update on public.clients for update to authenticated using (
  public.current_app_role() = 'admin'
  or ((public.has_module('deals') or public.has_module('letters') or public.has_module('finance'))
      and (public.scope_all() or created_by = auth.uid()))
) with check (true);
create policy clients_delete on public.clients for delete to authenticated using (public.current_app_role() = 'admin');

-- letters
create policy letters_select on public.letters for select to authenticated
  using (public.has_module('letters') and (public.scope_all() or created_by = auth.uid()));
create policy letters_insert on public.letters for insert to authenticated
  with check (public.has_module('letters') and created_by = auth.uid());
create policy letters_update on public.letters for update to authenticated
  using (public.current_app_role() = 'admin') with check (public.current_app_role() = 'admin');
create policy letters_delete on public.letters for delete to authenticated using (public.current_app_role() = 'admin');

-- finance_documents: module + per-document-type + scope.
-- Deals & Marketing doc types (deal_proposal, unit_handover, marketing_approval) are gated by
-- modules.deals instead, since they have no amount/VAT and aren't part of the finance_docs toggles.
create policy finance_documents_select on public.finance_documents for select to authenticated
  using (
    (doc_type in ('deal_proposal', 'unit_handover', 'marketing_approval')
      and public.has_module('deals')
      and (public.scope_all() or created_by = auth.uid()))
    or (doc_type not in ('deal_proposal', 'unit_handover', 'marketing_approval')
      and public.has_module('finance')
      and public.has_doc(doc_type)
      and (public.scope_all() or created_by = auth.uid()))
  );
create policy finance_documents_insert on public.finance_documents for insert to authenticated
  with check (
    (doc_type in ('deal_proposal', 'unit_handover', 'marketing_approval')
      and public.has_module('deals')
      and created_by = auth.uid())
    or (doc_type not in ('deal_proposal', 'unit_handover', 'marketing_approval')
      and public.has_module('finance')
      and public.can_create_finance()
      and public.has_doc(doc_type)
      and created_by = auth.uid())
  );
create policy finance_documents_update on public.finance_documents for update to authenticated
  using (
    (doc_type in ('deal_proposal', 'unit_handover', 'marketing_approval')
      and public.has_module('deals')
      and (public.scope_all() or created_by = auth.uid()))
    or (doc_type not in ('deal_proposal', 'unit_handover', 'marketing_approval')
      and public.has_module('finance')
      and public.can_create_finance()
      and public.has_doc(doc_type)
      and (public.scope_all() or created_by = auth.uid()))
  )
  with check (
    (doc_type in ('deal_proposal', 'unit_handover', 'marketing_approval')
      and public.has_module('deals'))
    or (doc_type not in ('deal_proposal', 'unit_handover', 'marketing_approval')
      and public.has_module('finance')
      and public.can_create_finance()
      and public.has_doc(doc_type))
  );
create policy finance_documents_delete on public.finance_documents for delete to authenticated
  using (public.current_app_role() = 'admin');

-- deals (commission pipeline): readable per scope; written by admins and accountants
create policy deals_select on public.deals for select to authenticated
  using (public.has_module('deals') and (public.scope_all() or agent_id = public.my_agent_id()));
create policy deals_insert on public.deals for insert to authenticated
  with check (public.current_app_role() = 'admin'
              or (public.current_app_role() = 'accountant' and public.has_module('deals') and public.can_create_finance()));
create policy deals_update on public.deals for update to authenticated
  using (public.current_app_role() = 'admin'
         or (public.current_app_role() = 'accountant' and public.has_module('deals') and public.can_create_finance()))
  with check (public.current_app_role() = 'admin'
         or (public.current_app_role() = 'accountant' and public.has_module('deals') and public.can_create_finance()));
create policy deals_delete on public.deals for delete to authenticated using (public.current_app_role() = 'admin');

-- Agreement PDFs follow the Developers module
drop policy if exists agreements_read on storage.objects;
create policy agreements_read on storage.objects for select to authenticated
  using (bucket_id = 'agreements' and public.has_module('developers'));

-- ---------------------------------------------------------------------
-- Super Admin role: is_admin_or_above() covers admin + super_admin everywhere below (admin
-- keeps every ability it already had); is_super_admin() gates the handful of owner-only
-- actions enforced in src/app/(app)/settings/actions.ts (company settings, brand/stamp
-- assets, managing admin-tier accounts, document sign-off).
-- ---------------------------------------------------------------------
create or replace function public.is_admin_or_above()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(public.current_app_role() in ('admin', 'super_admin'), false)
$$;

create or replace function public.is_super_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(public.current_app_role() = 'super_admin', false)
$$;

grant execute on function public.is_admin_or_above(), public.is_super_admin() to authenticated;

create or replace function public.has_module(m text)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_admin_or_above()
      or coalesce((select (permissions -> 'modules' ->> m)::boolean from public.profiles where id = auth.uid()), false)
$$;

create or replace function public.has_doc(t text)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_admin_or_above()
      or coalesce((select (permissions -> 'finance_docs' ->> t)::boolean from public.profiles where id = auth.uid()), false)
$$;

create or replace function public.can_create_finance()
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_admin_or_above()
      or coalesce((select (permissions ->> 'can_create_finance')::boolean from public.profiles where id = auth.uid()), false)
$$;

create or replace function public.scope_all()
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_admin_or_above()
      or coalesce((select permissions ->> 'scope' from public.profiles where id = auth.uid()) = 'all', false)
$$;

drop policy if exists profiles_select on public.profiles;
drop policy if exists profiles_update on public.profiles;
create policy profiles_select on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_admin_or_above());
create policy profiles_update on public.profiles for update to authenticated
  using (public.is_admin_or_above()) with check (public.is_admin_or_above());

drop policy if exists developers_insert on public.developers;
drop policy if exists developers_update on public.developers;
drop policy if exists developers_delete on public.developers;
create policy developers_insert on public.developers for insert to authenticated with check (public.is_admin_or_above());
create policy developers_update on public.developers for update to authenticated
  using (public.is_admin_or_above()) with check (public.is_admin_or_above());
create policy developers_delete on public.developers for delete to authenticated using (public.is_admin_or_above());

drop policy if exists agents_insert on public.agents;
drop policy if exists agents_update on public.agents;
drop policy if exists agents_delete on public.agents;
create policy agents_insert on public.agents for insert to authenticated with check (public.is_admin_or_above());
create policy agents_update on public.agents for update to authenticated
  using (public.is_admin_or_above()) with check (public.is_admin_or_above());
create policy agents_delete on public.agents for delete to authenticated using (public.is_admin_or_above());

drop policy if exists clients_select on public.clients;
drop policy if exists clients_update on public.clients;
drop policy if exists clients_delete on public.clients;
create policy clients_select on public.clients for select to authenticated using (
  public.is_admin_or_above()
  or ((public.has_module('deals') or public.has_module('letters') or public.has_module('finance'))
      and (public.scope_all() or created_by = auth.uid()
           or id in (select client_id from public.deals where agent_id = public.my_agent_id())))
);
create policy clients_update on public.clients for update to authenticated using (
  public.is_admin_or_above()
  or ((public.has_module('deals') or public.has_module('letters') or public.has_module('finance'))
      and (public.scope_all() or created_by = auth.uid()))
) with check (true);
create policy clients_delete on public.clients for delete to authenticated using (public.is_admin_or_above());

drop policy if exists letters_update on public.letters;
drop policy if exists letters_delete on public.letters;
create policy letters_update on public.letters for update to authenticated
  using (public.is_admin_or_above()) with check (public.is_admin_or_above());
create policy letters_delete on public.letters for delete to authenticated using (public.is_admin_or_above());

drop policy if exists finance_documents_delete on public.finance_documents;
create policy finance_documents_delete on public.finance_documents for delete to authenticated
  using (public.is_admin_or_above());

drop policy if exists deals_insert on public.deals;
drop policy if exists deals_update on public.deals;
drop policy if exists deals_delete on public.deals;
create policy deals_insert on public.deals for insert to authenticated
  with check (public.is_admin_or_above()
              or (public.current_app_role() = 'accountant' and public.has_module('deals') and public.can_create_finance()));
create policy deals_update on public.deals for update to authenticated
  using (public.is_admin_or_above()
         or (public.current_app_role() = 'accountant' and public.has_module('deals') and public.can_create_finance()))
  with check (public.is_admin_or_above()
         or (public.current_app_role() = 'accountant' and public.has_module('deals') and public.can_create_finance()));
create policy deals_delete on public.deals for delete to authenticated using (public.is_admin_or_above());

-- Agreement PDFs: upload/replace/delete stays admin-tier (read already follows has_module('developers')).
drop policy if exists agreements_write on storage.objects;
drop policy if exists agreements_update on storage.objects;
drop policy if exists agreements_delete on storage.objects;
create policy agreements_write on storage.objects for insert to authenticated
  with check (bucket_id = 'agreements' and public.is_admin_or_above());
create policy agreements_update on storage.objects for update to authenticated
  using (bucket_id = 'agreements' and public.is_admin_or_above());
create policy agreements_delete on storage.objects for delete to authenticated
  using (bucket_id = 'agreements' and public.is_admin_or_above());
