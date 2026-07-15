# Instalar Agent Skills — AnestIA

Ejecuta estos comandos en la raíz del proyecto **antes de arrancar** el desarrollo. Son las mismas 16
skills del proyecto KI (mismo stack: Angular 19+ · Next.js · PostgreSQL · Zod · Prisma).
Se instalan una sola vez; Claude Code las lee automáticamente y aplica las mejores prácticas actualizadas.

**Total: 16 skills** — 10 Angular · 3 Next.js · 2 UI/UX · 1 PostgreSQL

---

## ANGULAR — analogjs/angular-skills (10)
Repo: https://github.com/analogjs/angular-skills

```bash
npx skills add analogjs/angular-skills --skill angular-component   # standalone, signal inputs/outputs, OnPush, host bindings
npx skills add analogjs/angular-skills --skill angular-signals     # signal(), computed(), linkedSignal(), effect(), toSignal()
npx skills add analogjs/angular-skills --skill angular-di          # inject(), injection tokens, providers
npx skills add analogjs/angular-skills --skill angular-directives  # attribute/host directives, composición
npx skills add analogjs/angular-skills --skill angular-forms       # formularios con signals, validación por schema
npx skills add analogjs/angular-skills --skill angular-http        # httpResource(), resource(), interceptores funcionales
npx skills add analogjs/angular-skills --skill angular-routing     # lazy loading, guards/resolvers funcionales, input.fromRoute()
npx skills add analogjs/angular-skills --skill angular-ssr         # server-side rendering
npx skills add analogjs/angular-skills --skill angular-testing     # testing moderno con signals
npx skills add analogjs/angular-skills --skill angular-tooling     # CLI, configuración, build optimization
```

## NEXT.JS — vercel-labs/next-skills (3)
Repo: https://github.com/vercel-labs/next-skills

```bash
npx skills add vercel-labs/next-skills --skill next-best-practices    # RSC, data fetching, file conventions (background)
npx skills add vercel-labs/next-skills --skill next-upgrade           # guías de migración entre versiones
npx skills add vercel-labs/next-skills --skill next-cache-components   # 'use cache', cacheLife(), cacheTag()
```

## UI / UX — vercel-labs/agent-skills (2)
Repo: https://github.com/vercel-labs/agent-skills

```bash
npx skills add vercel-labs/agent-skills --skill web-design-guidelines # audita UI: 100+ reglas de accesibilidad/UX
npx skills add vercel-labs/agent-skills --skill frontend-design       # diseño visual: estilos, paletas, tipografía
```
> `frontend-design` también existe como skill integrada de Anthropic. Usa la que prefieras.

## POSTGRESQL — supabase/agent-skills (1)
Repo: https://github.com/supabase/agent-skills

```bash
npx skills add https://github.com/supabase/agent-skills --skill supabase-postgres-best-practices  # query perf, RLS, JSONB, índices
```

---

## Verificar
```bash
npx skills list   # deberías ver las 16 instaladas
```

## Qué aporta cada grupo a AnestIA

| Skill(s) | Uso en AnestIA |
|---|---|
| Angular (10) | Panel del anestesiólogo (dashboard, revisión/aprobación) y **formulario del paciente** con signals, standalone y OnPush desde el día 1 |
| Next.js (3) | API Routes `/api/**` con validación Zod; RSC, caching y file conventions |
| `web-design-guidelines` | Auditar accesibilidad y contraste del formulario del paciente, la pantalla de revisión y las alertas rojas de laboratorio |
| `frontend-design` | Dirección visual del panel y del formulario branded del paciente |
| `supabase-postgres-best-practices` | Queries de casos/pacientes, campos JSONB (`answers`, `fields`), índices, y pgvector si se usa RAG sobre el Manual Clínico |
