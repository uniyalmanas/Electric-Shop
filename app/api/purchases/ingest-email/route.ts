import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase-server';

/**
 * This endpoint is the target for an inbound-email webhook (e.g. Mailgun/SendGrid
 * inbound parse) OR is called by a background job after fetching from a shop's
 * forwarded Gmail inbox.
 *
 * PIPELINE THIS ROUTE ASSUMES HAS ALREADY HAPPENED UPSTREAM:
 *   1. Email received at shop's dedicated ingestion address
 *   2. PDF attachment extracted
 *   3. OCR run if the PDF is a scanned image (not needed for text-based PDFs)
 *   4. An LLM extraction step (e.g. Claude API) parsed the PDF into structured
 *      line items: { raw_name, quantity, cost_price }, plus supplier name/email,
 *      invoice number, and total amount.
 *
 * This route's job is just to: match the shop by supplier email domain / a
 * shop-specific alias, fuzzy-match extracted items against the product catalog,
 * and create a 'pending_review' purchase for the owner to confirm.
 *
 * NOTE: This is a stub. Wire in your actual email-ingestion provider and the
 * LLM extraction call before this becomes live.
 */

interface ExtractedLineItem {
  raw_name: string;
  quantity: number;
  cost_price: number;
}

interface IngestPayload {
  shop_id: string;
  supplier_email: string;
  supplier_invoice_number: string;
  total_amount: number;
  source_file_url: string; // where the original PDF was stored (e.g. Supabase Storage)
  line_items: ExtractedLineItem[];
}

export async function POST(req: NextRequest) {
  const supabase = createServerSupabaseClient();
  const payload: IngestPayload = await req.json();

  const { shop_id, supplier_email, supplier_invoice_number, total_amount, source_file_url, line_items } = payload;

  if (!shop_id || !line_items?.length) {
    return NextResponse.json({ error: 'Missing shop_id or line_items' }, { status: 400 });
  }

  // Try to match supplier by email
  const { data: supplier } = await supabase
    .from('suppliers')
    .select('id')
    .eq('shop_id', shop_id)
    .eq('email', supplier_email)
    .maybeSingle();

  // Create the purchase in 'pending_review' — nothing touches stock until the
  // owner/worker confirms it in the review screen. This is the required
  // human-confirmation step before any silent stock/ledger change.
  const { data: purchase, error: purchaseErr } = await supabase
    .from('purchases')
    .insert({
      shop_id,
      supplier_id: supplier?.id || null,
      has_bill: true,
      supplier_invoice_number,
      source: 'email_pdf',
      source_file_url,
      total_amount,
      status: 'pending_review',
    })
    .select()
    .single();

  if (purchaseErr || !purchase) {
    return NextResponse.json({ error: purchaseErr?.message }, { status: 500 });
  }

  // Fuzzy-match each extracted line item against existing products.
  // Simple version here: exact/substring match on name. Replace with a proper
  // fuzzy-match (e.g. trigram similarity via pg_trgm, or an LLM matching pass)
  // once you have real supplier invoice samples to test against.
  const { data: products } = await supabase
    .from('products')
    .select('id, name')
    .eq('shop_id', shop_id);

  const itemRows = line_items.map((item) => {
    const match = products?.find((p) =>
      p.name.toLowerCase().includes(item.raw_name.toLowerCase()) ||
      item.raw_name.toLowerCase().includes(p.name.toLowerCase())
    );
    return {
      purchase_id: purchase.id,
      product_id: match?.id || null, // null = "new item, needs confirmation"
      raw_name: item.raw_name,
      quantity: item.quantity,
      cost_price: item.cost_price,
    };
  });

  const { error: itemsErr } = await supabase.from('purchase_items').insert(itemRows);
  if (itemsErr) {
    return NextResponse.json({ error: itemsErr.message }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    purchase_id: purchase.id,
    unmatched_items: itemRows.filter((r) => !r.product_id).length,
    message: 'Purchase created as pending_review. Owner must confirm before stock updates.',
  });
}
