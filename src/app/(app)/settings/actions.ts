"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth";
import {
  ROLES,
  normalizePermissions,
  presetFor,
  resolvePermissions,
  type Permissions,
  type Role,
} from "@/lib/permissions";
import { createAdminClient } from "@/lib/supabase/admin";

export type ActionResult = { ok: true; message?: string } | { ok: false; error: string };

const fail = (error: string): ActionResult => ({ ok: false, error });
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Every action re-verifies the caller from their session cookie — never trust the client. */
async function adminCaller() {
  const session = await getSession();
  if (!session.configured || session.role !== "admin" || !session.userId) return null;
  return session;
}

function cleanPerms(role: Role, raw: unknown): Permissions {
  return role === "admin" ? resolvePermissions("admin", null) : normalizePermissions(raw, presetFor(role));
}

export interface CreateUserInput {
  fullName: string;
  email: string;
  password: string;
  role: Role;
  agentId?: string | null;
  /** Create a fresh agents row for this user (alternative to linking an existing one). */
  createAgentRow?: boolean;
  permissions: Permissions;
}

export async function createDashboardUser(input: CreateUserInput): Promise<ActionResult> {
  const caller = await adminCaller();
  if (!caller) return fail("Only admins can create users.");

  const fullName = (input.fullName ?? "").trim();
  const email = (input.email ?? "").trim().toLowerCase();
  if (!fullName) return fail("Full name is required.");
  if (!EMAIL.test(email)) return fail("Enter a valid email address.");
  if (typeof input.password !== "string" || input.password.length < 8) return fail("Password must be at least 8 characters.");
  if (!ROLES.includes(input.role)) return fail("Invalid role.");
  if (input.agentId && !UUID.test(input.agentId)) return fail("Invalid agent.");

  const admin = createAdminClient();

  if (input.agentId) {
    const { data: agent } = await admin.from("agents").select("id, user_id").eq("id", input.agentId).maybeSingle();
    if (!agent) return fail("The selected agent no longer exists.");
    if (agent.user_id) return fail("That agent is already linked to another user.");
  }

  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password: input.password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });
  if (createErr || !created.user) return fail(createErr?.message ?? "Could not create the user.");
  const userId = created.user.id;

  const rollback = async (msg: string) => {
    await admin.auth.admin.deleteUser(userId); // profile + links cascade / null out
    return fail(msg);
  };

  const { error: profileErr } = await admin.from("profiles").upsert({
    id: userId,
    full_name: fullName,
    role: input.role,
    permissions: cleanPerms(input.role, input.permissions),
  });
  if (profileErr) return rollback(`Could not save the profile: ${profileErr.message}`);

  if (input.agentId) {
    const { error } = await admin.from("agents").update({ user_id: userId }).eq("id", input.agentId);
    if (error) return rollback(`Could not link the agent: ${error.message}`);
  } else if (input.createAgentRow) {
    const { error } = await admin.from("agents").insert({ full_name: fullName, email, user_id: userId });
    if (error) return rollback(`Could not create the agent record: ${error.message}`);
  }

  revalidatePath("/settings");
  return { ok: true, message: `${fullName} can now sign in with ${email}.` };
}

export interface UpdateUserInput {
  userId: string;
  fullName?: string;
  role: Role;
  agentId?: string | null;
  permissions: Permissions;
}

export async function updateUserPermissions(input: UpdateUserInput): Promise<ActionResult> {
  const caller = await adminCaller();
  if (!caller) return fail("Only admins can edit users.");
  if (!UUID.test(input.userId)) return fail("Invalid user.");
  if (!ROLES.includes(input.role)) return fail("Invalid role.");
  if (input.userId === caller.userId && input.role !== "admin")
    return fail("You can't remove your own admin role — ask another admin.");
  if (input.agentId && !UUID.test(input.agentId)) return fail("Invalid agent.");

  const admin = createAdminClient();

  if (input.agentId) {
    const { data: agent } = await admin.from("agents").select("id, user_id").eq("id", input.agentId).maybeSingle();
    if (!agent) return fail("The selected agent no longer exists.");
    if (agent.user_id && agent.user_id !== input.userId) return fail("That agent is already linked to another user.");
  }

  const patch: Record<string, unknown> = { role: input.role, permissions: cleanPerms(input.role, input.permissions) };
  if (typeof input.fullName === "string" && input.fullName.trim()) patch.full_name = input.fullName.trim();
  const { error } = await admin.from("profiles").update(patch).eq("id", input.userId);
  if (error) return fail(error.message);

  // Re-link: clear any previous link for this user, then set the chosen one.
  await admin.from("agents").update({ user_id: null }).eq("user_id", input.userId);
  if (input.agentId) {
    const { error: linkErr } = await admin.from("agents").update({ user_id: input.userId }).eq("id", input.agentId);
    if (linkErr) return fail(`Permissions saved, but linking the agent failed: ${linkErr.message}`);
  }

  revalidatePath("/settings");
  return { ok: true, message: "User updated." };
}

export async function resetUserPassword(input: { userId: string; password: string }): Promise<ActionResult> {
  const caller = await adminCaller();
  if (!caller) return fail("Only admins can reset passwords.");
  if (!UUID.test(input.userId)) return fail("Invalid user.");
  if (typeof input.password !== "string" || input.password.length < 8) return fail("Password must be at least 8 characters.");
  const { error } = await createAdminClient().auth.admin.updateUserById(input.userId, { password: input.password });
  return error ? fail(error.message) : { ok: true, message: "Password updated." };
}

export async function deleteDashboardUser(input: { userId: string }): Promise<ActionResult> {
  const caller = await adminCaller();
  if (!caller) return fail("Only admins can delete users.");
  if (!UUID.test(input.userId)) return fail("Invalid user.");
  if (input.userId === caller.userId) return fail("You can't delete your own account.");
  const { error } = await createAdminClient().auth.admin.deleteUser(input.userId);
  if (error) return fail(error.message);
  revalidatePath("/settings");
  return { ok: true, message: "User deleted." };
}

export interface CompanyInput {
  company_name: string;
  trade_license: string;
  rera_orn: string;
  trn: string;
  address: string;
  phone: string;
  email: string;
  admin_alert_email: string;
}

export async function updateCompanySettings(input: CompanyInput): Promise<ActionResult> {
  const caller = await adminCaller();
  if (!caller) return fail("Only admins can change company settings.");
  const v = (s: unknown) => (typeof s === "string" ? s.trim() : "");
  const name = v(input.company_name);
  if (!name) return fail("Company name is required.");
  const trn = v(input.trn).replace(/\s/g, "");
  if (trn && !/^\d{15}$/.test(trn)) return fail("TRN must be exactly 15 digits.");
  for (const [label, val] of [["Company email", v(input.email)], ["Admin alert email", v(input.admin_alert_email)]] as const) {
    if (val && !EMAIL.test(val)) return fail(`${label} is not a valid email address.`);
  }
  const { error } = await createAdminClient()
    .from("company_settings")
    .update({
      company_name: name,
      trade_license: v(input.trade_license) || "726153",
      rera_orn: v(input.rera_orn) || null,
      trn: trn || null,
      address: v(input.address) || null,
      phone: v(input.phone) || null,
      email: v(input.email) || null,
      admin_alert_email: v(input.admin_alert_email) || null,
    })
    .eq("id", 1);
  if (error) return fail(error.message);
  revalidatePath("/settings");
  revalidatePath("/", "layout");
  return { ok: true, message: "Company settings saved." };
}
