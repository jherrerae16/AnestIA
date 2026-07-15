# U0 — NFR Design Patterns

## Security patterns
- **Auth guard middleware** (`/api/panel/**`): deny-by-default; validates signed cookie server-side each request. [SECURITY-08]
- **Security headers middleware**: CSP (default-src 'self'), HSTS (max-age 31536000; includeSubDomains), X-Content-Type-Options nosniff, X-Frame-Options DENY, Referrer-Policy strict-origin-when-cross-origin. [SECURITY-04]
- **Input validation**: Zod schema at every handler border. [SECURITY-05]
- **Adaptive hashing**: argon2id for passwords. [SECURITY-12]
- **Brute-force throttle**: per email+IP counter with progressive delay/lockout. [SECURITY-12]
- **Secrets via env**: `.env` gitignored; `.env.example` documents keys without values. [SECURITY-12]

## Reliability patterns
- **Idempotent seed**: upsert on natural keys.
- **Global error handler** (fail-closed): top-level catch → log (no secrets) → generic 500; never leak internals. [SECURITY-15]
- **Versioned migrations**: Prisma migrate; no raw SQL except pgvector extension.

## Maintainability
- **Adapter factories** (skeleton in U0): env flag selects impl; stub defaults so downstream builds without secrets.
- **Shared contract**: single Zod package consumed by api + web.

## Testing (PBT + example)
- fast-check properties: password hash round-trip, cookie round-trip, seed idempotence.
- Example tests: login success/failure, guard 401, seed creates 22 questions.
