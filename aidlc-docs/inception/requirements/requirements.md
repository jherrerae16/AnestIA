# Requirements — AnestIA

## Intent Analysis
- **User Request**: Build AnestIA, an automated pre-anesthetic assessment platform, using AI-DLC (formal AWS workflow, strict). Read the docs, install skills, build phase by phase starting at Fase 0. Respect clinical safety rules (HITL, no fabricated clinical data, physical exam pending). Pilot: single "Luquetta" profile, manual link send (no WhatsApp API), AI stubbed until key provided. Consult before assuming.
- **Request Type**: New Project (greenfield build over a fully specified domain).
- **Scope**: System-wide (form capture, lab AI, clinical engine, PDF render, HITL, distribution, patient history, dashboard).
- **Complexity**: Complex — medico-legal document, HITL gates, AI anti-hallucination, event-driven pipeline.
- **Depth**: Comprehensive.
- **Source of truth**: `docs/PRD_AnestIA.md` (v1.7) + `CLAUDE.md` reglas de oro. This document does not restate the PRD; it captures pilot-scoping decisions and the enabled extensions.

## Clinical Safety Rules (NON-NEGOTIABLE — apply every stage, gate every unit)
1. HITL: anesthesiologist approves everything; AI never auto-sends.
2. No fabrication of clinical data; every clinical datum carries `fuente`.
3. Physical exam + vitals = `pendiente_examen`; document cannot be approved while pending.
4. AI may derive from real data only (IMC by code, dx, ASA, draft plan/concept, recommendations).
5. Structured output always: Zod-validated `generateObject`; malformed / prohibited-field output rejected.
6. Zod at every boundary (input + output).
7. Traceability: approved version immutable + audit log (who/what/when).
8. GLP-1 declared → aspiration-risk logic + fasting recommendations.

## Functional Requirements (reference PRD §7 modules 1–12)
The 12 modules and RF-x IDs in PRD §7 are adopted verbatim as the functional requirement set. Pilot deltas below adjust scope; everything else stands as written.

## Non-Functional Requirements (reference PRD §8)
Adopted verbatim. Language = Spanish. Performance targets: lab extract+analyze < 30s, draft gen < 20s. Multi-tenant-ready data shape preserved even though only one profile is seeded.

## Pilot-Scoping Decisions (confirmed by user, 2026-07-14)

| # | Topic | Decision | Rationale / Impact |
|---|---|---|---|
| 1 | Auth | **Seeded password** for Luquetta (email + password in seed) + secure httpOnly/Secure/SameSite session cookie. | Realistic, satisfies SECURITY-12. Full RBAC/registration deferred to Fase 7. |
| 2 | File storage | **Local filesystem** (`storage/` outside repo) served via tokenized Route Handler; file hash stored; behind `lib/storage/` adapter. | Cloud-agnostic, zero infra. S3-swappable later (single change point). Encryption-at-rest for pilot = disk-level; documented exception vs SECURITY-01 cloud KMS. |
| 3 | Final-report distribution | **Real Gmail SMTP via App Password**, behind `lib/mailer/` adapter. Keeps `DeliveryRecord` + tokenized download link. Migrable to a transactional service. | App Password is a SECRET → env var only, never committed (SECURITY-12). Needed at Fase 6, not now. |
| 4 | Auto reminders (RF-2.3) | **Deferred to Fase 7.** Model hook left in place. | Manual send in pilot; scheduler adds no pilot value. |
| 5 | Pediatric preset | **Only "Preanestésica general"** (22 Qs) seeded; others built by Luquetta via constructor. | §16 #12 resolved. |
| 6 | Google Sheets export (RF-2.5) | **Include as manual on-demand export.** | Google API dependency (OAuth/service account) = deferred credential, needed at Fase 6. Behind adapter; PostgreSQL remains sole source of truth. |
| 7 | Luquetta branding assets | **Seed with placeholders** (name, "Anestesiología Cardiovascular", registro "PENDIENTE", placeholder logo/firma PNG). Real assets replace at Fase 4. | No blocker. |

## Deferred Secrets / Credentials (requested only when the phase needs them)
- `ANTHROPIC_API_KEY` — Fases 2 & 3 (until then: AI stub). Target model: Opus for clinical reasoning.
- Gmail App Password (`SMTP_*`) — Fase 6 (mailer).
- Google Sheets OAuth / service account — Fase 6 (export).
- Real branding assets (logo, firma PNG, registro médico) — Fase 4.

## Enabled Extensions (aidlc-rules)
- **Security Baseline** — ENABLED (all 15 rules blocking; infra-cloud-only rules marked N/A in a local no-container pilot, e.g. LB/CDN/VPC items). Justification: handles sensitive health data under Ley 1581.
- **Property-Based Testing** — ENABLED, FULL mode (all 10 rules blocking). Framework: **fast-check** (TS). High-value targets: IMC calc (invariant/oracle), lab-flag classification (invariant), Zod schema round-trips (round-trip), form-answer → document-field mapping (invariant), case state machine (stateful).

## Out of Scope (pilot)
- WhatsApp Business API (manual link send).
- Certified cryptographic signature (visual signature only; optional future layer).
- Full RBAC / registration / invitations.
- HL7/FHIR, billing, native mobile app, multi-clinic admin, shared preset library, second language.
- Cloud hosting decision (deferred; keep cloud-agnostic).

## Key Requirements Summary
AnestIA collapses a fragmented manual flow (Google Form → manual lab attach → copy-paste to AI → manual PDF → manual send) into one traceable platform. Core differentiator: a guard-railed clinical AI engine (never invents clinical data) behind a mandatory human approval gate. Pilot builds the full product surface with AI stubbed, single profile seeded, manual patient-link send, real SMTP for final delivery, local file storage, and both security + property-based-testing extensions enforced.
