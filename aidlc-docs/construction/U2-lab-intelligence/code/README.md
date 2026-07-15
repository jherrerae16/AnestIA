# U2 Lab Intelligence — Código generado (resumen)

## Qué hace
Primeros handlers del pipeline event-driven: `form.submitted → lab.extract → lab.flag → (clinical.generate)`. Extrae valores de laboratorio (AIProvider stub/visión), los marca con alertas rojas determinísticas y detecta agonistas GLP-1.

## Archivos
**packages/shared/src/**: lab.ts (`LAB_RULES` defaults "por validar", `canonicalAnalyte`, `parseNumeric`, `flagLab`), glp1.ts (`GLP1_DRUGS`, `detectGLP1`), lab.test.ts.
**apps/api/lib/**: services/lab.service.ts (extractForCase idempotente + GLP-1, flagForCase), queue/handlers.ts (onLabExtract, onLabFlag), queue/worker.ts (registra handlers). ai/index.ts (stub enriquecido: hemograma+coagulación Anexo C; [] si no hay adjuntos).

## Verificación (ejecutada end-to-end con worker real)
- ✅ 22 tests verdes (17 shared incl. **PBT flagLab determinismo+monotonicidad+oracle, detectGLP1 invariant**; 5 api).
- ✅ Pipeline real (`npm run worker`): caso con adjunto + P14="Uso Ozempic" →
  - **7 analitos extraídos** con sourceRef (hemograma+coagulación)
  - flags determinísticos aplicados por sexo (♀)
  - **Case.status → LABS_ANALIZADOS**
  - **GLP-1 detectado: `ozempic`** (audit) — CS8
  - **`clinical.generate` encolado** (avanza a U3)
  - **idempotente**: 7 resultados, sin duplicados al re-procesar
- ✅ CS2: sin adjuntos → 0 extracción (nunca fabrica).

## Umbrales (PENDIENTE validación clínica del Dr. Luquetta)
Hb <12♀/<13♂ o >17 ALERTA · Plaquetas <150k ALERTA/<100k CRITICO · INR >1.4 · Leucocitos <4k/>11k · Creatinina >1.3 · Glucemia >180 ALERTA/>250 CRITICO. Configurables en `packages/shared/src/lab.ts`.

## Pendiente
- Extracción real por visión (AI_PROVIDER=anthropic) — requiere ANTHROPIC_API_KEY (Fase 2-3). Stub cubre el flujo.
