# U5 HITL — Consolidated Design Plan (FD + NFR)

U5 = el gate humano médico-legal. Vista de revisión + edición + confirmación de examen + **aprobación bloqueante** + firma → PDF inmutable. Stories US-5.1…5.5.

## Alcance
- **Vista de revisión (panel)**: borrador + respuestas fuente + labs (con sourceRef) lado a lado; resalta campos derivados por IA, alertas, examen pendiente.
- **Edición en línea**: editar cualquier campo del assessment antes de aprobar (guardado en ApprovalRecord.edits).
- **Examen físico**: ingresar valores reales o "cargar examen normal" (confirmación activa) → limpia estado pendiente.
- **Aprobación BLOQUEANTE**: `canApprove` devuelve blockers si hay obligatorias vacías o examen pendiente. No se puede aprobar hasta resolverlos (CS3/CS1).
- **Al aprobar**: bloquear versión, aplicar firma, timestamp+aprobador, **PDF final inmutable** (sin marca de agua), ApprovalRecord, audit (CS7). Estado → APROBADO.
- **Rechazar**: reabre el formulario al paciente.

## Testable Properties (PBT-01)
- **canApprove** — invariante: examen pendiente O obligatoria vacía ⇒ NO aprobable; ambos resueltos ⇒ aprobable.
- **applyEdits** — round-trip / no pierde campos.

## Extension compliance (U5)
- Security: 08 (rutas panel por sesión + ownership del caso), 05 (validación edits), 15 (fail-closed), 14/13 (audit inmutable).
- PBT: canApprove invariante, applyEdits.

---

## Question 1 — Campos de "cargar examen normal"
Botón "cargar examen normal" rellena el examen físico con valores normales por defecto (confirmación ACTIVA del anestesiólogo). ¿Qué valores?

A) Valores normales estándar: TA 120/80, FC 72, FR 16, SatO2 98%; vía aérea Mallampati I, AO>4cm, DTM>6cm; cuello/CV/resp/abdomen/extremidades/SNC "sin hallazgos". Marcados fuente=anestesiologo (confirmados por él, no inventados por IA). Editables. (recomendado)
B) Sólo marca los campos como "confirmados normales" sin valores numéricos concretos.
X) Other (describe después de [Answer]:)

[Answer]: A

## Question 2 — Mecanismo de inmutabilidad
Al aprobar, la versión queda inmutable. ¿Cómo lo garantizo en el piloto?

A) ApprovalRecord guarda el snapshot de los fields aprobados (JSON) + hash + lockedPdfUrl (PDF final sin marca de agua). El GeneratedAssessment ya no se edita tras aprobar (guard en API). Audit registra la aprobación. (recomendado)
X) Other (describe después de [Answer]:)

[Answer]: A

## Question 3 — Firma
El PDF final lleva la firma visual del perfil. ¿Algo más que la imagen + nombre + registro?

A) Firma visual (imagen del perfil) + nombre + especialidad + registro + timestamp de aprobación + leyenda "Documento aprobado y firmado electrónicamente por el anestesiólogo tratante". (recomendado)
X) Other (describe después de [Answer]:)

[Answer]: A

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
