# U0 — Tech Stack Decisions

Stack fixed by PRD §9 / CLAUDE.md. U0-specific library choices:

| Concern | Choice | Rationale |
|---|---|---|
| Monorepo | npm workspaces | Native, no extra tooling; CLAUDE.md "sin contenedores". |
| API framework | Next.js (App Router, Route Handlers) | PRD. |
| Frontend | Angular 19 standalone/signals/zoneless | PRD. |
| ORM/DB | Prisma + PostgreSQL 16 + pgvector | PRD. |
| Validation | Zod (shared) | PRD; SECURITY-05. |
| Password hashing | **argon2** (or bcrypt fallback) | Adaptive hash (SECURITY-12). Prefer argon2id. |
| Session | Signed stateless cookie (jose/JWT) httpOnly/Secure/SameSite | Simple, no session table; server-side signature validation each request (SECURITY-08/12). |
| Queue | pg-boss | PRD; Postgres-backed. |
| PBT framework | **fast-check** (devDep) | PBT-09; integrates with the test runner. |
| Test runner | **Vitest** (api/shared) + Angular's default (web) | Fast, TS-native, fast-check integration. |
| Env management | `.env` (gitignored) + `.env.example` | No secrets in repo (SECURITY-12). |
| Logging | Structured logger (pino) | SECURITY-03; no secrets logged. |

## Secrets (U0)
- `DATABASE_URL` (set), `SESSION_SECRET` (generate), `SEED_ADMIN_PASSWORD` (env or generated once — pending Q1).
- Deferred (not U0): ANTHROPIC_API_KEY, SMTP_*, Google OAuth.
