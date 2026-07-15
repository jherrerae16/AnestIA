# U0 Fundaciones — Code Generation Plan

Single source of truth for U0 code generation. Workspace root: `/Users/jdh/Desktop/Luquetta`. Greenfield monolith → app code at root (workspaces). Docs summaries → `aidlc-docs/construction/U0-fundaciones/code/`.

**Stories**: US-0.1 (sign in), US-0.2 (workspace seed).
**Dependencies**: none (foundation).
**Config**: seed email `jherrerae16@gmail.com`; password `SEED_ADMIN_PASSWORD` env or generated+printed once; `AI_PROVIDER=stub`, `STORAGE_PROVIDER=local`, `MAILER_PROVIDER=stub`, `SHEETS_PROVIDER=noop`.

## Steps

### Step 1 — Root workspace setup
- [x] Root `package.json` (npm workspaces: `apps/*`, `packages/*`), scripts (dev, seed, worker, migrate, test), `.gitignore`, `.env.example`, `.nvmrc`.
- [x] `git init` + initial ignore (node_modules, .env, storage/, dist, .next).
- [x] Root `tsconfig.base.json` (strict).

### Step 2 — Prisma
- [x] Move `schema.prisma` → `prisma/schema.prisma`; add `passwordHash String?` to Anesthesiologist; add `previewFeatures=["postgresqlExtensions"]`, `binaryTargets` if needed.
- [x] `.env` DATABASE_URL (from state), SESSION_SECRET.
- [x] `prisma migrate dev --name init` (pgvector already enabled on DB).
- [x] Prisma client generated.

### Step 3 — packages/shared
- [x] `packages/shared/package.json` + tsconfig.
- [x] Zod: `loginSchema`, `DocField`/`FieldState`, `documentSchema` skeleton, common DTOs. Export types.

### Step 4 — apps/api scaffold (Next.js)
- [x] `apps/api` Next.js (App Router), tsconfig, next.config.
- [x] `lib/logger.ts` (pino), `lib/prisma.ts` (client singleton), `lib/errors.ts` (global fail-closed helper).
- [x] `middleware.ts`: security headers (CSP/HSTS/nosniff/XFO/Referrer) + panel session guard.

### Step 5 — Adapters (skeleton, stub/local)
- [x] `lib/ai/index.ts` (AIProvider interface + stub returning Anexo-C ref) + factory.
- [x] `lib/storage/index.ts` (local FS impl) + factory.
- [x] `lib/mailer/index.ts` (stub) + factory.
- [x] `lib/sheets/index.ts` (noop) + factory.
- [x] `lib/queue/index.ts` (pg-boss init, no handlers).

### Step 6 — Auth
- [x] `lib/auth/service.ts`: argon2 hash/verify, login (throttle), session sign/verify (jose), requireSession, logout.
- [x] Routes: `app/api/panel/auth/login/route.ts`, `/logout/route.ts`, `/me/route.ts` (Zod-validated).

### Step 7 — Seed
- [x] `prisma/seed.ts`: upsert Luquetta (email jherrerae16@gmail.com, placeholder branding, passwordHash from SEED_ADMIN_PASSWORD or generated+printed once) + default preset "Preanestésica general" with 22 questions (form-mapping.md), conditionals P12→P13, P20→P21. Idempotent. Wire `npm run seed`.

### Step 8 — apps/web scaffold (Angular 19)
- [x] `apps/web` Angular standalone/signals/zoneless, routes (`/signin` public, `/dashboard` guarded).
- [x] SignInPage, PanelShell + functional auth guard, empty DashboardPage. data-testid attrs.
- [x] Dev proxy to api.

### Step 9 — Tests (generated, executed in Build&Test)
- [x] Vitest + fast-check config.
- [x] PBT: password hash round-trip; cookie sign/verify round-trip; seed idempotence.
- [x] Example: login success/failure, guard 401, seed → 22 questions, default preset isDefault.

### Step 10 — Docs
- [x] `aidlc-docs/construction/U0-fundaciones/code/README.md` (how to run: install, migrate, seed, dev), summary of created files.

## Story traceability
- US-0.1 → Steps 4,6,8,9.
- US-0.2 → Steps 2,7,9.

## Verification target (U0 acceptance)
app runs · DB migrates · seed creates Luquetta + preset (22 Qs) · sign in works. Verified in Build&Test (and a smoke check right after generation).
