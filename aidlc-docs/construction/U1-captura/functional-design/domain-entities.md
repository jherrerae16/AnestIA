# U1 — Domain Entities (touched)

Written/updated in U1 (reference prisma/schema.prisma):
- **QuestionnairePreset / Question** — CRUD + versioning (already seeded base in U0).
- **Case** — created with linkToken, linkExpiresAt, status transitions (ENVIADO_AL_PACIENTE → RESPONDIENDO → RESPUESTAS_RECIBIDAS).
- **FormResponse** — answers (JSON, formAnswersSchema), partial flag, submittedAt.
- **Attachment** — type, url/key, fileHash.
- **Consent** — textVersion, acceptedAt.
- **Patient** — upserted from answers on submit (fullName, documentId, birthDate, sex, insurer, bloodType). Unique [anesthesiologistId, documentId].

## Shared schemas added (packages/shared)
- `formAnswersSchema` — `{ [questionOrder:number]: { value: unknown, type: QuestionType } }`; validated dynamically against the case's preset.
- `presetSchema`, `questionSchema` (types, required, options, conditional `{showIf:{questionOrder, equals}}`).
- `createCaseSchema`, `uploadMetaSchema`.
- `CONSENT_TEXT_V1` constant (pending Q1).

## State machine (Case)
BORRADOR → ENVIADO_AL_PACIENTE → RESPONDIENDO (partial) → RESPUESTAS_RECIBIDAS (submit) → [pipeline U2+]
