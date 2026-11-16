import { NextResponse, type NextRequest } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  EXPIRY_WARNING_DAYS,
  addDays,
  daysLeft,
  todayInDubai,
  type Developer,
} from "@/lib/developers";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const SIGNED_URL_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days — long enough for an email link

function authorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false; // fail closed when not configured
  const header = request.headers.get("authorization") ?? "";
  const match = /^Bearer\s+(.+)$/i.exec(header);
  if (!match) return false;
  const a = Buffer.from(match[1]);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Daily expiry digest for n8n.
 *   Authorization: Bearer <CRON_SECRET>
 * Returns every developer whose agreement ends within 30 days (or already ended),
 * with a signed PDF link, and stamps `last_reminded_at`. Renewing an agreement
 * resets the flag and moves end_date out, so the developer drops out of this list.
 *
 * GET and POST are both accepted (n8n's HTTP node can use either).
 * Add `?dry_run=1` to read the payload without touching last_reminded_at.
 */
async function handle(request: NextRequest) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const dryRun = request.nextUrl.searchParams.get("dry_run") === "1";
  const today = todayInDubai();
  const cutoff = addDays(today, EXPIRY_WARNING_DAYS);

  let supabase;
  try {
    supabase = createAdminClient();
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Server misconfigured" },
      { status: 500 },
    );
  }

  const { data, error } = await supabase
    .from("developers")
    .select("*")
    .lte("end_date", cutoff)
    .order("end_date", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = (data ?? []) as Developer[];

  const expiring_developers = await Promise.all(
    rows.map(async (d) => {
      const sign = async (path: string | null) => {
        if (!path) return null;
        const { data: signed } = await supabase.storage
          .from("agreements")
          .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
        return signed?.signedUrl ?? null;
      };
      const left = daysLeft(d.end_date, today);
      return {
        id: d.id,
        name: d.developer_name,
        end_date: d.end_date,
        days_left: left,
        status: left < 0 ? "expired" : "expiring",
        has_noc: d.has_noc,
        agreement_pdf_url: await sign(d.agreement_pdf_url),
        noc_pdf_url: await sign(d.noc_pdf_url),
        last_reminded_at: d.last_reminded_at,
      };
    }),
  );

  if (!dryRun && rows.length > 0) {
    const { error: updateError } = await supabase
      .from("developers")
      .update({ last_reminded_at: new Date().toISOString() })
      .in(
        "id",
        rows.map((r) => r.id),
      );
    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }
  }

  const { data: settings } = await supabase
    .from("company_settings")
    .select("admin_alert_email, company_name")
    .eq("id", 1)
    .maybeSingle();

  return NextResponse.json({
    count: expiring_developers.length,
    generated_at: new Date().toISOString(),
    today,
    window_days: EXPIRY_WARNING_DAYS,
    dry_run: dryRun,
    admin_alert_email: settings?.admin_alert_email ?? null,
    company_name: settings?.company_name ?? null,
    expiring_developers,
  });
}

export const GET = handle;
export const POST = handle;
