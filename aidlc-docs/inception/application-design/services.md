# Services & Orchestration — AnestIA

## Service layer overview
Business logic lives in `apps/api/lib/**` services (not in route handlers — CLAUDE.md convention). Route handlers = thin: validate (Zod) → authorize → call service → return.

## S1 — Auth & Authorization
- **Panel routes** `/api/panel/**`: `requireSession` middleware (deny-by-default, httpOnly/Secure/SameSite cookie). [SECURITY-08, SECURITY-12]
- **Patient form** `/api/form/[token]/**`: `verifyCaseToken` (object-level; no session). [SECURITY-08 IDOR prevention]
- **Downloads** `/api/download/[token]`: token-scoped to the approved PDF.
- All handlers: Zod input validation + size bounds. [SECURITY-05]

## S2 — Case pipeline (event-driven, pg-boss) [Q3=A]
```
Patient submit (S3)
  → API persists FormResponse + Attachments in ONE transaction
  → publish form.submitted {caseId}
  → onLabExtract   (AIProvider.extractLabs → ExtractedLabResult + sourceRef)      status: RESPUESTAS_RECIBIDAS→(extract)
  → onLabFlag      (LabEngine.flagAll, deterministic; GLP-1 marker)                status: LABS_ANALIZADOS
  → onClinicalGenerate (ClinicalEngine.generate → documentSchema-validated JSON;   status: BORRADOR_GENERADO
                        IMC by code; exam = pendiente_examen)
  → onDocumentRender  (PdfRenderer.renderDraft)                                    status: PENDIENTE_REVISION
  → notify anesthesiologist (in-app)
```
- Each job: idempotent (check current status/existing artifact before working), retryable, fail-closed. [SECURITY-15]
- Partial save does NOT publish; only final submit does.

## S3 — Form capture
- `savePartial` → FormResponse.partial=true, no event.
- `submit` → transaction (FormResponse + Attachments via StorageProvider) → publish form.submitted. PostgreSQL is source of truth.
- Consent captured before any data (Ley 1581).

## S4 — Review & Approval (HITL) [clinical-safety core]
- `ReviewApproval` (web) ↔ `ApprovalService` (api).
- `canApprove` returns blockers: required-empty fields, exam still `pendiente_examen`.
- `approve`: only if no blockers → lock version, apply visual signature, timestamp+approver, `renderFinal` immutable PDF, write ApprovalRecord + AuditLog. [CS1, CS3, CS7]
- `reject` reopens patient link.

## S5 — Distribution
- `DistributionService.distribute`: approved+immutable only → Mailer.send (Gmail SMTP) and/or tokenized download link → DeliveryRecord + audit. Recipients from DirectoryService (quick-add allowed). Aseguradora (P8) suggested. [RF-8, RF-12]

## S6 — Patient history
- `PatientService.upsertFromForm` on submit; `search`/`prefill` for reuse. Isolation by anesthesiologistId. [RF-11]

## S7 — Export (optional)
- `SheetsExporter.export` on-demand; downstream only, never a trigger nor source of truth.

## Orchestration principles
- Event-driven, no polling (submit is the trigger).
- Services own transitions; handlers never embed business rules.
- Adapters isolate all external dependencies (LLM, storage, mail, sheets) → single change points.
