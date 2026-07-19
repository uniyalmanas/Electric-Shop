import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createServerSupabaseClient } from '@/lib/supabase-server';

// Create a Supabase admin client using the service role key to manage Auth users
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

export async function POST(req: NextRequest) {
  const supabase = createServerSupabaseClient();

  try {
    // 1. Authenticate the caller (must be logged in)
    const { data: { user: currentUser } } = await supabase.auth.getUser();
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized: Please log in' }, { status: 401 });
    }

    // 2. Fetch caller worker profile and verify role is owner
    const { data: currentWorker } = await supabase
      .from('workers')
      .select('shop_id, role')
      .eq('auth_id', currentUser.id)
      .single();

    if (!currentWorker || currentWorker.role !== 'owner') {
      return NextResponse.json({ error: 'Forbidden: Only owners can register staff workers' }, { status: 403 });
    }

    // 3. Parse input body
    const body = await req.json();
    const { name, phone, email, password, role } = body;

    if (!name || !phone || !password || !role) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const phoneClean = phone.trim().replace(/\D/g, '');
    if (phoneClean.length !== 10) {
      return NextResponse.json({ error: 'Mobile number must be exactly 10 digits' }, { status: 400 });
    }

    if (password.length < 6) {
      return NextResponse.json({ error: 'Password must be at least 6 characters long' }, { status: 400 });
    }

    if (role !== 'owner' && role !== 'staff') {
      return NextResponse.json({ error: 'Invalid worker role' }, { status: 400 });
    }

    // 4. Create the Auth user for the worker using email or phone fallback
    const finalEmail = email && email.includes('@') ? email.trim().toLowerCase() : `${phoneClean}@shopapp.com`;
    const { data: authUser, error: authErr } = await supabaseAdmin.auth.admin.createUser({
      email: finalEmail,
      password,
      email_confirm: true,
      user_metadata: { role } // Store role in metadata for fast JWT middleware checks
    });

    if (authErr || !authUser.user) {
      return NextResponse.json({ error: 'Authentication registration failed: ' + (authErr?.message || 'unknown error') }, { status: 500 });
    }

    // 5. Link the new Auth user inside the workers database table
    const { data: worker, error: workerErr } = await supabaseAdmin
      .from('workers')
      .insert({
        shop_id: currentWorker.shop_id,
        auth_id: authUser.user.id,
        name: name.trim(),
        phone: phoneClean,
        email: finalEmail,
        role,
        active: true
      })
      .select()
      .single();

    if (workerErr) {
      // Rollback Auth user creation if database linking fails
      await supabaseAdmin.auth.admin.deleteUser(authUser.user.id);
      return NextResponse.json({ error: 'Database profiling failed: ' + workerErr.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, worker });

  } catch (err: any) {
    console.error('Worker registration unhandled error:', err);
    return NextResponse.json({ error: 'Server error: ' + err.message }, { status: 500 });
  }
}
