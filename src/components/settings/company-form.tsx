"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Field, inputCls } from "@/components/ui/modal";
import { sendTestAlert, updateCompanySettings, type CompanyInput } from "@/app/(app)/settings/actions";

export function CompanyForm({ initial }: { initial: CompanyInput }) {
  const router = useRouter();
  const [f, setF] = useState<CompanyInput>(initial);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [testing, setTesting] = useState(false);
  const [testMsg, setTestMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const dirty = f.admin_alert_email.trim() !== initial.admin_alert_email.trim();

  async function sendTest() {
    setTesting(true); setTestMsg(null);
    const res = await sendTestAlert();
    setTesting(false);
    setTestMsg(res.ok ? { ok: true, text: res.message ?? "Sent." } : { ok: false, text: res.error });
  }
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
    <form onSubmit={submit} className="max-w-2xl rounded-2xl glass p-6">
      <div className="grid gap-x-4 sm:grid-cols-2">
        <Field label="Company name"><input className={inputCls} value={f.company_name} onChange={set("company_name")} /></Field>
        <Field label="Trade license no."><input className={inputCls} value={f.trade_license} onChange={set("trade_license")} /></Field>
        <Field label="RERA ORN" hint="Printed on letters and documents when set."><input className={inputCls} value={f.rera_orn} onChange={set("rera_orn")} /></Field>
        <Field label="TRN (Tax Registration Number)" hint="15 digits. Pre-fills the agency TRN on tax invoices."><input className={inputCls} value={f.trn} onChange={set("trn")} inputMode="numeric" /></Field>
        <Field label="Phone"><input className={inputCls} value={f.phone} onChange={set("phone")} /></Field>
        <Field label="Company email"><input type="email" className={inputCls} value={f.email} onChange={set("email")} /></Field>
      </div>
      <Field label="Address"><textarea rows={2} className={inputCls} value={f.address} onChange={set("address")} /></Field>
      <Field label="Admin alert email" hint="Receives the daily developer-expiry reminders (n8n) and a confirmation email whenever a letter or finance document is issued.">
        <div className="flex gap-2">
          <input type="email" className={inputCls} value={f.admin_alert_email} onChange={set("admin_alert_email")} />
          <button
            type="button"
            onClick={sendTest}
            disabled={testing || dirty || !f.admin_alert_email.trim()}
            title={dirty ? "Save the new address first" : "Send a sample confirmation email"}
            className="whitespace-nowrap rounded-lg px-4 text-sm font-semibold text-navy bg-white/50 ring-1 ring-brand-line transition-all duration-200 hover:-translate-y-0.5 hover:bg-white/90 disabled:opacity-40"
          >
            {testing ? "Sending…" : "Send Test Email"}
          </button>
        </div>
        {dirty && <span className="mt-1 block text-[11px] text-amber-700">Save settings before sending a test — it goes to the saved address.</span>}
        {testMsg && <span role="status" className={`mt-1 block text-[12px] ${testMsg.ok ? "text-emerald-700" : "text-red-600"}`}>{testMsg.text}</span>}
      </Field>
      {msg && <p role="status" className={`mb-3 text-sm ${msg.ok ? "text-emerald-700" : "text-red-600"}`}>{msg.text}</p>}
      <button disabled={busy} className="rounded-lg btn-primary px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{busy ? "Saving…" : "Save settings"}</button>
    </form>
  );
}
