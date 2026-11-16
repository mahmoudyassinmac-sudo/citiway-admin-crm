import { AgentsManager } from "@/components/agents/agents-manager";
import { getSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Agent } from "@/lib/types";

export const metadata = { title: "Agents & RERA — Citiway CRM" };

export default async function AgentsPage() {
  const session = await getSession();
  let agents: Agent[] = [];
  if (session.configured) {
    const { data } = await (await createClient()).from("agents").select("*").order("full_name");
    agents = (data ?? []) as Agent[];
  }
  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <h1 className="font-head text-2xl font-bold text-navy">Agents &amp; RERA Compliance</h1>
      <p className="mb-6 mt-1 text-sm text-slate-500">
        Broker profiles with RERA BRN tracking. BRN cards within 30 days of expiry are flagged here and on the dashboard;
        agent name and BRN auto-fill into letters and deals.
      </p>
      <AgentsManager agents={agents} canEdit={session.role === "admin" && session.configured} />
    </div>
  );
}
