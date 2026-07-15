# Components — AnestIA

High-level components + responsibilities + interfaces. Detailed business rules deferred to per-unit Functional Design. Stack per PRD §9 / CLAUDE.md.

## Monorepo layout (Q1=A)
```
Luquetta/
├── prisma/schema.prisma            # data model (moved from root)
├── packages/shared/                # Zod schemas + shared TS types (FE + API + AI contract)
├── apps/api/                       # Next.js (API Routes) + pg-boss workers
│   ├── app/api/**/route.ts
│   └── lib/                        # business logic, adapters, engines (API-side)
│       ├── ai/                     # AIProvider adapter (stub|anthropic)
│       ├── storage/                # StorageProvider adapter (local|s3)
│       ├── mailer/                 # Mailer adapter (gmail-smtp|stub)
│       ├── sheets/                 # SheetsExporter adapter (noop|google)
│       ├── queue/                  # pg-boss setup + job registration
│       ├── labs/                   # lab flag rules (deterministic)
│       ├── clinical/               # prompt assembly + validation
│       ├── pdf/                    # Playwright render
│       ├── auth/                   # session + token authz
│       └── audit/                  # audit log writer
├── apps/web/                       # Angular 19 (panel + patient form)
├── storage/                        # runtime files (gitignored, outside served static)
└── aidlc-docs/                     # AI-DLC docs
```

## Frontend components (apps/web — Angular standalone/signals)

### C-WEB-1 PanelShell
- **Purpose**: Authenticated anesthesiologist workspace shell (nav, session).
- **Responsibilities**: Route guard (session), layout, logout.
- **Interface**: routes `/dashboard`, `/presets`, `/cases/:id/review`, `/patients`, `/directory`, `/profile`.

### C-WEB-2 PresetBuilder
- **Purpose**: Create/edit/version questionnaire presets.
- **Interface**: `loadPreset(id)`, `savePreset(dto)`, question editor (types, required, conditional).

### C-WEB-3 CaseCreator
- **Purpose**: Create a case, pick preset, produce tokenized link with copy button.
- **Interface**: `createCase(dto) → {caseId, linkUrl}`.

### C-WEB-4 PatientForm
- **Purpose**: Mobile-first branded form the patient fills (no account).
- **Responsibilities**: Consent gate (Ley 1581), conditional rendering, attachments upload, partial save, submit.
- **Interface**: `GET form(token)`, `savePartial(token, answers)`, `submit(token, answers, files)`.

### C-WEB-5 ReviewApproval
- **Purpose**: HITL side-by-side review + edit + approve/reject.
- **Responsibilities**: Highlight AI-derived/alerts/pending-exam; block approval if invalid; exam entry / "cargar examen normal".
- **Interface**: `loadCase(id)`, `editField(id, path, value)`, `confirmExam(id, payload)`, `approve(id)`, `reject(id, reason)`.

### C-WEB-6 Distribution
- **Purpose**: Select recipients from directory, send final PDF.
- **Interface**: `listContacts()`, `quickAddContact(dto)`, `distribute(caseId, contactIds, channels)`.

### C-WEB-7 PatientHistory
- **Purpose**: Search patients, view history, prefill new case.
- **Interface**: `search(query)`, `getPatient(id)`, `prefillCase(patientId)`.

### C-WEB-8 Dashboard
- **Purpose**: Cases by status, filters, indicators.
- **Interface**: `listCases(filter)`.

## Backend components (apps/api/lib)

### C-API-1 AuthService (auth/)
- **Purpose**: Session + token authorization (Q4=A).
- **Interface**: `login(email,password)`, `getSession(req)`, `requireSession(req)`, `verifyCaseToken(token)`.

### C-API-2 AIProvider adapter (ai/) (Q2=A)
- **Purpose**: Single change point for the LLM.
- **Interface**: `extractLabs(files: FileRef[]): Promise<ExtractedLab[]>`, `generateAssessment(input: ClinicalInput): Promise<DocumentJSON>`. Factory `getAIProvider()` reads `AI_PROVIDER=stub|anthropic`. Stub returns the Anexo-C reference case (Uribe).

### C-API-3 StorageProvider adapter (storage/)
- **Purpose**: File persistence (Q2 storage=local).
- **Interface**: `put(bytes, meta): Promise<{key, hash}>`, `get(key): Promise<bytes>`, `signedUrl(key, ttl)`. Factory reads `STORAGE_PROVIDER=local|s3`.

### C-API-4 Mailer adapter (mailer/)
- **Purpose**: Final-report delivery (real Gmail SMTP).
- **Interface**: `send({to, subject, html, attachments}): Promise<DeliveryResult>`. Factory reads `MAILER_PROVIDER=gmail-smtp|stub`. Reads `SMTP_*` secrets from env.

### C-API-5 SheetsExporter adapter (sheets/)
- **Purpose**: Optional on-demand export (RF-2.5).
- **Interface**: `export(caseIds): Promise<SheetRef>`. Factory `SHEETS_PROVIDER=noop|google`.

### C-API-6 LabEngine (labs/)
- **Purpose**: Deterministic red-flag classification (no LLM).
- **Interface**: `flag(result: ExtractedLab, sex): LabFlag`. Rules from `lab-rules.md`.

### C-API-7 ClinicalEngine (clinical/)
- **Purpose**: Assemble prompt-maestro system prompt + inputs, call AIProvider, validate against documentSchema, compute IMC in code.
- **Interface**: `generate(caseId): Promise<GeneratedAssessment>`. Rejects malformed / prohibited-field output.

### C-API-8 PdfRenderer (pdf/)
- **Purpose**: HTML→PDF via Playwright, Diseño Oficial, profile branding.
- **Interface**: `renderDraft(assessment): Promise<pdfBytes>`, `renderFinal(approved): Promise<pdfBytes>`.

### C-API-9 QueueManager (queue/)
- **Purpose**: pg-boss setup + 4 chained job handlers (Q3=A).
- **Interface**: `publish('form.submitted', {caseId})`; handlers `lab.extract`, `lab.flag`, `clinical.generate`, `document.render` — each idempotent, updates Case status.

### C-API-10 AuditLogger (audit/)
- **Purpose**: Append-only audit entries.
- **Interface**: `log({actorId, action, entity, entityId, meta})`. App cannot mutate/delete entries.

### C-API-11 CaseService / PresetService / PatientService / DirectoryService / ApprovalService
- **Purpose**: CRUD + orchestration around Prisma; enforce isolation by `anesthesiologistId`, state transitions, blocking-approval rules.
- **Interface**: standard service methods; ApprovalService.`approve()` enforces exam-not-pending + required-not-empty → locks version, applies signature, writes ApprovalRecord + audit, produces immutable PDF.

## Shared (packages/shared) (Q5=A)
### C-SHARED-1 Schemas
- **Purpose**: Single Zod contract shared FE/API/AI.
- **Key schemas**: `documentSchema` (nested by Diseño Oficial sections; each field `{valor, estado, fuente, alerta?, nota?}`), `formAnswersSchema`, `presetSchema`, `extractedLabSchema`, `clinicalInputSchema`, DTOs.
