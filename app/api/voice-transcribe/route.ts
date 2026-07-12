import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase-server';

export async function POST(req: NextRequest) {
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'Google API key is not configured.' }, { status: 500 });
  }

  try {
    const formData = await req.formData();
    const audioFile = formData.get('file') as File;
    
    if (!audioFile) {
      return NextResponse.json({ error: 'No audio file provided.' }, { status: 400 });
    }

    const buffer = Buffer.from(await audioFile.arrayBuffer());
    const base64Audio = buffer.toString('base64');

    console.log('Sending audio to Google Speech-to-Text...');
    const speechUrl = `https://speech.googleapis.com/v1/speech:recognize?key=${apiKey}`;
    
    const speechResponse = await fetch(speechUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        config: {
          encoding: 'WEBM_OPUS',
          sampleRateHertz: 48000,
          languageCode: 'hi-IN',
          alternativeLanguageCodes: ['en-IN', 'en-US'],
        },
        audio: {
          content: base64Audio,
        },
      }),
    });

    const speechResult = await speechResponse.json();
    console.log('Speech-to-Text response:', JSON.stringify(speechResult));

    const transcription = speechResult.results?.[0]?.alternatives?.[0]?.transcript;

    if (!transcription) {
      return NextResponse.json({ 
        success: false, 
        error: 'Could not transcribe audio. Speak clearly into the microphone.' 
      });
    }

    console.log(`Transcribed text: "${transcription}"`);

    // Fetch database catalog products and customers to match
    const supabase = createServerSupabaseClient();
    const [{ data: products }, { data: customers }] = await Promise.all([
      supabase.from('products').select('id, name, brand, rating, current_stock, unit_type, selling_price'),
      supabase.from('customers').select('id, name, type'),
    ]);

    const catalogProducts = (products || []).map(p => ({
      id: p.id,
      name: p.name,
      brand: p.brand || '',
      rating: p.rating || '',
      unit_type: p.unit_type,
      price: p.selling_price
    }));

    const catalogCustomers = (customers || []).map(c => ({
      id: c.id,
      name: c.name,
      type: c.type
    }));

    // Send transcription to Gemini to parse into structured actions
    const prompt = `You are a voice command parser for Gupta Electricals, an Indian retail electrical shop.
Analyze this spoken Hinglish/Hindi transcription: "${transcription}"

We have the following catalog of products:
${JSON.stringify(catalogProducts)}

We have the following customers/contractors registered:
${JSON.stringify(catalogCustomers)}

Your job is to match the items, quantity, actions, and contractor in the spoken sentence.
Examples:
1. "Ramesh contractor ko 5 roll polycab wire do credit pe" ->
   action: "sale"
   customer_id: [ID matching Ramesh]
   payment_type: "credit"
   items: [{ product_id: [ID of Polycab wire], quantity: 5 }]

2. "adjust in 10 piece switch" ->
   action: "adjust_in"
   customer_id: null
   payment_type: null
   items: [{ product_id: [ID of matched switch], quantity: 10 }]

Return ONLY a valid JSON object in this format (no markdown, no backticks, no other text):
{
  "action": "sale" | "adjust_in" | "adjust_out" | "unknown",
  "customer_id": "matched_customer_id" | null,
  "items": [
    { "product_id": "matched_product_id", "quantity": number }
  ],
  "payment_type": "cash" | "upi" | "credit" | null
}`;

    console.log('Sending text parser prompt to Gemini...');
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
    
    const geminiResponse = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: 'application/json',
        },
      }),
    });

    const geminiResult = await geminiResponse.json();
    const geminiText = geminiResult.candidates?.[0]?.content?.parts?.[0]?.text;
    
    console.log('Gemini raw response text:', geminiText);

    if (!geminiText) {
      return NextResponse.json({ 
        success: true, 
        transcription, 
        parsed: { action: 'unknown', items: [], customer_id: null, payment_type: null },
        message: 'Could not extract structured data. Try speaking product name and quantity clearly.'
      });
    }

    const parsedAction = JSON.parse(geminiText.trim());

    return NextResponse.json({
      success: true,
      transcription,
      parsed: parsedAction
    });

  } catch (error: any) {
    console.error('Voice transcription server error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
