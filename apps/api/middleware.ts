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

// Quien restablece su contraseña no tiene sesión — justamente porque perdió el acceso. Estas
// dos rutas son públicas por necesidad y llevan su propio throttle en el handler.
const PUBLIC_PANEL_PATHS = [
  '/api/panel/auth/login',
  '/api/panel/auth/password/olvide',
  '/api/panel/auth/password/restablecer',
];

// Rate limit in-memory (SECURITY-11). Rutas públicas: form del paciente, descarga, login.
const RL_HITS = new Map<string, number[]>();
function rateLimited(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const arr = (RL_HITS.get(key) ?? []).filter((t) => now - t < windowMs);
  arr.push(now);
  RL_HITS.set(key, arr);
  return arr.length > limit;
}
function isPublicLimited(pathname: string): boolean {
  return (
    pathname.startsWith('/api/form/') ||
    pathname.startsWith('/api/download/') ||
    pathname.startsWith('/api/panel/auth/login') ||
    pathname.startsWith('/api/panel/auth/password/')
  );
}

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

  // Rate limit para rutas públicas (SECURITY-11): 30 req / 10s por IP+ruta.
  if (isPublicLimited(pathname)) {
    const ip = req.headers.get('x-forwarded-for') ?? 'local';
    if (rateLimited(`${ip}:${pathname}`, 30, 10_000)) {
      return securityHeaders(
        NextResponse.json({ error: 'Demasiadas solicitudes. Intenta en un momento.' }, { status: 429 }),
      );
    }
  }

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
