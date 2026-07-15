# U3 Motor Clínico — Code Generation Plan

Builds on U0-U2. Stories US-3.1/3.2/3.3. Handler clinical.generate.

## Steps
### Step 1 — Shared: derivaciones + guardarraíles
- [x] `packages/shared/src/clinical.ts`: `computeIMC`, `suggestASA`, `enforceGuardrails(doc, imc)`, `ClinicalInput` type, `PROMPT_MAESTRO_VERSION`, EXAM section keys.
- [x] export; tests (PBT: IMC oracle/invariant/monotonic; guardrails).

### Step 2 — AIProvider stub: generateAssessment real-ish
- [x] Enrich stub `generateAssessment(input)` to build DocumentJSON from REAL case data (identificación/antecedentes/paraclínicos from input), examen_fisico all pendiente_examen, valoración/plan example marked derived, GLP-1 recs if flagged.

### Step 3 — ClinicalEngine service + handler
- [x] `lib/services/clinical.service.ts`: assembleInput(caseId), generate(caseId) (IMC by code, call provider, enforceGuardrails, persist GeneratedAssessment).
- [x] `lib/queue/handlers.ts`: add `onClinicalGenerate` (idempotent, status BORRADOR_GENERADO, publish document.render).
- [x] `lib/queue/worker.ts`: register clinical.generate.
- [x] promptMaestro loader (read docs/prompt-maestro-v2.md).

### Step 4 — Tests
- [x] PBT: computeIMC (oracle kg/(m^2), invariant, monotonic in weight); enforceGuardrails (exam→pendiente/valor null; estado≠ok⇒valor null; IMC overwritten).
- [x] Example: reference case → valid GeneratedAssessment, exam pending, GLP-1 recs present, malformed rejected.

### Step 5 — Docs + verify
- [x] README; run worker → full pipeline form.submitted→…→clinical.generate → GeneratedAssessment persisted, exam pending, status BORRADOR_GENERADO, document.render enqueued.

## Story traceability
US-3.1→1,2,3,4 · US-3.2→2,3 · US-3.3→1,4.

## Verification target
Caso de referencia → JSON válido, examen pendiente, ASA justificado, GLP-1 aplicada; salida mal formada rechazada.
