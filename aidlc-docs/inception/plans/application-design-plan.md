# Application Design Plan — AnestIA

High-level components, methods, services, dependencies. Stack is fixed (PRD §9 / CLAUDE.md), so questions are about **layout and interface shape**, not tech choice. Answer 5 questions, approve plan → I generate the 5 design artifacts.

## Proposed defaults (recommended)
- **Monorepo**: npm workspaces — `apps/api` (Next.js), `apps/web` (Angular), `packages/shared` (Zod schemas + types shared by both), plus top-level `lib/` used by the API for adapters/engines. Prisma at root `prisma/`.
- **Adapters** (single change point each): `lib/ai/` (stub|anthropic), `lib/storage/` (local|s3), `lib/mailer/` (gmail-smtp|stub), `lib/sheets/` (noop|google). Each exposes a narrow interface + a factory reading an env flag.
- **Pipeline**: pg-boss workers, one handler per job (`lab.extract`, `lab.flag`, `clinical.generate`, `document.render`), chained; idempotent; state transitions persisted on the Case.
- **Clinical field contract**: every document field = `{ valor, estado, fuente, alerta?, nota? }` (matches prompt-maestro D.8), one Zod schema shared FE/API/AI.

---

## Question 1 — Monorepo layout
¿Confirmas el layout de workspaces?

A) npm workspaces: `apps/api` (Next.js) · `apps/web` (Angular) · `packages/shared` (Zod/tipos) · `lib/` (adaptadores+engines, usados por api) · `prisma/` raíz. (recomendado)
B) Dos carpetas planas `api/` y `web/` sin workspaces, schemas duplicados/copiados.
C) Todo dentro de Next.js (Angular servido aparte), sin monorepo formal.
X) Other (describe después de [Answer]:)

[Answer]: A

## Question 2 — Forma del adaptador de IA
El flag stub↔anthropic. ¿Cómo lo expongo?

A) Interfaz `AIProvider` con 2 métodos: `extractLabs(files): ExtractedLab[]` y `generateAssessment(input): AssessmentJSON`; factory `getAIProvider()` lee `AI_PROVIDER=stub|anthropic`. Stub devuelve el caso de referencia (Uribe) del Anexo C. (recomendado)
B) Un solo método genérico `run(task, payload)` con switch interno.
X) Other (describe después de [Answer]:)

[Answer]: A
## Question 3 — Granularidad de workers del pipeline
`form.submitted` dispara el pipeline. ¿Cómo encadeno?

A) 4 jobs separados encadenados (`lab.extract`→`lab.flag`→`clinical.generate`→`document.render`), cada uno reintentable e idempotente, cada uno actualiza el estado del Case. (recomendado — trazable, reintentos finos)
B) Un solo job monolítico que hace todo (más simple, menos reintentable).
X) Other (describe después de [Answer]:)

[Answer]: A

## Question 4 — Patrón de auth/autorización en la API
Sesión de Luquetta + rutas del panel + enlaces tokenizados del paciente. ¿Patrón?

A) Middleware Next.js: rutas `/api/panel/**` requieren sesión (deny-by-default, cookie httpOnly); rutas `/api/form/[token]/**` validan el token del caso (autorización a nivel de objeto, sin sesión). Descargas del PDF por token. (recomendado — cumple SECURITY-08)
B) Chequeo de auth ad-hoc dentro de cada handler.
X) Other (describe después de [Answer]:)

[Answer]: A

## Question 5 — Esquema del documento clínico (contrato de salida)
El motor devuelve el documento como JSON. ¿Estructura del esquema Zod?

A) Un esquema anidado por secciones del Diseño Oficial (identificacion, antecedentes, paraclinicos, examen_fisico, valoracion_plan), donde cada CAMPO es `{valor, estado, fuente, alerta?, nota?}`. Un solo `documentSchema` compartido FE/API/AI, y es el que `generateObject` fuerza. (recomendado)
B) Esquema plano (lista de campos con clave/valor/estado).
X) Other (describe después de [Answer]:)

[Answer]: A

---

## Execution Checklist (after approval)
- [x] `components.md` — components + responsibilities + interfaces.
- [x] `component-methods.md` — method signatures + I/O types (business rules deferred to Functional Design).
- [x] `services.md` — service definitions + orchestration (pipeline, auth, distribution).
- [x] `component-dependency.md` — dependency matrix + communication patterns + data flow.
- [x] `application-design.md` — consolidated doc.
- [x] Validate completeness + consistency vs requirements/stories.
