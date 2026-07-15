# U7 Afinado — Código generado (resumen)

## Qué hace
Endurecimiento final + cierre de cumplimiento: rate-limit en rutas públicas, endpoint de auditoría por caso, reintentos en jobs, documentación de seguridad de dependencias, y reporte de cumplimiento (Reviewer hat).

## Archivos
**apps/api/lib/**: rate-limit.ts (+test), middleware.ts (+rate-limit form/download/login), queue/index.ts (retryLimit+backoff).
**apps/api/app/api/**: panel/cases/[id]/audit (timeline).
**aidlc-docs/construction/U7-afinado/**: dependency-security.md, compliance-report.md.

## Verificación
- ✅ 42 tests verdes (35 shared + 7 api incl. **PBT rateLimit invariante**).
- ✅ Audit endpoint: **12 eventos** en el timeline del caso (case.created → … → document.accessed).
- ✅ Rate-limit live: 30 req OK → **429** (SECURITY-11).
- ✅ Jobs con retryLimit=3 + backoff (US-7.2); handlers idempotentes (verificado en U2-U4).
- ✅ AuditLog append-only (la app sólo crea entradas).

## Reporte de cumplimiento
`compliance-report.md`: CS1-CS8 todas ✅ con evidencia; Security Baseline (aplicables ✅, cloud N/A, SECURITY-10 con acción pendiente pre-prod); PBT FULL; Ley 1581 / inmutabilidad / HITL verificados.

## Dependencias
`dependency-security.md`: npm audit documentado (8 prod / 32 total, transitivas de Next/Angular); sin `fix --force` (no romper build); aceptación de riesgo para piloto local; acción pendiente pre-producción.

## Pendientes (no bloquean piloto)
Ver compliance-report.md § Pendientes: keys de IA/SMTP/Sheets, assets reales, validación clínica de umbrales, actualización de deps + escáner CI.
