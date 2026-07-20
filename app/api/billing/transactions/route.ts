import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase-server';

export async function GET(req: NextRequest) {
  const supabase = createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Verify worker
    const { data: worker } = await supabase
      .from('workers')
      .select('shop_id')
      .eq('auth_id', user.id)
      .single();

    if (!worker) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { data: transactions, error } = await supabase
      .from('billing_transactions')
      .select('*')
      .eq('shop_id', worker.shop_id)
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

  try {
    const { amount, plan, payment_method, transaction_ref } = await req.json();

    if (!amount || !plan || !payment_method || !transaction_ref) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
    }

    // Verify worker is owner
    const { data: worker } = await supabase
      .from('workers')
      .select('role, shop_id')
      .eq('auth_id', user.id)
      .single();

    if (!worker || worker.role !== 'owner') {
      return NextResponse.json({ error: 'Only owners can record transactions.' }, { status: 403 });
    }

    // Insert pending transaction log
    const { data: transaction, error } = await supabase
      .from('billing_transactions')
      .insert({
        shop_id: worker.shop_id,
        amount: Number(amount),
        plan,
        payment_method,
        transaction_ref: transaction_ref.trim(),
        status: 'pending' // UPI is manually verified by master
      })
      .select()
      .single();

    if (error) {
      if (error.message.includes('unique')) {
        return NextResponse.json({ error: 'This Transaction Reference ID/UTR has already been submitted.' }, { status: 400 });
      }
      throw error;
    }

    return NextResponse.json({ success: true, transaction });

  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
