import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { shopName, ownerName, email, phone, password, seedCatalog, mode } = body;

    if (!shopName || !ownerName || !email || !phone || !password) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const phoneClean = phone.trim().replace(/\D/g, '');
    if (phoneClean.length !== 10) {
      return NextResponse.json({ error: 'Mobile number must be exactly 10 digits' }, { status: 400 });
    }

    // 1. Create the Auth user for the owner using service_role to bypass rate limits/emails
    const { data: authUser, error: authErr } = await supabaseAdmin.auth.admin.createUser({
      email: email.trim().toLowerCase(),
      password,
      email_confirm: true,
      user_metadata: { role: 'owner' }
    });

    if (authErr || !authUser.user) {
      return NextResponse.json({ error: 'Authentication failed: ' + (authErr?.message || 'unknown error') }, { status: 500 });
    }

    // Determine default subscription states based on signup mode
    const subscription_status = mode === 'pay' ? 'expired' : 'trial';
    const trial_ends_at = mode === 'pay' 
      ? new Date(0).toISOString() 
      : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    // 2. Create the shop entry
    const { data: shop, error: shopErr } = await supabaseAdmin
      .from('shops')
      .insert({
        name: shopName.trim(),
        owner_auth_id: authUser.user.id,
        subscription_status,
        trial_ends_at
      })
      .select()
      .single();

    if (shopErr || !shop) {
      // Rollback Auth user
      await supabaseAdmin.auth.admin.deleteUser(authUser.user.id);
      return NextResponse.json({ error: 'Failed to create shop: ' + shopErr?.message }, { status: 500 });
    }

    // 3. Create the owner worker entry
    const { error: workerErr } = await supabaseAdmin
      .from('workers')
      .insert({
        shop_id: shop.id,
        auth_id: authUser.user.id,
        name: ownerName.trim(),
        phone: phoneClean,
        email: email.trim().toLowerCase(),
        role: 'owner',
        active: true
      });

    if (workerErr) {
      // Rollback Shop and Auth user
      await supabaseAdmin.from('shops').delete().eq('id', shop.id);
      await supabaseAdmin.auth.admin.deleteUser(authUser.user.id);
      return NextResponse.json({ error: 'Failed to link owner profile: ' + workerErr.message }, { status: 500 });
    }

    // 4. Seed default catalog if selected
    if (seedCatalog) {
      try {
        const origin = req.nextUrl.origin;
        // Call seed route internally using server-to-server fetch with service key auth
        await fetch(`${origin}/api/shops/seed`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`
          },
          body: JSON.stringify({ shop_id: shop.id })
        });
      } catch (seedErr) {
        console.error('Seeding background warning:', seedErr);
      }
    }

    return NextResponse.json({ success: true });

  } catch (err: any) {
    console.error('Signup API error:', err);
    return NextResponse.json({ error: 'Server error: ' + err.message }, { status: 500 });
  }
}
