# U2 Lab Intelligence — Consolidated Design Plan (FD + NFR)

U2 = leer exámenes y detectar alertas rojas. Stories US-2.1 (extracción visión tras adaptador), US-2.2 (flags determinísticos), US-2.3 (detección GLP-1). Primeros handlers del pipeline: `lab.extract` → `lab.flag`.

## Alcance
- **`lab.extract`** (handler pg-boss): consume `form.submitted`→ toma adjuntos del caso → `AIProvider.extractLabs` (stub devuelve valores de ejemplo; anthropic = visión con key) → persiste `ExtractedLabResult` con `sourceRef`. NUNCA fabrica valores ausentes (CS2). Publica `lab.flag`.
- **`lab.flag`** (handler): compara cada `ExtractedLabResult` contra rangos de `lab-rules.md` (determinístico, sin LLM) → `NORMAL | ALERTA | CRITICO`. Ajusta por sexo.
- **GLP-1**: detecta agonistas declarados en P14 → marca para lógica de broncoaspiración (consumida en U3).

## Testable Properties (PBT-01)
- **`flag(result, sex)`** — invariante: determinística (mismo input→mismo output); monótona (valor más extremo ⇒ severidad ≥). Oracle vs tabla de rangos.
- **detección GLP-1** — invariante: detecta cualquier fármaco de la lista (case-insensitive, con/sin acentos).
- **lab.extract idempotente** — re-ejecutar no duplica ExtractedLabResult.

## Extension compliance (U2)
- Security: SECURITY-15 (jobs fail-closed, reintentables). Sin nuevos endpoints públicos.
- PBT: flag determinístico/monótono, GLP-1, idempotencia extract.

---

## Question 1 — Umbrales de laboratorio (lab-rules.md son ilustrativos)
`lab-rules.md` dice que los rangos deben ser validados por el Dr. Luquetta. Para el flagging determinístico necesito números concretos. ¿Uso estos defaults (marcados "por validar") o tienes los definitivos?

A) Usar defaults documentados como "PENDIENTE validación clínica del Dr. Luquetta", configurables (tabla en código). Valores: Hb <12♀/<13♂ o >17 ALERTA; Plaquetas <150k ALERTA / <100k CRITICO; INR >1.4 ALERTA; TP/TPT prolongados ALERTA; Leucocitos <4k o >11k ALERTA; Creatinina >1.3 ALERTA; Glucemia >180 ALERTA / >250 CRITICO. (recomendado — no bloquea; el Dr. ajusta después)
B) Me esperas y tú pasas la tabla validada.
X) Other (describe después de [Answer]:)

[Answer]: 

## Question 2 — Lista de agonistas GLP-1
¿Qué fármacos disparan la lógica GLP-1? Default:

A) semaglutida, liraglutida, tirzepatida, dulaglutida, exenatida, lixisenatida + nombres comerciales (Ozempic, Wegovy, Saxenda, Victoza, Mounjaro, Trulicity, Rybelsus). Detección case-insensitive, sin acentos. (recomendado)
B) Otra lista (indícala).
X) Other (describe después de [Answer]:)

[Answer]: 

## Question 3 — Normalización de nombres de analitos
La extracción (stub/visión) puede devolver "Hemoglobina", "HB", "Hgb". ¿Cómo mapeo a un canónico para flaggear?

A) Tabla de sinónimos → analito canónico (Hemoglobina, Plaquetas, Leucocitos, INR, TP, TPT, Creatinina, Glucemia, Hematocrito). Lo no reconocido se guarda pero se marca NORMAL (sin regla). (recomendado)
B) Otra estrategia.
X) Other (describe después de [Answer]:)

[Answer]: 

## Question 4 — ¿Registrar handlers en el worker ahora?
`npm run worker` arranca pg-boss. ¿Registro los handlers `lab.extract`/`lab.flag` en el worker (proceso aparte) para que el pipeline corra de verdad?

A) Sí — registrar en `lib/queue/worker.ts`; el pipeline procesa `form.submitted` automáticamente al correr `npm run worker`. Verificable end-to-end. (recomendado)
X) Other (describe después de [Answer]:)

[Answer]: 

---

## Artifacts to generate (this gate)
- [x] functional-design/business-logic-model.md
- [x] functional-design/business-rules.md
- [x] functional-design/domain-entities.md
- [x] nfr-requirements/nfr-requirements.md
- [x] nfr-requirements/tech-stack-decisions.md
- [x] nfr-design/nfr-design-patterns.md
- [x] nfr-design/logical-components.md
