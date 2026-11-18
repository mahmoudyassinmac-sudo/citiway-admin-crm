import Link from "next/link";
import { AlertTriangle, ArrowRight, Banknote, BadgeCheck, FileText, Stamp, Zap } from "lucide-react";
import { StatusBadge } from "@/components/developers/status-badge";
import { SignoffBadge } from "@/components/documents/pdf-actions";
import { countPendingApprovals } from "@/lib/approvals";
import { getSession } from "@/lib/auth";
import { toolsFor } from "@/lib/documents";
import {
  EXPIRY_WARNING_DAYS,
  addDays,
  daysLeft,
  formatDate,
  todayInDubai,
} from "@/lib/developers";
import { ALL_DOC_LABELS, DEALS_DOC_TYPES, type AnyDocType } from "@/lib/permissions";
import type { SignoffStatus } from "@/lib/signoff";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Dashboard — Citiway CRM" };

const aed = (n: number) => `AED ${n.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;

function Card({ title, icon, children, wide = false }: { title: string; icon: React.ReactNode; children: React.ReactNode; wide?: boolean }) {
  return (
    <section className={`rounded-2xl glass lift p-5 ${wide ? "lg:col-span-2" : ""}`}>
      <h2 className="mb-3 flex items-center gap-2 font-head text-sm font-bold uppercase tracking-wider text-navy">
        {icon}
        {title}
      </h2>
      {children}
    </section>
  );
}

type Kpi = { label: string; value: string | number; tone: string; sub: string; href?: string };

type MyDoc = { table: "letters" | "finance_documents"; id: string; ref: string; kind: string; status: SignoffStatus; note: string | null; at: string };

export default async function Dashboard() {
  const session = await getSession();
  const p = session.permissions;
  const own = p.scope === "own";
  const isSuperAdmin = session.role === "super_admin";
  const today = todayInDubai();
  const cutoff = addDays(today, EXPIRY_WARNING_DAYS);

  // What this user is allowed to see — every section below is gated on it.
  const show = {
    developers: p.modules.developers,
    agents: p.modules.agents,
    deals: p.modules.deals,
    letters: p.modules.letters,
    finance: p.modules.finance,
  };
  const anyDocs = show.letters || show.finance || show.deals;

  let devs: { id: string; developer_name: string; end_date: string; has_noc: boolean }[] = [];
  let brns: { id: string; full_name: string; rera_brn: string | null; brn_expiry_date: string }[] = [];
  let pending = 0;
  let pendingCount = 0;
  let letters: { id: string; ref_no: string; subject: string | null; created_at: string; signoff_status: SignoffStatus | null }[] = [];
  let docs: { id: string; doc_type: string; doc_no: string; total_aed: number; created_at: string; signoff_status: SignoffStatus | null }[] = [];
  let attention: MyDoc[] = [];
  let approvals = 0;

  if (session.configured) {
    const supabase = await createClient();
    const none = <T,>() => Promise.resolve({ data: [] as T[] });
    const [d, a, deals, l, f, la, fa, ap] = await Promise.all([
      show.developers
        ? supabase.from("developers").select("id, developer_name, end_date, has_noc").lte("end_date", cutoff).order("end_date")
        : none<(typeof devs)[number]>(),
      show.agents
        ? supabase
            .from("agents")
            .select("id, full_name, rera_brn, brn_expiry_date")
            .eq("is_active", true)
            .not("brn_expiry_date", "is", null)
            .lte("brn_expiry_date", cutoff)
            .order("brn_expiry_date")
        : none<(typeof brns)[number]>(),
      show.deals ? supabase.from("deals").select("commission_aed").neq("stage", "collected") : none<{ commission_aed: number }>(),
      show.letters
        ? supabase.from("letters").select("id, ref_no, subject, created_at, signoff_status").order("created_at", { ascending: false }).limit(5)
        : none<(typeof letters)[number]>(),
      show.finance
        ? supabase
            .from("finance_documents")
            .select("id, doc_type, doc_no, total_aed, created_at, signoff_status")
            .not("doc_type", "in", `(${DEALS_DOC_TYPES.join(",")})`)
            .order("created_at", { ascending: false })
            .limit(5)
        : none<(typeof docs)[number]>(),
      // Documents waiting on the Super Admin, or sent back (RLS limits these to what the user may see).
      show.letters && !isSuperAdmin
        ? supabase.from("letters").select("id, ref_no, signoff_status, signoff_note, created_at").in("signoff_status", ["pending", "rejected"]).order("created_at", { ascending: false }).limit(10)
        : none<Record<string, unknown>>(),
      (show.finance || show.deals) && !isSuperAdmin
        ? supabase.from("finance_documents").select("id, doc_no, doc_type, signoff_status, signoff_note, created_at").in("signoff_status", ["pending", "rejected"]).order("created_at", { ascending: false }).limit(10)
        : none<Record<string, unknown>>(),
      isSuperAdmin ? countPendingApprovals() : Promise.resolve(0),
    ]);
    devs = (d.data ?? []) as typeof devs;
    brns = (a.data ?? []) as typeof brns;
    const dl = (deals.data ?? []) as { commission_aed: number }[];
    pending = dl.reduce((s, x) => s + Number(x.commission_aed || 0), 0);
    pendingCount = dl.length;
    letters = (l.data ?? []) as typeof letters;
    docs = (f.data ?? []) as typeof docs;
    approvals = ap;
    attention = [
      ...((la.data ?? []) as Record<string, unknown>[]).map((r) => ({
        table: "letters" as const, id: r.id as string, ref: r.ref_no as string, kind: "Letter",
        status: r.signoff_status as SignoffStatus, note: r.signoff_note as string | null, at: r.created_at as string,
      })),
      ...((fa.data ?? []) as Record<string, unknown>[]).map((r) => ({
        table: "finance_documents" as const, id: r.id as string, ref: r.doc_no as string,
        kind: ALL_DOC_LABELS[r.doc_type as AnyDocType] ?? String(r.doc_type),
        status: r.signoff_status as SignoffStatus, note: r.signoff_note as string | null, at: r.created_at as string,
      })),
    ].sort((x, y) => (x.status === y.status ? y.at.localeCompare(x.at) : x.status === "rejected" ? -1 : 1));
  }

  const expired = devs.filter((d) => daysLeft(d.end_date, today) < 0).length;
  const waiting = attention.filter((x) => x.status === "pending").length;
  const returned = attention.filter((x) => x.status === "rejected").length;

  const kpis: Kpi[] = [
    isSuperAdmin && { label: "Awaiting your stamp", value: approvals, tone: approvals ? "text-amber-700" : "text-emerald-700", sub: "open approvals →", href: "/approvals" },
    show.developers && { label: "Agreements needing attention", value: devs.length, tone: devs.length ? "text-amber-700" : "text-emerald-700", sub: `${expired} expired` },
    show.deals && { label: own ? "My pending commissions" : "Pending commissions", value: aed(pending), tone: "text-navy", sub: `${pendingCount} open deal(s)` },
    show.agents && { label: "BRN cards expiring ≤ 30d", value: brns.length, tone: brns.length ? "text-amber-700" : "text-emerald-700", sub: "active agents" },
    anyDocs && !isSuperAdmin && { label: "Waiting for stamp", value: waiting, tone: waiting ? "text-amber-700" : "text-navy", sub: "with the Super Admin", href: "/documents" },
    anyDocs && !isSuperAdmin && { label: "Returned to me", value: returned, tone: returned ? "text-red-600" : "text-emerald-700", sub: returned ? "needs fixing" : "nothing returned", href: "/documents" },
    show.letters && (isSuperAdmin || session.role !== "agent") && { label: own ? "My letters (recent)" : "Letters issued (recent)", value: letters.length, tone: "text-navy", sub: "last 5 shown below" },
  ].filter(Boolean) as Kpi[];

  // Quick links to the tools this user can actually open.
  const tools = show.finance ? toolsFor(p) : [];
  const quick = [
    ...(show.letters ? [{ href: "/letters", title: "Official letter", sub: "NOC, salary certificate, undertaking…" }] : []),
    ...tools.map((t) => ({ href: `/finance/${t.slug}`, title: t.title, sub: t.description })),
    ...(show.deals ? [{ href: "/deals", title: "Clients & deals", sub: "Your clients and deal pipeline" }] : []),
  ];

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <h1 className="font-head text-2xl font-bold text-navy">
        Welcome{session.fullName ? `, ${session.fullName}` : ""}
      </h1>
      <p className="mb-6 mt-1 text-sm text-slate-500">
        {own ? "Your Citiway workspace — the documents and tools you have access to." : "Citiway Real Estate · Dubai back-office overview"}
      </p>

      {kpis.length > 0 && (
        <div className={`mb-6 grid gap-4 sm:grid-cols-2 ${kpis.length >= 4 ? "lg:grid-cols-4" : kpis.length === 3 ? "lg:grid-cols-3" : ""}`}>
          {kpis.map((k) => {
            const body = (
              <>
                <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{k.label}</div>
                <div className={`mt-2 font-head text-2xl font-bold ${k.tone}`}>{k.value}</div>
                <div className="text-xs text-slate-400">{k.sub}</div>
              </>
            );
            return k.href ? (
              <Link key={k.label} href={k.href} className="block rounded-2xl glass lift p-5">{body}</Link>
            ) : (
              <div key={k.label} className="rounded-2xl glass lift p-5">{body}</div>
            );
          })}
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-2">
        {anyDocs && !isSuperAdmin && attention.length > 0 && (
          <Card title="My documents — stamp status" icon={<Stamp className="h-4 w-4 text-amber-600" />} wide>
            <ul className="divide-y divide-slate-100">
              {attention.map((x) => (
                <li key={`${x.table}-${x.id}`} className="flex items-start justify-between gap-3 py-2.5 text-sm">
                  <div>
                    <span className="font-semibold text-navy">{x.ref}</span>
                    <span className="text-slate-500"> · {x.kind}</span>
                    {x.status === "rejected" && x.note && <div className="mt-0.5 text-xs text-red-600">“{x.note}”</div>}
                  </div>
                  <SignoffBadge status={x.status} />
                </li>
              ))}
            </ul>
            <Link href="/documents" className="mt-3 inline-block text-xs font-semibold text-navy underline">
              Open documents →
            </Link>
          </Card>
        )}

        {quick.length > 0 && (
          <Card title="Create a document" icon={<Zap className="h-4 w-4 text-brand" />} wide={!show.developers && !show.agents}>
            <ul className="grid gap-2 sm:grid-cols-2">
              {quick.map((q) => (
                <li key={q.href}>
                  <Link href={q.href} className="group flex items-center justify-between gap-3 rounded-xl border border-slate-100 bg-white/60 px-3 py-2.5 transition hover:border-brand/40 hover:bg-white">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-navy">{q.title}</div>
                      <div className="truncate text-xs text-slate-400">{q.sub}</div>
                    </div>
                    <ArrowRight className="h-4 w-4 shrink-0 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-brand" />
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        )}

        {show.developers && (
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
        )}

        {show.agents && (
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
        )}

        {show.letters && (
          <Card title={own ? "My recent letters" : "Recent official letters"} icon={<FileText className="h-4 w-4 text-brand" />}>
            {letters.length === 0 ? (
              <p className="text-sm text-slate-400">No letters issued yet.</p>
            ) : (
              <ul className="divide-y divide-slate-100 text-sm">
                {letters.map((l) => (
                  <li key={l.id} className="flex items-center justify-between gap-3 py-2.5">
                    <span className="min-w-0 truncate">
                      <span className="font-semibold text-navy">{l.ref_no}</span>
                      <span className="text-slate-500"> — {l.subject ?? "Untitled"}</span>
                    </span>
                    {l.signoff_status && l.signoff_status !== "none" && <SignoffBadge status={l.signoff_status} />}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        )}

        {show.finance && (
          <Card title={own ? "My recent invoices & receipts" : "Recent invoices & receipts"} icon={<Banknote className="h-4 w-4 text-brand" />}>
            {docs.length === 0 ? (
              <p className="text-sm text-slate-400">Nothing recorded yet.</p>
            ) : (
              <ul className="divide-y divide-slate-100 text-sm">
                {docs.map((x) => (
                  <li key={x.id} className="flex items-center justify-between gap-3 py-2.5">
                    <span className="min-w-0 truncate">
                      <span className="font-semibold text-navy">{x.doc_no}</span>
                      <span className="text-slate-500"> · {ALL_DOC_LABELS[x.doc_type as AnyDocType] ?? x.doc_type.replace(/_/g, " ")}</span>
                    </span>
                    <span className="flex shrink-0 items-center gap-2">
                      {x.signoff_status && x.signoff_status !== "none" && <SignoffBadge status={x.signoff_status} />}
                      <span className="font-medium">{aed(Number(x.total_aed))}</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        )}
      </div>
    </div>
  );
}
