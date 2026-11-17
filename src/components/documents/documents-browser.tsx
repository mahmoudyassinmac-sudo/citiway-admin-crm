"use client";

import { useState } from "react";
import { FileText, Receipt, Handshake } from "lucide-react";
import { ArchiveCell, type ArchiveInfo } from "@/components/documents/pdf-actions";

export interface LetterRow {
  id: string;
  ref_no: string;
  template_type: string;
  language: string;
  recipient: string | null;
  subject: string | null;
  created_at: string;
  preview: string;
  developer_name: string | null;
  agent_name: string | null;
  issued_by: string | null;
  archive: ArchiveInfo;
}

export interface FinanceRow {
  id: string;
  doc_type: string;
  doc_no: string;
  amount_aed: number;
  vat_aed: number;
  total_aed: number;
  status: string;
  due_date: string | null;
  created_at: string;
  client_name: string | null;
  developer_name: string | null;
  issued_by: string | null;
  archive: ArchiveInfo;
}

const aed = (n: number) =>
  `AED ${(Number(n) || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const fmt = (iso: string) =>
  new Date(iso).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

/**
 * Browse issued letters & finance documents. What shows up here is exactly what the
 * server query returned — RLS already scoped it to "my own" or "everyone" per the
 * viewer's permissions, so no extra filtering happens in this component.
 */
export function DocumentsBrowser({
  letters,
  financeDocs,
  dealsDocs,
  showLetters,
  showFinance,
  showDeals,
  isSuperAdmin,
}: {
  letters: LetterRow[];
  financeDocs: FinanceRow[];
  dealsDocs: FinanceRow[];
  showLetters: boolean;
  showFinance: boolean;
  showDeals: boolean;
  isSuperAdmin: boolean;
}) {
  const [tab, setTab] = useState<"letters" | "finance" | "deals">(showLetters ? "letters" : showFinance ? "finance" : "deals");
  const [openLetter, setOpenLetter] = useState<LetterRow | null>(null);

  const tabs = [
    showLetters && { key: "letters" as const, label: "Letters", count: letters.length, icon: FileText },
    showFinance && { key: "finance" as const, label: "Invoices & Receipts", count: financeDocs.length, icon: Receipt },
    showDeals && { key: "deals" as const, label: "Deals & Marketing", count: dealsDocs.length, icon: Handshake },
  ].filter(Boolean) as { key: "letters" | "finance" | "deals"; label: string; count: number; icon: typeof FileText }[];

  return (
    <div>
      {tabs.length > 1 && (
        <div className="mb-5 flex gap-2 border-b border-slate-100">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-semibold transition-colors ${
                tab === t.key ? "border-brand text-navy" : "border-transparent text-slate-400 hover:text-slate-600"
              }`}
            >
              <t.icon className="h-3.5 w-3.5" />
              {t.label}
              <span className="rounded-full bg-slate-100 px-1.5 text-xs text-slate-500">{t.count}</span>
            </button>
          ))}
        </div>
      )}

      {tab === "letters" && showLetters && (
        <div className="overflow-x-auto rounded-2xl glass">
          {letters.length === 0 ? (
            <p className="p-6 text-sm text-slate-400">No letters issued yet.</p>
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-slate-400">
                <tr>
                  <th className="px-4 py-3">Ref.</th>
                  <th className="px-4 py-3">Template</th>
                  <th className="px-4 py-3">Recipient / Subject</th>
                  <th className="px-4 py-3">Issued by</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {letters.map((l) => (
                  <tr key={l.id} className="hover:bg-slate-50/60">
                    <td className="px-4 py-3 font-semibold text-navy">{l.ref_no}</td>
                    <td className="px-4 py-3 capitalize text-slate-600">{l.template_type.replace(/_/g, " ")} · {l.language.toUpperCase()}</td>
                    <td className="px-4 py-3 text-slate-600">
                      <div className="font-medium text-navy">{l.subject || "Untitled"}</div>
                      <div className="text-xs text-slate-400">{l.recipient || "—"}</div>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{l.issued_by ?? "—"}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-slate-500">{fmt(l.created_at)}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex flex-col items-end gap-1.5">
                        <button onClick={() => setOpenLetter(l)} className="text-xs font-semibold text-slate-500 underline">
                          Details
                        </button>
                        <ArchiveCell table="letters" id={l.id} reference={l.ref_no} info={l.archive} isSuperAdmin={isSuperAdmin} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {tab === "finance" && showFinance && (
        <div className="overflow-x-auto rounded-2xl glass">
          {financeDocs.length === 0 ? (
            <p className="p-6 text-sm text-slate-400">No invoices or receipts issued yet.</p>
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-slate-400">
                <tr>
                  <th className="px-4 py-3">Doc. No.</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Client / Developer</th>
                  <th className="px-4 py-3">Total</th>
                  <th className="px-4 py-3">Issued by</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3 text-right">PDF</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {financeDocs.map((d) => (
                  <tr key={d.id} className="hover:bg-slate-50/60">
                    <td className="px-4 py-3 font-semibold text-navy">{d.doc_no}</td>
                    <td className="px-4 py-3 capitalize text-slate-600">{d.doc_type.replace(/_/g, " ")}</td>
                    <td className="px-4 py-3 text-slate-600">{d.client_name || d.developer_name || "—"}</td>
                    <td className="px-4 py-3 font-medium text-navy">{aed(d.total_aed)}</td>
                    <td className="px-4 py-3 text-slate-600">{d.issued_by ?? "—"}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-slate-500">{fmt(d.created_at)}</td>
                    <td className="px-4 py-3 text-right">
                      <ArchiveCell table="finance_documents" id={d.id} reference={d.doc_no} info={d.archive} isSuperAdmin={isSuperAdmin} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {tab === "deals" && showDeals && (
        <div className="overflow-x-auto rounded-2xl glass">
          {dealsDocs.length === 0 ? (
            <p className="p-6 text-sm text-slate-400">No deals or marketing documents issued yet.</p>
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-slate-400">
                <tr>
                  <th className="px-4 py-3">Doc. No.</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Client / Developer</th>
                  <th className="px-4 py-3">Issued by</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3 text-right">PDF</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {dealsDocs.map((d) => (
                  <tr key={d.id} className="hover:bg-slate-50/60">
                    <td className="px-4 py-3 font-semibold text-navy">{d.doc_no}</td>
                    <td className="px-4 py-3 capitalize text-slate-600">{d.doc_type.replace(/_/g, " ")}</td>
                    <td className="px-4 py-3 text-slate-600">{d.client_name || d.developer_name || "—"}</td>
                    <td className="px-4 py-3 text-slate-600">{d.issued_by ?? "—"}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-slate-500">{fmt(d.created_at)}</td>
                    <td className="px-4 py-3 text-right">
                      <ArchiveCell table="finance_documents" id={d.id} reference={d.doc_no} info={d.archive} isSuperAdmin={isSuperAdmin} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {openLetter && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-midnight/45 p-4 backdrop-blur-md"
          onMouseDown={(e) => e.target === e.currentTarget && setOpenLetter(null)}
        >
          <div className="my-8 w-full max-w-lg rounded-2xl glass-strong">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
              <h2 className="font-head text-base font-bold text-navy">{openLetter.ref_no}</h2>
              <button onClick={() => setOpenLetter(null)} className="text-slate-400 hover:text-slate-700">
                ✕
              </button>
            </div>
            <div className="space-y-2 px-6 py-5 text-sm">
              <div><span className="font-semibold text-navy">Template:</span> {openLetter.template_type.replace(/_/g, " ")}</div>
              <div><span className="font-semibold text-navy">Language:</span> {openLetter.language === "ar" ? "Arabic" : "English"}</div>
              <div><span className="font-semibold text-navy">Recipient:</span> {openLetter.recipient || "—"}</div>
              <div><span className="font-semibold text-navy">Subject:</span> {openLetter.subject || "—"}</div>
              {openLetter.developer_name && <div><span className="font-semibold text-navy">Developer:</span> {openLetter.developer_name}</div>}
              {openLetter.agent_name && <div><span className="font-semibold text-navy">Agent:</span> {openLetter.agent_name}</div>}
              <div><span className="font-semibold text-navy">Issued by:</span> {openLetter.issued_by ?? "—"}</div>
              <div><span className="font-semibold text-navy">Date:</span> {fmt(openLetter.created_at)}</div>
              {openLetter.preview && (
                <div className="mt-3 whitespace-pre-line rounded-lg border border-slate-100 bg-slate-50 p-3 text-xs text-slate-600">
                  {openLetter.preview}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
