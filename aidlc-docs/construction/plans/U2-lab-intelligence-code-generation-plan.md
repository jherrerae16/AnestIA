# U2 Lab Intelligence — Code Generation Plan

Builds on U0/U1. Stories US-2.1/2.2/2.3. Handlers lab.extract → lab.flag.

## Steps
### Step 1 — Shared: lab rules + GLP-1
- [x] `packages/shared/src/lab.ts`: `LabFlag` type, `LAB_RULES` table (defaults "por validar"), `canonicalAnalyte`, `parseNumeric`, `flagLab(analyte,value,sex)` pure.
- [x] `packages/shared/src/glp1.ts`: `GLP1_DRUGS`, `detectGLP1(text)`.
- [x] export; tests (PBT).

### Step 2 — Lab service + handlers (apps/api)
- [x] `lib/labs/engine.ts`: thin wrapper (already pure in shared) — flagResults(results, sex).
- [x] `lib/services/lab.service.ts`: extractForCase (AIProvider + persist + idempotent), flagForCase, detectGLP1ForCase.
- [x] `lib/queue/handlers.ts`: `onLabExtract`, `onLabFlag` (idempotent, advance status, publish next).

### Step 3 — Register handlers in worker
- [x] Update `lib/queue/worker.ts`: `boss.work('form.submitted', onLabExtract)`, `boss.work('lab.flag', onLabFlag)`.

### Step 4 — AIProvider stub enrich
- [x] Enrich stub extractLabs to return a realistic hemograma+coagulación set (Anexo C Uribe) for demo.

### Step 5 — Tests
- [x] PBT: flagLab determinism + monotonicity + oracle; detectGLP1 invariant; parseNumeric.
- [x] Example: Hb 11.5♀→ALERTA; plaquetas 90k→CRITICO; unknown analyte→NORMAL; "toma Ozempic"→GLP-1 detected.

### Step 6 — Docs + verify
- [x] README; run worker + trigger a case → verify ExtractedLabResult + flags + clinical.generate enqueued.

## Story traceability
US-2.1→1,2,4 · US-2.2→1,2,5 · US-2.3→1,2.

## Verification target
Hemograma cargado → analitos extraídos, fuera de rango marcados, valor ausente nunca fabricado, GLP-1 detectado; pipeline avanza a clinical.generate.
