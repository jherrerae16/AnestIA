# U3 Motor Clínico — Consolidated Design Plan (FD + NFR)

U3 = corazón IA. `clinical.generate` handler: prompt-maestro (system) + generateObject(documentSchema) desde respuestas + labs. Stories US-3.1/3.2/3.3. Stub hasta la key.

## Alcance
- **`clinical.generate`** (handler): consume `lab.flag`→ arma ClinicalInput (respuestas + labs extraídos + marcador GLP-1) → IMC por código → AIProvider.generateAssessment → **valida contra documentSchema (rechaza malformado / campos prohibidos)** → persiste GeneratedAssessment (promptVersion, modelUsed) → publica `document.render`.
- **Guardarraíles** (CS2-CS5): examen físico/vitales = `pendiente_examen`; cada campo con `fuente`; IMC determinístico (no LLM); ASA/dx/plan derivados de datos reales; salida mal formada rechazada.
- **GLP-1** (CS8): si detectado → recomendaciones de ayuno/broncoaspiración.

## Testable Properties (PBT-01)
- **IMC** (U0/U3) — invariante/oracle: `imc(kg,cm) = kg/(cm/100)^2`, redondeo; monótona en peso.
- **documentSchema round-trip** (ya en shared) + **validación rechaza examen con valor inventado** (estado≠ok ⇒ valor debe ser null).
- **assembleClinicalInput** — determinístico desde caso.

## Extension compliance (U3)
- Security: 15 (fail-closed), 05 (validación de salida del LLM = Zod). 
- PBT: IMC oracle/invariant, documentSchema, guardarraíl "no valor sin estado ok".

---

## Question 1 — Cálculo de ASA
El PRD dice IA deriva ASA "con justificación breve". En stub no hay LLM. ¿Cómo produzco ASA en el piloto sin key?

A) Stub devuelve ASA + justificación de ejemplo coherentes con el caso de referencia (Anexo C: ASA II). Con la key real, el LLM lo deriva. Además, un helper determinístico simple sugiere un ASA base por comorbilidades declaradas (marcado "derivado IA, verificar"). (recomendado)
B) Sólo stub fijo ASA II hasta la key (sin helper).
X) Other (describe después de [Answer]:)

[Answer]: A

## Question 2 — Detalle del stub de generateAssessment
El stub debe producir un documento válido para construir U4-U5 sin key. ¿Cuánto detalle?

A) Documento completo del Anexo C (Uribe): identificación derivada de respuestas reales del caso (no inventadas), antecedentes de las respuestas, paraclínicos de los labs extraídos, examen físico TODO pendiente_examen, valoración/plan de ejemplo marcada derivada. Rellena con los datos REALES del caso donde existan; ejemplo sólo en los campos narrativos derivados. (recomendado)
B) Stub mínimo (sólo estructura, campos vacíos/pendientes).
X) Other (describe después de [Answer]:)

[Answer]: A

## Question 3 — Versionado de prompt/modelo
`GeneratedAssessment.promptVersion` y `modelUsed`. ¿Qué registro?

A) promptVersion = "prompt-maestro-v2" (del doc), modelUsed = "stub" o el modelo real ("claude-opus-…") según AI_PROVIDER. (recomendado)
X) Other (describe después de [Answer]:)

[Answer]: A

---

## Artifacts to generate (this gate)
- [x] functional-design/business-logic-model.md
- [x] functional-design/business-rules.md
- [x] functional-design/domain-entities.md
- [x] nfr-requirements/nfr-requirements.md
- [x] nfr-requirements/tech-stack-decisions.md
- [x] nfr-design/nfr-design-patterns.md
- [x] nfr-design/logical-components.md
