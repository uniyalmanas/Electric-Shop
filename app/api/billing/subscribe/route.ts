import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase-server';

export async function POST(req: NextRequest) {
  const supabase = createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { paymentId, shopId, plan } = await req.json();

    if (!shopId || !plan || !paymentId) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
    }

    // Verify current user belongs to the shop and is owner
    const { data: worker } = await supabase
      .from('workers')
      .select('role, shop_id')
      .eq('auth_id', user.id)
      .single();

    if (!worker || worker.role !== 'owner' || worker.shop_id !== shopId) {
      return NextResponse.json({ error: 'Forbidden: Only shop owners can purchase subscriptions.' }, { status: 403 });
    }

    // Calculate new trial_ends_at (30 days from now)
    const newSubscriptionEnd = new Date();
    newSubscriptionEnd.setDate(newSubscriptionEnd.getDate() + 30);

    // 1. Update shop subscription status and trial period
    const { error: shopErr } = await supabase
      .from('shops')
      .update({
        subscription_status: plan,
        trial_ends_at: newSubscriptionEnd.toISOString(),
        is_suspended: false // Auto-unsuspend if they pay
      })
      .eq('id', shopId);

    if (shopErr) throw shopErr;

    // 2. Log in billing_transactions as auto-approved Razorpay transaction
    const { error: txnErr } = await supabase
      .from('billing_transactions')
      .insert({
        shop_id: shopId,
        amount: 1, // INR 1 testing price
        plan,
        payment_method: 'razorpay',
        transaction_ref: paymentId,
        status: 'approved'
      });

    if (txnErr) {
      console.warn('Logging billing transaction row failed:', txnErr.message);
    }

    return NextResponse.json({ success: true, message: 'Subscription activated.' });

  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 550 });
  }
}
