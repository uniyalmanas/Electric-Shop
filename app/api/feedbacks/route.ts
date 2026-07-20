import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase-server';

export async function POST(req: NextRequest) {
  const supabase = createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { content, rating } = await req.json();
    if (!content) {
      return NextResponse.json({ error: 'Feedback content is required' }, { status: 400 });
    }

    // Get shop_id and worker_id for the current user
    const { data: worker } = await supabase
      .from('workers')
      .select('id, shop_id')
      .eq('auth_id', user.id)
      .single();

    if (!worker) {
      return NextResponse.json({ error: 'Worker profile not found' }, { status: 403 });
    }

    const { error } = await supabase
      .from('feedbacks')
      .insert({
        shop_id: worker.shop_id,
        worker_id: worker.id,
        content,
        rating: rating ? Number(rating) : null,
      });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const supabase = createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Verify user is master admin
  const { data: worker } = await supabase
    .from('workers')
    .select('role')
    .eq('auth_id', user.id)
    .single();

  if (!worker || worker.role !== 'master') {
    return NextResponse.json({ error: 'Forbidden: Admin access only' }, { status: 403 });
  }

  // Fetch all feedbacks with shop name and worker name
  const { data, error } = await supabase
    .from('feedbacks')
    .select(`
      id,
      content,
      rating,
      created_at,
      shops (name),
      workers (name)
    `)
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ feedbacks: data });
}
