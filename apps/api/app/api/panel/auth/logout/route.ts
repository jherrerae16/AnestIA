import { NextResponse } from 'next/server';
import { apiHandler } from '../../../../../lib/errors';
import { SESSION_COOKIE, sessionCookieOptions } from '../../../../../lib/auth/service';

/** POST /api/panel/auth/logout — invalida la cookie de sesión. */
export const POST = apiHandler(async () => {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, '', { ...sessionCookieOptions(), maxAge: 0 });
  return res;
});
