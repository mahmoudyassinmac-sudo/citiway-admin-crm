import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { DEALS_DOC_TYPES, isAdminOrAbove } from "@/lib/permissions";
import { DocumentsBrowser, type FinanceRow, type LetterRow } from "@/components/documents/documents-browser";
import type { ArchiveInfo } from "@/components/documents/pdf-actions";
import type { SignoffStatus } from "@/lib/signoff";

export const metadata = { title: "Documents — Citiway CRM" };

/** Plain-text preview of the stored letter HTML (paragraphs only — tags stripped). */
function htmlToPreview(html: string | null, max = 700): string {
  if (!html) return "";
  const text = html
    .replace(/<\/tr>/gi, "\n")
    .replace(/<\/th>\s*<td>/gi, ": ")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return text.length > max ? `${text.slice(0, max).trimEnd()}…` : text;
}

type LetterJoined = {
  id: string;
  ref_no: string;
  template_type: string;
  language: string;
  recipient: string | null;
  subject: string | null;
  body_html: string | null;
  created_at: string;
  created_by: string | null;
  developer: { developer_name: string } | { developer_name: string }[] | null;
  agent: { full_name: string } | { full_name: string }[] | null;
} & ArchiveCols;

type FinanceJoined = {
  id: string;
  doc_type: string;
  doc_no: string;
  amount_aed: number;
  vat_aed: number;
  total_aed: number;
  status: string;
  due_date: string | null;
  created_at: string;
  created_by: string | null;
  client: { full_name: string } | { full_name: string }[] | null;
  developer: { developer_name: string } | { developer_name: string }[] | null;
} & ArchiveCols;

type ArchiveCols = {
  pdf_path: string | null;
  signed_pdf_path: string | null;
  stamp_anchor: unknown;
  signoff_status: SignoffStatus | null;
  signoff_note: string | null;
};

const ARCHIVE_COLS = "pdf_path, signed_pdf_path, stamp_anchor, signoff_status, signoff_note";

function archiveInfo(r: ArchiveCols): ArchiveInfo {
  return {
    has_pdf: !!(r.signed_pdf_path || r.pdf_path),
    signoff_status: r.signoff_status ?? "none",
    signoff_note: r.signoff_note,
    stampable: !!r.stamp_anchor,
  };
}

/** Supabase returns a to-one FK join as an object normally, but as an array in some query shapes — handle both. */
const one = <T,>(v: T | T[] | null): T | null => (Array.isArray(v) ? v[0] ?? null : v);

export default async function DocumentsPage() {
  const session = await getSession();
  const canSeeLetters = session.permissions.modules.letters;
  const canSeeFinance = session.permissions.modules.finance;
  const canSeeDeals = session.permissions.modules.deals;
  if (!canSeeLetters && !canSeeFinance && !canSeeDeals) redirect("/");

  let letters: LetterRow[] = [];
  let financeDocs: FinanceRow[] = [];
  let dealsDocs: FinanceRow[] = [];

  if (session.configured) {
    const supabase = await createClient();
    const [l, f] = await Promise.all([
      canSeeLetters
        ? supabase
            .from("letters")
            .select(
              `id, ref_no, template_type, language, recipient, subject, body_html, created_at, created_by, ${ARCHIVE_COLS}, developer:developers(developer_name), agent:agents(full_name)`,
            )
            .order("created_at", { ascending: false })
        : Promise.resolve({ data: [] as LetterJoined[] }),
      // finance_documents also holds Deals & Marketing docs (deal_proposal, unit_handover,
      // marketing_approval) — fetch once whenever either module is enabled; RLS scopes each
      // row correctly per-branch, and we split them below by doc_type for display.
      canSeeFinance || canSeeDeals
        ? supabase
            .from("finance_documents")
            .select(
              `id, doc_type, doc_no, amount_aed, vat_aed, total_aed, status, due_date, created_at, created_by, ${ARCHIVE_COLS}, client:clients(full_name), developer:developers(developer_name)`,
            )
            .order("created_at", { ascending: false })
        : Promise.resolve({ data: [] as FinanceJoined[] }),
    ]);

    const lettersData = (l.data ?? []) as LetterJoined[];
    const financeDataAll = (f.data ?? []) as FinanceJoined[];
    const isDealsDoc = (t: string) => (DEALS_DOC_TYPES as readonly string[]).includes(t);
    const financeData = financeDataAll.filter((row) => !isDealsDoc(row.doc_type));
    const dealsData = financeDataAll.filter((row) => isDealsDoc(row.doc_type));

    // No direct FK from letters/finance_documents to profiles (both reference auth.users
    // independently), so PostgREST can't embed it — look names up ourselves, one query.
    const creatorIds = Array.from(
      new Set(
        [...lettersData.map((r) => r.created_by), ...financeDataAll.map((r) => r.created_by)].filter(Boolean) as string[],
      ),
    );
    const names = new Map<string, string>();
    if (creatorIds.length) {
      const { data: profiles } = await supabase.from("profiles").select("id, full_name").in("id", creatorIds);
      for (const p of (profiles ?? []) as { id: string; full_name: string | null }[]) {
        if (p.full_name) names.set(p.id, p.full_name);
      }
    }

    letters = lettersData.map((row) => ({
      id: row.id,
      ref_no: row.ref_no,
      template_type: row.template_type,
      language: row.language,
      recipient: row.recipient,
      subject: row.subject,
      created_at: row.created_at,
      preview: htmlToPreview(row.body_html),
      developer_name: one(row.developer)?.developer_name ?? null,
      agent_name: one(row.agent)?.full_name ?? null,
      issued_by: (row.created_by && names.get(row.created_by)) ?? null,
      archive: archiveInfo(row),
    }));

    financeDocs = financeData.map((row) => ({
      id: row.id,
      doc_type: row.doc_type,
      doc_no: row.doc_no,
      amount_aed: row.amount_aed,
      vat_aed: row.vat_aed,
      total_aed: row.total_aed,
      status: row.status,
      due_date: row.due_date,
      created_at: row.created_at,
      client_name: one(row.client)?.full_name ?? null,
      developer_name: one(row.developer)?.developer_name ?? null,
      issued_by: (row.created_by && names.get(row.created_by)) ?? null,
      archive: archiveInfo(row),
    }));

    dealsDocs = dealsData.map((row) => ({
      id: row.id,
      doc_type: row.doc_type,
      doc_no: row.doc_no,
      amount_aed: row.amount_aed,
      vat_aed: row.vat_aed,
      total_aed: row.total_aed,
      status: row.status,
      due_date: row.due_date,
      created_at: row.created_at,
      client_name: one(row.client)?.full_name ?? null,
      developer_name: one(row.developer)?.developer_name ?? null,
      issued_by: (row.created_by && names.get(row.created_by)) ?? null,
      archive: archiveInfo(row),
    }));
  }

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <h1 className="font-head text-2xl font-bold text-navy">Documents</h1>
      <p className="mb-8 mt-1 text-sm text-slate-500">
        {isAdminOrAbove(session.role) || session.role === "accountant"
          ? "Every letter, invoice, receipt and deals document issued across the team."
          : "Letters, invoices, receipts and deals documents you've issued."}
      </p>
      <DocumentsBrowser
        letters={letters}
        financeDocs={financeDocs}
        dealsDocs={dealsDocs}
        showLetters={canSeeLetters}
        showFinance={canSeeFinance}
        showDeals={canSeeDeals}
        isSuperAdmin={session.role === "super_admin"}
      />
    </div>
  );
}
