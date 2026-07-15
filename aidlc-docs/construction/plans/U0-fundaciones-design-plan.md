# U0 Fundaciones — Consolidated Design Plan (FD + NFR-Req + NFR-Design)

Per Q2=B, U0 design is presented in ONE gate. U0 = executable skeleton (US-0.1 sign in, US-0.2 workspace seed). Mostly infrastructure scaffolding + auth; low domain complexity. Below: the design decisions + 2 real questions.

## Scope of U0
- npm workspaces monorepo (apps/api, apps/web, packages/shared, prisma/).
- Prisma schema moved to `prisma/schema.prisma`; initial migration; pgvector.
- Seed: Luquetta profile (placeholder branding) + default preset "Preanestésica general" (22 questions from form-mapping.md). Idempotent.
- AuthService: seeded password (adaptive hash), session cookie (httpOnly/Secure/SameSite), throttled login.
- Adapter skeletons (all stub/local): ai, storage, mailer, sheets — interfaces + stub impls + env-flag factories.
- pg-boss setup (queue skeleton, no handlers yet).
- packages/shared: Zod schema skeleton (documentSchema stub, DTOs).
- Angular app shell + sign-in page + guarded empty dashboard.
- Security headers middleware; global error handler (fail-closed).

## Testable Properties (PBT-01)
- **AuthService password hash/verify** — round-trip: `verify(hash(pw), pw) == true` (fast-check).
- **Session cookie encode/decode** — round-trip.
- **Seed idempotency** — `seed(); seed()` → same row counts (idempotence property).
- Full documentSchema round-trip deferred to U3 (schema is a skeleton in U0).

## Extension compliance (U0)
- **Security**: SECURITY-12 (auth: adaptive hash, secure cookie, brute-force throttle, no hardcoded creds — seed password via env or generated+printed once), SECURITY-04 (headers), SECURITY-05 (Zod on login input), SECURITY-15 (global error handler, fail-closed), SECURITY-03 (structured logger, no secrets logged), SECURITY-10 (lock file, pinned deps). Cloud-only rules (01 KMS, 02, 06, 07) N/A local pilot; disk-level encryption documented.
- **PBT**: fast-check added as devDep (PBT-09); properties above (PBT-01/02/04/08).

---

## Question 1 — Contraseña sembrada de Luquetta
¿Cómo defino la contraseña inicial de Luquetta en el seed? (SECURITY-12: sin credenciales hardcodeadas)

A) Leer de env `SEED_ADMIN_PASSWORD`; si no existe, generar una aleatoria y **imprimirla una vez** en consola al sembrar (tú la guardas). Hash adaptativo en BD. (recomendado — sin secreto en código)
B) Contraseña fija conocida para dev (ej. `luquetta-dev`) documentada en README. Más simple pero es credencial en repo.
X) Other (describe después de [Answer]:)

[Answer]: A

## Question 2 — Email de sign in de Luquetta
El seed necesita un email único para el perfil (login + `Anesthesiologist.email`). ¿Cuál uso?

A) Usar tu email de sesión: `contacto@ejemplo.com`. (recomendado — es tuyo, real)
B) Un placeholder `luquetta@anestia.local`.
X) Other (describe después de [Answer]:)

[Answer]: Usar mi correo jherrerae16@gmail.com


---

## Artifacts to generate (this gate)
- [x] functional-design/business-logic-model.md
- [x] functional-design/business-rules.md
- [x] functional-design/domain-entities.md
- [x] functional-design/frontend-components.md
- [x] nfr-requirements/nfr-requirements.md
- [x] nfr-requirements/tech-stack-decisions.md
- [x] nfr-design/nfr-design-patterns.md
- [x] nfr-design/logical-components.md
