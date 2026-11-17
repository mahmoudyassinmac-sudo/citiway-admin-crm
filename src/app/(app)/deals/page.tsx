import Link from "next/link";
import { redirect } from "next/navigation";
import { ClientsManager } from "@/components/deals/clients-manager";
import { DealsManager } from "@/components/deals/deals-manager";
import { getSession } from "@/lib/auth";
import { getLookups } from "@/lib/lookups";
import { isAdminOrAbove } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import { DEAL_SELECT, type Deal } from "@/lib/types";

export const metadata = { title: "Clients & Deals — Citiway CRM" };

export default async function DealsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const tab = (await searchParams).tab === "deals" ? "deals" : "clients";
  const session = await getSession(); // shared with the layout via React cache()
  if (!session.permissions.modules.deals) redirect("/");
  const loadDeals = async (): Promise<Deal[]> => {
    if (!session.configured || tab !== "deals") return [];
    const { data } = await (await createClient())
      .from("deals")
      .select(DEAL_SELECT)
      .order("created_at", { ascending: false });
    return (data ?? []) as Deal[];
  };
  const [{ clients, developers, agents }, deals] = await Promise.all([getLookups(), loadDeals()]);
  const docs = session.permissions.modules.finance ? session.permissions.finance_docs : null;
  const canWrite = session.role !== "agent";
  const tabCls = (on: boolean) =>
    `rounded-lg px-4 py-2 text-sm font-semibold ${on ? "btn-primary text-white" : "glass text-navy transition-all duration-200 hover:-translate-y-0.5"}`;

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <h1 className="font-head text-2xl font-bold text-navy">Clients &amp; Deals Vault</h1>
      <p className="mb-5 mt-1 text-sm text-slate-500">
        Central record of buyers and tenants. Use the one-click buttons to pre-fill contracts, invoices, receipts and
        commission undertakings.
      </p>
      <div className="mb-5 flex gap-2">
        <Link href="/deals" className={tabCls(tab === "clients")}>Clients · {clients.length}</Link>
        <Link href="/deals?tab=deals" className={tabCls(tab === "deals")}>Deals</Link>
      </div>
      {tab === "clients" ? (
        <ClientsManager
          clients={clients}
          canDelete={isAdminOrAbove(session.role)}
          allowed={{ contract: !!docs?.rental_contract, invoice: !!docs?.tax_invoice, receipt: !!docs?.receipt }}
        />
      ) : (
        <DealsManager
          deals={deals}
          lookups={{ clients, developers, agents }}
          canEdit={canWrite && session.configured}
          canInvoice={!!docs?.tax_invoice && canWrite}
          canDelete={isAdminOrAbove(session.role)}
        />
      )}
    </div>
  );
}
