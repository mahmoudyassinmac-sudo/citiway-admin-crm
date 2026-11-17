-- Step 2 of 2 for the Super Admin role. Run this ONLY AFTER
-- 20261117030000_add_super_admin_enum.sql has been run and committed on its own.
--
-- Super Admin is a strict superset of Admin everywhere in RLS (is_admin_or_above() covers both),
-- plus a handful of owner-only actions gated at the application layer in src/app/(app)/settings/
-- actions.ts (company settings, brand/stamp assets, managing admin-tier accounts, document
-- sign-off) using a separate is_super_admin() check.

create or replace function public.is_admin_or_above()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(public.current_app_role() in ('admin', 'super_admin'), false)
$$;

create or replace function public.is_super_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(public.current_app_role() = 'super_admin', false)
$$;

grant execute on function public.is_admin_or_above(), public.is_super_admin() to authenticated;

-- Permission helpers: admin-tier (admin + super_admin) always pass.
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

-- profiles
drop policy if exists profiles_select on public.profiles;
drop policy if exists profiles_update on public.profiles;
create policy profiles_select on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_admin_or_above());
create policy profiles_update on public.profiles for update to authenticated
  using (public.is_admin_or_above()) with check (public.is_admin_or_above());

-- developers / agents / clients / letters / finance_documents / deals: widen every direct
-- 'admin'-only check to admin-tier (admin + super_admin).
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
