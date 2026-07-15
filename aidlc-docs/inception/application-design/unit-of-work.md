# Units of Work — AnestIA

**Deployment model**: Monolith with logical modules (single deployable app). NOT microservices. Units = logical modules developed sequentially.
**Gate cadence (Q2=B)**: per unit → (1) Design gate = Functional Design + NFR Requirements + NFR Design presented together; (2) Code Generation gate = plan + generation. Build & Test runs once after all units. Infrastructure Design skipped.

## Code organization strategy (greenfield)
npm workspaces monorepo:
```
apps/api    — Next.js API Routes + pg-boss workers + lib/ (services, adapters, engines)
apps/web    — Angular 19 (panel + patient form)
packages/shared — Zod schemas + shared types (the AI/API/FE contract)
prisma/     — schema + migrations
storage/    — runtime files (gitignored)
```
Each unit adds to this shared tree (no per-unit repo). Modules within apps/api/lib: auth, ai, storage, mailer, sheets, queue, labs, clinical, pdf, audit, services.

## Unit definitions

### U0 — Fundaciones [Fase 0]
- **Responsibility**: Executable skeleton. Monorepo, TS, Prisma migrate, seed (Luquetta + default preset), sign in, adapter skeletons (all stub), pg-boss setup, shared schema skeleton.
- **Stories**: US-0.1, US-0.2.
- **Acceptance**: app runs, DB migrates, seed creates Luquetta + preset, sign in works.

### U1 — Captura [Fase 1]
- **Responsibility**: Preset builder, case + tokenized link, patient form (consent, conditional, attachments, partial save, submit), persistence + `form.submitted`.
- **Stories**: US-1.1…1.7.
- **Acceptance**: patient answers + attaches + submits → Case+FormResponse+Attachment, event emitted.

### U2 — Lab Intelligence [Fase 2]
- **Responsibility**: `lab.extract` (AIProvider vision/stub, only-present values, sourceRef), `lab.flag` (deterministic red flags), GLP-1 detection.
- **Stories**: US-2.1…2.3.
- **Acceptance**: hemograma → analytes extracted, out-of-range flagged, absent never fabricated.

### U3 — Motor clínico [Fase 3]
- **Responsibility**: `clinical.generate` (prompt-maestro + generateObject + documentSchema), IMC by code, derive dx/ASA/plan, exam=pendiente_examen, GLP-1 logic, persist GeneratedAssessment.
- **Stories**: US-3.1…3.3.
- **Acceptance**: reference case → valid JSON, exam pending, ASA justified, GLP-1 applied, malformed rejected.

### U4 — Documento [Fase 4]
- **Responsibility**: Playwright render of Diseño Oficial with branding + new fields; draft-only while exam pending.
- **Stories**: US-4.1.
- **Acceptance**: draft matches Diseño Oficial, one page, profile branding.

### U5 — Revisión/aprobación HITL [Fase 5]
- **Responsibility**: side-by-side review, inline edit, exam confirm/"cargar normal", blocking approval, lock+signature+immutable PDF+ApprovalRecord+audit.
- **Stories**: US-5.1…5.5.
- **Acceptance**: cannot approve with exam pending; on approve → immutable signed PDF.

### U6 — Distribución e historial [Fase 6]
- **Responsibility**: directory-based distribution (Gmail SMTP + tokenized link), DeliveryRecord, patient history + prefill, dashboard, optional Sheets export.
- **Stories**: US-6.1…6.5.
- **Acceptance**: send to a directory contact; patient appears in history.

### U7 — Afinado [Fase 7]
- **Responsibility**: full audit, job retries/idempotency, security headers/encryption/secrets, tests (PBT+example), compliance review (Reviewer hat: Ley 1581, immutability, HITL).
- **Stories**: US-7.1…7.3.
- **Acceptance**: audit complete, retries safe, security enforced, tests green, compliance verified.
