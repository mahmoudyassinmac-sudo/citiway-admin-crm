import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { DocumentsBrowser, type FinanceRow, type LetterRow } from "@/components/documents/documents-browser";

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
};

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
};

/** Supabase returns a to-one FK join as an object normally, but as an array in some query shapes — handle both. */
const one = <T,>(v: T | T[] | null): T | null => (Array.isArray(v) ? v[0] ?? null : v);

export default async function DocumentsPage() {
  const session = await getSession();
  const canSeeLetters = session.permissions.modules.letters;
  const canSeeFinance = session.permissions.modules.finance;
  if (!canSeeLetters && !canSeeFinance) redirect("/");

  let letters: LetterRow[] = [];
  let financeDocs: FinanceRow[] = [];

  if (session.configured) {
    const supabase = await createClient();
    const [l, f] = await Promise.all([
      canSeeLetters
        ? supabase
            .from("letters")
            .select(
              "id, ref_no, template_type, language, recipient, subject, body_html, created_at, created_by, developer:developers(developer_name), agent:agents(full_name)",
            )
            .order("created_at", { ascending: false })
        : Promise.resolve({ data: [] as LetterJoined[] }),
      canSeeFinance
        ? supabase
            .from("finance_documents")
            .select(
              "id, doc_type, doc_no, amount_aed, vat_aed, total_aed, status, due_date, created_at, created_by, client:clients(full_name), developer:developers(developer_name)",
            )
            .order("created_at", { ascending: false })
        : Promise.resolve({ data: [] as FinanceJoined[] }),
    ]);

    const lettersData = (l.data ?? []) as LetterJoined[];
    const financeData = (f.data ?? []) as FinanceJoined[];

    // No direct FK from letters/finance_documents to profiles (both reference auth.users
    // independently), so PostgREST can't embed it — look names up ourselves, one query.
    const creatorIds = Array.from(
      new Set([...lettersData.map((r) => r.created_by), ...financeData.map((r) => r.created_by)].filter(Boolean) as string[]),
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
    }));
  }

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <h1 className="font-head text-2xl font-bold text-navy">Documents</h1>
      <p className="mb-8 mt-1 text-sm text-slate-500">
        {session.role === "admin" || session.role === "accountant"
          ? "Every letter, invoice and receipt issued across the team."
          : "Letters, invoices and receipts you've issued."}
      </p>
      <DocumentsBrowser letters={letters} financeDocs={financeDocs} showLetters={canSeeLetters} showFinance={canSeeFinance} />
    </div>
  );
}
