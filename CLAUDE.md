# CLAUDE.md — AnestIA

Plataforma de **valoración preanestésica automatizada**. Automatiza el ciclo completo:
formulario al paciente → carga y análisis de exámenes → generación del documento clínico
con IA → revisión y aprobación del anestesiólogo → distribución del PDF firmado.

> Documento maestro de requisitos: `docs/PRD_AnestIA.md`. Ante cualquier duda de alcance,
> ese PRD manda. Este archivo es el contexto operativo del día a día.

## Stack (sin contenedores, instalación LTS)

- **Frontend:** Angular 19+ (standalone components, signals, zoneless).
- **Backend:** Next.js (API Routes), TypeScript.
- **Validación:** Zod, de punta a punta. El mismo esquema Zod valida frontend, API y la salida de la IA.
- **ORM / BD:** Prisma sobre PostgreSQL 16 + pgvector.
- **IA:** Vercel AI SDK con proveedor Anthropic (Claude). Salida estructurada con `generateObject` + Zod.
- **Extracción de labs:** Claude con visión vía AI SDK (no OCR tradicional).
- **PDF:** Playwright (headless Chromium) sobre plantilla HTML/CSS.
- **Cola de trabajos:** pg-boss (respaldada en PostgreSQL).
- **Charts:** Chart.js. **Parseo tabular:** xlsx.

## Reglas de oro (NO negociables)

1. **Seguridad clínica primero.** Este sistema produce documentos médico-legales firmados por un
   anestesiólogo, que es el responsable final. Todo pasa por su aprobación (HITL). La IA nunca autoenvía.
2. **No inferir sin sustento.** Nunca fabricar antecedentes, medicamentos, alergias, laboratorios,
   resultados, complicaciones, signos vitales ni hallazgos del examen físico. Cada dato clínico debe
   tener `fuente` (respuesta del paciente, valor extraído, o dato del anestesiólogo).
3. **Examen físico y signos vitales = `pendiente_examen`.** Nunca se generan "normales" por defecto.
   El documento no se puede aprobar mientras sigan pendientes.
4. **La IA puede derivar (de datos reales), no inventar:** IMC (cálculo), diagnóstico preoperatorio,
   ASA, borrador de plan/concepto y recomendaciones.
5. **Salida estructurada siempre.** El motor clínico devuelve JSON validado por Zod (`generateObject`).
   Cualquier salida mal formada o que pueble campos prohibidos se rechaza.
6. **Zod en cada borde.** Ningún endpoint sin validación de entrada y salida.
7. **Trazabilidad.** Versión aprobada = inmutable + audit log (quién, qué, cuándo).

Detalle clínico completo: `docs/prompt-maestro-v2.md`. Regla resumida: `.claude/rules/clinical-safety.md`.

## Alcance del piloto

- **Perfil único sembrado: "Luquetta"** (Dr. Jorge A. Luquetta). Sin registro ni logins masivos aún;
  sign in simple. La BD ya está modelada multi-anestesiólogo (no romper esa forma).
- **Envío al paciente = manual:** la plataforma genera un enlace tokenizado con botón de copiar;
  el anestesiólogo lo manda por su propio WhatsApp. **No** integrar WhatsApp Business API todavía.
- **LLM:** Claude vía key que se proveerá después. Mientras tanto, **stub tras adaptador**
  (ver "Estrategia de IA"). Modelo objetivo: Opus para lo clínico.
- **Hosting:** desarrollo local; decisión de nube diferida. Mantener todo cloud-agnóstico.
- **Firma:** visual (imagen PNG/PDF del perfil, pegada en el PDF). Firma certificada = opcional, futura.

## Estrategia de IA (clave para avanzar sin la key)

Toda llamada al LLM vive detrás de un **adaptador** (`lib/ai/`). `AI_PROVIDER` decide entre:
- `stub`: devuelve un JSON de ejemplo (caso de referencia del Diseño Oficial). Permite construir y
  probar TODO el flujo aguas abajo (PDF, revisión, aprobación, distribución) sin key.
- `anthropic`: llamada real vía el SDK de Anthropic (`@anthropic-ai/sdk`) cuando exista
  `ANTHROPIC_API_KEY`. (No es el Vercel AI SDK; la salida estructurada se fuerza con JSON Schema +
  validación Zod en el borde.)

**Solo dos funciones dependen de la key:** extracción de labs y el motor clínico. El resto del sistema
no toca el LLM. Cambiar de `stub` a `anthropic` es **un solo punto de cambio** (`lib/ai/index.ts`).

**Modelo por tarea** (no usar Opus para lo que Haiku resuelve):
- Motor clínico → **Opus** (`claude-opus-4-8`). Es juicio médico —ASA, riesgo, plan— que el
  anestesiólogo firma. Streaming + `stop_reason=max_tokens` chequeado (un documento truncado se
  rechaza, no se parsea a medias).
- Extracción de labs → **Haiku** (`claude-haiku-4-5`) sobre texto embebido; **Sonnet**
  (`claude-sonnet-5`) como fallback de visión para escaneados.

**Extracción de labs en cascada** (`LAB_EXTRACTION_MODE=capas|vision|comparativo`):
1. `unpdf` lee el texto embebido del PDF (cero tokens) y lo valida por código.
2. Si sirve → Haiku lo pasa a JSON estructurado (Zod).
3. Si el PDF es escaneado/ilegible → escala automáticamente a visión (Sonnet), por archivo y con el
   motivo registrado en audit log. Nunca es una decisión manual.
`comparativo` corre ambos métodos, persiste sólo visión (el conocido) y registra el diff
(`extraction.compared`) para decidir la migración con datos empíricos. Cada lab guarda su
`extractionMethod`. Ahorro medido: ~80% vs visión pura, misma precisión.

## Estructura del proyecto

```
anestia/
├── CLAUDE.md                    ← este archivo
├── prisma/schema.prisma         ← modelo de datos
├── packages/shared/src/
│   ├── dictionary/              ← FUENTE ÚNICA del cuestionario (134 ítems, códigos estables)
│   ├── rules.ts                 ← motor de activación + limpieza de respuestas ocultas
│   ├── facts.ts                 ← edad, banda etaria, ruta clínica (derivados, sin reloj)
│   └── answers.ts               ← ÚNICO módulo que indexa respuestas directamente
├── docs/                        ← fuente de verdad del dominio
│   ├── PRD_AnestIA.md           ← requisitos completos
│   ├── prompt-maestro-v2.md     ← system prompt del motor clínico
│   ├── diseno-oficial.md        ← spec de la plantilla de salida (PDF)
│   ├── form-mapping.md          ← GENERADO desde el diccionario (no editar a mano)
│   ├── lab-rules.md             ← rangos y alertas rojas
│   └── implementation-prompt.md ← plan de construcción por fases (hats)
└── .claude/
    ├── settings.json
    ├── rules/clinical-safety.md
    └── agents/                  ← subagentes ("hats" de AI-DLC)
```

## Convenciones de código

- **Angular:** standalone components, signals, control flow nativo (`@if`, `@for`); sin NgModules.
- **Next.js:** API Routes en `app/api/**/route.ts`; lógica de negocio en `lib/`, no en los handlers.
- **Zod:** los esquemas de dominio viven en `packages/shared/src/` y se comparten entre API,
  frontend e IA (mismo esquema valida los tres bordes).
- **Diccionario de preguntas:** `packages/shared/src/dictionary/` es la fuente única. De ahí se
  generan el seed, el bloque de preguntas del prompt clínico, las secciones de la UI y
  `docs/form-mapping.md` (con un test que falla si divergen). Los **códigos** (`ID01`, `CF01`)
  son la unidad de trazabilidad; el `order` es sólo presentación. Las respuestas se indexan por
  código, y sólo `answers.ts` las indexa directamente.
- **Prisma:** migraciones versionadas; nada de SQL crudo salvo pgvector.
- **Nombres y comentarios de dominio en español** (antecedentes, glosa, valoración, etc.).
- **Sin contenedores.** PostgreSQL y servicios como instalación LTS local.

## Comandos

```bash
npm run dev              # Next.js (API) + Angular en paralelo
npx prisma migrate dev   # aplica migraciones
npx prisma studio        # inspeccionar la BD
npm run seed             # siembra el perfil "Luquetta" y el preset base
npm run worker           # arranca los workers de pg-boss (pipeline)
```

## Flujo (event-driven)

`form.submitted` (el paciente envía) → cola pg-boss → extracción de labs (cascada) →
`lab.flag` (flagging determinístico por código) → `clinical.generate` (examen físico = pendiente)
→ `clinical.audit` (auditor independiente) → `document.render` (borrador) → notificación al
anestesiólogo → revisión/aprobación (HITL) → distribución. No hay polling: el disparador es el submit.

Cada etapa registra `pipeline.stage_failed` en el audit log si revienta (fail-closed pero no
silencioso). **Pendiente:** un reconciliador que re-emita `form.submitted` para casos con formulario
enviado y sin documento (hoy se recupera a mano).

## Estado de implementación (al día)

Piloto funcional de punta a punta con la key real. Lo construido en las últimas sesiones:

- **Motor clínico real** (Opus) tras el adaptador; auditor clínico independiente antes del render.
- **Extracción de labs en cascada** texto→visión con modo comparativo (ver *Estrategia de IA*).
- **Documento:** paraclínicos agrupados por tipo de estudio con fecha del informe y aviso de
  vigencia; pie de página por página; títulos en Sentence case.
- **Revisión:** el médico ve los exámenes originales (visor de adjuntos) y la ficha completa del
  paciente; labs agrupados con su fecha.
- **Seguridad clínica reforzada:** el examen "normal" ya no ateste cifras de signos vitales que
  nadie midió (quedan pendientes y bloquean la aprobación); no se traduce un procedimiento por
  coincidencia de letras ("lipoma" ≠ liposucción); el flagging reconoce los nombres largos de los
  informes reales; no se afirma "Niega X" cuando el paciente no respondió.
- **Móvil:** formulario del paciente y panel del médico responsive; tablas del panel como tarjetas
  en el celular (donde responde la mayoría de pacientes).

### Especificación del Dr. Luquetta (en curso)

Tres documentos rediseñan la captura: diccionario de datos mínimos, matriz de activación de
escalas y flujograma de direccionamiento. Plan por fases; **Fase 1A completa**:

- **Diccionario de 134 ítems** con códigos estables, reemplazando las 28 preguntas planas.
- **Motor de reglas declarativo** (`rules.ts`) sobre edad, agenda, multiselección y síntomas,
  con limpieza de respuestas de ramas cerradas.
- **Rutas por edad** derivadas de la fecha de nacimiento (pediátrica / adulta / adulto mayor).
- **Respuestas por código**: `formulario:CF01` en vez de `formulario:P14`.
- **Tres estados** (`SI_NO_NOSABE`): `No sabe` ya no puede colapsar en `No` (CS10).
- **Datos de agenda** (`PX01`–`PX11`) nunca se le muestran al paciente.
- **Corregido:** `capacidad_funcional` ya no afirma "≥ 4 METs" derivado de "no tengo
  enfermedades"; y se eliminó el estimado de signos vitales que escribía una SpO2 sin medir.

**Fase 1B completa** — el formulario del paciente:

- **Recorrido por pasos**: una pregunta o un grupo corto por pantalla (23-40 pantallas según la
  ruta), con las preguntas que abren ramas siempre solas para que nada aparezca ni desaparezca
  bajo el dedo.
- **Autoguardado en dos capas**: espejo en `localStorage` en cada cambio (salva al paciente
  cuando el navegador del móvil mata la pestaña) + guardado parcial al servidor con debounce.
  Antes sólo había un botón "Guardar" manual y cerrar la pestaña lo perdía todo.
- **Resumen final** que muestra sólo faltantes, "No sabe" e inconsistencias, con enlace directo
  a cada pregunta. Nunca se repite el cuestionario entero.
- **Tipos nuevos renderizados**: tres estados, acordeones con "Ninguna" excluyente, repetidor de
  medicamentos y `ARCHIVO` (que antes caía a un input de texto: al paciente se le pedía subir un
  examen y le salía una caja para escribir).
- **Las ramas cerradas se descartan** en cliente y servidor, así que el auditor deja de recibir
  contradicciones sobre datos fantasma.

La lógica (`buildScreens`, `summaryRows`, `pruneHiddenAnswers`) vive en `packages/shared` y está
cubierta por tests; el componente de Angular es un renderizador.

**Fase 2 completa** — la agenda quirúrgica:

- **Modelo `CaseSchedule`** con `PX01`–`PX11` como enums (no texto libre: los consumen ARISCAT,
  RCRI, Caprini y Apfel, y una escala no puede depender de que alguien escriba "abdominal alto"
  igual dos veces). `Case.procedure`/`procedureDate` quedan como read-model sincronizado, porque
  panel, calendario, exportación y recordatorio los leen.
- **El médico programa; el paciente no.** `case-creator` pasó de un input suelto a un formulario
  de agenda que dice, campo por campo, qué escala alimenta. Ninguna `PX` llega nunca al paciente.
- **Las ramas dependientes del procedimiento ya funcionan**: una lobectomía intratorácica de más
  de 3 h abre Caprini y el DASI completo (30 pantallas); una rinoplastia ambulatoria periférica
  no abre ninguna (24 pantallas).
- **Lo que falta se dice, no se supone.** `faltantesDeAgenda` alimenta un aviso al crear el caso
  y otro en la revisión: mientras falte una variable, las escalas que dependen de ella quedarán
  pendientes en vez de calcularse con supuestos.
- **`diffPresetVsDiccionario`** al arrancar el worker: el diccionario vive en TypeScript y las
  filas se materializan en el seed, así que cambiar una regla sin re-sembrar dejaba la base
  sirviendo la versión anterior — pasó, y en silencio.

**Fase 3 completa** — las ocho escalas:

- **DASI, STOP-Bang, Apfel, FRAIL, Caprini, RCRI, ARISCAT y POVOC** como funciones puras en
  `packages/shared/src/scales/`, con los cuatro estados de la spec y las variables exactas que
  sustentan cada resultado.
- **Las calcula el código, nunca el modelo.** Mismo patrón que los paraclínicos. Corren en el
  pipeline tras el flagging de labs, porque ARISCAT y RCRI consumen hemoglobina y creatinina ya
  validadas.
- **CS9 en un único punto** (`scales/resolve.ts`): una variable sólo entra si su procedencia está
  en la lista blanca. SpO2, vía aérea, CFS y ASA definitiva son exclusivamente del anestesiólogo
  — sin SpO2 medida, ARISCAT queda `PENDIENTE` en vez de completarse con una referencia.
- **Cortes versionados y retenidos**: las ocho están `SIN_VALIDAR`, así que se publica el puntaje
  y se retiene la categoría hasta que el Manual Clínico exista. El Dr. revisa `docs/escalas.md`,
  no código.
- **`escalas` es clave de primer nivel del documento**, con esquema propio: aplanarla a un
  `DocField` perdería la trazabilidad que exige el Doc 2. Banda nueva en el PDF con el estado y
  lo que falta.
- **Aprobación**: `PENDIENTE` no bloquea (bloquear empujaría a inventar el dato); un
  `REVISION_CLINICA` sin resolver, sí.

**Fase 4 completa** — procedencia y confianza de laboratorios:

- **Cada valor rastreable a su archivo y página.** `FileRef` lleva ahora el `attachmentId` y la
  extracción va archivo por archivo; antes se pasaba la clave de almacenamiento como "filename"
  y el id se perdía, así que un lab no se podía rastrear al PDF que lo produjo.
- **El original nunca se pierde**: `analyteRaw`, `valueRaw`, `unitRaw` junto a los normalizados.
- **Confianza y estado de extracción.** Por debajo de 0.7, sin unidad o sin archivo, el resultado
  pasa a `PENDIENTE_CONFIRMACION` y **no alimenta escalas ni alertas** hasta que el médico lo
  confirme.
- **Conversión de unidades con tabla cerrada** (`lab-units.ts`): lo que no tiene regla validada
  no se convierte. Las reglas usan el nombre canónico del analito.
- **Metadatos del archivo** (nombre, tipo, tamaño) que se descartaban al subirlo.

**Cierre de pendientes:**

- **Verificación de identidad de los informes** (§15): el documento manda; sin él, el nombre
  tolerando orden y partículas. `NO_VERIFICABLE` no es "no coincide" — se conserva y se marca.
  Una discordancia va siempre a revisión y no alimenta escalas.
- **`AP01` se repite por enfermedad** (§5): una instancia `AP01#<slug>` por cada diagnóstico
  marcado. El documento distingue lo controlado de lo que no, que es lo que cambia el ASA.
- **`collectedAt`**: fecha de toma de la muestra, distinta de la de emisión.
- **Jobs huérfanos**: un caso borrado ya no reintenta en bucle; el job se descarta.
- **`diffPresetVsDiccionario` comparaba cadenas** y Postgres reordena las claves de JSONB, así
  que avisaba siempre. Ahora compara estructuras.

Las cuatro fases de la especificación del Dr. Luquetta están completas.

**Pendientes conocidos:** editor de cuestionarios propios; reconciliador de casos atascados;
decisión sobre la exportación a Google Sheets; rotar la key (hoy en claro en `.env`).
