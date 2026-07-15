# U1 Captura — Consolidated Design Plan (FD + NFR-Req + NFR-Design)

U1 = reemplaza el Google Form. Stories US-1.1…1.7: constructor de presets, crear caso + enlace, form del paciente (consentimiento, condicional, adjuntos, guardado parcial, submit), persistencia + `form.submitted`. Un solo gate de diseño (Q2=B). Abajo: decisiones + preguntas.

## Alcance
- **Panel (P1)**: PresetBuilder (crear/editar/versionar, tipos, obligatorias, condicional) · CaseCreator (crear caso, elegir preset, enlace tokenizado + copiar).
- **Form paciente (P2, sin cuenta)**: acceso por token, consentimiento Ley 1581, render condicional, adjuntos, guardado parcial, submit.
- **Backend**: rutas panel (presets, cases) + rutas form por token (get/save/submit/upload), persistencia transaccional, emisión `form.submitted` (pg-boss).

## Testable Properties (PBT-01)
- **Motor condicional** — invariante: una pregunta oculta nunca es obligatoria efectiva; `visible(P21) ⇔ answer(P20)=='si'`.
- **formAnswersSchema round-trip** (PBT-02).
- **linkToken** — invariante: único, no adivinable (entropía ≥ 128 bits), expira.
- **partial→submit** — máquina de estados: submit sólo dispara pipeline una vez (idempotente).

## Extension compliance (U1)
- **Security**: SECURITY-05 (validación Zod en cada ruta, límites de tamaño de payload y archivos), SECURITY-08 (form por token = autorización a nivel de objeto; panel por sesión), SECURITY-09 (tipos de archivo permitidos, sin ejecución), SECURITY-12 (token expira), SECURITY-15 (fail-closed).
- **PBT**: motor condicional, formAnswersSchema, token.

---

## Question 1 — Texto y versión del consentimiento Ley 1581
El formulario exige aceptar tratamiento de datos sensibles antes de responder. ¿De dónde sale el texto?

A) Texto por defecto versionado en código (`CONSENT_TEXT_V1`, constante en shared), mostrado y guardado con su versión en `Consent`. Editable después. (recomendado — no bloquea; cumples Ley 1581 con un texto estándar)
B) Me esperas y tú redactas el texto legal exacto antes de codificar.
X) Other (describe después de [Answer]:)

[Answer]: 

## Question 2 — Expiración del enlace del paciente
`Case.linkExpiresAt`. ¿Default de expiración del enlace tokenizado?

A) 7 días desde la creación (configurable). (recomendado)
B) Sin expiración en el piloto (linkExpiresAt=null).
C) Otro valor (indícalo).
X) Other (describe después de [Answer]:)

[Answer]: 

## Question 3 — Límites de adjuntos
Para SECURITY-05/09. ¿Límites de carga de archivos del paciente?

A) Máx 10 archivos/caso, 15 MB c/u; tipos permitidos: PDF, JPG, PNG, WEBP, HEIC. (recomendado)
B) Otros límites (indícalos).
X) Other (describe después de [Answer]:)

[Answer]: 

## Question 4 — Forma del esquema de respuestas (formAnswersSchema)
¿Cómo estructuro las respuestas del paciente en `FormResponse.answers` (JSON)?

A) Mapa `{ [questionOrder]: { value, type } }` validado contra el preset del caso (tipos coinciden, obligatorias presentes, condicionales respetadas). (recomendado — validación contra el preset versionado)
B) Lista de `{questionId, value}`.
X) Other (describe después de [Answer]:)

[Answer]: 

## Question 5 — Motor de lógica condicional
Formato de `Question.conditional` (ya sembré `{showIf:{questionOrder, equals}}`). ¿Confirmo ese formato simple o lo extiendo?

A) Simple `{showIf:{questionOrder, equals}}` (una condición por pregunta) — suficiente para P12→P13, P20→P21. (recomendado para el piloto)
B) Extendido (AND/OR, múltiples condiciones).
X) Other (describe después de [Answer]:)

[Answer]: 

---

## Artifacts to generate (this gate)
- [x] functional-design/business-logic-model.md
- [x] functional-design/business-rules.md
- [x] functional-design/domain-entities.md
- [x] functional-design/frontend-components.md
- [x] nfr-requirements/nfr-requirements.md
- [x] nfr-requirements/tech-stack-decisions.md
- [x] nfr-design/nfr-design-patterns.md
- [x] nfr-design/logical-components.md
