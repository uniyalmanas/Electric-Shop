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

## Setup

```bash
npm install
cp .env.example .env.local   # fill in your Supabase project URL + anon key
npm run dev
```

You'll need a Supabase project. Run `schema.sql` in the SQL editor first.

For the initial owner + first staff account, insert rows directly into `shops` and
`workers` after creating their Supabase Auth users (via Supabase dashboard or
`supabase.auth.admin.createUser`) — there's no signup flow yet since onboarding is
in-person, per your distribution strategy.

## What's intentionally NOT built yet (and why)

These were flagged during scoping as scope-creep risks or multi-month efforts that
don't belong in a v1:

1. **Full Vyapar feature parity** (e-way bills, barcode scanning, payroll, multi-warehouse).
   Add only once real customers ask for a specific one.
2. **Actual GST filing** (submitting returns to GSTN). Requires GST Suvidha Provider
   licensing — a regulatory undertaking, not a feature. v1 generates GSTR-1/3B-ready
   *reports* for the CA; filing itself stays manual, as it is today.
3. **Voice input** — **Built!** Fully supported on both frontend and backend using Gemini 1.5 Flash's multimodal audio capabilities, with a development fallback mock mode.
4. **Email Inbound forwarding** — we have built the OCR upload UI and API, but auto-forwarding invoices from an email address (like `billing@guptaelectricals.com`) to the API via webhooks (e.g., Mailgun/SendGrid inbound parse) is not yet configured.
5. **Reconciliation UI** — table exists in the schema; no screen yet for owner to review
   physical-count-vs-system discrepancies.

## Why simplicity is non-negotiable here

Only ~15,000 of India's 12 million kirana-type stores have digitized with a mobile app —
about 0.1%. The dominant reason shop owners abandon these apps isn't missing features,
it's interface confusion and fear of making mistakes. The staff screen in this app is
built to that constraint on purpose: fewer options, not more, even as you add features
elsewhere.
