"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { issueFinanceDocument } from "@/app/(app)/documents/actions";
import { ALL_DOC_TYPES, type AnyDocType } from "@/lib/permissions";

const CanIssueContext = createContext(true);

/** Provided by DocumentHost: false hides "Save & Issue" for users without can_create_finance. */
export function CanIssueProvider({ value, children }: { value: boolean; children: React.ReactNode }) {
  return <CanIssueContext.Provider value={value}>{children}</CanIssueContext.Provider>;
}
export const useCanIssue = () => useContext(CanIssueContext);

export interface FinanceRecord {
  docType: AnyDocType;
  docNo: string;
  amount: number;
  vat: number;
  total: number;
  clientId?: string;
  developerId?: string;
  dueDate?: string | null;
}


export interface SaveResult { ok: boolean; message: string }

/**
 * Issues the document through a server action: it upserts into finance_documents (unique on
 * doc_type + doc_no, so re-issuing updates instead of duplicating) and emails the admin alert.
 */
export async function saveFinanceDocument(r: FinanceRecord): Promise<SaveResult> {
  if (!isSupabaseConfigured()) return { ok: true, message: "CRM not connected — document was not recorded." };
  try {
    const res = await issueFinanceDocument({
      docType: ALL_DOC_TYPES.includes(r.docType) ? r.docType : "other",
      docNo: r.docNo,
      amount: r.amount,
      vat: r.vat,
      total: r.total,
      clientId: r.clientId,
      developerId: r.developerId,
      dueDate: r.dueDate,
    });
    return res.ok
      ? { ok: true, message: res.message }
      : { ok: false, message: `Could not save ${r.docNo || "the document"} to the CRM: ${res.error}` };
  } catch (e) {
    return { ok: false, message: `Could not reach the CRM: ${e instanceof Error ? e.message : "network error"}` };
  }
}

/**
 * Explicit "Save & Issue Document" action. Nothing is recorded until the user clicks it,
 * so cancelled print dialogs never create records. `issue()` resolves true when the
 * document is safely recorded (or the CRM is not connected) and printing may proceed.
 */
export function useIssueDocument(getRecord: () => FinanceRecord | null) {
  const ref = useRef(getRecord);
  useEffect(() => {
    ref.current = getRecord; // always read the latest form state at click time
  });
  const [note, setNote] = useState("");
  const canIssue = useCanIssue();
  const issue = async (): Promise<boolean> => {
    const rec = ref.current();
    if (!rec) return true;
    const res = await saveFinanceDocument(rec);
    setNote(res.message);
    return res.ok;
  };
  return { note, issue, canIssue };
}

interface ClientLike { id: string; full_name: string }
interface DeveloperLike { id: string; developer_name: string }
export type PickedParty =
  | { kind: "client"; record: ClientLike & Record<string, string | null> }
  | { kind: "developer"; record: DeveloperLike & Record<string, string | null> };

/** "Fill from CRM" dropdown shared by the document tools. */
export function PartyPicker({
  clients,
  developers = [],
  onPick,
}: {
  clients: ClientLike[];
  developers?: DeveloperLike[];
  onPick: (p: PickedParty) => void;
}) {
  if (clients.length === 0 && developers.length === 0) return null;
  return (
    <label className="block mb-2">
      <span className="block text-[12px] font-semibold text-navy mb-1">Fill from CRM</span>
      <select
        className="field-in"
        defaultValue=""
        onChange={(e) => {
          const [kind, id] = e.target.value.split(":");
          if (kind === "client") {
            const record = clients.find((c) => c.id === id);
            if (record) onPick({ kind: "client", record: record as never });
          } else if (kind === "developer") {
            const record = developers.find((d) => d.id === id);
            if (record) onPick({ kind: "developer", record: record as never });
          }
        }}
      >
        <option value="">— select a saved party —</option>
        {clients.length > 0 && (
          <optgroup label="Clients">
            {clients.map((c) => (
              <option key={c.id} value={`client:${c.id}`}>{c.full_name}</option>
            ))}
          </optgroup>
        )}
        {developers.length > 0 && (
          <optgroup label="Developers">
            {developers.map((d) => (
              <option key={d.id} value={`developer:${d.id}`}>{d.developer_name}</option>
            ))}
          </optgroup>
        )}
      </select>
    </label>
  );
}
