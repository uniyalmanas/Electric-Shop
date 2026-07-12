import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase-server';

export async function POST(req: NextRequest) {
  const supabase = createServerSupabaseClient();
  const body = await req.json();

  const { customer_id, worker_id, payment_type, total_amount, amount_paid, items } = body;

  if (!payment_type || !total_amount || !items || !items.length) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  // Get a worker ID if not provided (to attribute the action in bypassed auth mode)
  let activeWorkerId = worker_id;
  if (!activeWorkerId) {
    const { data: workers } = await supabase.from('workers').select('id').limit(1);
    if (workers && workers.length > 0) {
      activeWorkerId = workers[0].id;
    } else {
      return NextResponse.json({ error: 'Must create at least one worker row in the database.' }, { status: 400 });
    }
  }

  // Calculate amount due
  const totalAmountNum = Number(total_amount);
  const amountPaidNum = Number(amount_paid) || 0;
  const amountDueNum = Math.max(0, totalAmountNum - amountPaidNum);

  // Get shop_id from the first item product (RLS is bypassed/disabled so we can query easily)
  const firstProductId = items[0].product_id;
  const { data: productInfo } = await supabase
    .from('products')
    .select('shop_id')
    .eq('id', firstProductId)
    .single();

  if (!productInfo) {
    return NextResponse.json({ error: 'Invalid product items provided.' }, { status: 400 });
  }

  const shopId = productInfo.shop_id;

  // 1. Insert Sales entry
  const { data: sale, error: saleErr } = await supabase
    .from('sales')
    .insert({
      shop_id: shopId,
      customer_id: customer_id || null,
      worker_id: activeWorkerId,
      payment_type,
      total_amount: totalAmountNum,
      amount_paid: amountPaidNum,
      amount_due: amountDueNum,
    })
    .select()
    .single();

  if (saleErr || !sale) {
    return NextResponse.json({ error: 'Sale creation failed: ' + saleErr?.message }, { status: 500 });
  }

  // 2. Loop and process items
  for (const item of items) {
    const { product_id, quantity, price } = item;
    const qtyNum = Number(quantity);
    const priceNum = Number(price);

    // Insert sale_items row
    const { error: itemErr } = await supabase.from('sale_items').insert({
      sale_id: sale.id,
      product_id,
      quantity: qtyNum,
      price: priceNum,
    });

    if (itemErr) {
      console.error('Failed to log sale item:', itemErr);
    }

    // Get current stock for product to recalculate
    const { data: prod } = await supabase
      .from('products')
      .select('current_stock, parent_product_id, box_quantity, name')
      .eq('id', product_id)
      .single();

    if (prod) {
      let currentStockVal = Number(prod.current_stock);
      
      // AUTO-UNBOXING: If requested quantity exceeds current piece stock, check for parent box
      if (qtyNum > currentStockVal && prod.parent_product_id && prod.box_quantity) {
        const { data: parentBox } = await supabase
          .from('products')
          .select('current_stock, name')
          .eq('id', prod.parent_product_id)
          .single();

        if (parentBox && Number(parentBox.current_stock) > 0) {
          // 1. Deduct 1 box from parent
          const updatedBoxStock = Number(parentBox.current_stock) - 1;
          await supabase
            .from('products')
            .update({ current_stock: updatedBoxStock })
            .eq('id', prod.parent_product_id);

          // 2. Log stock movement for parent box (transfer out)
          await supabase.from('stock_movements').insert({
            shop_id: shopId,
            product_id: prod.parent_product_id,
            worker_id: activeWorkerId,
            quantity: 1,
            direction: 'out',
            reason: 'transfer',
            entry_method: 'manual',
          });

          // 3. Add box_quantity (pieces) to current stock
          currentStockVal += Number(prod.box_quantity);
          console.log(`Auto-unboxed 1 Box of "${parentBox.name}" into ${prod.box_quantity} pieces of "${prod.name}"`);

          // 4. Log stock movement for piece product (transfer in)
          await supabase.from('stock_movements').insert({
            shop_id: shopId,
            product_id,
            worker_id: activeWorkerId,
            quantity: Number(prod.box_quantity),
            direction: 'in',
            reason: 'transfer',
            entry_method: 'manual',
          });
        }
      }

      const updatedStock = Math.max(0, currentStockVal - qtyNum);
      
      // Update product current_stock
      await supabase
        .from('products')
        .update({ current_stock: updatedStock })
        .eq('id', product_id);
    }

    // Insert stock_movements audit trail
    await supabase.from('stock_movements').insert({
      shop_id: shopId,
      product_id,
      worker_id: activeWorkerId,
      quantity: qtyNum,
      direction: 'out',
      reason: 'sale',
      reference_type: 'sale',
      reference_id: sale.id,
      entry_method: 'manual',
    });
  }

  // 3. Log into customer ledger if credit purchase / partial payment balance
  if (customer_id && (payment_type === 'credit' || amountDueNum > 0)) {
    // Generate a default 30-day payment term due date for credit
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 30);
    const dueDateString = dueDate.toISOString().split('T')[0];

    const { error: ledgerErr } = await supabase.from('customer_ledger').insert({
      shop_id: shopId,
      customer_id,
      sale_id: sale.id,
      amount: amountDueNum,
      type: 'charge',
      due_date: dueDateString,
    });

    if (ledgerErr) {
      console.error('Failed to log customer ledger charge:', ledgerErr);
    }
  }

  return NextResponse.json({ success: true, sale_id: sale.id });
}
