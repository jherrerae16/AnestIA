# Application Design (Consolidated) — AnestIA

Consolidates `components.md`, `component-methods.md`, `services.md`, `component-dependency.md`. Stack fixed per PRD §9 / CLAUDE.md. Design decisions Q1–Q5 all = A.

## 1. Architecture at a glance
- **Monorepo (npm workspaces)**: `apps/api` (Next.js API + pg-boss workers), `apps/web` (Angular 19 standalone/signals), `packages/shared` (Zod contract), `lib/` under api (adapters + engines), `prisma/` at root.
- **4 adapters = single change points**: AIProvider (stub|anthropic), StorageProvider (local|s3), Mailer (gmail-smtp|stub), SheetsExporter (noop|google). Only AIProvider is key-dependent.
- **Event-driven pipeline** (pg-boss): `form.submitted → lab.extract → lab.flag → clinical.generate → document.render`. 4 idempotent, retryable handlers.
- **Shared clinical contract**: `documentSchema` nested by Diseño Oficial sections; every field `{valor, estado, fuente, alerta?, nota?}`; `generateObject` forces it.

## 2. Components
See `components.md`. 8 web components, 11 API components/services, 4 adapters, 1 shared schemas package.

## 3. Methods
See `component-methods.md`. Signatures only; business rules → Functional Design (per-unit).

## 4. Services & orchestration
See `services.md`. Thin handlers; logic in services; ApprovalService = single HITL enforcement point; distribution only of approved+immutable version.

## 5. Dependencies & data flow
See `component-dependency.md`. Adapters isolate all external deps; tenant isolation by `anesthesiologistId`; append-only audit.

## 6. Mapping to units (build phases)
| Unit | Primary components |
|---|---|
| U0 Fundaciones | monorepo, prisma, seed, AuthService, adapter skeletons (stub), QueueManager setup, shared schemas skeleton |
| U1 Captura | PresetBuilder/Service, CaseCreator/Service, PatientForm, StorageProvider(local), Consent, FormResponse, form.submitted |
| U2 Lab Intelligence | AIProvider.extractLabs, LabEngine.flag, lab.extract/lab.flag handlers, GLP-1 detection |
| U3 Motor clínico | ClinicalEngine, AIProvider.generateAssessment, IMC calc, clinical.generate, documentSchema |
| U4 Documento | PdfRenderer, document.render, Diseño Oficial template, branding |
| U5 HITL | ReviewApproval, ApprovalService (blocking rules), signature, immutable PDF |
| U6 Distribución/historial | Distribution/DirectoryService, Mailer(Gmail), SheetsExporter, PatientHistory/Service, Dashboard |
| U7 Afinado | AuditLogger hardening, retries/idempotency, security headers, encryption, tests, compliance review |

## 7. Compliance hooks
- **Clinical safety** CS1–CS8 enforced at: pipeline (CS2/CS8), ClinicalEngine (CS2/CS3/CS4/CS5), ApprovalService (CS1/CS3/CS7), PdfRenderer (CS3).
- **Security extension**: AuthService, input validation, headers, secrets, fail-closed, audit integrity.
- **PBT extension (full, fast-check)**: IMC (invariant/oracle), LabEngine.flag (invariant), documentSchema (round-trip), Case state machine (stateful).

## 8. Validation vs requirements/stories
- All 12 PRD modules have owning components. All 30 stories map to a component + unit. All 8 clinical-safety rules have an enforcing component. Consistent with execution-plan units.
