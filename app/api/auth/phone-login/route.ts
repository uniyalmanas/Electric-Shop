import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

export async function POST(req: NextRequest) {
  try {
    const { phone } = await req.json();

    if (!phone) {
      return NextResponse.json({ error: 'Missing phone number' }, { status: 400 });
    }

    const phoneClean = phone.trim().replace(/\D/g, '');
    if (phoneClean.length !== 10) {
      return NextResponse.json({ error: 'Invalid phone number format' }, { status: 400 });
    }

    // Query workers table using admin privileges to find the email associated with the phone
    const { data: worker, error } = await supabaseAdmin
      .from('workers')
      .select('email')
      .eq('phone', phoneClean)
      .single();

    if (error || !worker || !worker.email) {
      // Fallback for legacy database users (seeded format: phone@shopapp.com)
      return NextResponse.json({ email: `${phoneClean}@shopapp.com` });
    }

    return NextResponse.json({ email: worker.email });
  } catch (err: any) {
    console.error('Phone login API error:', err);
    return NextResponse.json({ error: 'Server error: ' + err.message }, { status: 500 });
  }
}
