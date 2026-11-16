"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { formatDate } from "@/lib/developers";
import type { Agent } from "@/lib/types";
import { Field, Modal, inputCls } from "@/components/ui/modal";
import { BrnBadge } from "./brn-badge";

function AgentForm({ agent, onClose, onSaved }: { agent: Agent | null; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState({
    full_name: agent?.full_name ?? "",
    phone: agent?.phone ?? "",
    email: agent?.email ?? "",
    rera_brn: agent?.rera_brn ?? "",
    brn_expiry_date: agent?.brn_expiry_date ?? "",
    emirates_id: agent?.emirates_id ?? "",
    passport_no: agent?.passport_no ?? "",
    commission_split: String(agent?.commission_split ?? 50),
    is_active: agent?.is_active ?? true,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF((p) => ({ ...p, [k]: e.target.value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const split = Number(f.commission_split);
    if (!f.full_name.trim()) return setError("Name is required.");
    if (!(split >= 0 && split <= 100)) return setError("Commission split must be between 0 and 100.");
    if (f.rera_brn && !/^\d{3,8}$/.test(f.rera_brn.trim())) return setError("RERA BRN should be 3–8 digits.");
    if (f.emirates_id && !/^784-?\d{4}-?\d{7}-?\d$/.test(f.emirates_id.trim()))
      return setError("Emirates ID format: 784-YYYY-NNNNNNN-N.");
    setBusy(true);
    const payload = {
      full_name: f.full_name.trim(),
      phone: f.phone.trim() || null,
      email: f.email.trim() || null,
      rera_brn: f.rera_brn.trim() || null,
      brn_expiry_date: f.brn_expiry_date || null,
      emirates_id: f.emirates_id.trim() || null,
      passport_no: f.passport_no.trim() || null,
      commission_split: split,
      is_active: f.is_active,
    };
    const supabase = createClient();
    const { error } = agent
      ? await supabase.from("agents").update(payload).eq("id", agent.id)
      : await supabase.from("agents").insert(payload);
    if (error) {
      setError(error.message);
      setBusy(false);
    } else onSaved();
  }

  return (
    <Modal title={agent ? `Edit — ${agent.full_name}` : "Add agent"} onClose={onClose}>
      <form onSubmit={submit}>
        <Field label="Full name"><input className={inputCls} value={f.full_name} onChange={set("full_name")} autoFocus /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Phone"><input className={inputCls} value={f.phone} onChange={set("phone")} placeholder="+971 5x xxx xxxx" /></Field>
          <Field label="Email"><input type="email" className={inputCls} value={f.email} onChange={set("email")} /></Field>
          <Field label="RERA BRN"><input className={inputCls} value={f.rera_brn} onChange={set("rera_brn")} inputMode="numeric" /></Field>
          <Field label="BRN expiry date"><input type="date" className={inputCls} value={f.brn_expiry_date} onChange={set("brn_expiry_date")} /></Field>
          <Field label="Emirates ID"><input className={inputCls} value={f.emirates_id} onChange={set("emirates_id")} placeholder="784-YYYY-NNNNNNN-N" /></Field>
          <Field label="Passport no."><input className={inputCls} value={f.passport_no} onChange={set("passport_no")} /></Field>
          <Field label="Commission split (%)" hint="Agent's share of net commission."><input type="number" min={0} max={100} step="0.01" className={inputCls} value={f.commission_split} onChange={set("commission_split")} /></Field>
        </div>
        <label className="mb-4 flex items-center gap-2 text-sm font-medium text-navy">
          <input type="checkbox" checked={f.is_active} onChange={(e) => setF((p) => ({ ...p, is_active: e.target.checked }))} className="h-4 w-4" />
          Active agent
        </label>
        {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg px-4 py-2 text-sm text-slate-600 hover:bg-slate-100">Cancel</button>
          <button disabled={busy} className="rounded-lg btn-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{busy ? "Saving…" : "Save"}</button>
        </div>
      </form>
    </Modal>
  );
}

export function AgentsManager({ agents, canEdit }: { agents: Agent[]; canEdit: boolean }) {
  const router = useRouter();
  const [editing, setEditing] = useState<Agent | "new" | null>(null);

  async function remove(a: Agent) {
    if (!confirm(`Delete ${a.full_name}? Linked letters and deals keep their records but lose the agent link.`)) return;
    const { error } = await createClient().from("agents").delete().eq("id", a.id);
    if (error) alert(error.message);
    else router.refresh();
  }

  return (
    <>
      {canEdit && (
        <div className="mb-4 flex justify-end">
          <button onClick={() => setEditing("new")} className="flex items-center gap-2 rounded-lg btn-primary px-4 py-2 text-sm font-semibold text-white">
            <Plus className="h-4 w-4" /> Add agent
          </button>
        </div>
      )}
      <div className="overflow-x-auto rounded-2xl glass">
        <table className="w-full min-w-[820px] text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-left text-[11px] uppercase tracking-wider text-slate-500">
              <th className="px-4 py-3">Agent</th>
              <th className="px-4 py-3">Contact</th>
              <th className="px-4 py-3">RERA BRN</th>
              <th className="px-4 py-3">BRN status</th>
              <th className="px-4 py-3">Emirates ID</th>
              <th className="px-4 py-3">Split</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {agents.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-12 text-center text-slate-400">No agents yet.</td></tr>
            )}
            {agents.map((a) => (
              <tr key={a.id} className={`border-b border-slate-200/40 transition-colors duration-150 last:border-0 hover:bg-white/50 ${a.is_active ? "" : "opacity-60"}`}>
                <td className="px-4 py-3 font-semibold text-navy">
                  {a.full_name}
                  {!a.is_active && <span className="ml-2 text-xs font-normal text-slate-400">inactive</span>}
                </td>
                <td className="px-4 py-3 text-xs text-slate-600">
                  <div>{a.phone ?? "—"}</div>
                  <div className="text-slate-400">{a.email ?? ""}</div>
                </td>
                <td className="px-4 py-3">{a.rera_brn ?? "—"}</td>
                <td className="px-4 py-3">
                  <BrnBadge expiry={a.brn_expiry_date} />
                  <div className="mt-0.5 text-[11px] text-slate-400">{formatDate(a.brn_expiry_date)}</div>
                </td>
                <td className="px-4 py-3 text-xs">{a.emirates_id ?? "—"}</td>
                <td className="px-4 py-3">{a.commission_split}%</td>
                <td className="px-4 py-3">
                  {canEdit && (
                    <div className="flex justify-end gap-1">
                      <button onClick={() => setEditing(a)} aria-label={`Edit ${a.full_name}`} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><Pencil className="h-4 w-4" /></button>
                      <button onClick={() => remove(a)} aria-label={`Delete ${a.full_name}`} className="rounded-lg p-2 text-red-500 hover:bg-red-50"><Trash2 className="h-4 w-4" /></button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {editing && (
        <AgentForm
          agent={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); router.refresh(); }}
        />
      )}
    </>
  );
}
