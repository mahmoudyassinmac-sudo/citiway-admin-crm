# CLAUDE.md — Citiway Real Estate Back-Office CRM

## 1. Project Overview
Build a complete, production-ready **All-in-One Real Estate Back-Office CRM** for **Citiway Real Estate** (Dubai, UAE). The system unifies document generation, developer agreement tracking, RERA compliance, commission pipelines, and administrative operations into a single web application.

### Company Default Metadata (Configurable in Settings)
- **Company Name:** Citiway Real Estate
- **Location:** Dubai, United Arab Emirates
- **Trade License No.:** `726153`
- **RERA ORN:** `[Configurable in Admin Settings]`
- **TRN (Tax Registration Number):** `[Configurable in Admin Settings]`

---

## 2. Tech Stack & Deployment Pipeline
- **Framework:** Next.js (App Router), React, TypeScript
- **Styling:** Tailwind CSS, Lucide React icons (clean corporate real estate UI, full RTL/LTR support)
- **Database, Auth & File Storage:** Supabase (`@supabase/supabase-js`, `@supabase/ssr`)
  - Storage Bucket: `agreements` (private bucket for Developer Agreements PDFs & NOC PDFs)
- **Automation / Cron Webhook:** Next.js API Route (`/api/cron/developers-expiry`) secured via `CRON_SECRET` header, designed to be triggered daily by **n8n** to send reminder emails to Admin.
- **Version Control & Hosting:** GitHub (`gh` CLI) -> **Vercel** auto-deployment.

---

## 3. Core CRM Modules & Functional Requirements

### Module 1: Dashboard & Role-Based Access (`/`)
- **Authentication:** Supabase Auth with roles (`admin`, `accountant`, `agent`).
- **Admin Overview KPIs:**
  - Developer agreements expiring within 30 days or already expired (highlighted alert widget).
  - Pending / uncollected developer commissions (AED).
  - Agent RERA BRN cards expiring within 30 days.
  - Recent official letters, invoices, and receipts issued.

### Module 2: Real Estate Developers & Agreements (`/developers`)
- **Developer Directory & Tracker:** Manage agreements with Dubai developers (e.g., Emaar, Sobha, Binghatti, Damac, Object 1, etc.).
- **Required Fields:**
  - `developer_name` (text)
  - `start_date` (date)
  - `end_date` (date)
  - `has_noc` (boolean — whether NOC from developer is obtained)
  - `agreement_pdf_url` (Supabase Storage file upload)
  - `noc_pdf_url` (optional Supabase Storage file upload)
  - `last_reminded_at` (timestamp, nullable)
  - `notes` (text)
- **Status Logic & UI Badges:**
  - `Active` (Green): > 30 days remaining
  - `Expiring Soon` (Amber): <= 30 days remaining (shows exact countdown in days)
  - `Expired` (Red): `end_date < today`
- **1-Click Renew Workflow:** A "Renew Agreement" modal that updates `start_date`, `end_date`, `has_noc`, and uploads the renewed PDF, automatically resetting reminder flags so daily alert emails stop immediately.
- **Daily Expiry Notification API (`/api/cron/developers-expiry`):**
  - Protected by `Authorization: Bearer <CRON_SECRET>`.
  - Queries all developers where `end_date <= CURRENT_DATE + INTERVAL '30 days'`.
  - Returns structured JSON payload (`count`, `expiring_developers[]` with name, end_date, days_left, has_noc, signed PDF download URL) and updates `last_reminded_at` so n8n can send a daily email to Admin until the agreement is renewed.

### Module 3: Official Letterhead & Letters Generator (`/letters`)
- **Dual Mode:** Offline Smart Draft parser + AI Draft mode (using valid Anthropic model ID `claude-sonnet-4-6` or OpenAI).
- **Full Bilingual Support (EN / AR):**
  - Auto-detect Arabic script + manual `EN / AR` toggle.
  - When AR is active: set `dir="rtl"`, translate labels (`To:` -> `إلى:`, `Subject:` -> `الموضوع:`, `Ref. No.` -> `الرقم المرجعي:`, `Date` -> `التاريخ:`, `For Citiway Real Estate` -> `عن شركة سيتي واي للعقارات`), format Arabic dates, and mirror subject border (`border-r-4`) and signature block.
- **Auto-Incrementing Reference Number:** Format `CW-LTR-YYYY-XXXX`, persisted in database/localStorage and auto-incremented on print/export.
- **Templates:**
  1. `Commission Undertaking` (includes Client Name, Mobile/Email, Emirates ID/Passport, Project/Unit, Commission %, Agent Name + RERA BRN).
  2. `NOC` (No Objection Certificate).
  3. `Salary Certificate`.
  4. `General Official Letter`.
- **Smart Developer Validation:** When selecting a developer for a Commission Undertaking, cross-check the `developers` table and show a warning banner if the developer agreement is expired or `has_noc` is false.
- **Print & Security Guardrails:**
  - Cross-browser A4 scaling using `transform: scale(...)` and `transformOrigin: 'top left'` (never use non-standard CSS `zoom`).
  - Highlight any unfilled `[placeholder]` in amber/red and block/warn before printing if unfilled brackets remain.
  - Require confirmation / PIN verification before toggling on the digital stamp & signature overlay.

### Module 4: Contracts, Tax Invoices & Receipts (`/finance`)
- Generate UAE-compliant **Rental Contracts**, **5% VAT Tax Invoices** (displaying company TRN), and **Payment Receipts**.
- **Commission Collection Pipeline:** Track deal commissions (`SPA Signed` -> `Invoice Submitted` -> `Pending Transfer` -> `Collected`).

### Module 5: Agents & RERA Compliance (`/agents`)
- Manage broker profiles: Name, Phone, Email, **RERA BRN**, **BRN Expiry Date** (with 30-day expiry warning), Emirates ID, Passport, and Commission Split %.
- Auto-populate Agent Name and BRN inside Official Letters and Deals.

### Module 6: Clients & Deals Vault (`/deals`)
- Centralized database of buyers/tenants (Full Name, Phone, Email, Emirates ID / Passport) to auto-fill contracts and developer registration letters.

---

## 4. Supabase Database Schema Blueprint
When setting up database migrations/SQL (`supabase/schema.sql`), create:
1. `company_settings` (id, company_name, trade_license, rera_orn, trn, address, phone, email, admin_alert_email, next_letter_seq)
2. `developers` (id, developer_name, start_date, end_date, has_noc, agreement_pdf_url, noc_pdf_url, notes, last_reminded_at, created_at, updated_at)
3. `agents` (id, full_name, email, phone, rera_brn, brn_expiry_date, emirates_id, commission_split, is_active)
4. `clients` (id, full_name, email, phone, id_passport_no, nationality, created_at)
5. `letters` (id, ref_no, template_type, language, recipient, subject, body_html, developer_id, agent_id, created_by, created_at)
6. `finance_documents` (id, doc_type, doc_no, client_id, developer_id, agent_id, amount_aed, vat_aed, total_aed, status, due_date, created_at)

---

## 5. Development & Git Workflow Rules
- **Code Quality:** Strict TypeScript, modular components under `src/components/`, server actions or clean API routes under `src/app/api/`.
- **Environment Variables:** Always maintain an up-to-date `.env.example` (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET`, `ANTHROPIC_API_KEY`).
- **Build Verification:** Before committing any milestone, run `npm run build` and fix all TypeScript or lint errors.
- **GitHub & Vercel:** Commit incrementally per module using clear commit messages and push to GitHub when requested.