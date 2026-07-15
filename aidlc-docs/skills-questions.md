# Skills Installation — Questions

Instalé las skills de `INSTALAR_SKILLS.md`. Resultado:

- ✅ **Angular (10/10)** — todas instaladas en `.agents/skills/`
- ✅ **web-design-guidelines** — instalada
- ✅ **supabase-postgres-best-practices** — instalada
- ⚠️ **frontend-design** — YA NO está en `vercel-labs/agent-skills`, PERO existe como skill integrada de Anthropic (usable ahora mismo). INSTALAR_SKILLS.md ya contemplaba esta alternativa.
- ❌ **Next.js (0/3)** — `next-best-practices`, `next-upgrade`, `next-cache-components` YA NO existen en `vercel-labs/next-skills`. El repo se reestructuró desde que se escribió INSTALAR_SKILLS.md ("No skills found").

Las skills de Next.js NO bloquean Inception ni Fase 0 (no hay código Next todavía; se necesitarían en Fase 1+). Cómo procedo:

## Question 1
Las 3 skills de Next.js ya no están disponibles en el repo indicado. ¿Cómo procedo?

A) Continuar sin ellas — usar mi conocimiento actualizado de Next.js (App Router, RSC, Route Handlers, caching) directamente; no bloquea nada. Uso la skill built-in `next-best-practices` de Claude si aparece disponible.
B) Buscar el repo/nombre correcto de las skills de Next.js (pueden haberse movido a otro repo u otra convención de nombres) e instalarlas antes de seguir.
C) Pausar todo hasta que tú confirmes de dónde instalar las skills de Next.js actualizadas.
D) Other (describe después de [Answer]:)

[Answer]: A

## Question 2
Para `frontend-design`: uso la skill integrada de Anthropic (equivalente, disponible ya) en lugar de la de vercel-labs que ya no existe. ¿De acuerdo?

A) Sí — usar la `frontend-design` integrada de Anthropic
B) No — buscar/instalar otra fuente para frontend-design
C) Other (describe después de [Answer]:)

[Answer]: A
