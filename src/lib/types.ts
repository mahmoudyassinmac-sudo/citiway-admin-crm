export interface Agent {
  id: string;
  user_id: string | null;
  full_name: string;
  email: string | null;
  phone: string | null;
  rera_brn: string | null;
  brn_expiry_date: string | null;
  emirates_id: string | null;
  passport_no: string | null;
  commission_split: number;
  is_active: boolean;
}

export interface Client {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  id_passport_no: string | null;
  nationality: string | null;
  created_at: string;
}

export type Stage = "spa_signed" | "invoice_submitted" | "pending_transfer" | "collected";

export const STAGES: { key: Stage; label: string }[] = [
  { key: "spa_signed", label: "SPA Signed" },
  { key: "invoice_submitted", label: "Invoice Submitted" },
  { key: "pending_transfer", label: "Pending Transfer" },
  { key: "collected", label: "Collected" },
];

export interface Deal {
  id: string;
  client_id: string | null;
  developer_id: string | null;
  agent_id: string | null;
  project_name: string | null;
  unit_no: string | null;
  sale_price_aed: number | null;
  commission_pct: number | null;
  commission_aed: number;
  stage: Stage;
  spa_date: string | null;
  collected_at: string | null;
  notes: string | null;
  client?: { full_name: string } | null;
  developer?: { developer_name: string; end_date: string; has_noc: boolean } | null;
  agent?: { full_name: string; commission_split: number } | null;
}

export const DEAL_SELECT =
  "*, client:clients(full_name), developer:developers(developer_name, end_date, has_noc), agent:agents(full_name, commission_split)";

export const aed = (n: number | null | undefined) =>
  `AED ${(Number(n) || 0).toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
