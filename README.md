# Electrical Shop Inventory & Finance App — v1 Foundation

Niche inventory + finance management for electrical shops, built on Next.js + Supabase.

## What's built here

- **`schema.sql`** — full Postgres schema with Row Level Security. Run this in your
  Supabase project's SQL editor to set up all tables and policies.
- **Owner/staff role separation** — enforced two ways:
  1. RLS policies on `customer_ledger`, `supplier_ledger`, `expenses` (finance data is
     owner-only at the database level, not just hidden in the UI)
  2. `middleware.ts` blocks staff from reaching `/owner/*` routes even if they guess the URL
- **Staff dashboard** (`app/staff/page.tsx`) — deliberately 2 screens: product list →
  quantity entry. No settings, no reports, no clutter. This matters — see "Why simplicity
  is non-negotiable" below.
- **Owner dashboard** (`app/owner/page.tsx`) — daily summary (sales, cash, low stock,
  dues/payables) plus links to inventory, ledgers, GST reports, staff management.
- **Stock movement API** (`app/api/stock-movements/route.ts`) — every stock change is
  logged with who did it and why (`sale`, `internal_use`, `damage`, `return`), which is
  the actual fix for stock "going unnoticed."
- **Gemini OCR Purchase Ingestion & AI Fuzzy Matcher** (`app/api/purchases/parse-bill/route.ts`) —
  converts uploaded distributor invoice images or PDFs into structured purchase drafts. It queries
  your 87-item catalog and pre-matches invoice lines to database product IDs.
- **Purchase Review & Stock Reconciliation Panel** (`app/owner/purchases/review/page.tsx`) —
  lets the owner review, edit item quantities/costs, and approve. Re-computes final purchase values
  and logs payables to the `supplier_ledger` before committing the stock increase.
- **Development Mock Fallback Mode** — automatically activates if `GOOGLE_API_KEY` is inactive
  or leaked, generating simulated invoices containing real products in your database for seamless testing.
- **Hinglish Voice Counter Billing** (`app/api/voice-transcribe/route.ts`) — allows cashiers to click the mic button on the counter POS and speak counter orders in mixed Hinglish (e.g. *"Ramesh Electrician ko 10 rolls Polycab 1.5 wire do credit pe"*). Gemini 1.5 Flash transcribes the audio, identifies items/quantities, resolves the customer, and populates the checkout cart in one step.
- **Voice Command Mock Fallback** — automatically responds with realistic sample Hinglish commands (and pre-populates the billing or stock adjustment panels) if the Gemini STT/parsing API fails or is inactive.
- **Hands-Free POS (Global Barcode Scanner)** — keydown listener detects scanner keyboard emulation and processes scanned barcodes globally without forcing cashiers to focus search inputs.
- **Cart Price Overrides** — allows cashiers to inline-edit product prices in the cart to provide custom discounts or deal rates for contractors.
- **Bill Suspension (Hold / Retrieve)** — cashiers can temporarily hold/freeze active checkout carts to serve other customers and retrieve them when needed.
- **Official WhatsApp Receipt Gateway** — generates fully formatted text invoices and opens a wa.me redirection link to send direct receipts to customers for free.
- **Physical Stock Reconciliation Dashboard** (`app/owner/reconciliation/page.tsx`) — allows shop owners to review physical stock logs and sync counts with system inventory.
- **Multi-Tenant SaaS Onboarding** (`app/signup/page.tsx` & `/api/shops/signup`) — decoupled hardcoded branding, enabling any shop owner to register and start using the app. Uses a server-side signup endpoint using admin privileges to bypass email rate limits or verification blocks.
- **Dual-Credential Login** (`app/login/page.tsx`) — supports logging in using either a 10-digit mobile number or a registered email address, with fallback phone-to-email resolution (`/api/auth/phone-login`).
- **Forgot Password Flow & Reset Portal** (`app/login/page.tsx` & `app/reset-password/page.tsx`) — integrates an Account Recovery modal to send reset emails and a dedicated page to securely update user credentials.
- **Active Roster Locks (Instant Ejection)** (`middleware.ts`) — checks the worker's `active` database flag on every request. If an owner deactivates a staff member, they are instantly signed out, cookies are purged, and they are redirected to login with a deactivation warning.
- **Workers Directory & Audits Restyling** (`app/owner/staff/page.tsx`) — restyled the staff management page to match the premium dark theme with signature copper gradient highlights, charcoal layouts, and unified modals.

## Setup

```bash
npm install
cp .env.example .env.local   # fill in your Supabase project URL + anon key
npm run dev
```
LIVE LINK - https://electrical-shop-app-dun.vercel.app/owner
Youtube Link - https://www.youtube.com/watch?v=iKQTzETFUH4&t=417s

You'll need a Supabase project. Run `schema.sql` in the SQL editor first.

For registration, you can use the newly implemented public Signup flow (`/signup`) which registers your shop and owner profile instantly.

## What's intentionally NOT built yet (and why)

These were flagged during scoping as scope-creep risks or multi-month efforts that
don't belong in a v1:

1. **Full Vyapar feature parity** (e-way bills, barcode scanning, payroll, multi-warehouse).
   Add only once real customers ask for a specific one.
2. **Actual GST filing** (submitting returns to GSTN). Requires GST Suvidha Provider
   licensing — a regulatory undertaking, not a feature. v1 generates GSTR-1/3B-ready
   *reports* for the CA; filing itself stays manual, as it is today.
3. **Voice input** — **Built!** Fully supported on both frontend and backend using Gemini 1.5 Flash's multimodal audio capabilities, with a development fallback mock mode.
4. **Email Inbound forwarding** — we have built the OCR upload UI and API, but auto-forwarding invoices from an email address (like `billing@senwalelectricals.com`) to the API via webhooks (e.g., Mailgun/SendGrid inbound parse) is not yet configured.
5. **Reconciliation UI** — table exists in the schema; no screen yet for owner to review
   physical-count-vs-system discrepancies.

## Why simplicity is non-negotiable here

Only ~15,000 of India's 12 million kirana-type stores have digitized with a mobile app —
about 0.1%. The dominant reason shop owners abandon these apps isn't missing features,
it's interface confusion and fear of making mistakes. The staff screen in this app is
built to that constraint on purpose: fewer options, not more, even as you add features
elsewhere.

## Latest Deployment Note
- Triggered Vercel redeployment for SaaS onboarding and RLS updates.
