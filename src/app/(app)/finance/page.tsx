import Link from "next/link";
import { redirect } from "next/navigation";
import { FileSignature, FileText, Receipt } from "lucide-react";
import { getSession } from "@/lib/auth";
import { toolsFor } from "@/lib/documents";
import { createClient } from "@/lib/supabase/server";
import { PipelineBoard } from "@/components/deals/pipeline-board";
import { getLookups } from "@/lib/lookups";
import { DEAL_SELECT, type Deal } from "@/lib/types";

export const metadata = { title: "Finance & Documents — Citiway CRM" };

export default async function FinancePage() {
  const session = await getSession();
  if (!session.permissions.modules.finance) redirect("/");
  // Only the document types this user is allowed to create (e.g. never payment vouchers for an agent without it).
  const tools = toolsFor(session.permissions);

  const loadDeals = async (): Promise<Deal[]> => {
    if (!session.configured || !session.permissions.modules.deals) return [];
    const { data } = await (await createClient())
      .from("deals")
      .select(DEAL_SELECT)
      .order("created_at", { ascending: false });
    return (data ?? []) as Deal[];
  };
  const [lookups, deals] = await Promise.all([getLookups(), loadDeals()]);

  const groups = ["Finance", "Deals & Marketing"] as const;

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <h1 className="font-head text-2xl font-bold text-navy">Finance &amp; Documents</h1>
      <p className="mb-8 mt-1 text-sm text-slate-500">
        Contracts, 5% VAT tax invoices, receipts and the commission collection pipeline.
      </p>

      {session.permissions.modules.deals && (
        <section className="mb-10">
          <h2 className="mb-3 font-head text-sm font-bold uppercase tracking-wider text-navy">
            Commission collection pipeline
          </h2>
          <PipelineBoard deals={deals} lookups={lookups} canEdit={session.configured && session.role !== "agent"} />
        </section>
      )}

      {groups.map((g) => {
        const list = tools.filter((t) => t.group === g);
        if (!list.length) return null;
        return (
          <section key={g} className="mb-8">
            <h2 className="mb-3 font-head text-sm font-bold uppercase tracking-wider text-navy">{g}</h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {list.map((t) => {
                const Icon = t.slug.includes("receipt") ? Receipt : t.slug.includes("contract") ? FileSignature : FileText;
                return (
                  <Link
                    key={t.slug}
                    href={`/finance/${t.slug}`}
                    className="group rounded-xl glass lift p-4"
                  >
                    <Icon className="mb-3 h-5 w-5 text-brand" />
                    <div className="font-semibold text-navy group-hover:underline">{t.title}</div>
                    <div className="mt-1 text-xs text-slate-500">{t.description}</div>
                  </Link>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
