import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Role } from "@/lib/permissions";

/* ------------------------------------------------------------------ types */

export interface Issuer {
  userId: string | null;
  fullName: string | null;
  email: string | null;
  role: Role;
}

export type DocumentAlert =
  | {
      kind: "letter";
      issuer: Issuer;
      letter: {
        ref_no: string;
        template_type: string;
        language: string;
        recipient: string | null;
        subject: string | null;
        body_html: string | null;
      };
      clientId?: string | null;
      developerId?: string | null;
      agentId?: string | null;
      isTest?: boolean;
    }
  | {
      kind: "finance";
      issuer: Issuer;
      doc: {
        doc_type: string;
        doc_no: string;
        amount_aed: number;
        vat_aed: number;
        total_aed: number;
        status: string;
        due_date: string | null;
      };
      clientId?: string | null;
      developerId?: string | null;
      agentId?: string | null;
      isTest?: boolean;
    };

export interface DeliveryResult {
  /** "sent" | "skipped: …" | "failed: …" */
  email: string;
  webhook: string;
  recipient: string | null;
}

const DOC_CATEGORY: Record<string, string> = {
  rental_contract: "Rental Contract",
  receipt: "Receipt",
  tax_invoice: "Tax Invoice",
  payment_voucher: "Payment Voucher",
  other: "Other Document",
  deal_proposal: "Property & Deal Proposal",
  unit_handover: "Unit Handover & Inspection Form",
  marketing_approval: "Marketing Approval",
};

/* ---------------------------------------------------------------- helpers */

const esc = (v: unknown) =>
  String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const aed = (n: number) =>
  `AED ${(Number(n) || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function dubaiTimestamp(d = new Date()): string {
  const s = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Dubai",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);
  return `${s} GST (UTC+4)`;
}

/** Plain-text preview of the stored letter HTML (paragraphs + detail table rows). */
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

export function appUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_APP_URL;
  if (explicit) return explicit.replace(/\/$/, "");
  const host = process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL;
  return host ? `https://${host}` : "";
}

async function resolveNames(a: DocumentAlert) {
  const admin = createAdminClient();
  const [client, developer, agent] = await Promise.all([
    a.clientId ? admin.from("clients").select("full_name").eq("id", a.clientId).maybeSingle() : null,
    a.developerId ? admin.from("developers").select("developer_name").eq("id", a.developerId).maybeSingle() : null,
    a.agentId ? admin.from("agents").select("full_name, rera_brn").eq("id", a.agentId).maybeSingle() : null,
  ]);
  return {
    client: (client?.data?.full_name as string | undefined) ?? null,
    developer: (developer?.data?.developer_name as string | undefined) ?? null,
    agent: agent?.data
      ? `${agent.data.full_name}${agent.data.rera_brn ? ` (BRN ${agent.data.rera_brn})` : ""}`
      : null,
  };
}

/* ------------------------------------------------------------------ email */

function row(label: string, value: string | null | undefined) {
  if (!value) return "";
  return `<tr><td style="padding:8px 12px;background:#F4F8FC;color:#1E3553;font-weight:600;width:170px;border-bottom:1px solid #E1E9F4;vertical-align:top">${esc(label)}</td><td style="padding:8px 12px;border-bottom:1px solid #E1E9F4;color:#111827;white-space:pre-line">${esc(value)}</td></tr>`;
}

function section(title: string, rows: string) {
  if (!rows) return "";
  return `<h3 style="margin:22px 0 8px;font:700 12px/1.2 Arial,sans-serif;letter-spacing:.06em;text-transform:uppercase;color:#1E3553">${esc(title)}</h3>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border:1px solid #C9D9EE;border-radius:8px;border-collapse:separate;font:14px/1.45 Arial,sans-serif">${rows}</table>`;
}

interface Built {
  subject: string;
  html: string;
  category: string;
  reference: string;
  link: string;
  names: { client: string | null; developer: string | null; agent: string | null };
  timestamp: string;
}

async function build(a: DocumentAlert, companyName: string): Promise<Built> {
  const names = await resolveNames(a);
  const timestamp = dubaiTimestamp();
  const isLetter = a.kind === "letter";
  const category = isLetter ? "Official Letter" : (DOC_CATEGORY[a.doc.doc_type] ?? "Finance Document");
  const reference = isLetter ? a.letter.ref_no : a.doc.doc_no;
  // Points at the Documents archive, where the issued record itself is listed
  // (not the builder page, which only creates new ones).
  const base = appUrl();
  const link = `${base}/documents`;
  const issuer = a.issuer;
  const issuerName = issuer.fullName || issuer.email || "Unknown user";

  let details = "";
  if (a.kind === "finance") {
    details = section(
      "Financial summary",
      row("Base amount", aed(a.doc.amount_aed)) +
        row("VAT", aed(a.doc.vat_aed)) +
        row("Total", aed(a.doc.total_aed)) +
        row("Status", a.doc.status) +
        row("Due date", a.doc.due_date),
    );
  } else {
    const preview = htmlToPreview(a.letter.body_html);
    details =
      section(
        "Letter details",
        row("Template", a.letter.template_type.replace(/_/g, " ")) +
          row("Language", a.letter.language === "ar" ? "Arabic" : "English") +
          row("Recipient", a.letter.recipient) +
          row("Subject", a.letter.subject),
      ) +
      (preview
        ? `<div style="margin-top:10px;padding:12px;border:1px solid #E1E9F4;border-radius:8px;background:#FAFBFD;font:13px/1.5 Arial,sans-serif;color:#374151;white-space:pre-line" ${a.letter.language === "ar" ? 'dir="rtl"' : ""}>${esc(preview)}</div>`
        : "");
  }

  const html = `<!doctype html><html><body style="margin:0;padding:24px;background:#F3F5F8">
<div style="max-width:640px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #D6DEE8">
  <div style="background:#1E3553;color:#fff;padding:18px 24px;font:700 16px/1.3 Arial,sans-serif">${esc(companyName)} <span style="font-weight:400;color:#C9D9EE">· Document issued</span></div>
  <div style="padding:24px">
    ${a.isTest ? `<p style="margin:0 0 16px;padding:10px 12px;background:#FEF3C7;border:1px solid #F59E0B;border-radius:8px;font:13px Arial,sans-serif;color:#92400E"><b>Test alert</b> — sample data only. Your alert email is configured correctly.</p>` : ""}
    <p style="margin:0 0 4px;font:13px Arial,sans-serif;color:#6B7280">${esc(category)}</p>
    <p style="margin:0 0 16px;font:700 22px/1.2 Arial,sans-serif;color:#1E3553">${esc(reference)}</p>
    ${section(
      "Issued by",
      row("Name", issuerName) + row("Email", issuer.email) + row("Role", issuer.role),
    )}
    ${section("Related parties", row("Client", names.client) + row("Developer", names.developer) + row("Linked agent", names.agent))}
    ${details}
    <p style="margin:22px 0 6px;font:13px Arial,sans-serif;color:#6B7280">Issued ${esc(timestamp)}</p>
    ${link.startsWith("http") ? `<a href="${esc(link)}" style="display:inline-block;margin-top:8px;background:#1E3553;color:#fff;text-decoration:none;font:600 14px Arial,sans-serif;padding:10px 18px;border-radius:8px">View in CRM</a>` : ""}
  </div>
  <div style="padding:14px 24px;background:#F4F8FC;font:11px Arial,sans-serif;color:#6B7280">Automatic confirmation &amp; audit notice from the ${esc(companyName)} back-office CRM.</div>
</div></body></html>`;

  return {
    subject: `${a.isTest ? "[TEST] " : ""}[${companyName}] ${category} issued — ${reference} by ${issuerName}`,
    html,
    category,
    reference,
    link,
    names,
    timestamp,
  };
}

/* ---------------------------------------------------------------- delivery */

async function sendViaResend(to: string, subject: string, html: string): Promise<string> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return "skipped: RESEND_API_KEY is not configured";
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: process.env.ALERT_FROM_EMAIL || "Citiway CRM <onboarding@resend.dev>",
        to: [to],
        subject,
        html,
      }),
      signal: AbortSignal.timeout(8000),
    });
    if (res.ok) return "sent";
    const body = (await res.json().catch(() => ({}))) as { message?: string };
    return `failed: Resend ${res.status}${body.message ? ` — ${body.message}` : ""}`;
  } catch (e) {
    return `failed: ${e instanceof Error ? e.message : "network error"}`;
  }
}

async function postWebhook(payload: unknown): Promise<string> {
  const url = process.env.N8N_DOCUMENT_WEBHOOK_URL;
  if (!url) return "skipped: N8N_DOCUMENT_WEBHOOK_URL is not configured";
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(8000),
    });
    return res.ok ? "sent" : `failed: webhook responded ${res.status}`;
  } catch (e) {
    return `failed: ${e instanceof Error ? e.message : "network error"}`;
  }
}

/**
 * Sends the confirmation / audit alert for an issued letter or finance document.
 * Never throws: failures are logged and returned so callers can ignore or display them.
 * Callers should `await` it so serverless functions don't stop before delivery finishes.
 */
export async function sendDocumentAlert(alert: DocumentAlert): Promise<DeliveryResult> {
  const result: DeliveryResult = { email: "skipped", webhook: "skipped", recipient: null };
  try {
    const { data: settings } = await createAdminClient()
      .from("company_settings")
      .select("admin_alert_email, company_name")
      .eq("id", 1)
      .maybeSingle();

    const to = (settings?.admin_alert_email as string | null)?.trim() || null;
    if (!to) {
      result.email = "skipped: no admin alert email is set";
      return result; // nothing configured — exit silently
    }
    result.recipient = to;

    const companyName = (settings?.company_name as string | null) || "Citiway Real Estate";
    const built = await build(alert, companyName);

    const payload = {
      event: alert.isTest ? "document.test" : "document.issued",
      category: built.category,
      reference: built.reference,
      issued_by: alert.issuer,
      related: built.names,
      record: alert.kind === "letter" ? alert.letter : alert.doc,
      issued_at: new Date().toISOString(),
      issued_at_dubai: built.timestamp,
      link: built.link,
      recipient: to,
    };

    [result.email, result.webhook] = await Promise.all([
      sendViaResend(to, built.subject, built.html),
      postWebhook(payload),
    ]);
  } catch (e) {
    result.email = `failed: ${e instanceof Error ? e.message : "unexpected error"}`;
  }
  if (result.email.startsWith("failed") || result.webhook.startsWith("failed")) {
    console.error("[sendDocumentAlert]", result);
  }
  return result;
}

/** Plain email to the admin alert address (e.g. "a document is waiting for your stamp"). Never throws. */
export async function sendAdminNotice(subject: string, html: string): Promise<string> {
  try {
    const { data } = await createAdminClient()
      .from("company_settings")
      .select("admin_alert_email")
      .eq("id", 1)
      .maybeSingle();
    const to = (data?.admin_alert_email as string | null)?.trim();
    if (!to) return "skipped: no admin alert email is set";
    const r = await sendViaResend(to, subject, html);
    if (r.startsWith("failed")) console.error("[sendAdminNotice]", r);
    return r;
  } catch (e) {
    return `failed: ${e instanceof Error ? e.message : "unexpected error"}`;
  }
}

/** Sample alert used by the "Send Test Email" button. */
export function sampleAlert(issuer: Issuer): DocumentAlert {
  return {
    kind: "finance",
    isTest: true,
    issuer,
    doc: {
      doc_type: "receipt",
      doc_no: "CW-RCT-TEST-0001",
      amount_aed: 10000,
      vat_aed: 500,
      total_aed: 10500,
      status: "issued",
      due_date: null,
    },
  };
}
