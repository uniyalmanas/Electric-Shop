import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase-server';

export async function POST(req: NextRequest) {
  const supabase = createServerSupabaseClient();
  
  // 1. Authenticate user
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized: Please log in' }, { status: 401 });
  }

  // 2. Fetch worker profile
  const { data: worker } = await supabase
    .from('workers')
    .select('id, shop_id')
    .eq('auth_id', user.id)
    .single();

  if (!worker) {
    return NextResponse.json({ error: 'Forbidden: Worker profile not found' }, { status: 403 });
  }

  const activeWorkerId = worker.id;
  const body = await req.json();
  const { product_id, quantity, direction, reason, entry_method, location_id, to_location_id } = body;

  if (!product_id || !quantity || !direction || !reason) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  // Get shop_id from the product
  const { data: product, error: productErr } = await supabase
    .from('products')
    .select('shop_id')
    .eq('id', product_id)
    .single();

  if (productErr || !product) {
    return NextResponse.json({ error: 'Product not found' }, { status: 404 });
  }

  // 3. Multi-tenant security check
  if (product.shop_id !== worker.shop_id) {
    return NextResponse.json({ error: 'Forbidden: Product does not belong to your shop' }, { status: 403 });
  }

  const qty = Number(quantity);

  // Resolve source/primary location_id
  let resolvedLocationId = location_id;
  if (!resolvedLocationId) {
    const { data: defaultLoc } = await supabase
      .from('locations')
      .select('id')
      .eq('shop_id', product.shop_id)
      .eq('is_default', true)
      .single();
    if (defaultLoc) {
      resolvedLocationId = defaultLoc.id;
    } else {
      return NextResponse.json({ error: 'No default location found for this shop' }, { status: 400 });
    }
  }

  if (reason === 'transfer') {
    if (!to_location_id) {
      return NextResponse.json({ error: 'Destination location (to_location_id) is required for transfers' }, { status: 400 });
    }
    if (resolvedLocationId === to_location_id) {
      return NextResponse.json({ error: 'Source and destination locations must be different' }, { status: 400 });
    }

    // 1. Get stock at source location
    const { data: sourceStockRow } = await supabase
      .from('product_stocks')
      .select('current_stock')
      .eq('product_id', product_id)
      .eq('location_id', resolvedLocationId)
      .single();

    const currentSourceStock = sourceStockRow ? Number(sourceStockRow.current_stock) : 0;
    if (currentSourceStock < qty) {
      return NextResponse.json(
        { error: `Insufficient stock at source location. Available: ${currentSourceStock}, Requested: ${qty}` },
        { status: 400 }
      );
    }

    // 2. Get stock at destination location
    const { data: destStockRow } = await supabase
      .from('product_stocks')
      .select('current_stock')
      .eq('product_id', product_id)
      .eq('location_id', to_location_id)
      .single();

    const currentDestStock = destStockRow ? Number(destStockRow.current_stock) : 0;

    // 3. Update source stock
    const { error: sourceErr } = await supabase
      .from('product_stocks')
      .upsert({
        shop_id: product.shop_id,
        product_id,
        location_id: resolvedLocationId,
        current_stock: currentSourceStock - qty
      }, { onConflict: 'product_id, location_id' });

    if (sourceErr) {
      return NextResponse.json({ error: 'Failed to update source stock: ' + sourceErr.message }, { status: 500 });
    }

    // 4. Update destination stock
    const { error: destErr } = await supabase
      .from('product_stocks')
      .upsert({
        shop_id: product.shop_id,
        product_id,
        location_id: to_location_id,
        current_stock: currentDestStock + qty
      }, { onConflict: 'product_id, location_id' });

    if (destErr) {
      return NextResponse.json({ error: 'Failed to update destination stock: ' + destErr.message }, { status: 500 });
    }

    // 5. Log stock movement (out from source)
    const { error: moveOutErr } = await supabase.from('stock_movements').insert({
      shop_id: product.shop_id,
      product_id,
      worker_id: activeWorkerId,
      quantity: qty,
      direction: 'out',
      reason: 'transfer',
      location_id: resolvedLocationId,
      to_location_id,
      entry_method: entry_method || 'manual',
    });

    if (moveOutErr) {
      console.error('Failed to log source transfer movement:', moveOutErr);
    }

    // 6. Log stock movement (in to destination)
    const { error: moveInErr } = await supabase.from('stock_movements').insert({
      shop_id: product.shop_id,
      product_id,
      worker_id: activeWorkerId,
      quantity: qty,
      direction: 'in',
      reason: 'transfer',
      location_id: to_location_id,
      entry_method: entry_method || 'manual',
    });

    if (moveInErr) {
      console.error('Failed to log destination transfer movement:', moveInErr);
    }

    // Retrieve updated global product stock
    const { data: updatedProd } = await supabase
      .from('products')
      .select('current_stock')
      .eq('id', product_id)
      .single();

    return NextResponse.json({ success: true, new_stock: updatedProd?.current_stock || 0 });
  } else {
    // Non-transfer movement
    const { data: stockRow } = await supabase
      .from('product_stocks')
      .select('current_stock')
      .eq('product_id', product_id)
      .eq('location_id', resolvedLocationId)
      .single();

    const currentStock = stockRow ? Number(stockRow.current_stock) : 0;
    const newStock =
      direction === 'in'
        ? currentStock + qty
        : currentStock - qty;

    if (newStock < 0) {
      return NextResponse.json(
        { error: 'This would take stock below zero at the selected location.' },
        { status: 400 }
      );
    }

    // Update/upsert location stock
    const { error: stockUpdateErr } = await supabase
      .from('product_stocks')
      .upsert({
        shop_id: product.shop_id,
        product_id,
        location_id: resolvedLocationId,
        current_stock: newStock
      }, { onConflict: 'product_id, location_id' });

    if (stockUpdateErr) {
      return NextResponse.json({ error: stockUpdateErr.message }, { status: 500 });
    }

    // Insert the movement (the audit trail)
    const { error: moveErr } = await supabase.from('stock_movements').insert({
      shop_id: product.shop_id,
      product_id,
      worker_id: activeWorkerId,
      quantity: qty,
      direction,
      reason,
      location_id: resolvedLocationId,
      entry_method: entry_method || 'manual',
    });

    if (moveErr) {
      return NextResponse.json({ error: moveErr.message }, { status: 500 });
    }

    // Retrieve updated global product stock
    const { data: updatedProd } = await supabase
      .from('products')
      .select('current_stock')
      .eq('id', product_id)
      .single();

    return NextResponse.json({ success: true, new_stock: updatedProd?.current_stock || 0 });
  }
}
