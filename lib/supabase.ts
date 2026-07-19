import { createBrowserClient } from '@supabase/ssr';

// Browser-side client — used in client components (login form, staff/owner screens)
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

// Types matching schema.sql — keep in sync as the schema evolves
export type WorkerRole = 'owner' | 'staff';

export interface Worker {
  id: string;
  shop_id: string;
  auth_id: string;
  name: string;
  phone: string | null;
  email: string | null;
  role: WorkerRole;
  active: boolean;
}

export interface Product {
  id: string;
  shop_id: string;
  name: string;
  category: 'wire' | 'switch' | 'mcb' | 'appliance' | 'fitting' | 'cable' | 'conduit' | 'other';
  unit_type: 'meter' | 'piece' | 'box' | 'roll';
  brand: string | null;
  rating: string | null;
  box_quantity: number | null;
  has_warranty: boolean;
  warranty_months: number | null;
  cost_price: number;   // owner-visible only — filter this out before sending to staff clients
  selling_price: number;
  current_stock: number;
  reorder_threshold: number;
}
