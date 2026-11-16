"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  FileText,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  ShieldAlert,
  Trash2,
  Upload,
  XCircle,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  addDays,
  daysLeft,
  developerStatus,
  formatDate,
  todayInDubai,
  type Developer,
} from "@/lib/developers";
import { Field, Modal, inputCls } from "@/components/ui/modal";
import { StatusBadge } from "./status-badge";

const BUCKET = "agreements";
const MAX_PDF_BYTES = 20 * 1024 * 1024;

type Filter = "all" | "active" | "expiring" | "expired";

function validatePdf(file: File | null): string | null {
  if (!file) return null;
  if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf"))
    return "Only PDF files are allowed.";
  if (file.size > MAX_PDF_BYTES) return "PDF must be 20 MB or smaller.";
  return null;
}

async function uploadPdf(
  supabase: ReturnType<typeof createClient>,
  developerId: string,
  kind: "agreement" | "noc",
  file: File,
): Promise<string> {
  const path = `developers/${developerId}/${kind}-${Date.now()}.pdf`;
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { contentType: "application/pdf", upsert: false });
  if (error) throw new Error(`Upload failed: ${error.message}`);
  return path;
}

async function openPdf(path: string) {
  const { data, error } = await createClient().storage.from(BUCKET).createSignedUrl(path, 300);
  if (error || !data) {
    alert(`Could not open file: ${error?.message ?? "unknown error"}`);
    return;
  }
  window.open(data.signedUrl, "_blank", "noopener");
}

function FileInput({
  file,
  onChange,
  existing,
}: {
  file: File | null;
  onChange: (f: File | null) => void;
  existing?: string | null;
}) {
  return (
    <div>
      <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-slate-300 bg-slate-50 px-3 py-2.5 text-sm text-slate-600 hover:border-brand">
        <Upload className="h-4 w-4 text-brand" />
        <span className="truncate">{file ? file.name : existing ? "Replace current PDF…" : "Choose PDF…"}</span>
        <input
          type="file"
          accept="application/pdf,.pdf"
          className="hidden"
          onChange={(e) => onChange(e.target.files?.[0] ?? null)}
        />
      </label>
      {existing && !file && (
        <button
          type="button"
          onClick={() => openPdf(existing)}
          className="mt-1 text-[11px] font-medium text-navy underline"
        >
          View current file
        </button>
      )}
    </div>
  );
}

/* ------------------------------ Add / Edit ------------------------------ */
function DeveloperForm({
  developer,
  onClose,
  onSaved,
}: {
  developer: Developer | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const today = todayInDubai();
  const [name, setName] = useState(developer?.developer_name ?? "");
  const [start, setStart] = useState(developer?.start_date ?? today);
  const [end, setEnd] = useState(developer?.end_date ?? addDays(today, 364));
  const [hasNoc, setHasNoc] = useState(developer?.has_noc ?? false);
  const [notes, setNotes] = useState(developer?.notes ?? "");
  const [agreement, setAgreement] = useState<File | null>(null);
  const [noc, setNoc] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!name.trim()) return setError("Developer name is required.");
    if (end < start) return setError("End date must be on or after the start date.");
    const fileErr = validatePdf(agreement) ?? validatePdf(noc);
    if (fileErr) return setError(fileErr);

    setBusy(true);
    try {
      const supabase = createClient();
      const id = developer?.id ?? crypto.randomUUID();
      const patch: Record<string, unknown> = {
        developer_name: name.trim(),
        start_date: start,
        end_date: end,
        has_noc: hasNoc,
        notes: notes.trim() || null,
      };
      if (agreement) patch.agreement_pdf_url = await uploadPdf(supabase, id, "agreement", agreement);
      if (noc) patch.noc_pdf_url = await uploadPdf(supabase, id, "noc", noc);
      // Extending the end date beyond the warning window should stop reminders.
      if (developer && end !== developer.end_date) patch.last_reminded_at = null;

      const { error } = developer
        ? await supabase.from("developers").update(patch).eq("id", developer.id)
        : await supabase.from("developers").insert({ id, ...patch });
      if (error) throw new Error(error.message);
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setBusy(false);
    }
  }

  return (
    <Modal title={developer ? `Edit — ${developer.developer_name}` : "Add developer agreement"} onClose={onClose}>
      <form onSubmit={submit}>
        <Field label="Developer name">
          <input
            className={inputCls}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Emaar, Sobha, Binghatti, Damac, Object 1"
            autoFocus
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Start date">
            <input type="date" className={inputCls} value={start} onChange={(e) => setStart(e.target.value)} />
          </Field>
          <Field label="End date">
            <input type="date" className={inputCls} value={end} onChange={(e) => setEnd(e.target.value)} />
          </Field>
        </div>
        <label className="mb-4 flex items-center gap-2 text-sm font-medium text-navy">
          <input type="checkbox" checked={hasNoc} onChange={(e) => setHasNoc(e.target.checked)} className="h-4 w-4" />
          NOC obtained from developer
        </label>
        <Field label="Signed agreement (PDF)" hint="Stored in the private “agreements” bucket. Max 20 MB.">
          <FileInput file={agreement} onChange={setAgreement} existing={developer?.agreement_pdf_url} />
        </Field>
        <Field label="NOC (PDF, optional)">
          <FileInput file={noc} onChange={setNoc} existing={developer?.noc_pdf_url} />
        </Field>
        <Field label="Notes">
          <textarea className={inputCls} rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
        {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg px-4 py-2 text-sm text-slate-600 hover:bg-slate-100">
            Cancel
          </button>
          <button
            disabled={busy}
            className="rounded-lg bg-navy px-4 py-2 text-sm font-semibold text-white hover:bg-navy-light disabled:opacity-50"
          >
            {busy ? "Saving…" : "Save"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

/* ------------------------------ 1-click Renew ------------------------------ */
function RenewModal({
  developer,
  onClose,
  onSaved,
}: {
  developer: Developer;
  onClose: () => void;
  onSaved: () => void;
}) {
  const today = todayInDubai();
  // Continue straight after the old term if it hasn't lapsed; otherwise start today.
  const defaultStart = developer.end_date >= today ? addDays(developer.end_date, 1) : today;
  const [start, setStart] = useState(defaultStart);
  const [end, setEnd] = useState(addDays(defaultStart, 364));
  const [hasNoc, setHasNoc] = useState(developer.has_noc);
  const [pdf, setPdf] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (end < start) return setError("End date must be on or after the start date.");
    const fileErr = validatePdf(pdf);
    if (fileErr) return setError(fileErr);
    setBusy(true);
    try {
      const supabase = createClient();
      const patch: Record<string, unknown> = {
        start_date: start,
        end_date: end,
        has_noc: hasNoc,
        last_reminded_at: null, // stops the daily n8n reminder immediately
      };
      if (pdf) patch.agreement_pdf_url = await uploadPdf(supabase, developer.id, "agreement", pdf);
      const { error } = await supabase.from("developers").update(patch).eq("id", developer.id);
      if (error) throw new Error(error.message);
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setBusy(false);
    }
  }

  return (
    <Modal title={`Renew agreement — ${developer.developer_name}`} onClose={onClose}>
      <form onSubmit={submit}>
        <p className="mb-4 rounded-lg bg-brand-soft px-3 py-2 text-xs text-navy">
          Current term: {formatDate(developer.start_date)} → {formatDate(developer.end_date)}.
          Saving resets the reminder flag so daily alert emails stop immediately.
        </p>
        <div className="grid grid-cols-2 gap-3">
          <Field label="New start date">
            <input type="date" className={inputCls} value={start} onChange={(e) => setStart(e.target.value)} />
          </Field>
          <Field label="New end date">
            <input type="date" className={inputCls} value={end} onChange={(e) => setEnd(e.target.value)} />
          </Field>
        </div>
        <label className="mb-4 flex items-center gap-2 text-sm font-medium text-navy">
          <input type="checkbox" checked={hasNoc} onChange={(e) => setHasNoc(e.target.checked)} className="h-4 w-4" />
          NOC obtained from developer
        </label>
        <Field label="Renewed agreement (PDF)" hint="Optional now — you can attach it later via Edit.">
          <FileInput file={pdf} onChange={setPdf} existing={developer.agreement_pdf_url} />
        </Field>
        {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg px-4 py-2 text-sm text-slate-600 hover:bg-slate-100">
            Cancel
          </button>
          <button
            disabled={busy}
            className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            <RefreshCw className="h-4 w-4" />
            {busy ? "Renewing…" : "Renew agreement"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

/* ------------------------------ Manager ------------------------------ */
export function DevelopersManager({
  developers,
  canEdit,
  enabled,
}: {
  developers: Developer[];
  canEdit: boolean;
  enabled: boolean;
}) {
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<Developer | "new" | null>(null);
  const [renewing, setRenewing] = useState<Developer | null>(null);

  const counts = useMemo(() => {
    const c = { all: developers.length, active: 0, expiring: 0, expired: 0 };
    developers.forEach((d) => c[developerStatus(d.end_date)]++);
    return c;
  }, [developers]);

  const rows = useMemo(
    () =>
      developers
        .filter((d) => (filter === "all" ? true : developerStatus(d.end_date) === filter))
        .filter((d) => d.developer_name.toLowerCase().includes(query.trim().toLowerCase())),
    [developers, filter, query],
  );

  const refresh = () => {
    setEditing(null);
    setRenewing(null);
    router.refresh();
  };

  async function remove(d: Developer) {
    if (!confirm(`Delete ${d.developer_name}? This cannot be undone.`)) return;
    const supabase = createClient();
    const paths = [d.agreement_pdf_url, d.noc_pdf_url].filter(Boolean) as string[];
    if (paths.length) await supabase.storage.from(BUCKET).remove(paths);
    const { error } = await supabase.from("developers").delete().eq("id", d.id);
    if (error) alert(error.message);
    else router.refresh();
  }

  const chips: { key: Filter; label: string; cls: string }[] = [
    { key: "all", label: "All", cls: "" },
    { key: "active", label: "Active", cls: "text-emerald-700" },
    { key: "expiring", label: "Expiring soon", cls: "text-amber-700" },
    { key: "expired", label: "Expired", cls: "text-red-700" },
  ];

  return (
    <>
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className="relative min-w-[220px] flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search developers…"
            className={`${inputCls} pl-9`}
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {chips.map((c) => (
            <button
              key={c.key}
              onClick={() => setFilter(c.key)}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold ring-1 ring-inset transition ${
                filter === c.key
                  ? "bg-navy text-white ring-navy"
                  : `bg-white ring-slate-200 hover:ring-brand ${c.cls}`
              }`}
            >
              {c.label} · {counts[c.key]}
            </button>
          ))}
        </div>
        {canEdit && enabled && (
          <button
            onClick={() => setEditing("new")}
            className="flex items-center gap-2 rounded-lg bg-navy px-4 py-2 text-sm font-semibold text-white hover:bg-navy-light"
          >
            <Plus className="h-4 w-4" /> Add developer
          </button>
        )}
      </div>

      <div className="overflow-x-auto rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
        <table className="w-full min-w-[820px] text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-left text-[11px] uppercase tracking-wider text-slate-500">
              <th className="px-4 py-3 font-semibold">Developer</th>
              <th className="px-4 py-3 font-semibold">Term</th>
              <th className="px-4 py-3 font-semibold">Status</th>
              <th className="px-4 py-3 font-semibold">NOC</th>
              <th className="px-4 py-3 font-semibold">Documents</th>
              <th className="px-4 py-3 text-right font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-slate-400">
                  {developers.length === 0
                    ? enabled
                      ? "No developers yet — add your first agreement."
                      : "Connect Supabase to start tracking developer agreements."
                    : "No developers match the current filter."}
                </td>
              </tr>
            )}
            {rows.map((d) => {
              const status = developerStatus(d.end_date);
              return (
                <tr
                  key={d.id}
                  className={`border-b border-slate-50 last:border-0 ${
                    status === "expired" ? "bg-red-50/40" : status === "expiring" ? "bg-amber-50/40" : ""
                  }`}
                >
                  <td className="px-4 py-3">
                    <div className="font-semibold text-navy">{d.developer_name}</div>
                    {d.notes && <div className="max-w-[240px] truncate text-xs text-slate-500">{d.notes}</div>}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                    {formatDate(d.start_date)} → {formatDate(d.end_date)}
                    {daysLeft(d.end_date) >= 0 && (
                      <div className="text-[11px] text-slate-400">{daysLeft(d.end_date)} days remaining</div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge endDate={d.end_date} />
                  </td>
                  <td className="px-4 py-3">
                    {d.has_noc ? (
                      <span className="inline-flex items-center gap-1 text-emerald-700">
                        <CheckCircle2 className="h-4 w-4" /> Obtained
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-slate-400">
                        <XCircle className="h-4 w-4" /> Missing
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-1 text-xs">
                      {d.agreement_pdf_url ? (
                        <button onClick={() => openPdf(d.agreement_pdf_url!)} className="flex items-center gap-1 text-navy underline">
                          <FileText className="h-3.5 w-3.5" /> Agreement
                        </button>
                      ) : (
                        <span className="flex items-center gap-1 text-amber-700">
                          <ShieldAlert className="h-3.5 w-3.5" /> No agreement PDF
                        </span>
                      )}
                      {d.noc_pdf_url && (
                        <button onClick={() => openPdf(d.noc_pdf_url!)} className="flex items-center gap-1 text-navy underline">
                          <FileText className="h-3.5 w-3.5" /> NOC
                        </button>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {canEdit && enabled && (
                      <div className="flex justify-end gap-1.5">
                        <button
                          onClick={() => setRenewing(d)}
                          className={`flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold ${
                            status === "active"
                              ? "text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"
                              : "bg-emerald-600 text-white hover:bg-emerald-700"
                          }`}
                        >
                          <RefreshCw className="h-3.5 w-3.5" /> Renew
                        </button>
                        <button
                          onClick={() => setEditing(d)}
                          aria-label={`Edit ${d.developer_name}`}
                          className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => remove(d)}
                          aria-label={`Delete ${d.developer_name}`}
                          className="rounded-lg p-2 text-red-500 hover:bg-red-50"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {editing && (
        <DeveloperForm
          developer={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={refresh}
        />
      )}
      {renewing && <RenewModal developer={renewing} onClose={() => setRenewing(null)} onSaved={refresh} />}
    </>
  );
}
