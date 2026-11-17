/** Shared (client + server) types for the PDF archive and Super Admin sign-off. */

export type DocTable = "letters" | "finance_documents";
export const DOC_TABLES: DocTable[] = ["letters", "finance_documents"];

/** Where the stamp goes, as fractions of the A4 page (top-left origin), plus horizontal alignment. */
export interface StampAnchor {
  page: number;
  x: number;
  y: number;
  w: number;
  h: number;
  align: "left" | "center" | "right";
}

/** What the issuer chose: stamp now (Super Admin only), ask the Super Admin, or no stamp. */
export type SignoffMode = "stamp" | "request" | "none";

export type SignoffStatus = "none" | "pending" | "approved" | "rejected";

export const SIGNOFF_LABEL: Record<SignoffStatus, string> = {
  none: "No stamp",
  pending: "Awaiting stamp",
  approved: "Stamped",
  rejected: "Rejected",
};

export function isValidAnchor(a: unknown): a is StampAnchor {
  if (!a || typeof a !== "object") return false;
  const o = a as Record<string, unknown>;
  const frac = (v: unknown) => typeof v === "number" && Number.isFinite(v) && v >= -0.2 && v <= 1.2;
  return (
    Number.isInteger(o.page) && (o.page as number) >= 0 && (o.page as number) < 50 &&
    frac(o.x) && frac(o.y) && frac(o.w) && frac(o.h) &&
    (o.w as number) > 0.01 && (o.h as number) > 0.005 &&
    (o.align === "left" || o.align === "center" || o.align === "right")
  );
}
