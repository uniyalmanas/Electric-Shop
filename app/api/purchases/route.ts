import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase-server';

export async function POST(req: NextRequest) {
  const supabase = createServerSupabaseClient();
  const body = await req.json();

  const { supplier_id, has_bill, supplier_invoice_number, total_amount, amount_paid, items } = body;

  if (!supplier_id || !total_amount || !items || !items.length) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  // Get active worker for attribution in bypassed auth mode
  const { data: workers } = await supabase.from('workers').select('id').limit(1);
  if (!workers || workers.length === 0) {
    return NextResponse.json({ error: 'Requires at least one worker row in database.' }, { status: 400 });
  }
  const workerId = workers[0].id;

  const totalAmountNum = Number(total_amount);
  const amountPaidNum = Number(amount_paid) || 0;
  const amountDueNum = Math.max(0, totalAmountNum - amountPaidNum);

  // Fetch shop_id from supplier
  const { data: supplierInfo } = await supabase
    .from('suppliers')
    .select('shop_id, payment_terms_days')
    .eq('id', supplier_id)
    .single();

  if (!supplierInfo) {
    return NextResponse.json({ error: 'Supplier not found' }, { status: 400 });
  }

  const shopId = supplierInfo.shop_id;

  // 1. Insert Purchase
  const { data: purchase, error: purchaseErr } = await supabase
    .from('purchases')
    .insert({
      shop_id: shopId,
      supplier_id,
      has_bill: Boolean(has_bill),
      supplier_invoice_number: supplier_invoice_number || null,
      source: 'manual',
      total_amount: totalAmountNum,
      amount_paid: amountPaidNum,
      amount_due: amountDueNum,
      status: 'confirmed',
    })
    .select()
    .single();

  if (purchaseErr || !purchase) {
    return NextResponse.json({ error: 'Purchase logging failed: ' + purchaseErr?.message }, { status: 500 });
  }

  // 2. Loop and process purchase items
  for (const item of items) {
    const { product_id, quantity, cost_price } = item;
    const qtyNum = Number(quantity);
    const costNum = Number(cost_price);

    // Insert purchase_items row
    const { error: itemErr } = await supabase.from('purchase_items').insert({
      purchase_id: purchase.id,
      product_id,
      quantity: qtyNum,
      cost_price: costNum,
    });

    if (itemErr) {
      console.error('Failed to log purchase item:', itemErr);
    }

    // Get current stock and cost price to compute Weighted Average Cost (WAC)
    const { data: prod } = await supabase
      .from('products')
      .select('current_stock, cost_price')
      .eq('id', product_id)
      .single();

    if (prod) {
      const currentStock = Number(prod.current_stock) || 0;
      const currentCost = Number(prod.cost_price) || 0;
      
      const newStock = currentStock + qtyNum;
      
      // WAC Formula: ((Q1 * C1) + (Q2 * C2)) / (Q1 + Q2)
      let newWac = costNum;
      if (newStock > 0) {
        newWac = ((currentStock * currentCost) + (qtyNum * costNum)) / newStock;
      }

      // Update product current_stock and cost_price
      await supabase
        .from('products')
        .update({
          current_stock: newStock,
          cost_price: Number(newWac.toFixed(2)),
        })
        .eq('id', product_id);
    }

    // Insert stock_movements audit trail
    await supabase.from('stock_movements').insert({
      shop_id: shopId,
      product_id,
      worker_id: workerId,
      quantity: qtyNum,
      direction: 'in',
      reason: 'purchase',
      reference_type: 'purchase',
      reference_id: purchase.id,
      entry_method: 'manual',
    });
  }

  // 3. Log into supplier ledger if payable exists
  if (amountDueNum > 0) {
    const termsDays = supplierInfo.payment_terms_days || 30;
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + termsDays);
    const dueDateString = dueDate.toISOString().split('T')[0];

    const { error: ledgerErr } = await supabase.from('supplier_ledger').insert({
      shop_id: shopId,
      supplier_id,
      purchase_id: purchase.id,
      amount: amountDueNum,
      type: 'payable',
      due_date: dueDateString,
    });

    if (ledgerErr) {
      console.error('Failed to log supplier ledger payable:', ledgerErr);
    }
  }

  return NextResponse.json({ success: true, purchase_id: purchase.id });
}

export async function PUT(req: NextRequest) {
  const supabase = createServerSupabaseClient();
  const body = await req.json();

  const { purchase_id, items } = body;

  if (!purchase_id || !items || !items.length) {
    return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
  }

  // Get active worker for attribution
  const { data: workers } = await supabase.from('workers').select('id').limit(1);
  if (!workers || workers.length === 0) {
    return NextResponse.json({ error: 'Requires at least one worker.' }, { status: 400 });
  }
  const workerId = workers[0].id;

  // Fetch purchase details
  const { data: purchase, error: purErr } = await supabase
    .from('purchases')
    .select('shop_id, supplier_id, total_amount, amount_paid, amount_due')
    .eq('id', purchase_id)
    .single();

  if (purErr || !purchase) {
    return NextResponse.json({ error: 'Purchase not found: ' + purErr?.message }, { status: 400 });
  }

  const shopId = purchase.shop_id;

  // Process items mapping
  for (const item of items) {
    const { item_id, product_id, quantity, cost_price } = item;
    const qtyNum = Number(quantity);
    const costNum = Number(cost_price);

    // Update purchase_items mapping
    await supabase
      .from('purchase_items')
      .update({ product_id, quantity: qtyNum, cost_price: costNum })
      .eq('id', item_id);

    // Update product stock and WAC cost price
    const { data: prod } = await supabase
      .from('products')
      .select('current_stock, cost_price')
      .eq('id', product_id)
      .single();

    if (prod) {
      const currentStock = Number(prod.current_stock) || 0;
      const currentCost = Number(prod.cost_price) || 0;
      const newStock = currentStock + qtyNum;

      let newWac = costNum;
      if (newStock > 0) {
        newWac = ((currentStock * currentCost) + (qtyNum * costNum)) / newStock;
      }

      await supabase
        .from('products')
        .update({
          current_stock: newStock,
          cost_price: Number(newWac.toFixed(2)),
        })
        .eq('id', product_id);
    }

    // Insert stock movement audit log
    await supabase.from('stock_movements').insert({
      shop_id: shopId,
      product_id,
      worker_id: workerId,
      quantity: qtyNum,
      direction: 'in',
      reason: 'purchase',
      reference_type: 'purchase',
      reference_id: purchase_id,
      entry_method: 'manual',
    });
  }

  // Update purchase status to confirmed
  await supabase
    .from('purchases')
    .update({ status: 'confirmed' })
    .eq('id', purchase_id);

  // Log into supplier ledger if payable exists
  const amountDueNum = Number(purchase.amount_due) || 0;
  if (amountDueNum > 0 && purchase.supplier_id) {
    // Get supplier terms
    const { data: supplierInfo } = await supabase
      .from('suppliers')
      .select('payment_terms_days')
      .eq('id', purchase.supplier_id)
      .single();

    const termsDays = supplierInfo?.payment_terms_days || 30;
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + termsDays);
    const dueDateString = dueDate.toISOString().split('T')[0];

    await supabase.from('supplier_ledger').insert({
      shop_id: shopId,
      supplier_id: purchase.supplier_id,
      purchase_id,
      amount: amountDueNum,
      type: 'payable',
      due_date: dueDateString,
    });
  }

  return NextResponse.json({ success: true });
}

