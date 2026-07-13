# Project Context: Electrical Shop Inventory & Finance App

Paste this file as context when starting a session in Claude Code, Gemini CLI, or any agentic coding tool in VS Code. It gives full product context, what is built, and what to focus on next.

---

## 1. Product Summary & Positioning

A niche inventory + finance management web app **specifically for Indian electrical shops** (e.g., Senwal Electricals / ElectroStock) — not a general store or general Khata app. Built because generic tools (Vyapar, myBillBook, Khatabook) are broad-purpose and don't handle electrical-retail specifics: SKUs sold by meter/box/brand+rating, contractor running-credit, warranty tracking, unbox calculations, and billed vs. unbilled stock.

**Target User Split:**
- **Owner** — Remote visibility/control: finance margins, dues, payables, low stock, staff management.
- **Staff** — Dead-simple cashier counter checkout and stock adjustment (staff are restricted from seeing cost prices, margins, or finance data).

---

## 2. Tech Stack & Configuration

- **Next.js 14** (App Router) + **React 18** + **TypeScript**
- **Tailwind CSS** + Custom CSS for styling
- **Supabase**: Postgres database, Auth, and Row Level Security (RLS)
- **`@supabase/ssr`** for session handling
- **Gemini 1.5 Flash (via GOOGLE_API_KEY)**: Handles voice speech transcribing and purchase bill OCR parsing
- **Fonts**: Space Grotesk (Headings), IBM Plex Sans (Body), IBM Plex Mono (Monospace/Math)

---

## 3. What Has Been Built (Completed Features)

### 📊 1. Seeded Catalog & Inventory (ElectroStock Catalog)
* **87 Seeded Items**: Master catalog seeded with real Indian electrical shop brands (Finolex, Polycab, Havells, Anchor Roma, L&T, Legrand, Syska, Taparia) and units (meters, pieces, rolls, boxes).
* **Starred / Most Used Strip**: Saved to browser local storage. Starred items (via signature glowing wire bulb toggle) populate in a horizontal drawer at the top.
* **Stock Meters**: Color-coded progress bars showing stock level compared to reorder threshold (Green = Ok, Amber = Low, Red = Critical).
* **Multi-Sorting**: Supports sorting by Name, Stock (Low First), Price (Low/High), and Starred First.

### 📝 2. Billing Counter POS & Receipts
* **Checkout Cart**: Handles customer selectors (walk-in vs contractor), payment types (Cash, UPI, Credit), and balance due calculations.
* **Loose Measure Estimator**: A collapsible drawer widget that lets cashiers calculate custom wire lengths cut from a coil multiplied by custom rates, adding transient `custom-` SKUs directly to the cart.
* **Barcode Scanning Counter**: Staged input text listener matching scanned barcodes (Enter key emulation) to catalog items.
* **80mm Thermal Receipt**: CSS media queries hiding portal navigation and rendering Courier receipt drafts for physical printers.

### 🎙️ 3. Natural Voice Counter Billing
* **Hinglish Transcription**: Cashiers tap the mic and speak statements naturally ("ek coil Finolex 1.5 wire aur 4 SP MCB add karo"). Gemini translates and parses items into target cart matches.

### 🧾 4. Gemini OCR Invoice Ingestion
* **Image/PDF Ingestion**: Drag-and-drop file panel routing streams to `/api/purchases/parse-bill` for structural parsing.
* **WAC Cost Recomputation**: Dynamic Weighted Average Cost ($WAC$) recalculations upon confirming reviewed purchases.

### 🔍 5. Physical Stock Audits
* **Audit Trail**: Staff verify actual shelf counts. Discrepancies log to `reconciliation_logs` alongside system discrepancies and operator name.

### 🛡️ 6. Security & Git Configuration
* **Secret Protection**: `.env.local` untracked and removed from Git indexing.
* **Git Repository**: Initialized and pushed with **21 descriptive commits** to **[uniyalmanas/Electric-Shop](https://github.com/uniyalmanas/Electric-Shop)**.

---

## 4. Current File Layout

```
electrical-shop-app/
├── schema.sql                          # Postgres schema + RLS policies
├── middleware.ts                       # Redirects by role
├── lib/
│   ├── supabase.ts                     # Supabase browser client
│   └── supabase-server.ts              # Supabase server client
├── components/
│   └── Header.tsx                      # ElectroStock themed header
├── app/
│   ├── globals.css                     # Custom fonts & background grid patterns
│   ├── layout.tsx                      # Global theme settings (bg-[#14181B] / bg-[#EDEAE3])
│   ├── page.tsx                        # Main landing portal
│   ├── login/page.tsx                  # Credentials login
│   ├── staff/page.tsx                  # Cashier billing counter POS
│   ├── owner/                          # Owner console pages
│   │   ├── page.tsx                    # Owner metrics & weekly sales trends
│   │   ├── inventory/page.tsx          # ElectroStock inventory catalog & audits
│   │   ├── customers/page.tsx          # Contractor ledger dues
│   │   ├── expenses/page.tsx           # Operating expenses ledger
│   │   ├── purchases/review/page.tsx   # Gemini OCR purchase bills reviews
│   │   ├── reports/page.tsx            # GST taxable reports downloads
│   │   └── suppliers/page.tsx          # Supplier accounts
│   └── api/
│       ├── purchases/parse-bill/       # Gemini AI invoice parser endpoint
│       ├── sales/                      # Sales transactions logging
│       ├── stock-movements/            # Audit movement entries
│       └── voice-transcribe/           # Speech-to-text conversion endpoint
├── scratch/
│   ├── create-git-history.js           # Git commit history script
│   └── seed-inventory.js               # database seeder script
├── .gitignore                          # Excludes secret credentials
├── README.md                           # Readme setup details
└── PROJECT_CONTEXT.md                  # This context file
```

---

## 5. Next Focus & Strategic Roadmap

1. **Role-Based Access Control Enforcement**: Secure API endpoints so staff workers cannot read or write to cost prices, profit margins, supplier ledgers, or CA GST files.
2. **Godown Multi-Location Support**: Track stock transfers between retail counters and separate warehouses.
3. **Live WhatsApp Business API**: Link UltraMsg/Twilio to automatically push generated PDFs to customer numbers.
