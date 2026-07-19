import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();

  // Route definitions
  const isOwnerPath = request.nextUrl.pathname.startsWith('/owner');
  const isStaffPath = request.nextUrl.pathname.startsWith('/staff');
  const isLoginPath = request.nextUrl.pathname === '/login';
  const isSignupPath = request.nextUrl.pathname === '/signup';

  if (!user) {
    // If not authenticated and visiting protected pages, redirect to login
    if (isOwnerPath || isStaffPath) {
      return NextResponse.redirect(new URL('/login', request.url));
    }
  } else {
    // Authenticated user checks
    let role = user.user_metadata?.role;

    if (!role) {
      // Fallback query if role is not in token metadata (e.g. legacy/seeded users)
      const { data: worker } = await supabase
        .from('workers')
        .select('role')
        .eq('auth_id', user.id)
        .single();
      if (worker) {
        role = worker.role;
      }
    }

    // Redirect authenticated users trying to hit login/signup pages to their dashboards
    if (isLoginPath || isSignupPath) {
      if (role === 'staff') {
        return NextResponse.redirect(new URL('/staff', request.url));
      }
      return NextResponse.redirect(new URL('/owner', request.url));
    }

    // Enforce role-based access: staff cannot access /owner/*
    if (isOwnerPath && role === 'staff') {
      return NextResponse.redirect(new URL('/staff', request.url));
    }
  }

  return response;
}

export const config = {
  matcher: ['/login', '/signup', '/staff/:path*', '/owner/:path*'],
};
