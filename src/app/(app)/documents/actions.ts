"use server";

import { getSession } from "@/lib/auth";
import { sendDocumentAlert, type Issuer } from "@/lib/notifications/sendDocumentAlert";
import { ALL_DOC_TYPES, type AnyDocType } from "@/lib/permissions";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type IssueResult =
  | { ok: true; message: string; id: string | null }
  | { ok: false; error: string; duplicate?: boolean };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const optUuid = (v: unknown) => (typeof v === "string" && UUID.test(v) ? v : null);
const money = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 && n < 1e12 ? Math.round(n * 100) / 100 : 0;
};

async function issuerFrom(): Promise<Issuer | null> {
  const s = await getSession();
  if (!s.configured || !s.userId) return null;
  return { userId: s.userId, fullName: s.fullName, email: s.email, role: s.role };
}

/* ------------------------------ finance documents ------------------------------ */

export interface FinanceIssueInput {
  docType: AnyDocType;
  docNo: string;
  amount: number;
  vat: number;
  total: number;
  clientId?: string;
  developerId?: string;
  dueDate?: string | null;
}

/**
 * Records an issued finance document (RLS applies — permissions & scope are enforced by the
 * database for the signed-in user), then emails the admin alert address.
 */
export async function issueFinanceDocument(input: FinanceIssueInput): Promise<IssueResult> {
  const issuer = await issuerFrom();
  if (!issuer) return { ok: false, error: "You are not signed in." };
  if (!ALL_DOC_TYPES.includes(input.docType)) return { ok: false, error: "Unknown document type." };
  const docNo = String(input.docNo ?? "").trim().slice(0, 80);
  if (!docNo) return { ok: false, error: "The document number is empty." };

  const supabase = await createClient();
  // Attribute the document to the user's linked agent record, when they have one.
  const { data: myAgent } = await supabase.from("agents").select("id").eq("user_id", issuer.userId!).maybeSingle();

  const row = {
    doc_type: input.docType,
    doc_no: docNo,
    client_id: optUuid(input.clientId),
    developer_id: optUuid(input.developerId),
    agent_id: (myAgent?.id as string | undefined) ?? null,
    amount_aed: money(input.amount),
    vat_aed: money(input.vat),
    total_aed: money(input.total),
    status: "issued",
    due_date: typeof input.dueDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(input.dueDate) ? input.dueDate : null,
  };

  const { data: saved, error } = await supabase
    .from("finance_documents")
    .upsert(row, { onConflict: "doc_type,doc_no" })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };
  const id = (saved?.id as string | undefined) ?? null;
  // Re-issuing replaces the document: any earlier PDF / stamp no longer matches its content.
  if (id) {
    await createAdminClient()
      .from("finance_documents")
      .update({ pdf_path: null, pdf_uploaded_at: null, signed_pdf_path: null, stamp_anchor: null, signoff_status: "none", signoff_requested_by: null, signoff_requested_at: null, signed_by: null, signed_at: null, signoff_note: null })
      .eq("id", id);
  }

  // Awaited so the serverless function doesn't stop before the email is out; never throws.
  await sendDocumentAlert({
    kind: "finance",
    issuer,
    doc: {
      doc_type: row.doc_type,
      doc_no: row.doc_no,
      amount_aed: row.amount_aed,
      vat_aed: row.vat_aed,
      total_aed: row.total_aed,
      status: row.status,
      due_date: row.due_date,
    },
    clientId: row.client_id,
    developerId: row.developer_id,
    agentId: row.agent_id,
  });

  return { ok: true, id, message: `${docNo} issued and saved to the CRM (Finance documents).` };
}

/* --------------------------------- letters --------------------------------- */

export interface LetterIssueInput {
  refNo: string;
  templateType: string;
  language: "en" | "ar";
  recipient: string | null;
  subject: string | null;
  bodyHtml: string;
  developerId?: string | null;
  agentId?: string | null;
  clientId?: string | null;
}

export async function issueLetter(input: LetterIssueInput): Promise<IssueResult> {
  const issuer = await issuerFrom();
  if (!issuer) return { ok: false, error: "You are not signed in." };
  if (!/^CW-LTR-\d{4}-\d{4,}$/.test(input.refNo ?? "")) return { ok: false, error: "Invalid reference number." };

  const row = {
    ref_no: input.refNo,
    template_type: String(input.templateType || "general").slice(0, 60),
    language: input.language === "ar" ? "ar" : "en",
    recipient: input.recipient ? String(input.recipient).slice(0, 500) : null,
    subject: input.subject ? String(input.subject).slice(0, 500) : null,
    body_html: String(input.bodyHtml ?? "").slice(0, 200_000),
    developer_id: optUuid(input.developerId),
    agent_id: optUuid(input.agentId),
  };

  const { data: saved, error } = await (await createClient()).from("letters").insert(row).select("id").single();
  if (error) return error.code === "23505" ? { ok: false, error: "already issued", duplicate: true } : { ok: false, error: error.message };

  await sendDocumentAlert({
    kind: "letter",
    issuer,
    letter: {
      ref_no: row.ref_no,
      template_type: row.template_type,
      language: row.language,
      recipient: row.recipient,
      subject: row.subject,
      body_html: row.body_html,
    },
    clientId: optUuid(input.clientId),
    developerId: row.developer_id,
    agentId: row.agent_id,
  });

  return { ok: true, id: (saved?.id as string | undefined) ?? null, message: `${row.ref_no} issued and saved to the CRM.` };
}
