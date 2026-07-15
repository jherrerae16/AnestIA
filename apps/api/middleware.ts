import { NextRequest, NextResponse } from 'next/server';

/**
 * Middleware: cabeceras de seguridad en TODAS las respuestas (SECURITY-04) +
 * primera línea del guard deny-by-default para /api/panel/** (SECURITY-08):
 * exige PRESENCIA de la cookie de sesión. La verificación criptográfica de la
 * firma (jwtVerify) la hace cada handler del panel vía verifySession
 * (defensa en profundidad; jwtVerify no corre en el runtime Edge del middleware).
 * Rutas públicas: login y las de formulario del paciente (por token, se validan en el handler).
 */
const SESSION_COOKIE = 'anestia_session';

const PUBLIC_PANEL_PATHS = ['/api/panel/auth/login'];

function securityHeaders(res: NextResponse): NextResponse {
  res.headers.set('Content-Security-Policy', "default-src 'self'");
  res.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  res.headers.set('X-Content-Type-Options', 'nosniff');
  res.headers.set('X-Frame-Options', 'DENY');
  res.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  return res;
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const isPanel = pathname.startsWith('/api/panel/');
  const isPublicPanel = PUBLIC_PANEL_PATHS.some((p) => pathname.startsWith(p));

  if (isPanel && !isPublicPanel) {
    const hasCookie = Boolean(req.cookies.get(SESSION_COOKIE)?.value);
    if (!hasCookie) {
      return securityHeaders(
        NextResponse.json({ error: 'No autorizado.' }, { status: 401 }),
      );
    }
  }

  return securityHeaders(NextResponse.next());
}

export const config = {
  matcher: ['/api/:path*'],
};
