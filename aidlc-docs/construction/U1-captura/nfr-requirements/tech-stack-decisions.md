# U1 — Tech Stack Decisions

| Concern | Choice | Rationale |
|---|---|---|
| Token generation | `crypto.randomBytes(32).toString('base64url')` | ≥128-bit entropy, unguessable (SECURITY-12). |
| File upload | Next Route Handler reading `FormData`; StorageProvider(local) | No extra infra; adapter-swappable. |
| File type check | Extension + MIME allowlist (PDF/JPG/PNG/WEBP/HEIC) | SECURITY-09. |
| Conditional engine | Pure function in shared (`isVisible`) | Testable, shared FE/API (PBT target). |
| Answers validation | Dynamic Zod built from the case's preset | Validates types/required/conditional against the versioned preset. |
| Consent text | Versioned constant `CONSENT_TEXT_V1` in shared (pending Q1) | No blocker; Ley 1581 compliant. |
| Event | pg-boss `publish('form.submitted', {caseId})` | PRD event-driven. |
| Frontend forms | Angular signals + FormsModule | PRD; standalone. |

## Secrets (U1)
None new. (Storage local, no external creds.)
