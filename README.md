# Citiway Real Estate — Back-Office CRM

Next.js (App Router) · TypeScript · Tailwind CSS · Supabase · Vercel. See `CLAUDE.md` for the full spec.

## Setup
1. `npm install`
2. Create a Supabase project, run `supabase/schema.sql` in the SQL editor.
3. `cp .env.example .env.local` and fill in the keys.
4. Create a user in Supabase Auth, then promote it:
   `update public.profiles set role = 'admin' where id = '<user uuid>';`
5. `npm run dev`

## Daily developer-expiry alert (n8n)
`GET|POST /api/cron/developers-expiry` with header `Authorization: Bearer $CRON_SECRET`.
Returns `{ count, expiring_developers[] }` (name, end_date, days_left, has_noc, signed PDF URLs) and
stamps `last_reminded_at`. Use `?dry_run=1` to inspect without stamping. Renewing an agreement in
the UI moves `end_date` out and clears `last_reminded_at`, so the reminders stop.

## Document tools
`/letters` (letterhead) and `/finance/<tool>` host the original single-file tools, ported to
client components (`src/components/documents/*`, marked `@ts-nocheck` until each is typed).
