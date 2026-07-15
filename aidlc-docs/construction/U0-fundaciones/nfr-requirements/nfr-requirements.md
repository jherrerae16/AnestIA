# U0 — NFR Requirements

| Category | Requirement (U0) |
|---|---|
| Security | Adaptive password hashing; secure session cookie; brute-force throttle; Zod input validation; security headers; no hardcoded secrets; global fail-closed error handler; structured logging without secrets. [SECURITY-03/04/05/12/15] |
| Performance | Local dev; sign in < 500ms; seed < 5s. No load targets in pilot. |
| Availability | Local dev only; N/A cloud HA. |
| Scalability | Data model multi-tenant-ready (isolation by anesthesiologistId) though one profile seeded. |
| Reliability | Seed idempotent; migrations versioned; fail-closed on errors. |
| Maintainability | TS strict; shared Zod contract; lock file committed; pinned deps; tests (PBT + example). |
| Usability | Sign-in accessible (labels, contrast per web-design-guidelines); Spanish. |

## Extension NFRs
- **Security Baseline** applicable rules for U0: 03, 04, 05, 10, 12, 15. N/A: 01(cloud KMS), 02, 06, 07, 11(rate-limit → basic throttle only), 13, 14 (audit alerting → U7). Documented.
- **PBT (full)**: framework fast-check selected (PBT-09); U0 properties per PBT-01.
