import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const BASE = '/bridge';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const expected = process.env.ACCESS_TOKEN;

  if (!expected) return NextResponse.next();
  if (!pathname.startsWith(BASE)) return NextResponse.next();
  if (pathname.startsWith(`${BASE}/api/auth`) || pathname === `${BASE}/login`) {
    return NextResponse.next();
  }

  const token = request.cookies.get('auth')?.value;
  if (token !== expected) {
    return NextResponse.redirect(new URL(`${BASE}/login`, request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
