import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

const MASTER_EMAIL_HASH = 'd36e8dadc9667e4ac417598f6cd50444139d183bd20a276abc6b70dd0689548c';
const MASTER_PASSWORD_HASH = '1e2460a28591293839cf157f0a9ca9f9d737aeca2b6a4f52ae27b80c44f83ccd';

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });
    }

    // Verify using SHA-256 hashes to keep credentials secure and zero-env
    const emailHash = crypto.createHash('sha256').update(email.trim().toLowerCase()).digest('hex');
    const passwordHash = crypto.createHash('sha256').update(password).digest('hex');

    if (emailHash !== MASTER_EMAIL_HASH || passwordHash !== MASTER_PASSWORD_HASH) {
      return NextResponse.json({ error: 'Invalid master credentials.' }, { status: 401 });
    }

    // 1. Retrieve users to see if master already exists
    const { data: usersList, error: listErr } = await supabaseAdmin.auth.admin.listUsers();
    if (listErr) {
      return NextResponse.json({ error: 'Failed to search users: ' + listErr.message }, { status: 500 });
    }

    const targetEmail = email.trim().toLowerCase();
    const existingUser = usersList.users.find(u => u.email === targetEmail);

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
        email: targetEmail,
        password: password,
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
