import "server-only";
import { createClient } from "@/lib/supabase/server";
import { supabaseConfigured } from "@/lib/auth";

export interface CompanySettings {
  company_name: string;
  trade_license: string;
  rera_orn: string | null;
  trn: string | null;
  admin_alert_email: string | null;
  /** Next letter reference (CW-LTR-YYYY-XXXX), straight from the DB counter. */
  nextRef: string | null;
}

export async function getCompany(): Promise<CompanySettings> {
  const fallback: CompanySettings = {
    company_name: "Citiway Real Estate",
    trade_license: "726153",
    rera_orn: null,
    trn: null,
    admin_alert_email: null,
    nextRef: null,
  };
  if (!supabaseConfigured()) return fallback;
  const supabase = await createClient();
  const [{ data }, { data: ref }] = await Promise.all([
    supabase
      .from("company_settings")
      .select("company_name, trade_license, rera_orn, trn, admin_alert_email")
      .eq("id", 1)
      .maybeSingle(),
    supabase.rpc("peek_letter_ref"),
  ]);
  return { ...fallback, ...(data ?? {}), nextRef: (ref as string | null) ?? null };
}
