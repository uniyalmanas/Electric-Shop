import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase-server';

export async function GET(req: NextRequest) {
  const supabase = createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Verify user is master admin
  const { data: worker } = await supabase
    .from('workers')
    .select('role')
    .eq('auth_id', user.id)
    .single();

  if (!worker || worker.role !== 'master') {
    return NextResponse.json({ error: 'Forbidden: Admin access only' }, { status: 403 });
  }

  try {
    // Fetch basic shop info
    const { data: shops, error: shopsErr } = await supabase
      .from('shops')
      .select('id, name, created_at, subscription_status, trial_ends_at, is_suspended, owner_auth_id')
      .order('created_at', { ascending: false });

    if (shopsErr) throw shopsErr;

    // Fetch aggregates for each shop in parallel
    const detailedShops = await Promise.all((shops || []).map(async (shop) => {
      // 1. Worker count
      const { count: workerCount } = await supabase
        .from('workers')
        .select('*', { count: 'exact', head: true })
        .eq('shop_id', shop.id);

      // 2. Product count
      const { count: productCount } = await supabase
        .from('products')
        .select('*', { count: 'exact', head: true })
        .eq('shop_id', shop.id);

      // 3. Sales count
      const { count: salesCount } = await supabase
        .from('sales')
        .select('*', { count: 'exact', head: true })
        .eq('shop_id', shop.id);

      // 4. Ledger dues sum
      const { data: ledgerData } = await supabase
        .from('customer_ledger')
        .select('amount, type')
        .eq('shop_id', shop.id);

      const duesSum = (ledgerData || []).reduce(
        (sum, l) => sum + (l.type === 'charge' ? Number(l.amount) : -Number(l.amount)),
        0
      );

      return {
        ...shop,
        workerCount: workerCount || 0,
        productCount: productCount || 0,
        salesCount: salesCount || 0,
        duesSum: duesSum || 0
      };
    }));

    return NextResponse.json({ shops: detailedShops });

  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 550 });
  }
}

export async function POST(req: NextRequest) {
  const supabase = createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Verify master status
  const { data: worker } = await supabase
    .from('workers')
    .select('role')
    .eq('auth_id', user.id)
    .single();

  if (!worker || worker.role !== 'master') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { shopId, subscription_status, trial_ends_at, is_suspended } = body;

    if (!shopId) {
      return NextResponse.json({ error: 'Shop ID is required' }, { status: 400 });
    }

    const updates: any = {};
    if (subscription_status !== undefined) updates.subscription_status = subscription_status;
    if (trial_ends_at !== undefined) updates.trial_ends_at = trial_ends_at;
    if (is_suspended !== undefined) updates.is_suspended = is_suspended;

    const { error } = await supabase
      .from('shops')
      .update(updates)
      .eq('id', shopId);

    if (error) throw error;

    return NextResponse.json({ success: true });

  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
