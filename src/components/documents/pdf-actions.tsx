"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Download, Stamp, Trash2, X } from "lucide-react";
import { approveDocument, deleteDocument, getDocumentPdfUrl, rejectDocument } from "@/app/(app)/documents/archive-actions";
import { SIGNOFF_LABEL, type DocTable, type SignoffStatus } from "@/lib/signoff";

export interface ArchiveInfo {
  has_pdf: boolean;
  signoff_status: SignoffStatus;
  signoff_note: string | null;
  stampable: boolean;
}

const BADGE: Record<SignoffStatus, string> = {
  none: "bg-slate-100 text-slate-500",
  pending: "bg-amber-100 text-amber-800",
  approved: "bg-emerald-100 text-emerald-700",
  rejected: "bg-red-100 text-red-700",
};

export function SignoffBadge({ status, note }: { status: SignoffStatus; note?: string | null }) {
  return (
    <span title={note ?? undefined} className={`whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold ${BADGE[status]}`}>
      {SIGNOFF_LABEL[status]}
    </span>
  );
}

/** Opens the archived PDF (stamped copy when there is one) in a new tab. */
export function PdfButton({ table, id, which = "latest", label = "PDF" }: { table: DocTable; id: string; which?: "latest" | "original"; label?: string }) {
  const [busy, setBusy] = useState(false);
  async function open() {
    // Open the tab synchronously (popup blockers), then point it at the signed URL.
    const win = window.open("about:blank", "_blank");
    setBusy(true);
    const res = await getDocumentPdfUrl(table, id, which);
    setBusy(false);
    if (res.ok) {
      if (win) win.location.href = res.url;
      else window.location.href = res.url;
    } else {
      win?.close();
      window.alert(res.error);
    }
  }
  return (
    <button onClick={open} disabled={busy} className="inline-flex items-center gap-1 text-xs font-semibold text-brand underline disabled:opacity-60">
      <Download className="h-3.5 w-3.5" /> {busy ? "Opening…" : label}
    </button>
  );
}

/** Super Admin: stamp & sign an archived document, or send it back. */
export function SignoffButtons({ table, id, reference, allowReject = true }: { table: DocTable; id: string; reference: string; allowReject?: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState<"approve" | "reject" | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function approve() {
    if (!window.confirm(`Put the company stamp & signature on ${reference}?`)) return;
    setBusy("approve"); setMsg(null);
    const res = await approveDocument(table, id);
    setBusy(null);
    setMsg(res.ok ? { ok: true, text: res.message } : { ok: false, text: res.error });
    if (res.ok) router.refresh();
  }
  async function reject() {
    const note = window.prompt(`Why is ${reference} being returned? (the issuer will see this note)`, "");
    if (note === null) return;
    setBusy("reject"); setMsg(null);
    const res = await rejectDocument(table, id, note);
    setBusy(null);
    setMsg(res.ok ? { ok: true, text: res.message } : { ok: false, text: res.error });
    if (res.ok) router.refresh();
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex gap-2">
        <button onClick={approve} disabled={!!busy} className="inline-flex items-center gap-1 rounded-lg bg-gradient-to-r from-amber-500 to-amber-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm disabled:opacity-60">
          {busy === "approve" ? "Stamping…" : (<><Stamp className="h-3.5 w-3.5" /> Approve &amp; stamp</>)}
        </button>
        {allowReject && (
          <button onClick={reject} disabled={!!busy} className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-60">
            {busy === "reject" ? "…" : (<><X className="h-3.5 w-3.5" /> Reject</>)}
          </button>
        )}
      </div>
      {msg && (
        <span className={`inline-flex items-center gap-1 text-[11px] ${msg.ok ? "text-emerald-700" : "text-red-600"}`}>
          {msg.ok && <Check className="h-3 w-3" />} {msg.text}
        </span>
      )}
    </div>
  );
}

/** Super Admin: permanently delete a document and its archived PDFs. */
export function DeleteDocButton({ table, id, reference }: { table: DocTable; id: string; reference: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function remove() {
    const typed = window.prompt(
      `Delete ${reference} permanently?\n\nThe record and all its PDFs (including stamped copies) will be removed and cannot be recovered.\n\nType DELETE to confirm:`,
      "",
    );
    if (typed === null) return;
    if (typed.trim().toUpperCase() !== "DELETE") {
      window.alert("Not deleted — you need to type DELETE to confirm.");
      return;
    }
    setBusy(true);
    const res = await deleteDocument(table, id);
    setBusy(false);
    if (!res.ok) window.alert(res.error);
    else router.refresh();
  }
  return (
    <button onClick={remove} disabled={busy} title="Delete permanently" className="inline-flex items-center gap-1 text-xs font-semibold text-red-600 hover:underline disabled:opacity-60">
      <Trash2 className="h-3.5 w-3.5" /> {busy ? "Deleting…" : "Delete"}
    </button>
  );
}

/** PDF + sign-off status cell used in the Documents archive. */
export function ArchiveCell({ table, id, reference, info, isSuperAdmin }: { table: DocTable; id: string; reference: string; info: ArchiveInfo; isSuperAdmin: boolean }) {
  return (
    <div className="flex flex-col items-end gap-1.5">
      <div className="flex items-center gap-2">
        {info.stampable && <SignoffBadge status={info.signoff_status} note={info.signoff_note} />}
        {info.has_pdf ? <PdfButton table={table} id={id} /> : <span className="text-[11px] text-slate-400">No PDF</span>}
      </div>
      {info.signoff_status === "rejected" && info.signoff_note && (
        <span className="max-w-[220px] text-right text-[11px] text-red-600">“{info.signoff_note}”</span>
      )}
      {isSuperAdmin && info.has_pdf && info.stampable && info.signoff_status !== "approved" && (
        <SignoffButtons table={table} id={id} reference={reference} allowReject={info.signoff_status === "pending"} />
      )}
      {isSuperAdmin && <DeleteDocButton table={table} id={id} reference={reference} />}
    </div>
  );
}
