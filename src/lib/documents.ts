import type { ComponentType } from "react";
import type { DocType, Permissions } from "@/lib/permissions";
import AdnocInvoice from "@/components/documents/adnoc-invoice";
import adnocCss from "@/components/documents/adnoc-invoice-styles";
import DealProposal from "@/components/documents/deal-proposal";
import dealCss from "@/components/documents/deal-proposal-styles";
import MarketingApproval from "@/components/documents/marketing-approval";
import marketingCss from "@/components/documents/marketing-approval-styles";
import PaymentVoucher from "@/components/documents/payment-voucher";
import voucherCss from "@/components/documents/payment-voucher-styles";
import Receipt from "@/components/documents/receipt";
import receiptCss from "@/components/documents/receipt-styles";
import TaxInvoice from "@/components/documents/tax-invoice";
import taxCss from "@/components/documents/tax-invoice-styles";
import TenancyContract from "@/components/documents/tenancy-contract";
import tenancyCss from "@/components/documents/tenancy-contract-styles";
import UnitHandover from "@/components/documents/unit-handover";
import handoverCss from "@/components/documents/unit-handover-styles";

export interface DocumentTool {
  slug: string;
  title: string;
  description: string;
  group: "Finance" | "Deals & Marketing";
  /** Finance document type this tool produces (gated by finance_docs). Tools without one follow the Deals module. */
  docType: DocType | null;
  /** Has a company "signature & stamp" area the Super Admin can stamp. */
  stampable: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Component: ComponentType<any>;
  css: string;
}


export const DOCUMENT_TOOLS: DocumentTool[] = [
  { slug: "tax-invoice", title: "Tax Invoice", description: "UAE 5% VAT commission invoice showing the agency TRN.", group: "Finance", docType: "tax_invoice", stampable: true, Component: TaxInvoice, css: taxCss },
  { slug: "receipt", title: "Payment Receipt", description: "Receipt for cash, cheque or transfer payments.", group: "Finance", docType: "receipt", stampable: true, Component: Receipt, css: receiptCss },
  { slug: "tenancy-contract", title: "Tenancy Contract", description: "Dubai Unified Tenancy Contract generator.", group: "Finance", docType: "rental_contract", stampable: false, Component: TenancyContract, css: tenancyCss },
  { slug: "payment-voucher", title: "Payment Voucher", description: "Outgoing payment voucher with approvals.", group: "Finance", docType: "payment_voucher", stampable: true, Component: PaymentVoucher, css: voucherCss },
  { slug: "adnoc-invoice", title: "ADNOC Tax Invoice", description: "ADNOC-format commission tax invoice.", group: "Finance", docType: "tax_invoice", stampable: true, Component: AdnocInvoice, css: adnocCss },
  { slug: "deal-proposal", title: "Property & Deal Proposal", description: "Client-facing proposal with payment plan and QR code.", group: "Deals & Marketing", docType: null, stampable: false, Component: DealProposal, css: dealCss },
  { slug: "unit-handover", title: "Unit Handover & Inspection", description: "Snagging / handover inspection form.", group: "Deals & Marketing", docType: null, stampable: false, Component: UnitHandover, css: handoverCss },
  { slug: "marketing-approval", title: "Marketing Approval", description: "Marketing material approval request.", group: "Deals & Marketing", docType: null, stampable: false, Component: MarketingApproval, css: marketingCss },
];

export const findTool = (slug: string) => DOCUMENT_TOOLS.find((t) => t.slug === slug);

/** Tools this user may open: finance documents need the Finance module + that document type; the rest follow Deals. */
export function toolsFor(p: Permissions): DocumentTool[] {
  return DOCUMENT_TOOLS.filter((t) => (t.docType ? p.modules.finance && p.finance_docs[t.docType] : p.modules.deals));
}
