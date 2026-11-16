import type { ComponentType } from "react";
import type { AppRole } from "@/lib/auth";
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
  roles: AppRole[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Component: ComponentType<any>;
  css: string;
}

const finance: AppRole[] = ["admin", "accountant"];
const everyone: AppRole[] = ["admin", "accountant", "agent"];

export const DOCUMENT_TOOLS: DocumentTool[] = [
  { slug: "tax-invoice", title: "Tax Invoice", description: "UAE 5% VAT commission invoice showing the agency TRN.", group: "Finance", roles: finance, Component: TaxInvoice, css: taxCss },
  { slug: "receipt", title: "Payment Receipt", description: "Receipt for cash, cheque or transfer payments.", group: "Finance", roles: finance, Component: Receipt, css: receiptCss },
  { slug: "tenancy-contract", title: "Tenancy Contract", description: "Dubai Unified Tenancy Contract generator.", group: "Finance", roles: finance, Component: TenancyContract, css: tenancyCss },
  { slug: "payment-voucher", title: "Payment Voucher", description: "Outgoing payment voucher with approvals.", group: "Finance", roles: finance, Component: PaymentVoucher, css: voucherCss },
  { slug: "adnoc-invoice", title: "ADNOC Tax Invoice", description: "ADNOC-format commission tax invoice.", group: "Finance", roles: finance, Component: AdnocInvoice, css: adnocCss },
  { slug: "deal-proposal", title: "Property & Deal Proposal", description: "Client-facing proposal with payment plan and QR code.", group: "Deals & Marketing", roles: everyone, Component: DealProposal, css: dealCss },
  { slug: "unit-handover", title: "Unit Handover & Inspection", description: "Snagging / handover inspection form.", group: "Deals & Marketing", roles: everyone, Component: UnitHandover, css: handoverCss },
  { slug: "marketing-approval", title: "Marketing Approval", description: "Marketing material approval request.", group: "Deals & Marketing", roles: everyone, Component: MarketingApproval, css: marketingCss },
];

export const findTool = (slug: string) => DOCUMENT_TOOLS.find((t) => t.slug === slug);
