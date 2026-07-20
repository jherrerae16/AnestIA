# Reglas de seguridad clínica (CS1–CS8)

Reglas NO negociables del sistema. AnestIA produce documentos médico-legales firmados por un
anestesiólogo, responsable final. Fuente de verdad del dominio: `docs/prompt-maestro-v2.md` y
las "Reglas de oro" de `CLAUDE.md`. Este archivo es la referencia operativa de las reglas CS
citadas en las historias (`aidlc-docs/inception/user-stories/stories.md`) y en el código.

Leyenda: **CS1** HITL · **CS2** no-fabricación + `fuente` · **CS3** examen/signos = `pendiente_examen`
y bloquea aprobación · **CS4** derivar-no-inventar · **CS5** salida estructurada Zod (rechaza campos
prohibidos) · **CS6** Zod en ambos bordes · **CS7** inmutabilidad + audit · **CS8** lógica GLP-1.

---

## CS1 — Human-in-the-loop (HITL)
La IA nunca autoenvía ni autoaprueba. Todo documento pasa por la aprobación explícita del
anestesiólogo, que es el responsable final. La aprobación se revalida en el servidor
(`approval.service.ts` `canApprove`), no sólo en la UI.

## CS2 — No fabricar; cada dato clínico lleva `fuente`
Nunca inventar antecedentes, medicamentos, alergias, laboratorios, resultados, complicaciones,
signos vitales ni hallazgos del examen físico. Cada campo poblado (`estado: 'ok'`) debe tener
`fuente` que rastree a un dato real: respuesta del paciente (`formulario:Pn`), valor extraído
(`sourceRef`), cálculo del sistema (`sistema:calculo`) o dato del anestesiólogo
(`anestesiologo:*`). Una `fuente` genérica, vacía o falsa (p. ej. `stub:*` tratado como real)
viola CS2. "Niega X" sólo si el paciente respondió "No" — un blanco nunca produce una negación.

## CS3 — Examen físico y signos vitales = `pendiente_examen`
En TODO flujo automático, los campos de examen físico y signos vitales salen `pendiente_examen`
con `valor: null` — nunca "normales" por defecto. `enforceGuardrails` los fuerza; los providers
devuelven `examen_fisico: {}`. El documento NO puede aprobarse mientras sigan pendientes
(`canApprove` bloquea). El anestesiólogo puede confirmar hallazgos normales por acción explícita
(`applyExamNormal`, `fuente: 'anestesiologo:examen-normal-confirmado'`), y aun así los campos
medidos (signos vitales, peso/talla) quedan pendientes hasta que él ingrese los valores medidos.

## CS4 — La IA deriva de datos reales; no inventa
Se permite DERIVAR de datos reales, marcado como derivado: IMC (cálculo por código),
diagnóstico preoperatorio (del procedimiento), ASA (de comorbilidades declaradas), borrador de
plan/concepto y recomendaciones. No se permite afirmar lo no evaluado (p. ej. capacidad
funcional en METs, aptitud) — eso lo pone el anestesiólogo tras el examen presencial.

## CS5 — Salida estructurada siempre, campos prohibidos rechazados
El motor clínico devuelve JSON validado por Zod (`documentSchema`). Cualquier salida mal formada
o que pueble campos fuera del contrato del Diseño Oficial se rechaza. Las claves permitidas por
sección están restringidas en `documentSchema` (borde compartido), no sólo dentro del provider.
`paraclinicos` es la excepción (claves dinámicas por tipo de estudio extraído).

## CS6 — Zod en cada borde
Ningún endpoint sin validación Zod de entrada y salida. El mismo esquema valida frontend, API y
la salida de la IA.

## CS7 — Trazabilidad e inmutabilidad
La versión aprobada es inmutable (snapshot + hash) y todo cambio queda en el audit log (quién,
qué, cuándo). Reabrir un caso aprobado es una acción trazable.

## CS8 — Lógica GLP-1
La detección de uso de agonistas GLP-1 se hace de datos declarados por el paciente (P15
medicamentos); nunca se dispara sin sustento. Su presencia añade recomendaciones marcadas como
derivadas y una alerta.

---

**Aplicación en código:** `packages/shared/src/clinical.ts` (`enforceGuardrails`, `EXAM_FIELDS`),
`packages/shared/src/document.ts` (contrato + claves permitidas), `packages/shared/src/auditor.ts`
(auditor independiente), `apps/api/lib/services/approval.service.ts` (`canApprove`, inmutabilidad),
`apps/api/lib/ai/` (providers detrás del adaptador). Tests de guardarraíles en
`packages/shared/src/clinical.test.ts` y `apps/api/lib/ai/stub.test.ts`.
