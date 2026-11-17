/** Shared permission model (safe for server and client). Mirrors profiles.permissions in Postgres. */

export type Role = "admin" | "accountant" | "agent";
export const ROLES: Role[] = ["admin", "accountant", "agent"];

export const MODULE_KEYS = ["developers", "agents", "deals", "letters", "finance"] as const;
export type ModuleKey = (typeof MODULE_KEYS)[number];

export const DOC_TYPES = ["rental_contract", "receipt", "tax_invoice", "payment_voucher", "other"] as const;
export type DocType = (typeof DOC_TYPES)[number];

/**
 * Deals & Marketing documents (proposals, handover forms, marketing approvals) are stored in
 * `finance_documents` too (for one shared archive) but gated by the Deals module, not by the
 * per-document-type `finance_docs` toggles above — there's no amount/VAT to a handover form.
 */
export const DEALS_DOC_TYPES = ["deal_proposal", "unit_handover", "marketing_approval"] as const;
export type DealsDocType = (typeof DEALS_DOC_TYPES)[number];

export const ALL_DOC_TYPES = [...DOC_TYPES, ...DEALS_DOC_TYPES] as const;
export type AnyDocType = DocType | DealsDocType;

export const ALL_DOC_LABELS: Record<AnyDocType, string> = {
  rental_contract: "Rental Contracts",
  receipt: "Receipts",
  tax_invoice: "Tax Invoices",
  payment_voucher: "Payment Vouchers",
  other: "Other / Expenses",
  deal_proposal: "Property & Deal Proposals",
  unit_handover: "Unit Handover & Inspection Forms",
  marketing_approval: "Marketing Approvals",
};

export type Scope = "own" | "all";

export interface Permissions {
  modules: Record<ModuleKey, boolean>;
  finance_docs: Record<DocType, boolean>;
  can_create_finance: boolean;
  scope: Scope;
}

export const MODULE_LABELS: Record<ModuleKey, string> = {
  developers: "Developers",
  agents: "Agents",
  deals: "Deals & Clients",
  letters: "Official Letters",
  finance: "Finance & Contracts",
};

export const DOC_LABELS: Record<DocType, string> = {
  rental_contract: "Rental Contracts",
  receipt: "Receipts",
  tax_invoice: "Tax Invoices",
  payment_voucher: "Payment Vouchers",
  other: "Other / Expenses",
};

const all = <K extends string>(keys: readonly K[], v: boolean) =>
  Object.fromEntries(keys.map((k) => [k, v])) as Record<K, boolean>;

export function fullAccess(): Permissions {
  return {
    modules: all(MODULE_KEYS, true),
    finance_docs: all(DOC_TYPES, true),
    can_create_finance: true,
    scope: "all",
  };
}

/** Sensible defaults per role, used by the "Add user" form and as the fallback for legacy rows. */
export function presetFor(role: Role): Permissions {
  if (role === "admin" || role === "accountant") return fullAccess();
  return {
    modules: { developers: true, agents: false, deals: true, letters: true, finance: true },
    finance_docs: { rental_contract: true, receipt: true, tax_invoice: false, payment_voucher: false, other: false },
    can_create_finance: true,
    scope: "own",
  };
}

/** Coerce untrusted JSON into a complete Permissions object (missing keys fall back). */
export function normalizePermissions(raw: unknown, fallback: Permissions): Permissions {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const mods = (r.modules && typeof r.modules === "object" ? r.modules : {}) as Record<string, unknown>;
  const docs = (r.finance_docs && typeof r.finance_docs === "object" ? r.finance_docs : {}) as Record<string, unknown>;
  const pick = (v: unknown, d: boolean) => (typeof v === "boolean" ? v : d);
  return {
    modules: Object.fromEntries(MODULE_KEYS.map((k) => [k, pick(mods[k], fallback.modules[k])])) as Permissions["modules"],
    finance_docs: Object.fromEntries(DOC_TYPES.map((k) => [k, pick(docs[k], fallback.finance_docs[k])])) as Permissions["finance_docs"],
    can_create_finance: pick(r.can_create_finance, fallback.can_create_finance),
    scope: r.scope === "own" || r.scope === "all" ? r.scope : fallback.scope,
  };
}

/** Effective permissions: admins always get everything. */
export function resolvePermissions(role: Role, raw: unknown): Permissions {
  if (role === "admin") return fullAccess();
  return normalizePermissions(raw, presetFor(role));
}

export function summarizePermissions(role: Role, p: Permissions): string[] {
  if (role === "admin") return ["Full access"];
  const out: string[] = [];
  const mods = MODULE_KEYS.filter((k) => p.modules[k]).map((k) => MODULE_LABELS[k]);
  out.push(mods.length ? mods.join(", ") : "No modules");
  if (p.modules.finance) {
    const docs = DOC_TYPES.filter((k) => p.finance_docs[k]).map((k) => DOC_LABELS[k]);
    out.push(`Docs: ${docs.length ? docs.join(", ") : "none"}`);
    out.push(p.can_create_finance ? "Can issue" : "View only");
  }
  out.push(p.scope === "all" ? "All records" : "Own records");
  return out;
}
