-- PDF archive + Super Admin sign-off (stamp & signature) for every issued document.
-- Run AFTER the two super_admin migrations (it uses public.is_super_admin()).
-- Safe to re-run.

-- 1) Archive + sign-off columns on both document tables ---------------------------------
do $$
declare t text;
begin
  for t in select unnest(array['letters','finance_documents']) loop
    execute format($f$
      alter table public.%1$I
        add column if not exists pdf_path              text,
        add column if not exists pdf_uploaded_at       timestamptz,
        add column if not exists signed_pdf_path       text,
        add column if not exists stamp_anchor          jsonb,
        add column if not exists signoff_status        text not null default 'none',
        add column if not exists signoff_requested_by  uuid references auth.users(id) on delete set null,
        add column if not exists signoff_requested_at  timestamptz,
        add column if not exists signed_by             uuid references auth.users(id) on delete set null,
        add column if not exists signed_at             timestamptz,
        add column if not exists signoff_note          text
    $f$, t);
    begin
      execute format('alter table public.%1$I add constraint %1$s_signoff_status_chk check (signoff_status in (''none'',''pending'',''approved'',''rejected''))', t);
    exception when duplicate_object then null;
    end;
    execute format('create index if not exists %1$s_signoff_pending_idx on public.%1$I (signoff_requested_at) where signoff_status = ''pending''', t);
  end loop;
end $$;

-- 2) Stamp / signature images uploaded by the Super Admin (paths inside the private "brand" bucket)
alter table public.company_settings
  add column if not exists stamp_image_path     text,
  add column if not exists signature_image_path text;

-- 3) Private buckets. No storage policies on purpose: every read/write goes through the
--    server (service role) or a short-lived signed upload/download URL it issues.
insert into storage.buckets (id, name, public)
values ('documents', 'documents', false), ('brand', 'brand', false)
on conflict (id) do nothing;

-- 4) Nobody but the server or a Super Admin can touch the archive / sign-off columns.
--    (Agents may update their own finance rows on re-issue — this stops them forging an approval.)
create or replace function public.guard_signoff_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(auth.jwt() ->> 'role', '') = 'service_role' or public.is_super_admin() then
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.pdf_path := null;             new.pdf_uploaded_at := null;
    new.signed_pdf_path := null;      new.stamp_anchor := null;
    new.signoff_status := 'none';     new.signoff_requested_by := null;
    new.signoff_requested_at := null; new.signed_by := null;
    new.signed_at := null;            new.signoff_note := null;
  else
    new.pdf_path := old.pdf_path;                   new.pdf_uploaded_at := old.pdf_uploaded_at;
    new.signed_pdf_path := old.signed_pdf_path;     new.stamp_anchor := old.stamp_anchor;
    new.signoff_status := old.signoff_status;       new.signoff_requested_by := old.signoff_requested_by;
    new.signoff_requested_at := old.signoff_requested_at; new.signed_by := old.signed_by;
    new.signed_at := old.signed_at;                 new.signoff_note := old.signoff_note;
  end if;
  return new;
end $$;

drop trigger if exists letters_guard_signoff on public.letters;
create trigger letters_guard_signoff before insert or update on public.letters
  for each row execute function public.guard_signoff_columns();

drop trigger if exists finance_documents_guard_signoff on public.finance_documents;
create trigger finance_documents_guard_signoff before insert or update on public.finance_documents
  for each row execute function public.guard_signoff_columns();
