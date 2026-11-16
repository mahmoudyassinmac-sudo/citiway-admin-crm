"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Pencil, Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { STAGES, aed, type Deal, type Stage } from "@/lib/types";
import { DealForm, type DealLookups } from "./deal-form";

export function PipelineBoard({ deals, lookups, canEdit }: { deals: Deal[]; lookups: DealLookups; canEdit: boolean }) {
  const router = useRouter();
  const [editing, setEditing] = useState<Deal | "new" | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  async function move(d: Deal, to: Stage) {
    setBusy(d.id);
    const { error } = await createClient()
      .from("deals")
      .update({ stage: to, collected_at: to === "collected" ? new Date().toISOString() : null })
      .eq("id", d.id);
    setBusy(null);
    if (error) alert(error.message); else router.refresh();
  }

  return (
    <>
      {canEdit && (
        <div className="mb-3 flex justify-end">
          <button onClick={() => setEditing("new")} className="flex items-center gap-2 rounded-lg btn-primary px-4 py-2 text-sm font-semibold text-white"><Plus className="h-4 w-4" /> New deal</button>
        </div>
      )}
      <div className="grid gap-3 lg:grid-cols-4">
        {STAGES.map((s, i) => {
          const col = deals.filter((d) => d.stage === s.key);
          const sum = col.reduce((a, d) => a + Number(d.commission_aed || 0), 0);
          return (
            <div key={s.key} className="rounded-xl glass p-2.5">
              <div className="mb-2 px-1">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{i + 1}. {s.label}</div>
                <div className="font-head text-lg font-bold text-navy">{aed(sum)}</div>
                <div className="text-xs text-slate-500">{col.length} deal(s)</div>
              </div>
              <div className="space-y-2">
                {col.map((d) => (
                  <div key={d.id} className="rounded-lg glass-strong lift p-3 text-sm">
                    <div className="font-semibold text-navy">{d.project_name ?? "—"}{d.unit_no ? ` · ${d.unit_no}` : ""}</div>
                    <div className="text-xs text-slate-500">{d.client?.full_name ?? "No client"} · {d.developer?.developer_name ?? "—"}</div>
                    <div className="mt-1 font-medium">{aed(d.commission_aed)}</div>
                    {d.agent && <div className="text-[11px] text-slate-400">Agent: {d.agent.full_name}</div>}
                    {canEdit && (
                      <div className="mt-2 flex items-center justify-between">
                        <div className="flex gap-1">
                          {i > 0 && <button disabled={busy === d.id} onClick={() => move(d, STAGES[i - 1].key)} aria-label="Move back" className="rounded p-1 text-slate-500 ring-1 ring-slate-200 hover:bg-slate-50"><ChevronLeft className="h-3.5 w-3.5" /></button>}
                          {i < STAGES.length - 1 && (
                            <button disabled={busy === d.id} onClick={() => move(d, STAGES[i + 1].key)} className="flex items-center gap-1 rounded btn-primary px-2 py-1 text-[11px] font-semibold text-white">
                              {STAGES[i + 1].label} <ChevronRight className="h-3 w-3" />
                            </button>
                          )}
                        </div>
                        <button onClick={() => setEditing(d)} aria-label="Edit deal" className="rounded p-1 text-slate-500 hover:bg-slate-100"><Pencil className="h-3.5 w-3.5" /></button>
                      </div>
                    )}
                  </div>
                ))}
                {col.length === 0 && <div className="rounded-lg border border-dashed border-slate-300 p-4 text-center text-xs text-slate-400">Empty</div>}
              </div>
            </div>
          );
        })}
      </div>
      {editing && <DealForm deal={editing === "new" ? null : editing} lookups={lookups} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); router.refresh(); }} />}
    </>
  );
}
