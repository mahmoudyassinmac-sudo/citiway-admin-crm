"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Field, inputCls } from "@/components/ui/modal";
import { updateCompanySettings, type CompanyInput } from "@/app/(app)/settings/actions";

export function CompanyForm({ initial }: { initial: CompanyInput }) {
  const router = useRouter();
  const [f, setF] = useState<CompanyInput>(initial);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const set = (k: keyof CompanyInput) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF((p) => ({ ...p, [k]: e.target.value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setMsg(null);
    const res = await updateCompanySettings(f);
    setBusy(false);
    setMsg(res.ok ? { ok: true, text: res.message ?? "Saved." } : { ok: false, text: res.error });
    if (res.ok) router.refresh();
  }

  return (
    <form onSubmit={submit} className="max-w-2xl rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
      <div className="grid gap-x-4 sm:grid-cols-2">
        <Field label="Company name"><input className={inputCls} value={f.company_name} onChange={set("company_name")} /></Field>
        <Field label="Trade license no."><input className={inputCls} value={f.trade_license} onChange={set("trade_license")} /></Field>
        <Field label="RERA ORN" hint="Printed on letters and documents when set."><input className={inputCls} value={f.rera_orn} onChange={set("rera_orn")} /></Field>
        <Field label="TRN (Tax Registration Number)" hint="15 digits. Pre-fills the agency TRN on tax invoices."><input className={inputCls} value={f.trn} onChange={set("trn")} inputMode="numeric" /></Field>
        <Field label="Phone"><input className={inputCls} value={f.phone} onChange={set("phone")} /></Field>
        <Field label="Company email"><input type="email" className={inputCls} value={f.email} onChange={set("email")} /></Field>
      </div>
      <Field label="Address"><textarea rows={2} className={inputCls} value={f.address} onChange={set("address")} /></Field>
      <Field label="Admin alert email" hint="Receives the daily developer-agreement expiry reminders (via the n8n workflow).">
        <input type="email" className={inputCls} value={f.admin_alert_email} onChange={set("admin_alert_email")} />
      </Field>
      {msg && <p role="status" className={`mb-3 text-sm ${msg.ok ? "text-emerald-700" : "text-red-600"}`}>{msg.text}</p>}
      <button disabled={busy} className="rounded-lg bg-navy px-5 py-2.5 text-sm font-semibold text-white hover:bg-navy-light disabled:opacity-50">{busy ? "Saving…" : "Save settings"}</button>
    </form>
  );
}
