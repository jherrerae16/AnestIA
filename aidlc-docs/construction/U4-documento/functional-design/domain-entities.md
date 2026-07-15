# U4 — Domain Entities (touched)

- **GeneratedAssessment** — leído (fields=DocumentJSON) para render.
- **Anesthesiologist** — branding (clinicLogoUrl, signatureUrl, fullName, specialty, medicalRegistry, footerText).
- **Case** — status BORRADOR_GENERADO → PENDIENTE_REVISION; draftPdfUrl (nuevo, opcional) o se guarda en storage con key derivada.
- **Attachment/ExtractedLabResult** — labs para la sección paraclínicos.

## Storage
- PDF de borrador guardado vía StorageProvider (key: `<caseId>/draft.pdf`). El PDF final inmutable (U5) irá a `lockedPdfUrl` en ApprovalRecord.

## Shared additions
- `pdf-template.ts` (o en api): `buildHtml(assessment, branding, opts)` + `escapeHtml`.
