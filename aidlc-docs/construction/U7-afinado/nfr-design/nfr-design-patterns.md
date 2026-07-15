# U7 — NFR Design Patterns

## Rate limiting
- `rateLimit(key, limit, windowMs)` in-memory (Map con ventana). Aplicado en middleware para form/download/login por IP+ruta. 429 al exceder.

## Retries / idempotence
- pg-boss: retryLimit + retryBackoff al registrar work/send.
- Handlers idempotentes: guardas de existencia (ExtractedLabResult/GeneratedAssessment/ApprovalRecord).

## Audit integrity
- Sólo `create` en AuditLog; sin rutas de edición/borrado.
- Endpoint de lectura por caso (sesión+ownership).

## Secrets / errors
- env-only; error handler fail-closed genérico (ya en U0).

## Supply chain
- package-lock.json commiteado; npm audit documentado (nota de aceptación de riesgo para el piloto local).
