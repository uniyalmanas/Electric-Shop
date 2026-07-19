import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import fs from 'fs';
import path from 'path';

export async function POST(req: NextRequest) {
  const supabase = createServerSupabaseClient();
  const body = await req.json();
  const { shop_id } = body;

  if (!shop_id) {
    return NextResponse.json({ error: 'Missing shop_id' }, { status: 400 });
  }

  // 1. Verify that the authenticated user is indeed the owner of this shop
  const { data: shop, error: shopErr } = await supabase
    .from('shops')
    .select('id, owner_auth_id')
    .eq('id', shop_id)
    .single();

  if (shopErr || !shop) {
    return NextResponse.json({ error: 'Shop not found' }, { status: 404 });
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user || shop.owner_auth_id !== user.id) {
    return NextResponse.json({ error: 'Unauthorized to seed this shop' }, { status: 403 });
  }

  try {
    // 2. Read the standard HTML inventory file
    const htmlPath = path.join(process.cwd(), 'electrical-shop-inventory.html');
    if (!fs.existsSync(htmlPath)) {
      return NextResponse.json({ error: 'Inventory seed file not found' }, { status: 500 });
    }
    const htmlContent = fs.readFileSync(htmlPath, 'utf8');

    // 3. Extract items using the same regex as the main seeder
    const regex = /item\(\s*'([^']+)'\s*,\s*'([^']+)'\s*,\s*'([^']*)'\s*,\s*'([^']*)'\s*,\s*'([^']+)'\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*\)/g;
    
    let match;
    const items = [];
    while ((match = regex.exec(htmlContent)) !== null) {
      const [_, name, rawCategory, brand, spec, rawUnit, price, stock, threshold] = match;
      
      // Map category
      let category = 'other';
      const catLower = rawCategory.toLowerCase();
      if (catLower.includes('wire') || catLower.includes('cable')) category = 'wire';
      else if (catLower.includes('switch') || catLower.includes('socket')) category = 'switch';
      else if (catLower.includes('mcb') || catLower.includes('switchgear')) category = 'mcb';
      else if (catLower.includes('db') || catLower.includes('distribution')) category = 'fitting';
      else if (catLower.includes('conduit') || catLower.includes('pipe')) category = 'conduit';
      else if (catLower.includes('lighting')) category = 'appliance';
      else if (catLower.includes('fan')) category = 'appliance';
      else if (catLower.includes('heater')) category = 'appliance';

      // Map unit type
      let unit_type = 'piece';
      const unitLower = rawUnit.toLowerCase();
      if (unitLower.includes('meter')) unit_type = 'meter';
      else if (unitLower.includes('box')) unit_type = 'box';
      else if (unitLower.includes('coil') || unitLower.includes('roll')) unit_type = 'roll';

      items.push({
        name: spec ? `${name} (${spec})` : name,
        category,
        brand: brand || 'Generic',
        rating: spec || null,
        unit_type,
        selling_price: parseFloat(price) || 0,
        cost_price: Math.round((parseFloat(price) || 0) * 0.75), // 25% average margin cost seed
        current_stock: parseFloat(stock) || 0,
        reorder_threshold: parseFloat(threshold) || 0,
      });
    }

    if (items.length === 0) {
      return NextResponse.json({ error: 'No items parsed' }, { status: 500 });
    }

    // 4. Batch insert products
    const productsToInsert = items.map((item, idx) => ({
      shop_id,
      name: item.name,
      category: item.category,
      unit_type: item.unit_type,
      brand: item.brand,
      rating: item.rating,
      cost_price: item.cost_price,
      selling_price: item.selling_price,
      current_stock: item.current_stock, // Triggers will handle product_stocks setup
      reorder_threshold: item.reorder_threshold,
      barcode: `8900000000${String(idx).padStart(3, '0')}`,
    }));

    const { error: insertErr } = await supabase
      .from('products')
      .insert(productsToInsert);

    if (insertErr) {
      return NextResponse.json({ error: 'Failed to insert products: ' + insertErr.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, count: productsToInsert.length });
  } catch (err: any) {
    return NextResponse.json({ error: 'Internal server error: ' + err.message }, { status: 500 });
  }
}
