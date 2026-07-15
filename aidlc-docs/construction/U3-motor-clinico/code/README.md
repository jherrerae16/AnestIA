# U3 Motor Clínico — Código generado (resumen)

## Qué hace
`clinical.generate` — el corazón IA. Ensambla respuestas + labs + GLP-1, calcula IMC por código, llama al proveedor (stub/anthropic con `generateObject`+documentSchema), valida el contrato, aplica guardarraíles y persiste `GeneratedAssessment`. Avanza el pipeline a `document.render`.

## Archivos
**packages/shared/src/**: clinical.ts (`computeIMC`, `suggestASA`, `enforceGuardrails`, `ClinicalInput`, `PROMPT_MAESTRO_VERSION`, `EXAM_FIELDS`), clinical.test.ts.
**apps/api/lib/**: services/clinical.service.ts (assembleInput, generateForCase, loadPromptMaestro), queue/handlers.ts (+onClinicalGenerate), queue/worker.ts (+registro). ai/index.ts (stub generateAssessment con datos reales del caso + recs GLP-1).

## Guardarraíles (verificados)
- **CS5**: salida validada con `documentSchema` (rechaza malformado).
- **CS3**: `enforceGuardrails` fuerza examen físico → `pendiente_examen`, valor null (aunque el LLM intente poblarlo).
- **CS4**: IMC ← valor calculado por código (sobrescribe al modelo).
- **CS2**: campo con estado≠'ok' → valor null (no inventar).
- **CS8**: GLP-1 detectado → recomendaciones de ayuno/broncoaspiración.

## Verificación (end-to-end con worker real)
- ✅ 29 tests verdes (24 shared incl. **PBT computeIMC oracle+monótona**, **enforceGuardrails CS2/CS3/CS4 invariantes**; 5 api).
- ✅ Pipeline completo `form.submitted→lab.extract→lab.flag→clinical.generate→document.render`:
  - GeneratedAssessment persistido (promptVersion=prompt-maestro-v2, modelUsed=stub)
  - Case.status → **BORRADOR_GENERADO**
  - **IMC=27.3** por código (fuente sistema:calculo) — Ana López 70/160
  - **signos_vitales = pendiente_examen** (valor null) — CS3
  - **ASA II** derivado · **GLP-1 ozempic** con alerta — CS8
  - **document.render encolado**
- ✅ idempotente.

## Pendiente
- Motor real (AI_PROVIDER=anthropic, generateObject con Opus) — requiere ANTHROPIC_API_KEY. El stub cubre todo el flujo aguas abajo (U4-U6).
