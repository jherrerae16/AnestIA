# Unit Test Execution — AnestIA

## Ejecutar todos los tests
```bash
npm run test --workspace packages/shared
npm run test --workspace apps/api
# o: npm test  (todos los workspaces)
```

## Resultados esperados
- **shared**: 35 tests, 0 fallos (7 archivos). Vitest + fast-check.
- **api**: 7 tests, 0 fallos (2 archivos).
- **Total: 42 verdes.**

## Cobertura PBT (property-based, fast-check) por unidad
- U0: password hash round-trip, sesión sign/verify round-trip, throttle.
- U1: motor condicional (oculta⇒no-obligatoria), validateAnswers, answers round-trip.
- U2: flagLab determinismo/monotonicidad/oracle, detectGLP1 invariant, parseNumeric.
- U3: computeIMC oracle/monótona, enforceGuardrails CS2/CS3/CS4 invariantes.
- U4: buildDocumentHtml determinismo/watermark, escapeHtml anti-inyección.
- U5: canApprove invariante bloqueo, applyExamNormal.
- U6: buildDeliveryEmail determinismo, prefillFromPatient.
- U7: rateLimit invariante.

## Semilla en fallo (PBT-08)
fast-check imprime la semilla y el caso mínimo al fallar. Para reproducir, fijar la semilla reportada.

## Si fallan
1. Revisar la salida (archivo:línea + counterexample).
2. Distinguir bug de código vs. generador de test (PBT-07): p.ej. `fc.emailAddress()` genera correos que Zod rechaza → ajustar el generador, no el código (ocurrió en U0).
