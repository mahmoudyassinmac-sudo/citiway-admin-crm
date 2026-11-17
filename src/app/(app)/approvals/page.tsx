import { Stamp } from "lucide-react";
import { requireSuperAdmin } from "@/lib/auth";
import { listApprovals, type ApprovalItem } from "@/lib/approvals";
import { PdfButton, SignoffBadge, SignoffButtons } from "@/components/documents/pdf-actions";

export const metadata = { title: "Approvals — Citiway CRM" };

const fmt = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Dubai" })
    : "—";

function Row({ item, pending }: { item: ApprovalItem; pending: boolean }) {
  return (
    <tr className="align-top hover:bg-slate-50/60">
      <td className="px-4 py-3">
        <div className="font-semibold text-navy">{item.reference}</div>
        <div className="text-xs capitalize text-slate-400">{item.kind}</div>
      </td>
      <td className="px-4 py-3 text-slate-600">{item.detail}</td>
      <td className="px-4 py-3 text-slate-600">
        <div>{item.requestedBy ?? "—"}</div>
        <div className="text-xs text-slate-400">{fmt(item.requestedAt)}</div>
      </td>
      {!pending && (
        <td className="px-4 py-3">
          <SignoffBadge status={item.status} />
          <div className="mt-1 text-xs text-slate-400">{fmt(item.decidedAt)}</div>
          {item.note && <div className="mt-1 max-w-[220px] text-xs text-red-600">“{item.note}”</div>}
        </td>
      )}
      <td className="px-4 py-3 text-right">
        <div className="flex flex-col items-end gap-2">
          <div className="flex gap-3">
            {pending ? (
              <PdfButton table={item.table} id={item.id} which="original" label="Review PDF" />
            ) : (
              <PdfButton table={item.table} id={item.id} label={item.status === "approved" ? "Stamped PDF" : "PDF"} />
            )}
          </div>
          {pending && <SignoffButtons table={item.table} id={item.id} reference={item.reference} />}
        </div>
      </td>
    </tr>
  );
}

export default async function ApprovalsPage() {
  await requireSuperAdmin();
  let data: { pending: ApprovalItem[]; recent: ApprovalItem[] } = { pending: [], recent: [] };
  let error: string | null = null;
  try {
    data = await listApprovals();
  } catch (e) {
    error = e instanceof Error ? e.message : "Could not load approvals.";
  }

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <h1 className="flex items-center gap-2 font-head text-2xl font-bold text-navy">
        <Stamp className="h-6 w-6 text-amber-600" /> Approvals
      </h1>
      <p className="mb-8 mt-1 text-sm text-slate-500">
        Documents waiting for the company stamp &amp; signature. Review the PDF, then approve to stamp it — the stamped copy
        replaces the draft in Documents for everyone who can see it.
      </p>
      {error && <p className="mb-6 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      <h2 className="mb-3 font-head text-base font-semibold text-navy">Waiting for you ({data.pending.length})</h2>
      <div className="mb-10 overflow-x-auto rounded-2xl glass">
        {data.pending.length === 0 ? (
          <p className="p-6 text-sm text-slate-400">Nothing waiting — all caught up.</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-slate-400">
              <tr>
                <th className="px-4 py-3">Document</th>
                <th className="px-4 py-3">Details</th>
                <th className="px-4 py-3">Requested by</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.pending.map((i) => <Row key={`${i.table}-${i.id}`} item={i} pending />)}
            </tbody>
          </table>
        )}
      </div>

      <h2 className="mb-3 font-head text-base font-semibold text-navy">Recently decided</h2>
      <div className="overflow-x-auto rounded-2xl glass">
        {data.recent.length === 0 ? (
          <p className="p-6 text-sm text-slate-400">No decisions yet.</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-slate-400">
              <tr>
                <th className="px-4 py-3">Document</th>
                <th className="px-4 py-3">Details</th>
                <th className="px-4 py-3">Requested by</th>
                <th className="px-4 py-3">Decision</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.recent.map((i) => <Row key={`${i.table}-${i.id}`} item={i} pending={false} />)}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
