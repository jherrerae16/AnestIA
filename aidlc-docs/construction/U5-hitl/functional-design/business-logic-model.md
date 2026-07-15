# U5 — Business Logic Model

## Panel flows (P1, sesión + ownership)

### F1 — Cargar caso a revisión [US-5.1]
`GET /api/panel/cases/:id/review` → GeneratedAssessment (fields) + FormResponse (respuestas fuente) + ExtractedLabResult (con flag/sourceRef) + estado del examen. UI muestra lado a lado, resaltando derivados/alertas/pendiente.

### F2 — Edición en línea [US-5.2]
`PATCH /api/panel/cases/:id/assessment` con {path, value} → valida (Zod) → aplica al fields → registra en edits. No permitido si ya aprobado.

### F3 — Examen físico [US-5.3]
- `POST /api/panel/cases/:id/exam` con valores reales → setea examen_fisico campos estado='ok', fuente='anestesiologo'.
- "cargar examen normal": rellena valores normales estándar (confirmación activa) fuente='anestesiologo'.

### F4 — Aprobación bloqueante [US-5.4]
- `GET .../can-approve` → `canApprove(fields)` → {ok, blockers[]} (examen pendiente / obligatorias vacías).
- `POST .../approve`:
  1. Re-chequear canApprove; si blockers → 422 (no aprueba).
  2. Snapshot fields → ApprovalRecord (edits, approvedById, approvedAt, hash).
  3. Render PDF final (sin marca de agua) → StorageProvider → lockedPdfUrl.
  4. Case.status → APROBADO. Audit assessment.approved.
  5. GeneratedAssessment queda bloqueado (no más edición).

### F5 — Rechazar [US-5.5]
`POST .../reject` {reason} → reabre form (status → RESPONDIENDO / genera nuevo enlace o reutiliza), audit.

## Funciones puras (shared)
- `canApprove(fields): {ok, blockers[]}` — examen pendiente? obligatorias (identificación clave) vacías?
- `NORMAL_EXAM` — set de valores normales estándar.
- `applyExamNormal(fields): fields`.
