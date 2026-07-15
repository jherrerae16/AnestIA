# U0 — Domain Entities (touched)

U0 instantiates the full Prisma schema (all 14 models) but only WRITES a subset in the seed. Reference: `prisma/schema.prisma`.

## Written by U0 seed
- **Anesthesiologist** — Luquetta: fullName, specialty, medicalRegistry (placeholder "PENDIENTE"), email (unique), clinicLogoUrl/signatureUrl (placeholder paths), footerText. + `passwordHash` field to ADD (see note).
- **QuestionnairePreset** — "Preanestésica general", version=1, isDefault=true, ownerId=Luquetta.
- **Question** ×22 — order, label, type (QuestionType enum), required, options (for selección), conditional (JSON).

## Schema addition needed (U0)
`Anesthesiologist` has no auth field in the provided schema. U0 adds:
```prisma
passwordHash String?   // adaptive hash; seed populates
```
(Kept optional to not break the multi-tenant shape; pilot uses it for sign in.) Also add a lightweight `Session` mechanism — pilot uses a signed stateless cookie (no Session table needed) OR a `Session` table if we want server-side invalidation. Design choice folded into NFR design; default = signed stateless cookie + short expiry.

## Enums used
QuestionType (TEXTO_CORTO, SELECCION_UNICA, SELECCION_MULTIPLE, FECHA, NUMERO, SI_NO, ARCHIVO, TEXTO_LARGO), Sex.

## Not written by U0 (created empty, used later)
Patient, Case, FormResponse, Attachment, ExtractedLabResult, GeneratedAssessment, ApprovalRecord, DirectoryContact, DeliveryRecord, Consent, AuditLog.
