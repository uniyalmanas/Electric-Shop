# Project Context: Electrical Shop Inventory & Finance App

Paste this whole file as context when starting a session in Claude Code, Gemini CLI, or
any agentic coding tool in VS Code. It gives full product context plus what's already
built, so the agent extends the existing scaffold instead of starting over.

---

## 1. Product summary

A niche inventory + finance management web app **specifically for Indian electrical
shops** — not a general store / general Khata app. Built because generic tools
(Vyapar, myBillBook, Khatabook) are broad-purpose and don't handle electrical-retail
specifics well: SKUs sold by meter/box/brand+rating, contractor running-credit,
warranty tracking, and billed vs. unbilled stock.

**Non-negotiable positioning:** stay niche to electrical shops only. Do not build
general-store/multi-vertical support in this phase — that's explicitly out of scope
until there are paying electrical-shop customers.

**Target user split:**
- **Owner** — needs remote visibility/control from his phone: finance, dues, payables,
  low stock, staff management. Full trust in staff to run the shop day-to-day.
- **Staff** — needs a dead-simple way to add/remove stock and record sales. Should
  NOT see cost prices, margins, or finance data.

**Why simplicity is a hard requirement, not a preference:** only ~0.1% of Indian
kirana-type shops (15,000 of 12 million) have digitized with a mobile app. The
dominant failure mode isn't missing features — it's owners/staff abandoning apps
within weeks due to interface confusion and fear of making mistakes. Every UI decision
should default to fewer taps, fewer options, and fewer decisions per screen, especially
for staff-facing screens.

## 2. Tech stack (already decided, do not change without discussion)

- **Next.js 14** (App Router) + **React 18** + **TypeScript**
- **Tailwind CSS** for styling
- **Supabase**: Postgres database, Auth, and Row Level Security (RLS) for the
  owner/staff data separation — enforced at the DB level, not just hidden in the UI
- **`@supabase/ssr`** for session handling across server components, API routes, and
  middleware
- Deployment target: **Vercel**
- WhatsApp automation: **UltraMsg** (used in a prior project, Target Library — same
  approach should carry over for payment/reorder alerts)
- Planned but not yet integrated:
  - Speech-to-text for voice stock entry (Hindi/Hinglish support needed) — evaluate
    Whisper or an equivalent that handles Hinglish well
  - **Claude API** for LLM-based extraction of line items from messy/inconsistent
    supplier invoice PDFs
  - Inbound email service (Mailgun or SendGrid inbound parse) to receive forwarded
    supplier invoice emails

## 3. What's already built — extend this, don't rebuild it

A working scaffold already exists (attached as `electrical-shop-app.zip` / already in
the repo if this context follows the zip). Structure:

```
electrical-shop-app/
├── schema.sql                          # Full Postgres schema + RLS policies
├── middleware.ts                       # Redirects by role, blocks staff from /owner/*
├── lib/supabase.ts                     # Browser + server Supabase clients, shared types
├── app/
│   ├── login/page.tsx                  # Phone+password login (single form)
│   ├── staff/page.tsx                  # 2-screen staff flow: product list → qty entry
│   ├── owner/page.tsx                  # Daily summary + nav to sub-sections
│   └── api/
│       ├── stock-movements/route.ts    # Records stock change + updates running count
│       └── purchases/ingest-email/route.ts  # Stub: creates pending_review purchase
├── package.json
├── .env.example
└── README.md                           # Full setup instructions + roadmap notes
```

**Database schema (`schema.sql`) already includes:**
`shops`, `workers` (role: owner/staff), `products` (electrical-specific fields: category,
unit_type, brand, rating, box_quantity, has_warranty), `customers` (type: walk_in/
contractor), `suppliers`, `sales` + `sale_items`, `purchases` + `purchase_items`
(with `has_bill` flag for billed/unbilled tracking, `source`: manual/email_pdf/voice,
`status`: pending_review/confirmed), `stock_movements` (full audit trail: who, what,
why — `reason` enum includes sale/internal_use/damage/return/transfer), `customer_ledger`
and `supplier_ledger` (owner-only via RLS), `expenses`, `reconciliation_logs`.

RLS is already set up so: all shop members can read/write products, stock movements,
sales, customers, suppliers; **only owner role can read/write** `customer_ledger`,
`supplier_ledger`, `expenses`.

## 4. Core functional requirements (from product owner's direct feedback)

Gathered directly from the electrical shop owner who is the first customer:

1. **Vyapar-equivalent baseline**: GST billing, basic accounting, customer/supplier
   ledgers — table stakes so the app is a credible replacement for what he uses today.
   Do NOT attempt full feature parity with Vyapar (e-way bills, payroll, barcode
   scanning, multi-warehouse) — add only if actual customers request it later.
2. **Billed vs. unbilled inventory**: shops buy some stock via formal GST invoices, some
   informally without a bill. The system must track both — `purchases.has_bill` flag,
   `supplier_invoice_number` nullable. Unbilled purchases still move stock in normally.
3. **Voice-based stock entry**: staff should be able to speak to add/remove stock
   (Hindi/Hinglish), rather than typing. Pipeline: speech-to-text → parse into
   product + quantity + action (add/remove) → show confirmation screen → commit on
   confirm. Never auto-commit from voice without a confirm step.
4. **Email/PDF invoice auto-ingestion**: shops receive supplier bills via email as PDF
   attachments. The system should automatically extract line items and add them to
   inventory. Pipeline: dedicated shop email alias → inbound email service receives
   attachment → PDF text/OCR extraction → LLM (Claude API) parses into structured line
   items → fuzzy-match against existing product catalog → create `purchases` row with
   `status: pending_review` → **owner/staff must confirm before it touches stock or
   ledgers** — never auto-commit silently.
5. **Easy/simple UI**: staff screens especially must stay minimal — 2-3 screens max,
   large touch targets, minimal typing, one clear action per screen.
6. **Separate owner and staff logins**: enforced via `workers.role` + RLS + middleware
   route blocking (already scaffolded). Staff never see cost price, margins, ledgers,
   or finance summaries — enforce this in API route field selection, not just RLS,
   since RLS is row-level not column-level.
7. **GST reports, not GST filing**: generate GSTR-1/GSTR-3B-*ready reports* from
   existing billing data (CGST/SGST/IGST fields already in the schema) for the owner
   to hand to his CA. Do NOT attempt actual return filing/submission to GSTN — that
   requires GST Suvidha Provider (GSP) licensing, which is a multi-month regulatory
   undertaking and a liability risk, entirely out of scope for now.

## 5. Explicit non-goals for this phase

- No general/multi-vertical store support (electrical only)
- No full Vyapar feature parity
- No actual GST return filing/submission
- No onboarding/installation fees in the business model — subscription-only
- Don't over-build reconciliation UI, payroll, or multi-warehouse until real customers
  ask

## 6. Build priorities (in order)

1. Get `schema.sql` running in a real Supabase project; verify RLS policies actually
   restrict staff from finance tables (test with a staff-role session)
2. Wire up real auth (owner + first staff account) and confirm login → correct
   dashboard routing via `middleware.ts`
3. Complete the sales flow (currently only stock movements + purchases exist — need a
   `sales` creation screen for staff: pick customer, add items, choose payment type)
4. Build the customer ledger UI (owner-only) — running balance per contractor, due
   dates, WhatsApp reminder trigger via UltraMsg
5. Build the purchases review screen (owner-only) — confirm/edit items from
   `pending_review` purchases before they commit to stock
6. Voice input pipeline
7. Email/PDF ingestion pipeline (wire the stub route to a real inbound email provider
   + Claude API extraction step)
8. GST report generation (GSTR-1/3B formatted exports)

---

**Instruction to the coding agent:** Read the existing `schema.sql`, `middleware.ts`,
`lib/supabase.ts`, and the files under `app/` before writing anything. Extend the
existing patterns (RLS-first access control, owner/staff field-level separation in API
routes, confirm-before-commit for any automated data entry) rather than introducing new
patterns. Ask before changing the schema or the tech stack choices above.
