import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase-server';

export async function POST(req: NextRequest) {
  const apiKey = process.env.GOOGLE_API_KEY;

  try {
    const formData = await req.formData();
    const audioFile = formData.get('file') as File;
    
    if (!audioFile) {
      return NextResponse.json({ error: 'No audio file provided.' }, { status: 400 });
    }

    const buffer = Buffer.from(await audioFile.arrayBuffer());
    const base64Audio = buffer.toString('base64');

    // Fetch database catalog products and customers to match
    const supabase = createServerSupabaseClient();
    const [{ data: products }, { data: customers }] = await Promise.all([
      supabase.from('products').select('id, name, brand, rating, current_stock, unit_type, selling_price, cost_price'),
      supabase.from('customers').select('id, name, type'),
    ]);

    const catalogProducts = (products || []).map(p => ({
      id: p.id,
      name: p.name,
      brand: p.brand || '',
      rating: p.rating || '',
      unit_type: p.unit_type,
      price: p.selling_price,
      cost_price: p.cost_price
    }));

    const catalogCustomers = (customers || []).map(c => ({
      id: c.id,
      name: c.name,
      type: c.type
    }));

    let voiceResult = null;
    let isMock = false;

    if (apiKey) {
      try {
        console.log('Calling Gemini 3.5 Flash with audio file directly for transcription and parsing...');
        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${apiKey}`;
        
        const prompt = `You are a voice command parser for Gupta Electricals, an Indian retail electrical shop.
Listen to this spoken Hinglish/Hindi command.

First, transcribe the spoken command exactly as heard in Hindi/Hinglish (e.g. "Ramesh contractor ko 5 roll polycab wire do credit pe" or "adjust in 10 piece switch"). Put this transcription in the "transcription" field.

Second, match the items, quantity, actions, and contractor in the spoken sentence against our product catalog and customer list.

We have the following catalog of products:
${JSON.stringify(catalogProducts)}

We have the following customers/contractors registered:
${JSON.stringify(catalogCustomers)}

Your job is to match the items, quantity, actions, and contractor in the spoken sentence.
Examples of sentence patterns and their matched outputs:
1. "Ramesh Electrician ko 5 roll polycab wire do credit pe" ->
   action: "sale"
   customer_id: [ID matching Ramesh Electrician]
   payment_type: "credit"
   items: [{ product_id: [ID of Polycab wire], quantity: 5 }]

2. "adjust in 10 piece switch" ->
   action: "adjust_in"
   customer_id: null
   payment_type: null
   items: [{ product_id: [ID of matched switch], quantity: 10 }]

Ensure the product matches are accurate. If the brand or spec is mentioned, match it to the exact catalog item.
Return strictly a valid JSON object matching this structure:
{
  "transcription": "spoken transcription here",
  "action": "sale" | "adjust_in" | "adjust_out" | "unknown",
  "customer_id": "matched_customer_id" | null,
  "items": [
    { "product_id": "matched_product_id", "quantity": number }
  ],
  "payment_type": "cash" | "upi" | "credit" | null
}
`;

        const geminiResponse = await fetch(geminiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  {
                    inlineData: {
                      mimeType: audioFile.type || 'audio/webm',
                      data: base64Audio,
                    },
                  },
                  {
                    text: prompt,
                  },
                ],
              },
            ],
            generationConfig: {
              responseMimeType: 'application/json',
            },
          }),
        });

        if (geminiResponse.status === 200) {
          const geminiData = await geminiResponse.json();
          if (!geminiData.error) {
            const geminiText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text;
            if (geminiText) {
              const parsedRes = JSON.parse(geminiText.trim());
              voiceResult = {
                transcription: parsedRes.transcription || 'Spoken command parsed.',
                parsed: {
                  action: parsedRes.action || 'unknown',
                  customer_id: parsedRes.customer_id || null,
                  items: parsedRes.items || [],
                  payment_type: parsedRes.payment_type || null
                }
              };
            }
          } else {
            console.error('Gemini voice transcription error:', geminiData.error);
          }
        } else {
          console.error('Gemini voice HTTP error status:', geminiResponse.status);
        }
      } catch (geminiErr) {
        console.error('Gemini voice exception:', geminiErr);
      }
    }

    // Fallback mock mode if Gemini is missing, leaked, or failed
    if (!voiceResult) {
      isMock = true;
      console.warn('Using development voice command parser fallback.');
      
      const roll = Math.floor(Math.random() * 3);
      if (roll === 0) {
        const cust = catalogCustomers.find(c => c.name.toLowerCase().includes('ramesh')) || catalogCustomers[0];
        const prod = catalogProducts.find(p => p.brand === 'Polycab' && p.name.includes('1.5')) || catalogProducts[0];
        voiceResult = {
          transcription: "Ramesh Electrician ko 10 rolls Polycab 1.5 wire do credit pe",
          parsed: {
            action: "sale",
            customer_id: cust ? cust.id : null,
            items: prod ? [{ product_id: prod.id, quantity: 10 }] : [],
            payment_type: "credit"
          }
        };
      } else if (roll === 1) {
        const prod = catalogProducts.find(p => p.brand === 'Havells' && p.name.toLowerCase().includes('switch')) || catalogProducts[0];
        voiceResult = {
          transcription: "5 piece Havells modular switch billing cash",
          parsed: {
            action: "sale",
            customer_id: null,
            items: prod ? [{ product_id: prod.id, quantity: 5 }] : [],
            payment_type: "cash"
          }
        };
      } else {
        const prod = catalogProducts.find(p => p.brand === 'Anchor' && p.name.toLowerCase().includes('switch')) || catalogProducts[0];
        voiceResult = {
          transcription: "Roma switch adjust in 20 pieces",
          parsed: {
            action: "adjust_in",
            customer_id: null,
            items: prod ? [{ product_id: prod.id, quantity: 20 }] : [],
            payment_type: null
          }
        };
      }
    }

    return NextResponse.json({
      success: true,
      transcription: voiceResult.transcription,
      parsed: voiceResult.parsed,
      is_mock: isMock
    });

  } catch (error: any) {
    console.error('Voice transcription server error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
