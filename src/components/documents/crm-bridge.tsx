"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";

const CanIssueContext = createContext(true);

/** Provided by DocumentHost: false hides "Save & Issue" for users without can_create_finance. */
export function CanIssueProvider({ value, children }: { value: boolean; children: React.ReactNode }) {
  return <CanIssueContext.Provider value={value}>{children}</CanIssueContext.Provider>;
}
export const useCanIssue = () => useContext(CanIssueContext);

export interface FinanceRecord {
  docType: "tax_invoice" | "receipt" | "rental_contract" | "payment_voucher" | "other";
  docNo: string;
  amount: number;
  vat: number;
  total: number;
  clientId?: string;
  developerId?: string;
  dueDate?: string | null;
}

const isUuid = (v?: string) => !!v && /^[0-9a-f-]{36}$/i.test(v);

export interface SaveResult { ok: boolean; message: string }

/** Upsert into finance_documents (unique on doc_type + doc_no, so re-issuing updates instead of duplicating). */
export async function saveFinanceDocument(r: FinanceRecord): Promise<SaveResult> {
  if (!isSupabaseConfigured()) return { ok: true, message: "CRM not connected — document was not recorded." };
  if (!r.docNo.trim()) return { ok: false, message: "Cannot issue: the document number is empty." };
  const { error } = await createClient()
    .from("finance_documents")
    .upsert(
      {
        doc_type: r.docType,
        doc_no: r.docNo.trim(),
        client_id: isUuid(r.clientId) ? r.clientId : null,
        developer_id: isUuid(r.developerId) ? r.developerId : null,
        amount_aed: r.amount || 0,
        vat_aed: r.vat || 0,
        total_aed: r.total || 0,
        status: "issued",
        due_date: r.dueDate ?? null,
      },
      { onConflict: "doc_type,doc_no" },
    );
  return error
    ? { ok: false, message: `Could not save ${r.docNo} to the CRM: ${error.message}` }
    : { ok: true, message: `${r.docNo} issued and saved to the CRM (Finance documents).` };
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
