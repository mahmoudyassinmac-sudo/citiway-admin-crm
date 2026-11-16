import { daysLeft, developerStatus } from "@/lib/developers";

export function StatusBadge({ endDate }: { endDate: string }) {
  const status = developerStatus(endDate);
  const left = daysLeft(endDate);

  const styles = {
    active: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    expiring: "bg-amber-50 text-amber-800 ring-amber-200",
    expired: "bg-red-50 text-red-700 ring-red-200",
  }[status];

  const label =
    status === "active"
      ? "Active"
      : status === "expiring"
        ? left === 0
          ? "Expires today"
          : `Expiring Soon · ${left} day${left === 1 ? "" : "s"}`
        : `Expired · ${Math.abs(left)} day${Math.abs(left) === 1 ? "" : "s"} ago`;

  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${styles}`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${
          status === "active" ? "bg-emerald-500" : status === "expiring" ? "bg-amber-500" : "bg-red-500"
        }`}
      />
      {label}
    </span>
  );
}
