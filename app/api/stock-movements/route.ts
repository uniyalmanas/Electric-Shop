import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase-server';

export async function POST(req: NextRequest) {
  const supabase = createServerSupabaseClient();
  const body = await req.json();

  const { product_id, worker_id, quantity, direction, reason, entry_method } = body;

  if (!product_id || !worker_id || !quantity || !direction || !reason) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  // Get shop_id + current stock from the product (RLS ensures this only
  // succeeds if the logged-in worker belongs to this shop)
  const { data: product, error: productErr } = await supabase
    .from('products')
    .select('shop_id, current_stock')
    .eq('id', product_id)
    .single();

  if (productErr || !product) {
    return NextResponse.json({ error: 'Product not found' }, { status: 404 });
  }

  const newStock =
    direction === 'in'
      ? Number(product.current_stock) + Number(quantity)
      : Number(product.current_stock) - Number(quantity);

  if (newStock < 0) {
    return NextResponse.json(
      { error: 'This would take stock below zero — check the quantity.' },
      { status: 400 }
    );
  }

  // Insert the movement (the audit trail)
  const { error: moveErr } = await supabase.from('stock_movements').insert({
    shop_id: product.shop_id,
    product_id,
    worker_id,
    quantity,
    direction,
    reason,
    entry_method: entry_method || 'manual',
  });

  if (moveErr) {
    return NextResponse.json({ error: moveErr.message }, { status: 500 });
  }

  // Update the running stock count
  const { error: updateErr } = await supabase
    .from('products')
    .update({ current_stock: newStock })
    .eq('id', product_id);

  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, new_stock: newStock });
}
