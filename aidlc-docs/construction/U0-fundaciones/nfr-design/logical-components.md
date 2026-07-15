# U0 — Logical Components

| Component | Type | Role in U0 |
|---|---|---|
| middleware (api) | HTTP interceptor | security headers + session guard for /api/panel/** |
| AuthService | service | login/verify/session/logout, throttle |
| SeedScript | script | idempotent Luquetta + default preset |
| adapter factories | modules | ai/storage/mailer/sheets — stub/local impls + env flag |
| QueueManager (skeleton) | module | pg-boss init (no handlers yet) |
| logger | module | pino structured logger (no secrets) |
| shared Zod package | library | loginSchema, DTO stubs, documentSchema skeleton |
| errorHandler | wrapper | global fail-closed handler |

## Integration
- No queues/caches/circuit-breakers active in U0 beyond pg-boss init (skeleton).
- pgvector extension enabled at DB level (used later for RAG; not in U0 logic).
- No infrastructure components (local pilot; Infrastructure Design skipped).
