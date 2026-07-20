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
  const isMasterPath = request.nextUrl.pathname.startsWith('/master');
  const isLoginPath = request.nextUrl.pathname === '/login';
  const isSignupPath = request.nextUrl.pathname === '/signup';

  if (!user) {
    // If not authenticated and visiting protected pages, redirect to login
    if (isOwnerPath || isStaffPath || isMasterPath) {
      return NextResponse.redirect(new URL('/login', request.url));
    }
  } else {
    // Fetch worker profile and their shop status
    const { data: worker } = await supabase
      .from('workers')
      .select('role, active, shop_id, shops(is_suspended, subscription_status, trial_ends_at)')
      .eq('auth_id', user.id)
      .single();

    if (!worker || !worker.active) {
      // Inactive or deleted worker: terminate session and redirect to login
      const redirectResponse = NextResponse.redirect(new URL('/login?error=deactivated', request.url));
      // Delete session cookies manually or signOut
      await supabase.auth.signOut();
      return redirectResponse;
    }

    // Check if the shop itself is suspended (masters are immune to suspension check)
    const shopInfo = worker.shops as any;
    const isShopSuspended = shopInfo ? shopInfo.is_suspended : false;
    if (isShopSuspended && worker.role !== 'master') {
      const redirectResponse = NextResponse.redirect(new URL('/login?error=suspended', request.url));
      await supabase.auth.signOut();
      return redirectResponse;
    }

    // Check if the trial or subscription has expired (masters are immune)
    const subscriptionStatus = shopInfo ? shopInfo.subscription_status : 'trial';
    const trialEndsAt = shopInfo?.trial_ends_at ? new Date(shopInfo.trial_ends_at) : new Date();
    const isExpired = subscriptionStatus === 'expired' || 
      (subscriptionStatus === 'trial' && trialEndsAt < new Date());

    if (isExpired && worker.role !== 'master') {
      const isBillingPath = request.nextUrl.pathname.startsWith('/owner/billing');
      if ((isOwnerPath && !isBillingPath) || isStaffPath) {
        return NextResponse.redirect(new URL('/owner/billing', request.url));
      }
    }

    const role = worker.role;

    // Redirect authenticated users trying to hit login/signup pages to their dashboards
    if (isLoginPath || isSignupPath) {
      if (role === 'master') {
        return NextResponse.redirect(new URL('/master', request.url));
      }
      if (role === 'staff') {
        return NextResponse.redirect(new URL('/staff', request.url));
      }
      return NextResponse.redirect(new URL('/owner', request.url));
    }

    // Enforce master path restriction
    if (isMasterPath && role !== 'master') {
      return NextResponse.redirect(new URL('/owner', request.url));
    }

    // Enforce owner-only path restriction (allow master to bypass for admin view)
    if (isOwnerPath && role !== 'owner' && role !== 'master') {
      return NextResponse.redirect(new URL('/staff', request.url));
    }
  }

  return response;
}

export const config = {
  matcher: ['/login', '/signup', '/staff/:path*', '/owner/:path*'],
};
