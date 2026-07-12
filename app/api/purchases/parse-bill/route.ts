import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase-server';

export async function POST(req: NextRequest) {
  const supabase = createServerSupabaseClient();
  const apiKey = process.env.GOOGLE_API_KEY;

  if (!apiKey) {
    return NextResponse.json({ error: 'GOOGLE_API_KEY is not configured in local environment.' }, { status: 500 });
  }

  try {
    const formData = await req.json();
    const { fileData, fileName, fileType } = formData;

    if (!fileData || !fileType) {
      return NextResponse.json({ error: 'Missing file data or file type' }, { status: 400 });
    }

    // 1. Invoke Gemini 1.5 Flash to parse the document using inlineData
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
    
    const promptText = `
      You are an expert OCR accountant. Analyze this supplier purchase invoice. 
      Extract:
      1. Supplier Name / Company Name
      2. Invoice Number / Bill Number (if any)
      3. Total Invoice Billed Amount
      4. List of items: each item must have:
         - raw_name (item name/description)
         - quantity (number of units)
         - cost_price (unit cost price of this item)

      Ensure all numbers are parsed correctly. If quantity or price is missing, default to 1 and the total item cost respectively.
      Output your response strictly as a JSON object of this structure:
      {
        "supplier_name": "Supplier Company name",
        "invoice_number": "GST-12345",
        "total_amount": 15000.00,
        "items": [
          {
            "raw_name": "Havells 2.5sqmm copper wire red",
            "quantity": 10,
            "cost_price": 1200.00
          }
        ]
      }
    `;

    const response = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                inlineData: {
                  mimeType: fileType,
                  data: fileData, // Base64 encoded string
                },
              },
              {
                text: promptText,
              },
            ],
          },
        ],
        generationConfig: {
          responseMimeType: 'application/json',
        },
      }),
    });

    const geminiData = await response.json();
    
    if (geminiData.error) {
      return NextResponse.json({ error: 'Gemini extraction failed: ' + geminiData.error.message }, { status: 500 });
    }

    const textResponse = geminiData.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!textResponse) {
      return NextResponse.json({ error: 'No text extracted from Gemini.' }, { status: 500 });
    }

    const parsedInvoice = JSON.parse(textResponse.trim());

    // 2. Resolve supplier_id
    let supplierId = null;
    const { data: suppliers } = await supabase.from('suppliers').select('id, name');
    
    if (suppliers && suppliers.length > 0) {
      // Find case-insensitive closest match or fallback to first supplier
      const matched = suppliers.find(
        (s) => s.name.toLowerCase().includes(parsedInvoice.supplier_name.toLowerCase()) || 
               parsedInvoice.supplier_name.toLowerCase().includes(s.name.toLowerCase())
      );
      supplierId = matched ? matched.id : suppliers[0].id;
    } else {
      // Create a default fallback supplier if none exist
      const { data: shops } = await supabase.from('shops').select('id').limit(1);
      if (shops && shops.length > 0) {
        const { data: newSup } = await supabase.from('suppliers').insert({
          shop_id: shops[0].id,
          name: parsedInvoice.supplier_name || 'OCR Parsed Supplier',
        }).select().single();
        if (newSup) supplierId = newSup.id;
      }
    }

    if (!supplierId) {
      return NextResponse.json({ error: 'Requires at least one supplier registered in database.' }, { status: 400 });
    }

    // Get a default shop ID
    const { data: defaultShop } = await supabase.from('shops').select('id').limit(1).single();
    if (!defaultShop) {
      return NextResponse.json({ error: 'No shop configured.' }, { status: 500 });
    }

    // 3. Log a pending review purchase
    const totalAmount = Number(parsedInvoice.total_amount) || 0;
    const { data: purchase, error: purchaseErr } = await supabase
      .from('purchases')
      .insert({
        shop_id: defaultShop.id,
        supplier_id: supplierId,
        has_bill: true,
        supplier_invoice_number: parsedInvoice.invoice_number || null,
        source: 'email_pdf',
        total_amount: totalAmount,
        amount_paid: 0,
        amount_due: totalAmount,
        status: 'pending_review',
      })
      .select()
      .single();

    if (purchaseErr || !purchase) {
      return NextResponse.json({ error: 'Failed to write pending purchase: ' + purchaseErr?.message }, { status: 500 });
    }

    // 4. Log raw items awaiting mapping
    for (const item of (parsedInvoice.items || [])) {
      await supabase.from('purchase_items').insert({
        purchase_id: purchase.id,
        product_id: null, // Awaiting matching
        raw_name: item.raw_name,
        quantity: Number(item.quantity) || 1,
        cost_price: Number(item.cost_price) || 0,
      });
    }

    return NextResponse.json({ success: true, purchase_id: purchase.id });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json({ error: 'OCR Parsing failed: ' + err.message }, { status: 500 });
  }
}
