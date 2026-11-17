import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  fullAccess,
  isAdminOrAbove,
  resolvePermissions,
  type ModuleKey,
  type Permissions,
  type Role,
} from "@/lib/permissions";

export type AppRole = Role;

export interface Session {
  configured: boolean;
  userId: string | null;
  email: string | null;
  fullName: string | null;
  role: AppRole;
  /** Effective permissions (full access for admins). */
  permissions: Permissions;
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
/** Memoised per request: layout and page share one auth + profile lookup. */
export const getSession = cache(async (): Promise<Session> => {
  if (!supabaseConfigured()) {
    // Local preview only (the proxy blocks unconfigured production): super_admin so every tool can be inspected.
    return { configured: false, userId: null, email: null, fullName: null, role: "super_admin", permissions: fullAccess() };
  }
  const supabase = await createClient();
  // getClaims() verifies the JWT locally (cached JWKS) — no Auth-server round trip per navigation.
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, role, permissions")
    .eq("id", claims.sub)
    .maybeSingle();

  const role = (profile?.role as AppRole | undefined) ?? "agent";
  return {
    configured: true,
    userId: claims.sub,
    email: (claims.email as string | undefined) ?? null,
    fullName: profile?.full_name ?? null,
    role,
    permissions: resolvePermissions(role, profile?.permissions),
  };
});

/** Redirects home unless the user may open this module (admins always may). */
export async function requireModule(key: ModuleKey): Promise<Session> {
  const session = await getSession();
  if (!session.permissions.modules[key]) redirect("/");
  return session;
}

/** Admin-tier pages / actions (admin or super_admin). */
export async function requireAdmin(): Promise<Session> {
  const session = await getSession();
  if (!isAdminOrAbove(session.role)) redirect("/");
  return session;
}

/** Super-admin-only pages / actions: company settings, brand assets, admin-tier accounts, sign-off. */
export async function requireSuperAdmin(): Promise<Session> {
  const session = await getSession();
  if (session.role !== "super_admin") redirect("/");
  return session;
}
