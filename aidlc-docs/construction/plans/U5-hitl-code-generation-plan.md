# U5 HITL — Code Generation Plan

Builds on U0-U4. Stories US-5.1…5.5.

## Steps
### Step 1 — Shared: reglas de aprobación
- [x] `packages/shared/src/approval.ts`: `REQUIRED_ID_FIELDS`, `canApprove(fields)` → {ok, blockers[]}, `NORMAL_EXAM` (valores estándar), `applyExamNormal(fields)`, `applyEdit(fields, section, key, value)`.
- [x] export; tests (PBT: canApprove invariante; applyExamNormal limpia pendiente).

### Step 2 — ApprovalService (api)
- [x] `lib/services/approval.service.ts`: getReview, editAssessment (guard no-aprobado), setExam, loadExamNormal, canApproveCase, approve (re-check + snapshot+hash + PDF final + ApprovalRecord + lock + audit + status APROBADO), reject.

### Step 3 — Review routes (panel)
- [x] `app/api/panel/cases/[id]/review/route.ts` (GET), `assessment/route.ts` (PATCH), `exam/route.ts` (POST), `can-approve/route.ts` (GET), `approve/route.ts` (POST), `reject/route.ts` (POST). Todas: sesión + ownership.

### Step 4 — Frontend
- [x] ReviewApprovalPage (lado a lado, edición, examen, aprobación bloqueante) + ruta /cases/:id/review + ApiService métodos.

### Step 5 — Tests
- [x] PBT: canApprove (examen pendiente O obligatoria vacía ⇒ no ok; ambos resueltos ⇒ ok).
- [x] Example: aprobar con examen pendiente → 422 blocked; cargar examen normal → aprobable; aprobar → ApprovalRecord + lockedPdfUrl + status APROBADO + edición posterior rechazada.

### Step 6 — Docs + verify
- [x] README; smoke: revisar caso PENDIENTE_REVISION → aprobar bloqueado → cargar examen → aprobar → PDF final inmutable + APROBADO.

## Story traceability
US-5.1→3(review) · US-5.2→2,3 · US-5.3→1,2,3 · US-5.4→1,2,3,5 · US-5.5→2,3.

## Verification target
No se puede aprobar con examen pendiente; al aprobar queda PDF inmutable firmado + ApprovalRecord + APROBADO.
