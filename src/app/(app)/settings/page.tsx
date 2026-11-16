import Link from "next/link";
import { redirect } from "next/navigation";
import { CompanyForm } from "@/components/settings/company-form";
import { UsersManager, type AgentOption, type UserRow } from "@/components/settings/users-manager";
import { getSession } from "@/lib/auth";
import { resolvePermissions, type Role } from "@/lib/permissions";
import { createAdminClient } from "@/lib/supabase/admin";

export const metadata = { title: "Settings — Citiway CRM" };

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const session = await getSession();
  if (session.role !== "admin") redirect("/");
  const tab = (await searchParams).tab === "company" ? "company" : "users";

  const tabCls = (on: boolean) =>
    `rounded-lg px-4 py-2 text-sm font-semibold ${on ? "bg-navy text-white" : "bg-white text-navy ring-1 ring-slate-200 hover:ring-brand"}`;

  let body: React.ReactNode;
  if (!session.configured || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    body = (
      <p className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        Settings need Supabase and <code>SUPABASE_SERVICE_ROLE_KEY</code> to be configured.
      </p>
    );
  } else {
    const admin = createAdminClient();
    if (tab === "company") {
      const { data } = await admin.from("company_settings").select("*").eq("id", 1).maybeSingle();
      body = (
        <CompanyForm
          initial={{
            company_name: data?.company_name ?? "",
            trade_license: data?.trade_license ?? "",
            rera_orn: data?.rera_orn ?? "",
            trn: data?.trn ?? "",
            address: data?.address ?? "",
            phone: data?.phone ?? "",
            email: data?.email ?? "",
            admin_alert_email: data?.admin_alert_email ?? "",
          }}
        />
      );
    } else {
      const [profiles, agentsRes, authUsers] = await Promise.all([
        admin.from("profiles").select("id, full_name, role, permissions").order("created_at"),
        admin.from("agents").select("id, full_name, rera_brn, user_id").order("full_name"),
        admin.auth.admin.listUsers({ perPage: 1000 }),
      ]);
      const agents = (agentsRes.data ?? []) as AgentOption[];
      const authById = new Map((authUsers.data?.users ?? []).map((u) => [u.id, u]));
      const users: UserRow[] = (profiles.data ?? []).map((p) => {
        const role = p.role as Role;
        const au = authById.get(p.id);
        return {
          id: p.id,
          fullName: p.full_name,
          email: au?.email ?? null,
          role,
          permissions: resolvePermissions(role, p.permissions),
          lastSignIn: au?.last_sign_in_at ?? null,
          agentId: agents.find((a) => a.user_id === p.id)?.id ?? null,
        };
      });
      body = <UsersManager users={users} agents={agents} currentUserId={session.userId} />;
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <h1 className="font-head text-2xl font-bold text-navy">Settings</h1>
      <p className="mb-5 mt-1 text-sm text-slate-500">Manage your team, what each person can see and do, and your company details.</p>
      <div className="mb-5 flex gap-2">
        <Link href="/settings" className={tabCls(tab === "users")}>Users &amp; Permissions</Link>
        <Link href="/settings?tab=company" className={tabCls(tab === "company")}>Company Settings</Link>
      </div>
      {body}
    </div>
  );
}
