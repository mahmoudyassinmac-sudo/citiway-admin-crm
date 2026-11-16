"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { formatDate } from "@/lib/developers";
import { STAGES, aed, type Deal } from "@/lib/types";
import { DealForm, type DealLookups } from "./deal-form";

export function DealsManager({ deals, lookups, canEdit, canDelete }: { deals: Deal[]; lookups: DealLookups; canEdit: boolean; canDelete: boolean }) {
  const router = useRouter();
  const [editing, setEditing] = useState<Deal | "new" | null>(null);

  async function remove(d: Deal) {
    if (!confirm("Delete this deal?")) return;
    const { error } = await createClient().from("deals").delete().eq("id", d.id);
    if (error) alert(error.message); else router.refresh();
  }
  const link = "rounded-md px-2 py-1 text-[11px] font-semibold text-navy ring-1 ring-brand-line hover:bg-brand-soft";

  return (
    <>
      {canEdit && (
        <div className="mb-4 flex justify-end">
          <button onClick={() => setEditing("new")} className="flex items-center gap-2 rounded-lg bg-navy px-4 py-2 text-sm font-semibold text-white hover:bg-navy-light"><Plus className="h-4 w-4" /> New deal</button>
        </div>
      )}
      <div className="overflow-x-auto rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
        <table className="w-full min-w-[900px] text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-left text-[11px] uppercase tracking-wider text-slate-500">
              <th className="px-4 py-3">Deal</th><th className="px-4 py-3">Client</th><th className="px-4 py-3">Agent</th>
              <th className="px-4 py-3">Commission</th><th className="px-4 py-3">Stage</th><th className="px-4 py-3">Documents</th><th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {deals.length === 0 && <tr><td colSpan={7} className="px-4 py-12 text-center text-slate-400">No deals yet.</td></tr>}
            {deals.map((d) => (
              <tr key={d.id} className="border-b border-slate-50 last:border-0">
                <td className="px-4 py-3"><div className="font-semibold text-navy">{d.project_name ?? "—"}{d.unit_no ? ` · ${d.unit_no}` : ""}</div><div className="text-xs text-slate-400">{d.developer?.developer_name ?? ""} · SPA {formatDate(d.spa_date)}</div></td>
                <td className="px-4 py-3">{d.client?.full_name ?? "—"}</td>
                <td className="px-4 py-3">{d.agent?.full_name ?? "—"}</td>
                <td className="px-4 py-3"><div className="font-medium">{aed(d.commission_aed)}</div><div className="text-xs text-slate-400">{d.commission_pct ?? "—"}% of {aed(d.sale_price_aed)}</div></td>
                <td className="px-4 py-3"><span className="rounded-full bg-brand-soft px-2.5 py-1 text-xs font-semibold text-navy">{STAGES.find((s) => s.key === d.stage)?.label}</span></td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1.5">
                    <Link className={link} href={`/letters?template=commission&client=${d.client_id ?? ""}&developer=${d.developer_id ?? ""}&agent=${d.agent_id ?? ""}&unit=${encodeURIComponent(d.unit_no ?? "")}`}>Undertaking</Link>
                    {canEdit && <Link className={link} href={`/finance/tax-invoice?client=${d.client_id ?? ""}&developer=${d.developer_id ?? ""}&deal=${d.id}`}>Invoice</Link>}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-1">
                    {canEdit && <button onClick={() => setEditing(d)} aria-label="Edit deal" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><Pencil className="h-4 w-4" /></button>}
                    {canDelete && <button onClick={() => remove(d)} aria-label="Delete deal" className="rounded-lg p-2 text-red-500 hover:bg-red-50"><Trash2 className="h-4 w-4" /></button>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {editing && <DealForm deal={editing === "new" ? null : editing} lookups={lookups} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); router.refresh(); }} />}
    </>
  );
}
