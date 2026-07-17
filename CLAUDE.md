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
├── docs/                        ← fuente de verdad del dominio
│   ├── PRD_AnestIA.md           ← requisitos completos
│   ├── prompt-maestro-v2.md     ← system prompt del motor clínico
│   ├── diseno-oficial.md        ← spec de la plantilla de salida (PDF)
│   ├── form-mapping.md          ← 22 preguntas → campos del documento
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

**Pendientes conocidos:** editor de cuestionarios propios; reconciliador de casos atascados;
decisión sobre la exportación a Google Sheets; rotar la key (hoy en claro en `.env`).
