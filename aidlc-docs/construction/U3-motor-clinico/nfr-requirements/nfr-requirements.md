# U3 — NFR Requirements

| Category | Requirement |
|---|---|
| Safety (clínica) | Guardarraíles CS2-CS5/CS8 aplicados y verificados; examen pendiente; IMC por código. |
| Correctness | Salida validada por Zod; malformada rechazada. |
| Reliability | Handler idempotente, fail-closed, reintentable. |
| Performance | Generación < 20s (PRD). Stub instantáneo. |
| Traceability | promptVersion + modelUsed por assessment. |

## Extension NFRs
- Security 05 (validación de salida IA), 15 (fail-closed).
- PBT (full): IMC oracle/invariant, documentSchema round-trip, guardarraíl "estado≠ok ⇒ valor null".
