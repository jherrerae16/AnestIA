# AnestIA

Plataforma de valoración preanestésica automatizada. Formulario al paciente → análisis de exámenes →
generación del documento clínico con IA → revisión y aprobación del anestesiólogo → distribución.

## Requisitos
- Node.js LTS · PostgreSQL 16 con extensión `pgvector` (instalación LTS, sin contenedores).

## Puesta en marcha
```bash
cp .env.example .env         # completar DATABASE_URL
npm install
npx prisma migrate dev       # crea el esquema
npm run seed                 # siembra el perfil "Luquetta" + preset base
npm run dev                  # API (Next.js) + panel (Angular)
npm run worker               # workers de la cola (pg-boss)
```

## Estado (AI-DLC por fases)
Inception completa. Construcción: **U0 Fundaciones ✅ · U1 Captura ✅ · U2 Lab Intelligence ✅ · U3 Motor clínico ✅ · U4 Documento ✅ · U5 Revisión/HITL ✅ · U6 Distribución ✅**. Piloto funcional de punta a punta con la key real (Claude). En afinado: editor de cuestionarios, recuperación de casos atascados. Artefactos en `aidlc-docs/`.

## Documentación
- `CLAUDE.md` — contexto operativo y reglas de oro.
- `docs/PRD_AnestIA.md` — requisitos completos.
- `docs/implementation-prompt.md` — plan de construcción por fases.
- `docs/prompt-maestro-v2.md` — system prompt del motor clínico.
- `docs/diseno-oficial.md` · `docs/form-mapping.md` · `docs/lab-rules.md` — especificaciones de dominio.

## IA
El LLM (Claude) se integra con `ANTHROPIC_API_KEY`. Sin key, `AI_PROVIDER=stub` permite construir y
probar todo el flujo. Al integrar la key: `AI_PROVIDER=anthropic` (único punto de cambio).

**Modelo por tarea:** el motor clínico usa Opus (juicio médico que el anestesiólogo firma); la
extracción de labs usa Haiku sobre texto embebido y Sonnet como fallback de visión.

**Extracción de labs en cascada** (`LAB_EXTRACTION_MODE`):
- `capas` — lee el texto del PDF (unpdf, cero tokens) → Haiku a JSON; si el PDF es escaneado o
  ilegible, escala automáticamente a visión. ~80% más barato que visión pura.
- `vision` — fuerza visión (Sonnet) sobre todos los archivos.
- `comparativo` — corre ambos, persiste visión y registra el diff en audit log para decidir la
  migración con datos.

> Sistema de apoyo a la documentación clínica. El anestesiólogo es el responsable final; toda
> valoración pasa por su aprobación (HITL).
