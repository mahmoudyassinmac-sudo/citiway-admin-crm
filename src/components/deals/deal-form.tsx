"use client";

import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { developerStatus, todayInDubai } from "@/lib/developers";
import { STAGES, aed, type Deal, type Stage } from "@/lib/types";
import { Field, Modal, inputCls } from "@/components/ui/modal";

export interface DealLookups {
  clients: { id: string; full_name: string }[];
  developers: { id: string; developer_name: string; end_date: string; has_noc: boolean }[];
  agents: { id: string; full_name: string; commission_split: number; is_active: boolean }[];
}

export function DealForm({
  deal,
  lookups,
  onClose,
  onSaved,
}: {
  deal: Deal | null;
  lookups: DealLookups;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [f, setF] = useState({
    client_id: deal?.client_id ?? "",
    developer_id: deal?.developer_id ?? "",
    agent_id: deal?.agent_id ?? "",
    project_name: deal?.project_name ?? "",
    unit_no: deal?.unit_no ?? "",
    sale_price_aed: deal?.sale_price_aed != null ? String(deal.sale_price_aed) : "",
    commission_pct: deal?.commission_pct != null ? String(deal.commission_pct) : "",
    commission_aed: deal ? String(deal.commission_aed) : "",
    stage: (deal?.stage ?? "spa_signed") as Stage,
    spa_date: deal?.spa_date ?? todayInDubai(),
    notes: deal?.notes ?? "",
  });
  const [manualComm, setManualComm] = useState(Boolean(deal));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const v = e.target.value;
    setF((p) => {
      const n = { ...p, [k]: v };
      if (!manualComm && (k === "sale_price_aed" || k === "commission_pct")) {
        const c = (parseFloat(n.sale_price_aed) || 0) * (parseFloat(n.commission_pct) || 0) / 100;
        n.commission_aed = c ? String(Math.round(c * 100) / 100) : "";
      }
      return n;
    });
  };

  const dev = lookups.developers.find((d) => d.id === f.developer_id);
  const agent = lookups.agents.find((a) => a.id === f.agent_id);
  const devWarn: string[] = [];
  if (dev) {
    if (developerStatus(dev.end_date) === "expired") devWarn.push(`The agreement with ${dev.developer_name} has expired.`);
    if (!dev.has_noc) devWarn.push(`No NOC recorded from ${dev.developer_name}.`);
  }
  const comm = parseFloat(f.commission_aed) || 0;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!f.project_name.trim() && !f.unit_no.trim()) return setError("Enter a project or unit.");
    const price = f.sale_price_aed ? Number(f.sale_price_aed) : null;
    const pct = f.commission_pct ? Number(f.commission_pct) : null;
    if ((price !== null && price < 0) || (pct !== null && (pct < 0 || pct > 100))) return setError("Check price and commission %.");
    setBusy(true);
    const stageChanged = !deal || deal.stage !== f.stage;
    const payload = {
      client_id: f.client_id || null,
      developer_id: f.developer_id || null,
      agent_id: f.agent_id || null,
      project_name: f.project_name.trim() || null,
      unit_no: f.unit_no.trim() || null,
      sale_price_aed: price,
      commission_pct: pct,
      commission_aed: comm,
      stage: f.stage,
      spa_date: f.spa_date || null,
      notes: f.notes.trim() || null,
      ...(stageChanged ? { collected_at: f.stage === "collected" ? new Date().toISOString() : null } : {}),
    };
    const supabase = createClient();
    const { error } = deal
      ? await supabase.from("deals").update(payload).eq("id", deal.id)
      : await supabase.from("deals").insert(payload);
    if (error) {
      setError(error.message);
      setBusy(false);
    } else onSaved();
  }

  return (
    <Modal title={deal ? "Edit deal" : "New deal"} onClose={onClose}>
      <form onSubmit={submit}>
        <Field label="Client">
          <select className={inputCls} value={f.client_id} onChange={set("client_id")}>
            <option value="">— select client —</option>
            {lookups.clients.map((c) => <option key={c.id} value={c.id}>{c.full_name}</option>)}
          </select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Developer">
            <select className={inputCls} value={f.developer_id} onChange={set("developer_id")}>
              <option value="">— select —</option>
              {lookups.developers.map((d) => <option key={d.id} value={d.id}>{d.developer_name}</option>)}
            </select>
          </Field>
          <Field label="Agent">
            <select className={inputCls} value={f.agent_id} onChange={set("agent_id")}>
              <option value="">— select —</option>
              {lookups.agents.filter((a) => a.is_active || a.id === f.agent_id).map((a) => <option key={a.id} value={a.id}>{a.full_name}</option>)}
            </select>
          </Field>
          <Field label="Project"><input className={inputCls} value={f.project_name} onChange={set("project_name")} /></Field>
          <Field label="Unit no."><input className={inputCls} value={f.unit_no} onChange={set("unit_no")} /></Field>
          <Field label="Sale price (AED)"><input type="number" min={0} step="0.01" className={inputCls} value={f.sale_price_aed} onChange={set("sale_price_aed")} /></Field>
          <Field label="Commission %"><input type="number" min={0} max={100} step="0.01" className={inputCls} value={f.commission_pct} onChange={set("commission_pct")} /></Field>
          <Field label="Commission (AED, excl. VAT)" hint={manualComm ? "Manually set." : "Auto = price × %"}>
            <input type="number" min={0} step="0.01" className={inputCls} value={f.commission_aed} onChange={(e) => { setManualComm(true); set("commission_aed")(e); }} />
          </Field>
          <Field label="SPA date"><input type="date" className={inputCls} value={f.spa_date} onChange={set("spa_date")} /></Field>
        </div>
        <Field label="Pipeline stage">
          <select className={inputCls} value={f.stage} onChange={set("stage")}>
            {STAGES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
          </select>
        </Field>
        {agent && comm > 0 && (
          <p className="mb-3 rounded-lg bg-brand-soft px-3 py-2 text-xs text-navy">
            {agent.full_name} ({agent.commission_split}%): {aed((comm * agent.commission_split) / 100)} · Company: {aed(comm - (comm * agent.commission_split) / 100)}
          </p>
        )}
        {devWarn.map((w) => (
          <p key={w} role="alert" className="mb-2 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {w}
          </p>
        ))}
        <Field label="Notes"><textarea rows={2} className={inputCls} value={f.notes} onChange={set("notes")} /></Field>
        {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg px-4 py-2 text-sm text-slate-600 hover:bg-slate-100">Cancel</button>
          <button disabled={busy} className="rounded-lg bg-navy px-4 py-2 text-sm font-semibold text-white hover:bg-navy-light disabled:opacity-50">{busy ? "Saving…" : "Save deal"}</button>
        </div>
      </form>
    </Modal>
  );
}
