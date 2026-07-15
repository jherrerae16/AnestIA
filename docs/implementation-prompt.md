# Implementation Prompt — AnestIA (AI-DLC por fases)

Este documento guía la construcción de AnestIA con Claude Code. Se avanza **fase por fase**;
no pasar a la siguiente hasta cumplir los criterios de aceptación de la actual.
La fuente de verdad de requisitos es `docs/PRD_AnestIA.md` y las reglas de `CLAUDE.md`.

## Hats (roles de trabajo)

Al abordar cada tarea, ponte el "hat" que corresponda y anúncialo:

- 🏛️ **Architect** — estructura de carpetas, modelos, contratos Zod, decisiones transversales.
- ⚙️ **Backend** — Next.js API Routes, Prisma, pg-boss, adaptador de IA, storage.
- 🎨 **Frontend** — Angular (panel del anestesiólogo + formulario del paciente).
- 🧠 **Clinical-AI** — motor clínico, extracción de labs, prompt, esquemas de salida.
- 🖨️ **Document** — render del PDF fiel al Diseño Oficial (Playwright).
- ✅ **QA** — pruebas, validación de campos, casos límite, verificación de reglas de seguridad.
- 🔍 **Reviewer** — revisa que se cumplan las reglas de oro antes de cerrar cada fase.

## Regla transversal (aplica a TODAS las fases)

No violar nunca las **reglas de oro** de `CLAUDE.md` ni `.claude/rules/clinical-safety.md`.
Todo endpoint valida entrada/salida con Zod. Nada de fabricar datos clínicos.

---

## Fase 0 — Fundaciones 🏛️

**Objetivo:** esqueleto ejecutable del proyecto.
- Monorepo (Next.js API + Angular) con TypeScript, sin contenedores.
- PostgreSQL + pgvector local; aplicar `prisma/schema.prisma` (migración inicial).
- `npm run seed`: sembrar el perfil **"Luquetta"** y el **preset base** (22 preguntas de `docs/form-mapping.md`).
- Sign in simple para el perfil único (sin registro masivo).
- Esqueleto de `lib/schemas/` (Zod), `lib/ai/` (adaptador con `stub`), `lib/queue/` (pg-boss).

**Aceptación:** la app corre, la BD migra, el seed crea a Luquetta y su preset, se puede iniciar sesión.

## Fase 1 — Captura 🎨⚙️

**Objetivo:** reemplazar por completo el Google Form.
- Constructor/editor de presets (crear, nombrar, versionar; tipos de pregunta; obligatorias; condicional).
- Crear caso → generar enlace tokenizado con botón **copiar** (envío manual por WhatsApp).
- **Formulario del paciente**: nativo, responsive mobile-first, branded con el logo del perfil.
  Incluye consentimiento Ley 1581 al inicio y **carga de adjuntos** (labs/ECG/eco/imágenes).
- Guardado parcial (no dispara pipeline); `submit` sí dispara `form.submitted`.
- Respuestas y adjuntos persistidos en PostgreSQL (fuente de verdad).

**Aceptación:** un paciente abre el enlace, responde, adjunta un examen y envía; queda un `Case` con
`FormResponse` + `Attachment`, y se emite el evento.

## Fase 2 — Lab Intelligence 🧠⚙️

**Objetivo:** leer exámenes y detectar alertas rojas.
- Job `lab.extract`: extrae valores desde PDF/imagen con **Claude visión** (vía adaptador; con la key
  hace la llamada real, sin key el `stub` devuelve valores de ejemplo). **Solo valores presentes.**
- Guardar `ExtractedLabResult` con `sourceRef` (trazable a la fuente para verificación).
- Job `lab.flag`: comparar contra `docs/lab-rules.md` → `NORMAL | ALERTA | CRITICO` (determinístico).
- Detección de **GLP-1** declarado en el formulario → marca para la lógica de broncoaspiración.

**Aceptación:** al cargar un hemograma se extraen los analitos, se marcan los fuera de rango, y nunca
se inventa un valor ausente.

## Fase 3 — Motor clínico 🧠

**Objetivo:** generar el borrador estructurado de la valoración.
- Job `clinical.generate`: usa `docs/prompt-maestro-v2.md` como system prompt + `generateObject` con
  esquema Zod (contrato de salida). Entradas: respuestas + labs extraídos.
- Deriva IMC (código), diagnóstico, ASA, borrador de concepto/plan/recomendaciones.
- **Examen físico y signos vitales → `pendiente_examen`** (nunca inventar).
- Lógica GLP-1 → recomendaciones de ayuno / riesgo de contenido gástrico.
- Persistir `GeneratedAssessment` con `promptVersion` y `modelUsed`.

**Aceptación:** con el caso de referencia del Diseño Oficial, el motor produce un JSON válido, con
examen físico pendiente, ASA justificado y la lógica GLP-1 aplicada; una salida mal formada se rechaza.

## Fase 4 — Documento 🖨️

**Objetivo:** PDF fiel al Diseño Oficial.
- Plantilla HTML/CSS según `docs/diseno-oficial.md`; render con **Playwright**.
- Logo y firma tomados del perfil (Luquetta). Campos nuevos: grupo sanguíneo, transfusiones, prótesis dental.
- No renderizar como final si hay campos obligatorios vacíos o examen físico pendiente.

**Aceptación:** el borrador se ve igual al Diseño Oficial, una sola página, con el branding del perfil.

## Fase 5 — Revisión y aprobación (HITL) ✅

**Objetivo:** el gate humano.
- Vista lado a lado: borrador + respuestas fuente + labs (con su `sourceRef`).
- Resaltar: campos derivados por IA, alertas de laboratorio, inconsistencias, examen físico pendiente.
- Edición en línea. **Bloquear aprobación** si hay obligatorios vacíos o examen pendiente.
- Botón "cargar examen normal" (confirmación activa) + edición de valores reales.
- Al aprobar: bloquear versión, aplicar firma visual, timestamp, `ApprovalRecord`, PDF inmutable, audit log.

**Aceptación:** no se puede aprobar con examen pendiente; al aprobar queda un PDF inmutable firmado.

## Fase 6 — Distribución e historial ⚙️🎨

**Objetivo:** cerrar el ciclo.
- Distribuir el PDF seleccionando contactos del **directorio** (no escribir correos a mano); alta rápida.
- Registrar `DeliveryRecord` (envío/acceso) en audit log.
- **Base de datos e historial de pacientes:** búsqueda por documento/nombre; ficha con historial;
  precarga de datos al crear un caso para un paciente existente.
- Dashboard de casos por estado.

**Aceptación:** se envía el reporte a un contacto del directorio y el paciente aparece en su historial.

## Fase 7 — Afinado 🔍✅

- Auditoría completa, manejo de errores/reintentos en jobs, seguridad, cifrado, pruebas.
- Repaso final de cumplimiento (Ley 1581, inmutabilidad, HITL) por el hat Reviewer.

---

## Integración de la key (cuando llegue)

Cambiar el flag del adaptador de `stub` a `anthropic` y definir `ANTHROPIC_API_KEY`. Debe ser el
**único** cambio para activar la IA real en Fases 2 y 3. Verificar que el resto del sistema no dependía
del LLM.
