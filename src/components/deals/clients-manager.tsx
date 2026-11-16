"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Pencil, Plus, Search, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { Client } from "@/lib/types";
import { Field, Modal, inputCls } from "@/components/ui/modal";

function ClientForm({ client, onClose, onSaved }: { client: Client | null; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState({
    full_name: client?.full_name ?? "",
    phone: client?.phone ?? "",
    email: client?.email ?? "",
    id_passport_no: client?.id_passport_no ?? "",
    nationality: client?.nationality ?? "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF((p) => ({ ...p, [k]: e.target.value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!f.full_name.trim()) return setError("Full name is required.");
    if (f.email && !/^\S+@\S+\.\S+$/.test(f.email.trim())) return setError("Invalid email address.");
    setBusy(true);
    const payload = Object.fromEntries(Object.entries(f).map(([k, v]) => [k, v.trim() || null]));
    const supabase = createClient();
    const { error } = client
      ? await supabase.from("clients").update(payload).eq("id", client.id)
      : await supabase.from("clients").insert(payload);
    if (error) { setError(error.message); setBusy(false); } else onSaved();
  }

  return (
    <Modal title={client ? `Edit — ${client.full_name}` : "Add client"} onClose={onClose}>
      <form onSubmit={submit}>
        <Field label="Full name (as on ID)"><input className={inputCls} value={f.full_name} onChange={set("full_name")} autoFocus /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Phone"><input className={inputCls} value={f.phone} onChange={set("phone")} /></Field>
          <Field label="Email"><input type="email" className={inputCls} value={f.email} onChange={set("email")} /></Field>
          <Field label="Emirates ID / Passport"><input className={inputCls} value={f.id_passport_no} onChange={set("id_passport_no")} /></Field>
          <Field label="Nationality"><input className={inputCls} value={f.nationality} onChange={set("nationality")} /></Field>
        </div>
        {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg px-4 py-2 text-sm text-slate-600 hover:bg-slate-100">Cancel</button>
          <button disabled={busy} className="rounded-lg btn-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{busy ? "Saving…" : "Save"}</button>
        </div>
      </form>
    </Modal>
  );
}

export function ClientsManager({ clients, canDelete, allowed }: { clients: Client[]; canDelete: boolean; allowed: { contract: boolean; invoice: boolean; receipt: boolean } }) {
  const router = useRouter();
  const [editing, setEditing] = useState<Client | "new" | null>(null);
  const [q, setQ] = useState("");
  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    return clients.filter((c) => !s || [c.full_name, c.phone, c.email, c.id_passport_no].some((v) => v?.toLowerCase().includes(s)));
  }, [clients, q]);

  async function remove(c: Client) {
    if (!confirm(`Delete ${c.full_name}?`)) return;
    const { error } = await createClient().from("clients").delete().eq("id", c.id);
    if (error) alert(error.message); else router.refresh();
  }

  const link = "rounded-md px-2 py-1 text-[11px] font-semibold text-navy bg-white/50 ring-1 ring-brand-line transition-all duration-200 hover:-translate-y-0.5 hover:bg-white/90";

  return (
    <>
      <div className="mb-4 flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search clients…" className={`${inputCls} pl-9`} />
        </div>
        <button onClick={() => setEditing("new")} className="flex items-center gap-2 rounded-lg btn-primary px-4 py-2 text-sm font-semibold text-white">
          <Plus className="h-4 w-4" /> Add client
        </button>
      </div>
      <div className="overflow-x-auto rounded-2xl glass">
        <table className="w-full min-w-[820px] text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-left text-[11px] uppercase tracking-wider text-slate-500">
              <th className="px-4 py-3">Client</th><th className="px-4 py-3">Contact</th><th className="px-4 py-3">ID / Passport</th>
              <th className="px-4 py-3">One-click auto-fill into…</th><th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={5} className="px-4 py-12 text-center text-slate-400">{clients.length ? "No matches." : "No clients yet."}</td></tr>}
            {rows.map((c) => (
              <tr key={c.id} className="border-b border-slate-200/40 transition-colors duration-150 last:border-0 hover:bg-white/50">
                <td className="px-4 py-3"><div className="font-semibold text-navy">{c.full_name}</div><div className="text-xs text-slate-400">{c.nationality ?? ""}</div></td>
                <td className="px-4 py-3 text-xs text-slate-600"><div>{c.phone ?? "—"}</div><div className="text-slate-400">{c.email ?? ""}</div></td>
                <td className="px-4 py-3 text-xs">{c.id_passport_no ?? "—"}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1.5">
                    <Link className={link} href={`/letters?template=commission&client=${c.id}`}>Commission letter</Link>
                    {allowed.contract && <Link className={link} href={`/finance/tenancy-contract?client=${c.id}`}>Contract</Link>}
                    {allowed.invoice && <Link className={link} href={`/finance/tax-invoice?client=${c.id}`}>Invoice</Link>}
                    {allowed.receipt && <Link className={link} href={`/finance/receipt?client=${c.id}`}>Receipt</Link>}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-1">
                    <button onClick={() => setEditing(c)} aria-label={`Edit ${c.full_name}`} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><Pencil className="h-4 w-4" /></button>
                    {canDelete && <button onClick={() => remove(c)} aria-label={`Delete ${c.full_name}`} className="rounded-lg p-2 text-red-500 hover:bg-red-50"><Trash2 className="h-4 w-4" /></button>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {editing && <ClientForm client={editing === "new" ? null : editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); router.refresh(); }} />}
    </>
  );
}
