# U7 — Business Logic Model

## US-7.1 Auditoría
- AuditLog append-only ya escrito en: case.created, consent.accepted, form.submitted, glp1.detected, lab.extracted/flagged, clinical.generated, document.rendered, assessment.edited/exam_confirmed/approved/rejected, document.delivered/accessed.
- Añadir: endpoint `GET /api/panel/cases/:id/audit` (timeline del caso, sesión+ownership).
- Confirmar: la app nunca hace update/delete sobre AuditLog (sólo create).

## US-7.2 Reintentos / idempotencia
- Configurar en pg-boss al encolar/registrar: retryLimit (p.ej. 3), retryBackoff.
- Cada handler ya es idempotente (chequea artefacto/estado antes): verificar y documentar.

## US-7.3 Seguridad
- `rateLimit(key, limit, windowMs)` (in-memory) aplicado en middleware a: /api/form/**, /api/download/**, /api/panel/auth/login.
- Confirmar headers (U0), Zod en bordes, secretos vía env, error handler fail-closed.
- Documentar cifrado: TLS en prod; disco en piloto.
- `npm audit` documentado (sin fix --force).

## Reviewer (cumplimiento)
- Recorrer CS1-CS8 + extensiones + Ley 1581/inmutabilidad/HITL → compliance-report.md con evidencia (rutas/tests).
