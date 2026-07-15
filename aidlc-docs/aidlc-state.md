# AI-DLC State Tracking — AnestIA

## Project Information
- **Project Type**: Brownfield (design assets: PRD, schema.prisma, domain specs; no application code yet)
- **Start Date**: 2026-07-14
- **Current Stage**: INCEPTION — Workspace Detection (complete) → Requirements Analysis (pending skills decision)

## Workspace State
- **Existing Code**: Design assets only (Prisma schema, domain docs). No runnable app code.
- **Programming Languages**: TypeScript (target). Prisma schema present.
- **Build System**: npm (target). No package.json yet.
- **Project Structure**: Empty of app code; spec docs + schema present → Greenfield build over a specified domain.
- **Reverse Engineering Needed**: No (no legacy app code to reverse; specs ARE the requirements source of truth).
- **Workspace Root**: /Users/jdh/Desktop/Luquetta

## Code Location Rules
- **Application Code**: Workspace root (NEVER in aidlc-docs/)
- **Documentation**: aidlc-docs/ only
- **Structure patterns**: See code-generation.md Critical Rules

## Toolchain Verified
- Node v24.14.1, npm 11.11.0
- PostgreSQL 16.14 (Homebrew), running on socket /tmp:5432
- skills CLI 1.5.17
- git: NOT initialized yet

## Skills Installation (2026-07-14)
- Angular (10/10): ✅ installed under .agents/skills/
- Next.js (0/3): ❌ vercel-labs/next-skills restructured — next-best-practices, next-upgrade, next-cache-components no longer present
- web-design-guidelines: ✅ installed
- frontend-design: ⚠️ not in vercel-labs/agent-skills; available as Anthropic built-in
- supabase-postgres-best-practices: ✅ installed
- Bonus: writing-guidelines installed
- **Resolved (user)**: Q1=A continue without the 3 missing Next.js skills (use up-to-date Next.js knowledge / built-in). Q2=A use Anthropic built-in frontend-design.

## Setup Decisions (confirmed by user)
- Methodology: AWS AI-DLC formal strict (core-workflow.md governs)
- File structure: in-place at workspace root
- Skills: install all 16 (partial — see above)
- Database: create `anestia` DB (user jdh, local socket, pgvector)

## Clinical Safety Rules (NON-NEGOTIABLE — apply every stage)
1. HITL: anesthesiologist approves everything; AI never auto-sends.
2. No fabrication of clinical data; every datum has `fuente`.
3. Physical exam + vitals = `pendiente_examen`; cannot approve while pending.
4. AI may derive (IMC, dx, ASA, draft plan) from real data only.
5. Structured output always (Zod-validated generateObject).
6. Zod at every boundary (input + output).
7. Traceability: approved version immutable + audit log.

## Requirements Analysis — Intent
- Request Type: New Project
- Scope: System-wide
- Complexity: Complex
- Depth: Comprehensive (high-risk clinical/medico-legal)

## Extension Configuration
| Extension | Enabled | Mode | Decided At |
|---|---|---|---|
| Security Baseline | Yes | All rules blocking (cloud-only rules N/A in local pilot) | Requirements Analysis |
| Property-Based Testing | Yes | FULL (all 10 rules blocking); framework fast-check | Requirements Analysis |

## Deferred Secrets (request per phase)
- ANTHROPIC_API_KEY (Fases 2-3), Gmail App Password SMTP_* (Fase 6), Google Sheets OAuth (Fase 6), branding assets (Fase 4).

## Execution Plan Summary
- **Stages to Execute**: Application Design, Units Generation, Functional Design (per-unit), NFR Requirements (per-unit), NFR Design (per-unit), Code Generation (per-unit), Build and Test.
- **Stages to Skip**: Reverse Engineering (no legacy code), Infrastructure Design (local no-container pilot, hosting deferred).
- **Units**: U0 Fundaciones · U1 Captura · U2 Lab Intelligence · U3 Motor clínico · U4 Documento · U5 HITL · U6 Distribución/historial · U7 Afinado (sequential).

## Stage Progress
### 🔵 INCEPTION
- [x] Workspace Detection
- [x] Reverse Engineering (SKIPPED)
- [x] Requirements Analysis (approved 2026-07-14)
- [x] User Stories (approved 2026-07-15)
- [x] Workflow Planning (approved 2026-07-15)
- [x] Application Design — EXECUTE (approved 2026-07-15)
- [x] Units Generation — EXECUTE (approved 2026-07-15). Q1=A sequential, Q2=B consolidated per-unit gates (1 design + 1 code gate/unit).
### 🟢 CONSTRUCTION (per unit ×8, sequential; per-unit: Design gate [FD+NFR] then Code gate)
- [x] U0 Fundaciones — DONE (approved 2026-07-15). US-0.1 + US-0.2. 8 tests green, auth verified, seed idempotent.
- [x] U1 Captura — DONE (approved 2026-07-15, committed+pushed). US-1.1…1.7. 14 tests green, backend smoke full, Angular builds.
- [x] U2 Lab Intelligence — DONE (approved, committed+pushed). 22 tests green, pipeline verified with real worker.
- [x] U3 Motor clínico — DONE (approved, committed+pushed). US-3.1/3.2/3.3. 29 tests green, pipeline verified with real worker.
- [x] U4 Documento — DONE (approved, committed+pushed). US-4.1. 34 tests green, real PDF, full pipeline verified.
- [~] U5 HITL — Code GENERATED + verified (backend smoke) → GATE. US-5.1…5.5. 37 tests green (PBT canApprove blocking invariant). Blocking gate verified: approve-with-exam-pending→422, load-normal→approvable, approve→APROBADO+immutable PDF+ApprovalRecord, edit-after→409 lock. CS1/CS3/CS7 enforced. Angular builds. (canApprove folded into review GET, no separate route.)
- [ ] U6 Distribución/historial
- [ ] U7 Afinado
- [ ] Build and Test (after all units)
- Infrastructure Design — SKIP (all units)
### 🟡 OPERATIONS
- [ ] Operations — PLACEHOLDER

## Infrastructure
- DB `anestia` created (user jdh, socket /tmp:5432), pgvector enabled. DATABASE_URL=postgresql://jdh@localhost:5432/anestia

## Current Status
- **Lifecycle Phase**: CONSTRUCTION
- **Current Stage**: U0 Fundaciones — consolidated Design gate
- **Next Stage**: U0 Code Generation
- **Status**: Awaiting U0 design approval
- [ ] Workflow Planning
- [ ] Application Design
- [ ] Units Generation
- [ ] Construction (per-unit)
- [ ] Build and Test
