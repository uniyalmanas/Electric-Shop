const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

async function main() {
  const client = new Client({
    connectionString: 'postgresql://postgres:Manas@12RYZEN@db.rptumrcmtwohqeobfhca.supabase.co:5432/postgres',
  });

  try {
    await client.connect();
    console.log('Connected to database!');

    // 1. Get default shop ID
    const { rows: shops } = await client.query('SELECT id FROM shops LIMIT 1;');
    if (shops.length === 0) {
      console.error('No shop registered in database. Please run migrations first.');
      return;
    }
    const shopId = shops[0].id;
    console.log(`Target Shop ID: ${shopId}`);

    // 2. Read html file content
    const htmlPath = path.join(__dirname, '..', 'electrical-shop-inventory.html');
    const htmlContent = fs.readFileSync(htmlPath, 'utf8');

    // 3. Extract item definitions using regex
    // Example line: item('House Wire 1.0 sq mm', 'wires', 'Finolex', 'FR, 90m coil', 'coil', 950, 42, 10),
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
      else if (catLower.includes('extension')) category = 'other';
      else if (catLower.includes('stabilizer')) category = 'other';
      else if (catLower.includes('tool')) category = 'other';
      else if (catLower.includes('bell')) category = 'other';

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

    console.log(`Parsed ${items.length} items from HTML inventory file.`);

    if (items.length === 0) {
      console.error('Failed to parse items. Check HTML file format or regex.');
      return;
    }

    // 4. Clean existing test products to avoid duplicates
    await client.query('DELETE FROM stock_movements;');
    await client.query('DELETE FROM purchase_items;');
    await client.query('DELETE FROM sale_items;');
    await client.query('DELETE FROM products;');
    console.log('Cleared existing product tables.');

    // 5. Insert parsed items
    let insertedCount = 0;
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const barcode = `8900000000${String(i).padStart(3, '0')}`;
      
      const { rows } = await client.query(
        `INSERT INTO products (
          shop_id, name, category, unit_type, brand, rating, cost_price, selling_price, current_stock, reorder_threshold, barcode
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING id;`,
        [
          shopId,
          item.name,
          item.category,
          item.unit_type,
          item.brand,
          item.rating,
          item.cost_price,
          item.selling_price,
          item.current_stock,
          item.reorder_threshold,
          barcode
        ]
      );

      // Add initial stock movement log for audit trail
      if (item.current_stock > 0 && rows.length > 0) {
        const { rows: workers } = await client.query('SELECT id FROM workers LIMIT 1;');
        if (workers.length > 0) {
          await client.query(
            `INSERT INTO stock_movements (
              shop_id, product_id, worker_id, quantity, direction, reason, entry_method
            ) VALUES ($1, $2, $3, $4, $5, $6, $7);`,
            [shopId, rows[0].id, workers[0].id, item.current_stock, 'in', 'reconciliation_adjustment', 'manual']
          );
        }
      }

      insertedCount++;
    }

    console.log(`Successfully seeded ${insertedCount} electrical shop SKUs into database!`);

  } catch (err) {
    console.error('Error during seeding:', err);
  } finally {
    await client.end();
  }
}

main();
