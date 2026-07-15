# U2 — NFR Design Patterns

## Correctness / determinism
- `flagLab` = función pura sobre tabla `LAB_RULES`; sin LLM, sin I/O. PBT: oracle (vs tabla) + invariante de monotonicidad.
- Parseo numérico defensivo: si no hay número → NORMAL (no fabrica).

## Reliability (pipeline)
- Handlers idempotentes: chequear estado/artefactos antes de trabajar.
- Reintentos de pg-boss (config retryLimit/backoff); fail-closed (no publican el siguiente job si fallan).
- Cada handler avanza Case.status sólo tras éxito.

## Traceability
- sourceRef persistido por valor.
- GLP-1 detectado + fin de cada job → AuditLog.

## Anti-hallucination (CS2)
- lab.extract sólo persiste lo que devuelve extractLabs; ninguna regla "rellena" un analito ausente.
