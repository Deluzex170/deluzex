import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

function decodeJwtPayload(token: string): { sub?: string; is_admin?: boolean; exp?: number } | null {
  try {
    const parts = token.split('.');
    if (parts.length < 2) return null;
    const base64Url = parts[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const json = atob(base64);
    return JSON.parse(json);
  } catch {
    return null;
  }
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  const isAdminLogin = pathname === '/admin/login';
  const isAdminRoute = (pathname === '/admin' || pathname.startsWith('/admin/')) && !isAdminLogin;
  // Checkout is open to guests; only account areas need a session
  const protectedRoutes: string[] = [];
  const isProtectedRoute = protectedRoutes.some(route => pathname === route || pathname.startsWith(route + '/'));

  // Define routes meant only for unauthenticated regular users
  const authRoutes = ['/login', '/signup', '/signin'];
  const isAuthRoute = authRoutes.some(route => pathname === route || pathname.startsWith(route + '/'));

  // Get token/session from cookies
  const token = request.cookies.get('accessToken')?.value || request.cookies.get('session')?.value || request.cookies.get('access_token')?.value;

  if (isAdminLogin) {
    if (token) {
      const payload = decodeJwtPayload(token);
      const isExpired = payload?.exp ? Date.now() >= payload.exp * 1000 : false;
      if (payload && !isExpired && payload.is_admin === true) {
        // Already logged in as admin -> send to admin dashboard
        return NextResponse.redirect(new URL('/admin', request.url));
      }
    }
    return NextResponse.next();
  }

  if (isAdminRoute) {
    if (!token) {
      return NextResponse.redirect(new URL(`/admin/login?redirect=${encodeURIComponent(pathname)}`, request.url));
    }
    const payload = decodeJwtPayload(token);
    const isExpired = payload?.exp ? Date.now() >= payload.exp * 1000 : false;
    if (!payload || isExpired || payload.is_admin !== true) {
      // Non-admin user or invalid/expired token - redirect to admin login
      const response = NextResponse.redirect(new URL(`/admin/login?redirect=${encodeURIComponent(pathname)}`, request.url));
      if (isExpired) {
        response.cookies.delete('access_token');
        response.cookies.delete('accessToken');
      }
      return response;
    }
    return NextResponse.next();
  }

  if (!token && isProtectedRoute) {
    // Redirect to login if trying to access a protected route without a token
    return NextResponse.redirect(new URL(`/login?redirect=${encodeURIComponent(pathname)}`, request.url));
  }

  if (token && isAuthRoute) {
    const payload = decodeJwtPayload(token);
    const isExpired = payload?.exp ? Date.now() >= payload.exp * 1000 : false;
    if (payload && !isExpired) {
      if (payload.is_admin === true) {
        return NextResponse.redirect(new URL('/admin', request.url));
      }
      return NextResponse.redirect(new URL('/', request.url));
    }
    // Stale or expired token: remove invalid cookies and allow user to access login/signup
    const response = NextResponse.next();
    response.cookies.delete('access_token');
    response.cookies.delete('accessToken');
    response.cookies.delete('session');
    return response;
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico, sitemap.xml, robots.txt (metadata files)
     */
    '/((?!api|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
