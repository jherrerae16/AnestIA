# U1 — NFR Design Patterns

## Security
- **Token authz**: `verifyCaseToken(token)` in every `/api/form/[token]/**` handler (object-level, no session). Expired/invalid → 410/404. [SECURITY-08]
- **Input validation**: dynamic Zod (from preset) + static Zod (DTOs) at every border; payload + file size caps. [SECURITY-05]
- **File hardening**: MIME+extension allowlist; store by hash; serve only via tokenized route; never execute. [SECURITY-09]
- **Consent gate**: server refuses save/submit until Consent row exists for the case. [Ley 1581]
- **Fail-closed**: apiHandler wrapper on all routes. [SECURITY-15]

## Reliability
- **Transactional submit**: `prisma.$transaction([...])` then publish event (outbox-lite: event only after commit).
- **Idempotent submit**: guard on FormResponse.submittedAt / case status before emitting.
- **Partial save**: upsert FormResponse partial without side effects.

## Correctness (PBT)
- `isVisible` invariant: hidden ⇒ not-required-effective.
- formAnswersSchema round-trip.
- token entropy/uniqueness property.
- submit idempotence (state-machine): двойной submit → single event.
