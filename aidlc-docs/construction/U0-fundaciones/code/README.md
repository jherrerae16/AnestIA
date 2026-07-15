# U0 Fundaciones — Código generado (resumen)

## Cómo correr
```bash
npm install
# .env ya creado con DATABASE_URL + SESSION_SECRET (SEED_ADMIN_PASSWORD vacío = genera password)
npx prisma migrate dev        # aplica migración init (pgvector incluido)
npm run seed                  # siembra Luquetta + preset "Preanestésica general" (22 preguntas)
npm run dev:api               # Next.js API en :3000
npm run dev:web               # Angular en :4200 (proxy → :3000)
npm run test                  # tests (Vitest + fast-check)
npm run worker                # arranca pg-boss (sin handlers en U0)
```

## Archivos creados (U0)
**Raíz**: package.json (workspaces), .gitignore, .env / .env.example, .nvmrc, tsconfig.base.json.
**prisma/**: schema.prisma (movido + `passwordHash`), migrations/…_init, seed.ts.
**packages/shared/src/**: document.ts (documentSchema + DocField), auth.ts (loginSchema, sessionPayload), index.ts, tests.
**apps/api/**: next.config.mjs, middleware.ts (headers + guard), lib/{logger,prisma,errors}.ts, lib/ai|storage|mailer|sheets|queue (adaptadores stub/local), lib/auth/service.ts (+test), app/api/health, app/api/panel/auth/{login,logout,me}.
**apps/web/**: Angular 19 standalone/zoneless — signin.page, panel-shell, dashboard.page, auth.service, auth.guard, routing.

## Verificación (end-to-end, ejecutada)
- ✅ `npm install` (975 paquetes)
- ✅ `prisma migrate dev` → migración init aplicada, pgvector ok
- ✅ `npm run seed` → Luquetta + preset con **22 preguntas**; **idempotente** (re-seed → 1/1/22, sin duplicados)
- ✅ Tests: 5 api (argon2 hash round-trip PBT, sesión sign/verify PBT, throttle) + 3 shared (documentSchema round-trip PBT). Total 8 verdes.
- ✅ API viva: health 200; **cabeceras de seguridad** presentes (CSP/HSTS/nosniff/XFO/Referrer)
- ✅ Flujo auth completo: wrong-pw→401, correct→200+cookie(HttpOnly), me+cookie→200+perfil, me sin cookie→401, logout→200, me post-logout→401, email inválido→400 (Zod)

## Notas / decisiones durante la generación
- Imports relativos SIN extensión `.js` (el bundler de Next no resuelve `.js` sobre `.ts`).
- Cookie `Secure` sólo en producción (en dev http local se desactiva para permitir el flujo). SECURITY-12 se mantiene en prod.
- Middleware (runtime Edge) sólo exige **presencia** de cookie; la verificación criptográfica de firma la hace cada handler del panel (`verifySession`) — defensa en profundidad, evita `jwtVerify` en Edge.
- PBT encontró un caso real: `fc.emailAddress()` genera emails que Zod `.email()` rechaza → se ajustó el generador (PBT-07 calidad de generadores), no el código.
- Password de Luquetta generada en el seed (mostrada una vez). Para fijarla: definir `SEED_ADMIN_PASSWORD` en `.env`.

## Pendiente de verificación
- Angular `ng serve` no se levantó en vivo (requiere instalar toolchain Angular y arrancar :4200). El contrato API + shared está verificado; el front se valida en Build&Test con el flujo real.
