# U7 — NFR Requirements

| Category | Requirement |
|---|---|
| Security | Rate-limit público; headers; secretos env; validación; fail-closed; audit integrity. |
| Reliability | Jobs reintentables + idempotentes; recuperación ante fallos sin duplicar. |
| Auditability | Timeline completo por caso; append-only. |
| Compliance | CS1-CS8 + Ley 1581 + inmutabilidad + HITL verificados y documentados. |
| Supply chain | Lockfile; npm audit documentado. |

## Extension NFRs
- Security: cierre de 10/11/14 (deps, rate-limit, audit alerting básico). 
- PBT: rate-limit; suite completa (documentar ejecución en CI / instrucciones Build&Test).
