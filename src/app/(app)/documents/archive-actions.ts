"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth";
import { brandPaths, loadBrandImage, type BrandImage } from "@/lib/brand";
import { appUrl, sendAdminNotice } from "@/lib/notifications/sendDocumentAlert";
import { DOC_TABLES, isValidAnchor, type DocTable, type SignoffMode, type StampAnchor } from "@/lib/signoff";
import { stampPdf } from "@/lib/stamp-pdf";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const BUCKET = "documents";

function validTarget(table: unknown, id: unknown): table is DocTable {
  return DOC_TABLES.includes(table as DocTable) && typeof id === "string" && UUID.test(id);
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Row as the signed-in user may see it (RLS decides) — the gate for touching its PDF. */
async function visibleRow(table: DocTable, id: string) {
  const { data } = await (await createClient())
    .from(table)
    .select("id, signoff_status")
    .eq("id", id)
    .maybeSingle();
  return data as { id: string; signoff_status: string } | null;
}

function reference(table: DocTable, row: Record<string, unknown>): string {
  return String((table === "letters" ? row.ref_no : row.doc_no) ?? "document");
}

/* --------------------------------------------------------------- archive upload */

/** Step 1: a short-lived signed upload URL for this document's PDF (the browser uploads it directly). */
export async function prepareArchiveUpload(table: DocTable, id: string): Promise<Result<{ path: string; token: string }>> {
  const s = await getSession();
  if (!s.configured || !s.userId) return { ok: false, error: "You are not signed in." };
  if (!validTarget(table, id)) return { ok: false, error: "Invalid document." };
  const row = await visibleRow(table, id);
  if (!row) return { ok: false, error: "Document not found." };
  if (row.signoff_status === "approved" && s.role !== "super_admin")
    return { ok: false, error: "This document is already stamped — re-issue it to change it." };

  const path = `${table}/${id}/${Date.now()}.pdf`;
  const { data, error } = await createAdminClient().storage.from(BUCKET).createSignedUploadUrl(path);
  if (error || !data) return { ok: false, error: error?.message ?? "Could not prepare the upload." };
  return { ok: true, path, token: data.token };
}

/** Step 2: record the uploaded PDF, where its stamp goes, and the sign-off choice. */
export async function finalizeArchive(input: {
  table: DocTable;
  id: string;
  path: string;
  anchor: StampAnchor | null;
  mode: SignoffMode;
}): Promise<Result<{ message: string }>> {
  const s = await getSession();
  if (!s.configured || !s.userId) return { ok: false, error: "You are not signed in." };
  const { table, id, path } = input;
  if (!validTarget(table, id)) return { ok: false, error: "Invalid document." };
  if (typeof path !== "string" || !new RegExp(`^${table}/${id}/\\d+\\.pdf$`).test(path))
    return { ok: false, error: "Invalid file path." };
  const row = await visibleRow(table, id);
  if (!row) return { ok: false, error: "Document not found." };
  if (row.signoff_status === "approved" && s.role !== "super_admin")
    return { ok: false, error: "This document is already stamped." };

  const admin = createAdminClient();
  // The file must really be there (uploaded through the URL we issued).
  const folder = path.slice(0, path.lastIndexOf("/"));
  const { data: files } = await admin.storage.from(BUCKET).list(folder, { search: path.slice(folder.length + 1) });
  if (!files?.length) return { ok: false, error: "The PDF upload was not found." };

  const anchor = isValidAnchor(input.anchor) ? input.anchor : null;
  let mode: SignoffMode = input.mode;
  if (!anchor) mode = "none"; // this document type has no stamp slot
  if (mode === "stamp" && s.role !== "super_admin") mode = "request"; // only the Super Admin stamps

  const now = new Date().toISOString();
  const base = {
    pdf_path: path,
    pdf_uploaded_at: now,
    stamp_anchor: anchor,
    signoff_note: null,
  };
  const patch =
    mode === "stamp"
      ? { ...base, signoff_status: "approved", signed_pdf_path: path, signed_by: s.userId, signed_at: now, signoff_requested_by: null, signoff_requested_at: null }
      : mode === "request"
        ? { ...base, signoff_status: "pending", signed_pdf_path: null, signed_by: null, signed_at: null, signoff_requested_by: s.userId, signoff_requested_at: now }
        : { ...base, signoff_status: "none", signed_pdf_path: null, signed_by: null, signed_at: null, signoff_requested_by: null, signoff_requested_at: null };

  const { data: updated, error } = await admin
    .from(table)
    .update(patch)
    .eq("id", id)
    .select(table === "letters" ? "ref_no, subject" : "doc_no, doc_type")
    .single();
  if (error) return { ok: false, error: error.message };
  const ref = reference(table, updated as unknown as Record<string, unknown>);

  if (mode === "request") {
    const who = s.fullName || s.email || "A team member";
    const link = appUrl() ? `${appUrl()}/approvals` : "";
    await sendAdminNotice(
      `[Citiway CRM] Stamp & signature requested — ${ref}`,
      `<div style="font:14px/1.6 Arial,sans-serif;color:#1E3553">
        <p><b>${esc(who)}</b> issued <b>${esc(ref)}</b> and is waiting for the company stamp &amp; signature.</p>
        ${link ? `<a href="${esc(link)}" style="display:inline-block;background:#1E3553;color:#fff;text-decoration:none;font-weight:600;padding:10px 18px;border-radius:8px">Open approvals</a>` : ""}
      </div>`,
    );
  }

  revalidatePath("/documents");
  revalidatePath("/approvals");
  const message =
    mode === "stamp"
      ? `PDF archived — stamped & signed.`
      : mode === "request"
        ? `PDF archived — sent to the Super Admin for stamp & signature.`
        : `PDF archived.`;
  return { ok: true, message };
}

/* --------------------------------------------------------------- download */

/** Signed link to the archived PDF (stamped version when there is one). RLS decides who may open it. */
export async function getDocumentPdfUrl(table: DocTable, id: string, which: "latest" | "original" = "latest"): Promise<Result<{ url: string }>> {
  const s = await getSession();
  if (!s.configured || !s.userId) return { ok: false, error: "You are not signed in." };
  if (!validTarget(table, id)) return { ok: false, error: "Invalid document." };
  const { data } = await (await createClient())
    .from(table)
    .select("pdf_path, signed_pdf_path")
    .eq("id", id)
    .maybeSingle();
  if (!data) return { ok: false, error: "Document not found." };
  const path = which === "original" ? data.pdf_path : data.signed_pdf_path || data.pdf_path;
  if (!path) return { ok: false, error: "No PDF has been archived for this document yet." };
  const { data: signed, error } = await createAdminClient().storage.from(BUCKET).createSignedUrl(path, 300);
  if (error || !signed) return { ok: false, error: error?.message ?? "Could not open the PDF." };
  return { ok: true, url: signed.signedUrl };
}

/* --------------------------------------------------------------- sign-off (Super Admin) */

async function superAdmin() {
  const s = await getSession();
  return s.configured && s.userId && s.role === "super_admin" ? s : null;
}

/** Applies the company stamp (and signature) to the archived PDF and marks it approved. */
export async function approveDocument(table: DocTable, id: string): Promise<Result<{ message: string }>> {
  const s = await superAdmin();
  if (!s) return { ok: false, error: "Only the Super Admin can stamp documents." };
  if (!validTarget(table, id)) return { ok: false, error: "Invalid document." };

  const admin = createAdminClient();
  const { data: row } = await admin
    .from(table)
    .select(`pdf_path, stamp_anchor, signoff_status, ${table === "letters" ? "ref_no" : "doc_no"}`)
    .eq("id", id)
    .maybeSingle();
  if (!row) return { ok: false, error: "Document not found." };
  const r = row as unknown as Record<string, unknown>;
  if (r.signoff_status === "approved") return { ok: false, error: "Already stamped." };
  if (!r.pdf_path) return { ok: false, error: "This document has no archived PDF to stamp." };
  if (!isValidAnchor(r.stamp_anchor)) return { ok: false, error: "This document type has no stamp area." };

  const { data: file, error: dlErr } = await admin.storage.from(BUCKET).download(r.pdf_path as string);
  if (dlErr || !file) return { ok: false, error: "Could not read the archived PDF." };

  const paths = await brandPaths();
  const images = (await Promise.all(
    (paths.signature ? (["signature", "stamp"] as const) : (["stamp"] as const)).map((k) => loadBrandImage(k, paths)),
  )).filter(Boolean) as BrandImage[];
  if (!images.length) return { ok: false, error: "No stamp image is configured." };

  const ref = reference(table, r);
  let stamped: Uint8Array;
  try {
    stamped = await stampPdf(new Uint8Array(await file.arrayBuffer()), r.stamp_anchor, images, {
      approvedBy: s.fullName || s.email || "Super Admin",
      reference: ref,
    });
  } catch (e) {
    return { ok: false, error: `Could not stamp the PDF: ${e instanceof Error ? e.message : "error"}` };
  }

  const signedPath = `${table}/${id}/signed-${Date.now()}.pdf`;
  const { error: upErr } = await admin.storage.from(BUCKET).upload(signedPath, stamped, { contentType: "application/pdf" });
  if (upErr) return { ok: false, error: upErr.message };

  const { error } = await admin
    .from(table)
    .update({ signoff_status: "approved", signed_pdf_path: signedPath, signed_by: s.userId, signed_at: new Date().toISOString(), signoff_note: null })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/approvals");
  revalidatePath("/documents");
  return { ok: true, message: `${ref} stamped & signed.` };
}

export async function rejectDocument(table: DocTable, id: string, note: string): Promise<Result<{ message: string }>> {
  const s = await superAdmin();
  if (!s) return { ok: false, error: "Only the Super Admin can review documents." };
  if (!validTarget(table, id)) return { ok: false, error: "Invalid document." };
  const { error } = await createAdminClient()
    .from(table)
    .update({ signoff_status: "rejected", signoff_note: String(note ?? "").trim().slice(0, 1000) || null, signed_by: s.userId, signed_at: new Date().toISOString() })
    .eq("id", id)
    .neq("signoff_status", "approved");
  if (error) return { ok: false, error: error.message };
  revalidatePath("/approvals");
  revalidatePath("/documents");
  return { ok: true, message: "Returned to the issuer." };
}

/* --------------------------------------------------------------- delete (Super Admin) */

/** Permanently deletes a document record and every PDF archived for it. Super Admin only. */
export async function deleteDocument(table: DocTable, id: string): Promise<Result<{ message: string }>> {
  const s = await superAdmin();
  if (!s) return { ok: false, error: "Only the Super Admin can delete documents." };
  if (!validTarget(table, id)) return { ok: false, error: "Invalid document." };

  const admin = createAdminClient();
  const { data: row } = await admin
    .from(table)
    .select(table === "letters" ? "ref_no" : "doc_no")
    .eq("id", id)
    .maybeSingle();
  if (!row) return { ok: false, error: "Document not found (maybe already deleted)." };
  const ref = reference(table, row as unknown as Record<string, unknown>);

  // Remove the archived PDFs (original + stamped copies) first, then the record.
  const folder = `${table}/${id}`;
  const { data: files } = await admin.storage.from(BUCKET).list(folder, { limit: 1000 });
  if (files?.length) {
    const { error: rmErr } = await admin.storage.from(BUCKET).remove(files.map((f) => `${folder}/${f.name}`));
    if (rmErr) return { ok: false, error: `Could not delete the PDF files: ${rmErr.message}` };
  }

  const { error } = await admin.from(table).delete().eq("id", id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/documents");
  revalidatePath("/approvals");
  revalidatePath("/");
  return { ok: true, message: `${ref} deleted.` };
}
