# U1 Captura — Code Generation Plan

Workspace root: `/Users/jdh/Desktop/Luquetta`. Builds on U0. Stories US-1.1…1.7.
Config (approved defaults): consent `CONSENT_TEXT_V1` (standard, replaceable); link expiry 7d; attachments 10/case × 15MB, {PDF,JPG,PNG,WEBP,HEIC}; answers map `{order:{value,type}}`; conditional `{showIf:{questionOrder,equals}}`.

## Steps

### Step 1 — Shared schemas (packages/shared)
- [x] `preset.ts`: questionSchema, presetSchema, conditional type, `isVisible(question, answers)` pure fn.
- [x] `form.ts`: formAnswersSchema builder `buildAnswersSchema(preset)`, createCaseSchema, uploadMetaSchema.
- [x] `consent.ts`: `CONSENT_TEXT_V1` + version constant.
- [x] export from index; tests.

### Step 2 — API services (apps/api/lib)
- [x] `lib/services/preset.service.ts`: list/create/update (+versioning).
- [x] `lib/services/case.service.ts`: createCase (token via crypto.randomBytes, expiry +7d), state transitions.
- [x] `lib/services/form.service.ts`: getByToken, savePartial, submit (validate vs preset, transaction, idempotent), consent.
- [x] `lib/services/patient.service.ts`: upsertFromForm.
- [x] `lib/auth/token.ts`: verifyCaseToken.

### Step 3 — API routes: panel (session)
- [x] `app/api/panel/presets/route.ts` (GET list, POST create), `presets/[id]/route.ts` (GET, PUT).
- [x] `app/api/panel/cases/route.ts` (POST create → link), `cases/[id]/route.ts` (GET).

### Step 4 — API routes: form (token)
- [x] `app/api/form/[token]/route.ts` (GET form + preset + partial + consent).
- [x] `.../consent/route.ts` (POST accept).
- [x] `.../save/route.ts` (POST partial).
- [x] `.../upload/route.ts` (POST multipart → StorageProvider + Attachment).
- [x] `.../submit/route.ts` (POST → validate, transaction, publish form.submitted, upsert patient).
- [x] `app/api/download/[key]/route.ts` (tokenized attachment serve).
- [x] Update middleware matcher note (form paths public/token-gated).

### Step 5 — Frontend: panel (Angular)
- [x] PresetBuilderPage (+ question editor), CaseCreatorPage (create + copy link). Routes + nav.

### Step 6 — Frontend: patient form (Angular, public)
- [x] PatientFormPage (by token) + ConsentGate + DynamicQuestion + AttachmentUploader + save/submit. Branded, mobile-first, data-testid.
- [x] Public route `/form/:token` (no guard).

### Step 7 — Tests
- [x] PBT: `isVisible` invariant (hidden⇒not-required); formAnswersSchema round-trip; token entropy/uniqueness; submit idempotence.
- [x] Example: create case→token; partial save no event; submit validates required; conditional hides P21 when P20≠sí; consent required before submit.

### Step 8 — Docs
- [x] `aidlc-docs/construction/U1-captura/code/README.md` + file summary.

## Story traceability
US-1.1→1,3,5 · US-1.2→2,3,5 · US-1.3→1,4,6 · US-1.4→1,6,7 · US-1.5→2,4,6 · US-1.6→2,4,7 · US-1.7→2,4,7.

## Verification target (U1 acceptance)
Patient opens link → answers → attaches → submits → Case+FormResponse+Attachment persisted, `form.submitted` emitted. Verified via API smoke + tests (front live-serve in Build&Test).
