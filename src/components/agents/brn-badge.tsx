import { daysLeft } from "@/lib/developers";

export function BrnBadge({ expiry }: { expiry: string | null }) {
  if (!expiry)
    return <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-500">No expiry set</span>;
  const left = daysLeft(expiry);
  const cls =
    left < 0
      ? "bg-red-50 text-red-700 ring-red-200"
      : left <= 30
        ? "bg-amber-50 text-amber-800 ring-amber-200"
        : "bg-emerald-50 text-emerald-700 ring-emerald-200";
  const label =
    left < 0 ? `Expired · ${Math.abs(left)}d ago` : left <= 30 ? `Expiring · ${left}d left` : "Valid";
  return (
    <span className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${cls}`}>
      {label}
    </span>
  );
}
