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

    if (!shopId || !plan) {
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

    // Update shop subscription status and trial period
    const { error: shopErr } = await supabase
      .from('shops')
      .update({
        subscription_status: plan,
        trial_ends_at: newSubscriptionEnd.toISOString(),
        is_suspended: false // Auto-unsuspend if they pay
      })
      .eq('id', shopId);

    if (shopErr) throw shopErr;

    // Log the transaction in stock movements or audit logs if needed, or simply return success
    return NextResponse.json({ success: true, message: 'Subscription activated.' });

  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
