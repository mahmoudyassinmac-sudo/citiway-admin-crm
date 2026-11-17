import "server-only";
import { ALL_DOC_LABELS, type AnyDocType } from "@/lib/permissions";
import type { DocTable, SignoffStatus } from "@/lib/signoff";
import { createAdminClient } from "@/lib/supabase/admin";

export interface ApprovalItem {
  table: DocTable;
  id: string;
  reference: string;
  kind: string;
  detail: string;
  status: SignoffStatus;
  requestedBy: string | null;
  requestedAt: string | null;
  decidedBy: string | null;
  decidedAt: string | null;
  note: string | null;
}

/** Super Admin only (callers check the role) — reads across everyone's documents. */
export async function countPendingApprovals(): Promise<number> {
  try {
    const admin = createAdminClient();
    const [a, b] = await Promise.all([
      admin.from("letters").select("id", { count: "exact", head: true }).eq("signoff_status", "pending"),
      admin.from("finance_documents").select("id", { count: "exact", head: true }).eq("signoff_status", "pending"),
    ]);
    return (a.count ?? 0) + (b.count ?? 0);
  } catch {
    return 0; // migration not applied yet / no service key — never break the layout
  }
}

const AED = (n: unknown) => `AED ${(Number(n) || 0).toLocaleString("en-US", { maximumFractionDigits: 2 })}`;

export async function listApprovals(): Promise<{ pending: ApprovalItem[]; recent: ApprovalItem[] }> {
  const admin = createAdminClient();
  const common = "id, signoff_status, signoff_requested_by, signoff_requested_at, signed_by, signed_at, signoff_note, created_by, created_at";
  const [lp, fp, lr, fr] = await Promise.all([
    admin.from("letters").select(`${common}, ref_no, subject, template_type`).eq("signoff_status", "pending").order("signoff_requested_at"),
    admin.from("finance_documents").select(`${common}, doc_no, doc_type, total_aed`).eq("signoff_status", "pending").order("signoff_requested_at"),
    admin.from("letters").select(`${common}, ref_no, subject, template_type`).in("signoff_status", ["approved", "rejected"]).not("signed_at", "is", null).order("signed_at", { ascending: false }).limit(15),
    admin.from("finance_documents").select(`${common}, doc_no, doc_type, total_aed`).in("signoff_status", ["approved", "rejected"]).not("signed_at", "is", null).order("signed_at", { ascending: false }).limit(15),
  ]);

  type Row = Record<string, unknown>;
  const rowsL = [...(lp.data ?? []), ...(lr.data ?? [])] as Row[];
  const rowsF = [...(fp.data ?? []), ...(fr.data ?? [])] as Row[];
  const ids = new Set<string>();
  for (const r of [...rowsL, ...rowsF]) for (const k of ["signoff_requested_by", "signed_by", "created_by"]) if (r[k]) ids.add(r[k] as string);
  const names = new Map<string, string>();
  if (ids.size) {
    const { data } = await admin.from("profiles").select("id, full_name").in("id", [...ids]);
    for (const p of (data ?? []) as { id: string; full_name: string | null }[]) if (p.full_name) names.set(p.id, p.full_name);
  }
  const name = (v: unknown) => (typeof v === "string" ? names.get(v) ?? null : null);

  const fromLetter = (r: Row): ApprovalItem => ({
    table: "letters",
    id: r.id as string,
    reference: r.ref_no as string,
    kind: `Letter · ${String(r.template_type ?? "general").replace(/_/g, " ")}`,
    detail: (r.subject as string | null) || "Untitled",
    status: r.signoff_status as SignoffStatus,
    requestedBy: name(r.signoff_requested_by) ?? name(r.created_by),
    requestedAt: (r.signoff_requested_at as string | null) ?? (r.created_at as string),
    decidedBy: name(r.signed_by),
    decidedAt: r.signed_at as string | null,
    note: r.signoff_note as string | null,
  });
  const fromFinance = (r: Row): ApprovalItem => ({
    table: "finance_documents",
    id: r.id as string,
    reference: r.doc_no as string,
    kind: ALL_DOC_LABELS[r.doc_type as AnyDocType] ?? String(r.doc_type),
    detail: AED(r.total_aed),
    status: r.signoff_status as SignoffStatus,
    requestedBy: name(r.signoff_requested_by) ?? name(r.created_by),
    requestedAt: (r.signoff_requested_at as string | null) ?? (r.created_at as string),
    decidedBy: name(r.signed_by),
    decidedAt: r.signed_at as string | null,
    note: r.signoff_note as string | null,
  });

  const pending = [...((lp.data ?? []) as Row[]).map(fromLetter), ...((fp.data ?? []) as Row[]).map(fromFinance)].sort((a, b) =>
    String(a.requestedAt).localeCompare(String(b.requestedAt)),
  );
  const recent = [...((lr.data ?? []) as Row[]).map(fromLetter), ...((fr.data ?? []) as Row[]).map(fromFinance)]
    .sort((a, b) => String(b.decidedAt).localeCompare(String(a.decidedAt)))
    .slice(0, 15);
  return { pending, recent };
}
