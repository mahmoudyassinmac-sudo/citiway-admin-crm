import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type AppRole = "admin" | "accountant" | "agent";

export interface Session {
  configured: boolean;
  userId: string | null;
  email: string | null;
  fullName: string | null;
  role: AppRole;
}

export function supabaseConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}

/**
 * Current user + role. When Supabase isn't configured (local dev only — the proxy
 * blocks this in production) an "admin" preview session is returned so the UI can
 * render the setup notice instead of crashing.
 */
export async function getSession(): Promise<Session> {
  if (!supabaseConfigured()) {
    // Local preview only (the proxy blocks unconfigured production): admin so every tool can be inspected.
    return { configured: false, userId: null, email: null, fullName: null, role: "admin" };
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, role")
    .eq("id", user.id)
    .maybeSingle();

  return {
    configured: true,
    userId: user.id,
    email: user.email ?? null,
    fullName: profile?.full_name ?? null,
    role: (profile?.role as AppRole | undefined) ?? "agent",
  };
}
