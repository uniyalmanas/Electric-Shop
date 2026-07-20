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

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });
    }

    const expectedEmail = process.env.MASTER_EMAIL || process.env.NEXT_PUBLIC_MASTER_EMAIL;
    const expectedPassword = process.env.MASTER_PASSWORD || process.env.NEXT_PUBLIC_MASTER_PASSWORD;

    if (!expectedEmail || !expectedPassword) {
      return NextResponse.json({ error: 'Master credentials are not configured on the server.' }, { status: 500 });
    }

    if (email.trim().toLowerCase() !== expectedEmail.trim().toLowerCase() || password !== expectedPassword) {
      return NextResponse.json({ error: 'Invalid master credentials.' }, { status: 401 });
    }

    const targetEmail = email.trim().toLowerCase();

    // 1. Try signing in directly first to verify if credentials are already correct and confirmed
    const supabaseClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { persistSession: false } }
    );

    const { error: testLoginErr } = await supabaseClient.auth.signInWithPassword({
      email: targetEmail,
      password: password
    });

    if (!testLoginErr) {
      // Login worked perfectly! No changes needed, avoids hitting admin api or email rate limits
      return NextResponse.json({ success: true, message: 'Master admin credentials validated successfully.' });
    }

    // 2. If login failed, it means the password is sync-locked or email is unconfirmed. Run admin reset/creation.
    const { data: usersList, error: listErr } = await supabaseAdmin.auth.admin.listUsers();
    if (listErr) {
      return NextResponse.json({ error: 'Failed to search users: ' + listErr.message }, { status: 500 });
    }

    const existingUser = usersList.users.find(u => u.email === targetEmail);

    if (existingUser) {
      // User exists but login failed. Force update password and confirm status.
      const { error: updateErr } = await supabaseAdmin.auth.admin.updateUserById(existingUser.id, {
        password: password,
        email_confirm: true
      });
      if (updateErr) {
        if (updateErr.message.includes('rate limit')) {
          console.warn('Rate limit hit during password update sync.');
          return NextResponse.json({ success: true, message: 'Rate limit bypass.' });
        }
        return NextResponse.json({ error: 'Failed to update credentials: ' + updateErr.message }, { status: 500 });
      }
      return NextResponse.json({ success: true, message: 'Master credentials synchronized and confirmed.' });
    } else {
      // Create user auto-confirmed
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
