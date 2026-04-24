import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  const { token } = await request.json() as { token: string };
  const expected = process.env.ACCESS_TOKEN;

  if (!expected || token !== expected) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set('auth', token, {
    httpOnly: true,
    sameSite: 'strict',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  });
  return response;
}
