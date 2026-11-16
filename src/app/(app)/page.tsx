import Link from "next/link";
import { AlertTriangle, Banknote, BadgeCheck, FileText } from "lucide-react";
import { StatusBadge } from "@/components/developers/status-badge";
import { getSession } from "@/lib/auth";
import {
  EXPIRY_WARNING_DAYS,
  addDays,
  daysLeft,
  formatDate,
  todayInDubai,
} from "@/lib/developers";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Dashboard — Citiway CRM" };

const aed = (n: number) => `AED ${n.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;

function Card({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl glass lift p-5">
      <h2 className="mb-3 flex items-center gap-2 font-head text-sm font-bold uppercase tracking-wider text-navy">
        {icon}
        {title}
      </h2>
      {children}
    </section>
  );
}

export default async function Dashboard() {
  const session = await getSession();
  const today = todayInDubai();
  const cutoff = addDays(today, EXPIRY_WARNING_DAYS);

  let devs: { id: string; developer_name: string; end_date: string; has_noc: boolean }[] = [];
  let brns: { id: string; full_name: string; rera_brn: string | null; brn_expiry_date: string }[] = [];
  let pending = 0;
  let pendingCount = 0;
  let letters: { id: string; ref_no: string; subject: string | null; created_at: string }[] = [];
  let docs: { id: string; doc_type: string; doc_no: string; total_aed: number; created_at: string }[] = [];

  if (session.configured) {
    const supabase = await createClient();
    const isFinance = session.permissions.modules.finance;
    const showDevs = session.permissions.modules.developers;
    const showBrn = session.permissions.modules.agents;
    const [d, a, deals, l, f] = await Promise.all([
      showDevs
        ? supabase.from("developers").select("id, developer_name, end_date, has_noc").lte("end_date", cutoff).order("end_date")
        : Promise.resolve({ data: [] as typeof devs }),
      !showBrn
        ? Promise.resolve({ data: [] })
        : supabase
        .from("agents")
        .select("id, full_name, rera_brn, brn_expiry_date")
        .eq("is_active", true)
        .not("brn_expiry_date", "is", null)
        .lte("brn_expiry_date", cutoff)
        .order("brn_expiry_date"),
      session.permissions.modules.deals
        ? supabase.from("deals").select("commission_aed").neq("stage", "collected")
        : Promise.resolve({ data: [] as { commission_aed: number }[] }),
      supabase
        .from("letters")
        .select("id, ref_no, subject, created_at")
        .order("created_at", { ascending: false })
        .limit(5),
      isFinance
        ? supabase
            .from("finance_documents")
            .select("id, doc_type, doc_no, total_aed, created_at")
            .order("created_at", { ascending: false })
            .limit(5)
        : Promise.resolve({ data: [] }),
    ]);
    devs = d.data ?? [];
    brns = (a.data ?? []) as typeof brns;
    const dl = (deals.data ?? []) as { commission_aed: number }[];
    pending = dl.reduce((s, x) => s + Number(x.commission_aed || 0), 0);
    pendingCount = dl.length;
    letters = l.data ?? [];
    docs = (f.data ?? []) as typeof docs;
  }

  const expired = devs.filter((d) => daysLeft(d.end_date, today) < 0).length;

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <h1 className="font-head text-2xl font-bold text-navy">
        Welcome{session.fullName ? `, ${session.fullName}` : ""}
      </h1>
      <p className="mb-6 mt-1 text-sm text-slate-500">Citiway Real Estate · Dubai back-office overview</p>

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Agreements needing attention", value: devs.length, tone: devs.length ? "text-amber-700" : "text-emerald-700", sub: `${expired} expired` },
          { label: "Pending commissions", value: aed(pending), tone: "text-navy", sub: `${pendingCount} open deal(s)` },
          { label: "BRN cards expiring ≤ 30d", value: brns.length, tone: brns.length ? "text-amber-700" : "text-emerald-700", sub: "active agents" },
          { label: "Letters issued (recent)", value: letters.length, tone: "text-navy", sub: "last 5 shown below" },
        ].map((k) => (
          <div key={k.label} className="rounded-2xl glass lift p-5">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{k.label}</div>
            <div className={`mt-2 font-head text-2xl font-bold ${k.tone}`}>{k.value}</div>
            <div className="text-xs text-slate-400">{k.sub}</div>
          </div>
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card title="Developer agreements — expiring / expired" icon={<AlertTriangle className="h-4 w-4 text-amber-600" />}>
          {devs.length === 0 ? (
            <p className="text-sm text-slate-400">All agreements are active. 🎉</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {devs.map((d) => (
                <li key={d.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                  <div>
                    <div className="font-semibold text-navy">{d.developer_name}</div>
                    <div className="text-xs text-slate-500">
                      Ends {formatDate(d.end_date)} · NOC {d.has_noc ? "on file" : "missing"}
                    </div>
                  </div>
                  <StatusBadge endDate={d.end_date} />
                </li>
              ))}
            </ul>
          )}
          <Link href="/developers" className="mt-3 inline-block text-xs font-semibold text-navy underline">
            Manage developers →
          </Link>
        </Card>

        <Card title="Agent RERA BRN — expiring ≤ 30 days" icon={<BadgeCheck className="h-4 w-4 text-brand" />}>
          {brns.length === 0 ? (
            <p className="text-sm text-slate-400">No BRN cards expiring soon.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {brns.map((a) => {
                const left = daysLeft(a.brn_expiry_date, today);
                return (
                  <li key={a.id} className="flex items-center justify-between py-2.5 text-sm">
                    <div>
                      <div className="font-semibold text-navy">{a.full_name}</div>
                      <div className="text-xs text-slate-500">BRN {a.rera_brn ?? "—"} · {formatDate(a.brn_expiry_date)}</div>
                    </div>
                    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${left < 0 ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-800"}`}>
                      {left < 0 ? "Expired" : `${left} days`}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <Card title="Recent official letters" icon={<FileText className="h-4 w-4 text-brand" />}>
          {letters.length === 0 ? (
            <p className="text-sm text-slate-400">No letters issued yet.</p>
          ) : (
            <ul className="divide-y divide-slate-100 text-sm">
              {letters.map((l) => (
                <li key={l.id} className="py-2.5">
                  <span className="font-semibold text-navy">{l.ref_no}</span>
                  <span className="text-slate-500"> — {l.subject ?? "Untitled"}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Recent invoices & receipts" icon={<Banknote className="h-4 w-4 text-brand" />}>
          {docs.length === 0 ? (
            <p className="text-sm text-slate-400">Nothing recorded yet.</p>
          ) : (
            <ul className="divide-y divide-slate-100 text-sm">
              {docs.map((x) => (
                <li key={x.id} className="flex justify-between py-2.5">
                  <span>
                    <span className="font-semibold text-navy">{x.doc_no}</span>
                    <span className="text-slate-500"> · {x.doc_type.replace("_", " ")}</span>
                  </span>
                  <span className="font-medium">{aed(Number(x.total_aed))}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
