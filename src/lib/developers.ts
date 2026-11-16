/** Shared developer-agreement status logic (used by the UI, dashboard, letters and the cron route). */

export type DeveloperStatus = "active" | "expiring" | "expired";

export const EXPIRY_WARNING_DAYS = 30;

export interface Developer {
  id: string;
  developer_name: string;
  start_date: string;
  end_date: string;
  has_noc: boolean;
  agreement_pdf_url: string | null;
  noc_pdf_url: string | null;
  notes: string | null;
  last_reminded_at: string | null;
  created_at: string;
  updated_at: string;
}

/** Today's calendar date (YYYY-MM-DD) in Dubai, independent of server timezone. */
export function todayInDubai(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Dubai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/** Whole calendar days from today (Dubai) until `endDate`. Negative when expired. */
export function daysLeft(endDate: string, today: string = todayInDubai()): number {
  const [ey, em, ed] = endDate.split("-").map(Number);
  const [ty, tm, td] = today.split("-").map(Number);
  return Math.round((Date.UTC(ey, em - 1, ed) - Date.UTC(ty, tm - 1, td)) / 86_400_000);
}

export function developerStatus(endDate: string, today?: string): DeveloperStatus {
  const d = daysLeft(endDate, today);
  if (d < 0) return "expired";
  if (d <= EXPIRY_WARNING_DAYS) return "expiring";
  return "active";
}

/** Add `days` to a YYYY-MM-DD date string. */
export function addDays(date: string, days: number): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

export function formatDate(date: string | null | undefined): string {
  if (!date) return "—";
  const [y, m, d] = date.split("-");
  return `${d}/${m}/${y}`;
}
