import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase-server';

export async function GET(req: NextRequest) {
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
    const { data: transactions, error } = await supabase
      .from('billing_transactions')
      .select('*, shops(name)')
      .order('created_at', { ascending: false });

    if (error) throw error;

    return NextResponse.json({ transactions });

  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
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
    const { transactionId, status } = body; // status can be 'approved' or 'rejected'

    if (!transactionId || !['approved', 'rejected'].includes(status)) {
      return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 });
    }

    // 1. Get the transaction info
    const { data: txn, error: getErr } = await supabase
      .from('billing_transactions')
      .select('*')
      .eq('id', transactionId)
      .single();

    if (getErr || !txn) {
      return NextResponse.json({ error: 'Transaction not found.' }, { status: 404 });
    }

    // 2. Update transaction status
    const { error: updateTxnErr } = await supabase
      .from('billing_transactions')
      .update({ status })
      .eq('id', transactionId);

    if (updateTxnErr) throw updateTxnErr;

    // 3. If approved, unlock shop and extend subscription by 30 days!
    if (status === 'approved') {
      const newSubscriptionEnd = new Date();
      newSubscriptionEnd.setDate(newSubscriptionEnd.getDate() + 30);

      const { error: shopErr } = await supabase
        .from('shops')
        .update({
          subscription_status: txn.plan,
          trial_ends_at: newSubscriptionEnd.toISOString(),
          is_suspended: false
        })
        .eq('id', txn.shop_id);

      if (shopErr) throw shopErr;
    }

    return NextResponse.json({ success: true });

  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 550 });
  }
}
