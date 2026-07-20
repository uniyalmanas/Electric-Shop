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
    .select('id, role, shop_id')
    .eq('auth_id', user.id)
    .single();

  if (!worker) {
    return NextResponse.json({ error: 'Forbidden: Worker profile not found' }, { status: 403 });
  }

  const activeWorkerId = worker.id;
  const body = await req.json();
  const { customer_id, payment_type, total_amount, amount_paid, items } = body;

  if (!payment_type || total_amount === undefined || !items || !items.length) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  // Calculate amount due and validate numbers
  const totalAmountNum = Number(total_amount);
  const amountPaidNum = Number(amount_paid) || 0;

  // Get shop_id from the first item product
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

  if (shopId !== worker.shop_id) {
    return NextResponse.json({ error: 'Forbidden: Product does not belong to your shop' }, { status: 403 });
  }

  // 3. Fetch product details from DB for price validation, cost-price checks, and stock status
  const productIds = items.map((it: any) => it.product_id);
  const { data: dbProducts, error: dbProdErr } = await supabase
    .from('products')
    .select('id, name, cost_price, selling_price, current_stock, parent_product_id, box_quantity')
    .in('id', productIds);

  if (dbProdErr || !dbProducts || dbProducts.length !== productIds.length) {
    return NextResponse.json({ error: 'Failed to retrieve products from database catalog.' }, { status: 400 });
  }

  // 4. Validate each item (quantity, price, staff restrictions)
  let calculatedTotal = 0;
  for (const item of items) {
    const dbProd = dbProducts.find((p) => p.id === item.product_id);
    if (!dbProd) {
      return NextResponse.json({ error: `Product not found: ${item.product_id}` }, { status: 400 });
    }

    const priceNum = Number(item.price);
    const qtyNum = Number(item.quantity);

    if (isNaN(priceNum) || priceNum < 0) {
      return NextResponse.json({ error: `Invalid price for product ${dbProd.name}` }, { status: 400 });
    }

    if (isNaN(qtyNum) || qtyNum <= 0) {
      return NextResponse.json({ error: `Invalid quantity for product ${dbProd.name}` }, { status: 400 });
    }

    // Staff check: cannot sell below cost price
    if (worker.role === 'staff' && priceNum < Number(dbProd.cost_price)) {
      return NextResponse.json({ 
        error: `Forbidden: Staff cashiers cannot sell ${dbProd.name} below cost price (₹${dbProd.cost_price}).` 
      }, { status: 403 });
    }

    calculatedTotal += qtyNum * priceNum;
  }

  // 5. Verify total amount matches server recomputation (avoid header/total tampering)
  if (Math.abs(calculatedTotal - totalAmountNum) > 0.01) {
    return NextResponse.json({ 
      error: `Total amount mismatch. Client submitted: ₹${totalAmountNum}, Server recalculated: ₹${calculatedTotal}` 
    }, { status: 400 });
  }

  const amountDueNum = Math.max(0, calculatedTotal - amountPaidNum);

  // Fetch default location (Counter) for this shop
  const { data: defaultLoc } = await supabase
    .from('locations')
    .select('id')
    .eq('shop_id', shopId)
    .eq('is_default', true)
    .single();
  
  if (!defaultLoc) {
    return NextResponse.json({ error: 'No default Counter location configured for this shop.' }, { status: 500 });
  }
  const defaultLocId = defaultLoc.id;

  // 6. Insert Sales entry
  const { data: sale, error: saleErr } = await supabase
    .from('sales')
    .insert({
      shop_id: shopId,
      customer_id: customer_id || null,
      worker_id: activeWorkerId,
      payment_type,
      total_amount: calculatedTotal,
      amount_paid: amountPaidNum,
      amount_due: amountDueNum,
    })
    .select()
    .single();

  if (saleErr || !sale) {
    return NextResponse.json({ error: 'Sale creation failed: ' + saleErr?.message }, { status: 500 });
  }

  // Rollback state tracking
  const stockRollbacks: { product_id: string; location_id: string; original_stock: number }[] = [];

  try {
    // 7. Loop and process items
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
        throw new Error(`Failed to log sale item: ${itemErr.message}`);
      }

      // Get product details
      const prod = dbProducts.find(p => p.id === product_id)!;

      // Fetch stock at default location
      const { data: stockRow, error: stockFetchErr } = await supabase
        .from('product_stocks')
        .select('current_stock')
        .eq('product_id', product_id)
        .eq('location_id', defaultLocId)
        .single();
      
      if (stockFetchErr && stockFetchErr.code !== 'PGRST116') {
        throw new Error(`Failed to fetch stock for product ${prod.name}: ${stockFetchErr.message}`);
      }

      let currentStockVal = stockRow ? Number(stockRow.current_stock) : 0;
      
      // AUTO-UNBOXING: If requested quantity exceeds current piece stock, check for parent box
      if (qtyNum > currentStockVal && prod.parent_product_id && prod.box_quantity) {
        const { data: parentBoxStockRow, error: pBoxErr } = await supabase
          .from('product_stocks')
          .select('current_stock')
          .eq('product_id', prod.parent_product_id)
          .eq('location_id', defaultLocId)
          .single();

        if (pBoxErr && pBoxErr.code !== 'PGRST116') {
          throw new Error(`Failed to fetch parent box stock: ${pBoxErr.message}`);
        }

        const parentBoxStock = parentBoxStockRow ? Number(parentBoxStockRow.current_stock) : 0;

        if (parentBoxStock > 0) {
          // Track rollback for parent box stock
          stockRollbacks.push({
            product_id: prod.parent_product_id,
            location_id: defaultLocId,
            original_stock: parentBoxStock
          });

          // Deduct 1 box from parent in product_stocks
          const updatedBoxStock = parentBoxStock - 1;
          const { error: pBoxUpdateErr } = await supabase
            .from('product_stocks')
            .upsert({
              shop_id: shopId,
              product_id: prod.parent_product_id,
              location_id: defaultLocId,
              current_stock: updatedBoxStock
            }, { onConflict: 'product_id, location_id' });

          if (pBoxUpdateErr) {
            throw new Error(`Failed to update parent box stock: ${pBoxUpdateErr.message}`);
          }

          // Log stock movement for parent box (transfer out)
          await supabase.from('stock_movements').insert({
            shop_id: shopId,
            product_id: prod.parent_product_id,
            worker_id: activeWorkerId,
            quantity: 1,
            direction: 'out',
            reason: 'transfer',
            location_id: defaultLocId,
            entry_method: 'manual',
          });

          // Add box_quantity (pieces) to current stock
          currentStockVal += Number(prod.box_quantity);
          console.log(`Auto-unboxed 1 Box into ${prod.box_quantity} pieces for product ${prod.name}`);

          // Log stock movement for piece product (transfer in)
          await supabase.from('stock_movements').insert({
            shop_id: shopId,
            product_id,
            worker_id: activeWorkerId,
            quantity: Number(prod.box_quantity),
            direction: 'in',
            reason: 'transfer',
            location_id: defaultLocId,
            entry_method: 'manual',
          });
        }
      }

      // Track rollback for piece stock
      stockRollbacks.push({
        product_id,
        location_id: defaultLocId,
        original_stock: stockRow ? Number(stockRow.current_stock) : 0
      });

      const updatedStock = Math.max(0, currentStockVal - qtyNum);
      
      // Update product_stocks at default location
      const { error: stockUpdateErr } = await supabase
        .from('product_stocks')
        .upsert({
          shop_id: shopId,
          product_id,
          location_id: defaultLocId,
          current_stock: updatedStock
        }, { onConflict: 'product_id, location_id' });

      if (stockUpdateErr) {
        throw new Error(`Failed to update product stock: ${stockUpdateErr.message}`);
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
        location_id: defaultLocId,
        entry_method: 'manual',
      });
    }

    // 8. Log into customer ledger if credit purchase / partial payment balance
    if (customer_id && (payment_type === 'credit' || amountDueNum > 0)) {
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
        throw new Error(`Failed to log customer ledger charge: ${ledgerErr.message}`);
      }
    }

  } catch (error: any) {
    console.error('Checkout processing error, rolling back...', error);
    
    // Rollback stock levels
    for (const rb of stockRollbacks) {
      await supabase
        .from('product_stocks')
        .upsert({
          shop_id: shopId,
          product_id: rb.product_id,
          location_id: rb.location_id,
          current_stock: rb.original_stock
        }, { onConflict: 'product_id, location_id' });
    }

    // Rollback Sale record (deletes sale_items cascadingly)
    await supabase.from('sales').delete().eq('id', sale.id);

    return NextResponse.json({ error: 'Checkout failed and changes rolled back: ' + error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, sale_id: sale.id });
}
