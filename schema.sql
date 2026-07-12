-- ============================================================
-- Electrical Shop Inventory & Finance Management — Schema
-- Target: Supabase (Postgres + RLS)
-- ============================================================

-- ---------- SHOPS (multi-tenant root) ----------
create table shops (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_auth_id uuid not null references auth.users(id),
  created_at timestamptz default now()
);

-- ---------- WORKERS (owner + staff, linked to Supabase auth) ----------
create table workers (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references shops(id) on delete cascade,
  auth_id uuid not null references auth.users(id),
  name text not null,
  phone text,
  role text not null check (role in ('owner','staff')),
  active boolean default true,
  created_at timestamptz default now(),
  unique (shop_id, auth_id)
);

-- ---------- PRODUCTS (electrical-specific SKU model) ----------
create table products (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references shops(id) on delete cascade,
  name text not null,
  category text not null check (category in
    ('wire','switch','mcb','appliance','fitting','cable','conduit','other')),
  unit_type text not null check (unit_type in ('meter','piece','box','roll')),
  brand text,
  rating text,              -- e.g. "16A", "2.5 sq mm"
  box_quantity int,         -- units per box, if sold by box
  has_warranty boolean default false,
  warranty_months int,
  cost_price numeric(10,2) not null default 0,
  selling_price numeric(10,2) not null default 0,
  current_stock numeric(10,2) not null default 0,
  reorder_threshold numeric(10,2) default 0,
  created_at timestamptz default now()
);

-- ---------- CUSTOMERS ----------
create table customers (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references shops(id) on delete cascade,
  name text not null,
  phone text,
  type text not null check (type in ('walk_in','contractor')) default 'walk_in',
  credit_limit numeric(10,2) default 0,
  created_at timestamptz default now()
);

-- ---------- SUPPLIERS ----------
create table suppliers (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references shops(id) on delete cascade,
  name text not null,
  phone text,
  email text,               -- used to match inbound invoice emails
  payment_terms_days int default 0,
  created_at timestamptz default now()
);

-- ---------- SALES ----------
create table sales (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references shops(id) on delete cascade,
  customer_id uuid references customers(id),
  worker_id uuid not null references workers(id),
  payment_type text not null check (payment_type in ('cash','credit','upi')),
  total_amount numeric(10,2) not null default 0,
  amount_paid numeric(10,2) not null default 0,
  amount_due numeric(10,2) not null default 0,
  created_at timestamptz default now()
);

create table sale_items (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references sales(id) on delete cascade,
  product_id uuid not null references products(id),
  quantity numeric(10,2) not null,
  price numeric(10,2) not null
);

-- ---------- PURCHASES (billed + unbilled) ----------
create table purchases (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references shops(id) on delete cascade,
  supplier_id uuid references suppliers(id),
  has_bill boolean not null default true,
  supplier_invoice_number text,
  source text not null default 'manual' check (source in ('manual','email_pdf','voice')),
  source_file_url text,        -- stored copy of the original PDF, if any
  total_amount numeric(10,2) not null default 0,
  amount_paid numeric(10,2) not null default 0,
  amount_due numeric(10,2) not null default 0,
  status text not null default 'confirmed' check (status in ('pending_review','confirmed')),
  created_at timestamptz default now()
);

create table purchase_items (
  id uuid primary key default gen_random_uuid(),
  purchase_id uuid not null references purchases(id) on delete cascade,
  product_id uuid references products(id),      -- nullable: unmatched item awaiting confirmation
  raw_name text,                                  -- name as extracted, before matching
  quantity numeric(10,2) not null,
  cost_price numeric(10,2) not null
);

-- ---------- STOCK MOVEMENTS (the audit trail — fixes "unnoticed" stock) ----------
create table stock_movements (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references shops(id) on delete cascade,
  product_id uuid not null references products(id),
  worker_id uuid not null references workers(id),
  quantity numeric(10,2) not null,
  direction text not null check (direction in ('in','out')),
  reason text not null check (reason in
    ('sale','purchase','internal_use','damage','return','transfer','reconciliation_adjustment')),
  reference_type text,      -- 'sale' | 'purchase' | null
  reference_id uuid,
  entry_method text default 'manual' check (entry_method in ('manual','voice','email_pdf')),
  created_at timestamptz default now()
);

-- ---------- LEDGERS ----------
create table customer_ledger (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references shops(id) on delete cascade,
  customer_id uuid not null references customers(id),
  sale_id uuid references sales(id),
  amount numeric(10,2) not null,
  type text not null check (type in ('charge','payment')),
  due_date date,
  created_at timestamptz default now()
);

create table supplier_ledger (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references shops(id) on delete cascade,
  supplier_id uuid not null references suppliers(id),
  purchase_id uuid references purchases(id),
  amount numeric(10,2) not null,
  type text not null check (type in ('payable','payment')),
  due_date date,
  created_at timestamptz default now()
);

-- ---------- EXPENSES ----------
create table expenses (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references shops(id) on delete cascade,
  worker_id uuid not null references workers(id),
  category text not null check (category in
    ('rent','wages','electricity','transport','misc')),
  amount numeric(10,2) not null,
  notes text,
  created_at timestamptz default now()
);

-- ---------- RECONCILIATION ----------
create table reconciliation_logs (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references shops(id) on delete cascade,
  product_id uuid not null references products(id),
  worker_id uuid not null references workers(id),
  system_qty numeric(10,2) not null,
  physical_qty numeric(10,2) not null,
  discrepancy numeric(10,2) generated always as (physical_qty - system_qty) stored,
  notes text,
  created_at timestamptz default now()
);

-- ============================================================
-- ROW LEVEL SECURITY
-- Core rule: a worker can only see rows for their own shop_id.
-- Owner-only rule: cost_price / margins / finance tables restricted to role='owner'.
-- ============================================================

alter table shops enable row level security;
alter table workers enable row level security;
alter table products enable row level security;
alter table customers enable row level security;
alter table suppliers enable row level security;
alter table sales enable row level security;
alter table sale_items enable row level security;
alter table purchases enable row level security;
alter table purchase_items enable row level security;
alter table stock_movements enable row level security;
alter table customer_ledger enable row level security;
alter table supplier_ledger enable row level security;
alter table expenses enable row level security;
alter table reconciliation_logs enable row level security;

-- Helper: get the worker row for the current auth user within a shop
create or replace function current_worker_role(target_shop_id uuid)
returns text
language sql stable
as $$
  select role from workers
  where shop_id = target_shop_id and auth_id = auth.uid() and active = true
  limit 1;
$$;

create or replace function is_shop_member(target_shop_id uuid)
returns boolean
language sql stable
as $$
  select exists (
    select 1 from workers
    where shop_id = target_shop_id and auth_id = auth.uid() and active = true
  );
$$;

-- SHOPS: owner sees/manages their own shop
create policy shop_owner_access on shops
  for all using (owner_auth_id = auth.uid());

-- WORKERS: any active member of the shop can see the worker list (for attribution);
-- only owner can insert/update/delete staff
create policy workers_select on workers
  for select using (is_shop_member(shop_id));
create policy workers_owner_write on workers
  for insert with check (current_worker_role(shop_id) = 'owner');
create policy workers_owner_update on workers
  for update using (current_worker_role(shop_id) = 'owner');
create policy workers_owner_delete on workers
  for delete using (current_worker_role(shop_id) = 'owner');

-- PRODUCTS: all shop members can read/write stock-relevant fields.
-- (Cost price visibility is enforced at the application/API layer for staff views —
--  Postgres RLS is row-level, not column-level, so the API must select fields by role.)
create policy products_shop_access on products
  for all using (is_shop_member(shop_id));

-- CUSTOMERS / SUPPLIERS / SALES / SALE_ITEMS / STOCK_MOVEMENTS:
-- all shop members can read and write (staff need this for daily operation)
create policy customers_shop_access on customers for all using (is_shop_member(shop_id));
create policy suppliers_shop_access on suppliers for all using (is_shop_member(shop_id));
create policy sales_shop_access on sales for all using (is_shop_member(shop_id));
create policy sale_items_shop_access on sale_items
  for all using (is_shop_member((select shop_id from sales where sales.id = sale_items.sale_id)));
create policy stock_movements_shop_access on stock_movements
  for all using (is_shop_member(shop_id));

-- PURCHASES / PURCHASE_ITEMS: all members can read; only owner can see amount_paid/finance
-- (again, fine-grained field hiding happens in the API layer)
create policy purchases_shop_access on purchases for all using (is_shop_member(shop_id));
create policy purchase_items_shop_access on purchase_items
  for all using (is_shop_member((select shop_id from purchases where purchases.id = purchase_items.purchase_id)));

-- LEDGERS + EXPENSES: OWNER ONLY — this is the finance layer staff should not see
create policy customer_ledger_owner_only on customer_ledger
  for all using (current_worker_role(shop_id) = 'owner');
create policy supplier_ledger_owner_only on supplier_ledger
  for all using (current_worker_role(shop_id) = 'owner');
create policy expenses_owner_only on expenses
  for all using (current_worker_role(shop_id) = 'owner');

-- RECONCILIATION: any member can log a physical count; only owner reviews discrepancies
create policy reconciliation_insert on reconciliation_logs
  for insert with check (is_shop_member(shop_id));
create policy reconciliation_select on reconciliation_logs
  for select using (is_shop_member(shop_id));

-- ============================================================
-- INDEXES
-- ============================================================
create index idx_products_shop on products(shop_id);
create index idx_stock_movements_shop_product on stock_movements(shop_id, product_id);
create index idx_sales_shop on sales(shop_id, created_at desc);
create index idx_purchases_shop on purchases(shop_id, created_at desc);
create index idx_customer_ledger_customer on customer_ledger(customer_id, due_date);
create index idx_supplier_ledger_supplier on supplier_ledger(supplier_id, due_date);
