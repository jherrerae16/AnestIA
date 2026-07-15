# U3 — Business Logic Model

## Handler: clinical.generate [US-3.1/3.2/3.3]
Trigger: `lab.flag {caseId}` → `clinical.generate {caseId}`.
1. Idempotencia: si el caso ya tiene GeneratedAssessment, saltar.
2. Ensamblar `ClinicalInput`:
   - respuestas (FormResponse.answers)
   - labs extraídos (ExtractedLabResult + flags)
   - marcador GLP-1 (desde audit/detección P14)
   - IMC calculado por código (peso P5, talla P6)
3. `AIProvider.generateAssessment(input)` → DocumentJSON.
   - stub: documento del Anexo C, rellenando datos REALES del caso donde existan; narrativos derivados de ejemplo; examen físico pendiente.
   - anthropic: `generateObject({schema: documentSchema, system: promptMaestroV2, prompt: input})`.
4. **Post-validación (guardarraíles)**:
   - Parsear con `documentSchema` (rechaza malformado).
   - Forzar IMC = valor calculado por código (no del LLM).
   - Verificar examen_fisico: todos los campos `estado='pendiente_examen'` con `valor=null` (CS3). Si el LLM puso un valor → rechazar/limpiar.
   - Verificar: ningún campo con `estado≠'ok'` tiene `valor` no nulo inventado.
5. Persistir GeneratedAssessment (fields=DocumentJSON, promptVersion, modelUsed).
6. Case.status → BORRADOR_GENERADO; publicar `document.render`.

## Funciones puras (shared)
- `computeIMC(pesoKg, tallaCm): number` — determinístico (ya en U0 lib; se mueve/expone en shared para PBT).
- `suggestASA(comorbilidades): {grado, justificacion}` — heurística simple, marcada "derivada, verificar".
- `assembleClinicalInput(case): ClinicalInput`.
- `enforceGuardrails(doc, imc): DocumentJSON` — aplica CS2/CS3/CS4.
