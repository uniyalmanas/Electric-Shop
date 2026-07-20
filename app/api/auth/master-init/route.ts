import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();

    const masterEmail = process.env.NEXT_PUBLIC_MASTER_EMAIL;
    const masterPassword = process.env.NEXT_PUBLIC_MASTER_PASSWORD;

    if (!masterEmail || !masterPassword) {
      return NextResponse.json({ error: 'Master credentials are not configured in environment variables.' }, { status: 500 });
    }

    if (email !== masterEmail || password !== masterPassword) {
      return NextResponse.json({ error: 'Invalid master credentials.' }, { status: 401 });
    }

    // 1. Retrieve users to see if master already exists
    const { data: usersList, error: listErr } = await supabaseAdmin.auth.admin.listUsers();
    if (listErr) {
      return NextResponse.json({ error: 'Failed to search users: ' + listErr.message }, { status: 500 });
    }

    const existingUser = usersList.users.find(u => u.email === masterEmail);

    if (existingUser) {
      // Master user exists. Force confirm their email!
      const { error: updateErr } = await supabaseAdmin.auth.admin.updateUserById(existingUser.id, {
        email_confirm: true
      });
      if (updateErr) {
        return NextResponse.json({ error: 'Failed to confirm existing master email: ' + updateErr.message }, { status: 500 });
      }
      return NextResponse.json({ success: true, message: 'Existing master admin email confirmed.' });
    } else {
      // Master user does not exist. Create them with auto-confirmation.
      const { data: newUser, error: createErr } = await supabaseAdmin.auth.admin.createUser({
        email: masterEmail,
        password: masterPassword,
        email_confirm: true,
        user_metadata: { role: 'master' }
      });

      if (createErr || !newUser.user) {
        return NextResponse.json({ error: 'Failed to create master admin user: ' + (createErr?.message || 'unknown error') }, { status: 500 });
      }

      return NextResponse.json({ success: true, message: 'Master admin user created and confirmed.' });
    }
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
