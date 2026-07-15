# U1 — NFR Requirements

| Category | Requirement |
|---|---|
| Security | Token authz (form), session (panel); Zod + size bounds on every route; file type/size allowlist; consent-before-data; fail-closed; no PII in logs. [SECURITY-05/08/09/12/15] |
| Performance | Form load < 1s; save/submit < 1s (excludes pipeline, which is async). |
| Reliability | Submit transactional; idempotent event emission; partial save recoverable. |
| Usability | Mobile-first, responsive, accessible (labels, contrast, focus); Spanish; branded. |
| Privacy | Ley 1581 consent gate; patient data isolated per anesthesiologist. |
| Maintainability | Shared Zod schemas; conditional engine unit + PBT tested. |

## Extension NFRs
- Security rules 05/08/09/12/15 applicable. 01/02/06/07 N/A (local). 11 rate-limit → basic (form is token-gated).
- PBT (full): conditional-visibility invariant, formAnswersSchema round-trip, token uniqueness/entropy, submit idempotence.
