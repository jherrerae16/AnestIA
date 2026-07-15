# Component Dependencies & Data Flow — AnestIA

## Dependency matrix (→ = depends on / calls)
| Component | Depends on |
|---|---|
| PanelShell (web) | AuthService (via API) |
| PresetBuilder | PresetService |
| CaseCreator | CaseService |
| PatientForm | CaseService, StorageProvider (upload), Consent |
| ReviewApproval | ApprovalService, ClinicalEngine output, LabEngine output |
| Distribution | DistributionService, DirectoryService, Mailer |
| PatientHistory | PatientService |
| Dashboard | CaseService |
| CaseService | Prisma, AuditLogger, QueueManager |
| PresetService | Prisma, AuditLogger |
| PatientService | Prisma |
| ApprovalService | Prisma, PdfRenderer, AuditLogger |
| DistributionService | Prisma, Mailer, StorageProvider, AuditLogger |
| QueueManager | pg-boss, LabEngine, ClinicalEngine, AIProvider, PdfRenderer, Prisma |
| ClinicalEngine | AIProvider, shared documentSchema, IMC calc, Prisma |
| LabEngine | lab-rules.md ranges (pure) |
| AIProvider (stub/anthropic) | Vercel AI SDK + Anthropic (anthropic only); ANTHROPIC_API_KEY |
| StorageProvider | local FS (pilot) / S3 (future) |
| Mailer | nodemailer + Gmail SMTP; SMTP_* secrets |
| SheetsExporter | Google API (google only); OAuth secret |
| All API services | shared Zod schemas (packages/shared) |

## Communication patterns
- **Web ↔ API**: HTTP/JSON, Zod-validated both borders. Angular `httpResource`/`resource`.
- **API internal**: direct function calls (services), Prisma for data.
- **Pipeline**: async via pg-boss (Postgres-backed); job → job chaining.
- **External**: only through adapters (AIProvider, StorageProvider, Mailer, SheetsExporter).

## Data flow (happy path)
```
Anesthesiologist → CaseCreator → CaseService → Case(linkToken)  [manual copy → WhatsApp]
Patient → PatientForm → [Consent] → answers+files → StorageProvider + Prisma (txn) → form.submitted
  → QueueManager: extract → flag → generate → render
  → Case: PENDIENTE_REVISION → notify
Anesthesiologist → ReviewApproval → (edit/confirm exam) → ApprovalService.approve
  → locked version + signature + immutable PDF + ApprovalRecord + AuditLog → APROBADO
  → Distribution → Mailer/link + DeliveryRecord + AuditLog → ENTREGADO → Recipient
PatientService.upsertFromForm → patient history
```

## Key isolation & safety boundaries
- Every panel query scoped by `anesthesiologistId` (tenant isolation, Ley 1581).
- AIProvider is the ONLY key-dependent boundary → rest of system runs on stub.
- ApprovalService is the single enforcement point for HITL blocking rules (CS1/CS3/CS7).
- AuditLogger is append-only; no component can delete audit entries.
- LabEngine + IMC are deterministic (no LLM) → PBT oracle/invariant targets.

## Cross-cutting (extensions)
- **Security**: AuthService (S12), input validation everywhere (S05), security headers middleware (S04), secrets via env (S12), fail-closed error handling (S15), audit integrity (S14/S13).
- **PBT**: documentSchema round-trip, IMC invariant/oracle, LabEngine.flag invariant, Case state-machine stateful.
