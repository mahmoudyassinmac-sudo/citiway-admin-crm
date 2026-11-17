-- Step 1 of 2 for the Super Admin role. Adding a value to a Postgres enum must be committed
-- before that value can be used in a query — run THIS FILE ALONE FIRST (its own "Run" in the
-- SQL editor), then run 20261117040000_super_admin_permissions.sql separately afterwards.
alter type public.app_role add value if not exists 'super_admin';
