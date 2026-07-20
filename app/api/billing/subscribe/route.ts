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

    // Server-side Razorpay verification
    const keyId = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;

    let paymentVerified = false;

    if (keyId && keySecret) {
      if (paymentId.startsWith('pay_test_')) {
        return NextResponse.json({ error: 'Cannot use test payment IDs in production mode.' }, { status: 400 });
      }

      try {
        const auth = Buffer.from(`${keyId}:${keySecret}`).toString('base64');
        const rzRes = await fetch(`https://api.razorpay.com/v1/payments/${paymentId}`, {
          headers: {
            Authorization: `Basic ${auth}`,
          },
        });

        if (rzRes.ok) {
          const rzData = await rzRes.json();
          // Verify status is captured or authorized, and amount is correct (₹1 = 100 paise)
          if ((rzData.status === 'captured' || rzData.status === 'authorized') && rzData.amount === 100) {
            paymentVerified = true;
          } else {
            return NextResponse.json({ error: `Invalid payment status (${rzData.status}) or amount (${rzData.amount})` }, { status: 400 });
          }
        } else {
          const errorData = await rzRes.text();
          console.error('Razorpay verification API error:', errorData);
          return NextResponse.json({ error: 'Failed to verify payment with payment gateway.' }, { status: 400 });
        }
      } catch (err: any) {
        console.error('Razorpay verification exception:', err);
        return NextResponse.json({ error: 'Verification request failed: ' + err.message }, { status: 500 });
      }
    } else {
      // In development fallback mode
      console.warn('RAZORPAY_KEY_SECRET is not configured. Falling back to mock verification.');
      if (paymentId.startsWith('pay_test_')) {
        paymentVerified = true;
      } else {
        return NextResponse.json({ error: 'Missing payment configuration secret key.' }, { status: 500 });
      }
    }

    if (!paymentVerified) {
      return NextResponse.json({ error: 'Payment verification failed' }, { status: 400 });
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
