# U5 HITL — Código generado (resumen)

## Qué hace
El gate humano médico-legal. Vista de revisión lado a lado, edición en línea, confirmación de examen físico, **aprobación bloqueante** (no aprueba con examen pendiente/obligatorias vacías), firma → PDF final inmutable + ApprovalRecord + audit.

## Archivos
**packages/shared/src/**: approval.ts (`canApprove` bloqueante, `NORMAL_EXAM`, `applyExamNormal`, `applyEdit`, `REQUIRED_ID_FIELDS`), approval.test.ts.
**apps/api/lib/services/**: approval.service.ts (getReview, editAssessment [guard], loadExamNormal/setExam, approve [re-check+snapshot+hash+PDF final+lock+audit], reject, ApprovedLockError).
**apps/api/app/api/panel/cases/[id]/**: review, assessment (PATCH), exam, approve, reject.
**apps/web/**: review-approval.page.ts (lado a lado + aprobación) + ruta + ApiService.

## Verificación (backend smoke — la ruta crítica de seguridad)
- ✅ 37 tests verdes (32 shared incl. **PBT canApprove invariante bloqueo**, applyExamNormal; 5 api). Angular build OK.
- ✅ Gate bloqueante end-to-end:
  1. GET review 200
  2. **APPROVE con examen pendiente → 422 BLOQUEADO** (CS3 — la regla central)
  3. Cargar examen normal → 200
  4. canApprove → ok
  5. **APPROVE → ok**; Case=APROBADO, ApprovalRecord (aprobador+lockedPdfUrl) — CS7
  6. **EDIT tras aprobar → 409 LOCK** (inmutable) — CS7
  7. **PDF final: 97 KB** (sin marca de agua)

## Reglas de seguridad clínica verificadas
- **CS1**: la IA nunca aprueba; sólo el anestesiólogo autenticado.
- **CS3**: no se puede aprobar con examen pendiente (re-chequeo server-side, no burlable).
- **CS7**: inmutabilidad post-aprobación (snapshot+hash+PDF final+guard 409+audit).
- "Cargar examen normal" = confirmación activa (fuente=anestesiologo, §17).

## Pendiente
- Front live-serve; el build compila y el backend está verificado.
