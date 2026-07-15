# U3 — NFR Design Patterns

## Safety (guardarraíles en capas)
1. **Schema-level**: `generateObject` fuerza documentSchema; salida que no valida → error.
2. **Post-parse `enforceGuardrails`**:
   - examen_fisico: todos los campos → estado='pendiente_examen', valor=null (CS3).
   - IMC ← valor calculado por código (CS4).
   - todo campo con estado≠'ok' → valor=null (CS2).
3. **fuente obligatoria**: campos poblados sin fuente → se degradan a no_reportado.

## Reliability
- Idempotente (chequear GeneratedAssessment antes).
- fail-closed: si valida mal o el proveedor falla → no persiste, no avanza; pg-boss reintenta.

## Determinism
- IMC/ASA en código puro → PBT oracle/invariant, independiente del LLM.

## Traceability
- promptVersion + modelUsed persistidos; audit clinical.generated.
