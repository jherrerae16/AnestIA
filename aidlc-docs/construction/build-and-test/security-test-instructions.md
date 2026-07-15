# Security Test Instructions — AnestIA

## Autenticación / autorización (SECURITY-08/12)
- Login con password errónea → 401; correcta → 200 + cookie httpOnly.
- Rutas `/api/panel/**` sin sesión → 401.
- Rutas `/api/form/:token` con token inválido/expirado → 410.
- Descarga de adjunto sólo por el dueño (sesión) → ownership.
- Throttle de login tras 5 fallos.

## Validación de entrada (SECURITY-05)
- Email inválido en login → 400 (Zod).
- Adjuntos: tipo no permitido / >15MB → 422; >10 archivos → 422.

## Rate limiting (SECURITY-11)
- >30 req/10s a form/download/login → 429.

## Cabeceras (SECURITY-04)
- Toda respuesta: CSP, HSTS, X-Content-Type-Options, X-Frame-Options, Referrer-Policy.

## Secretos (SECURITY-12)
- Ningún secreto en el repo (`.env` gitignored; grep de la password sembrada = 0 en docs).
- Logs con pino redactan password/token/cookie.

## Dependencias (SECURITY-10)
- `npm audit` documentado en `U7-afinado/dependency-security.md`. Acción pendiente pre-producción: actualizar Next/Angular + escáner CI.

## Inmutabilidad / audit (SECURITY-13/14, CS7)
- Editar caso aprobado → 409.
- AuditLog append-only (sin rutas de edición/borrado).
