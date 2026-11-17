import { redirect } from "next/navigation";
import { AgentsManager } from "@/components/agents/agents-manager";
import { getSession, supabaseConfigured } from "@/lib/auth";
import { isAdminOrAbove } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import type { Agent } from "@/lib/types";

export const metadata = { title: "Agents & RERA — Citiway CRM" };

export default async function AgentsPage() {
  const load = async (): Promise<Agent[]> => {
    if (!supabaseConfigured()) return [];
    const { data } = await (await createClient()).from("agents").select("*").order("full_name");
    return (data ?? []) as Agent[];
  };
  const [session, agents] = await Promise.all([getSession(), load()]);
  if (!session.permissions.modules.agents) redirect("/");
  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <h1 className="font-head text-2xl font-bold text-navy">Agents &amp; RERA Compliance</h1>
      <p className="mb-6 mt-1 text-sm text-slate-500">
        Broker profiles with RERA BRN tracking. BRN cards within 30 days of expiry are flagged here and on the dashboard;
        agent name and BRN auto-fill into letters and deals.
      </p>
      <AgentsManager agents={agents} canEdit={isAdminOrAbove(session.role) && session.configured} />
    </div>
  );
}
