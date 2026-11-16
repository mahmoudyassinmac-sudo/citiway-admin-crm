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

-- finance_documents: module + per-document-type + scope
create policy finance_documents_select on public.finance_documents for select to authenticated
  using (public.has_module('finance') and public.has_doc(doc_type) and (public.scope_all() or created_by = auth.uid()));
create policy finance_documents_insert on public.finance_documents for insert to authenticated
  with check (public.has_module('finance') and public.can_create_finance() and public.has_doc(doc_type) and created_by = auth.uid());
create policy finance_documents_update on public.finance_documents for update to authenticated
  using (public.has_module('finance') and public.can_create_finance() and public.has_doc(doc_type) and (public.scope_all() or created_by = auth.uid()))
  with check (public.has_module('finance') and public.can_create_finance() and public.has_doc(doc_type));
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
