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

Toda llamada al LLM vive detrás de un **adaptador** (`lib/ai/`). Un flag decide entre:
- `stub`: devuelve un JSON de ejemplo (caso de referencia del Diseño Oficial). Permite construir y
  probar TODO el flujo aguas abajo (PDF, revisión, aprobación, distribución) sin key.
- `anthropic`: llamada real vía Vercel AI SDK cuando exista `ANTHROPIC_API_KEY`.

**Solo dos funciones dependen de la key:** extracción de labs por visión y el motor clínico. El resto
del sistema no toca el LLM. Cambiar de `stub` a `anthropic` debe ser **un solo punto de cambio**.

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
- **Zod:** los esquemas viven en `lib/schemas/` y se comparten entre API e IA.
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

`form.submitted` (el paciente envía) → cola pg-boss → `lab.extract` → `lab.flag` →
`clinical.generate` (examen físico = pendiente) → `document.render` (borrador) →
notificación al anestesiólogo → revisión/aprobación (HITL) → distribución.
No hay polling: el disparador es el submit.
