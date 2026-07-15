# U2 — Tech Stack Decisions

| Concern | Choice | Rationale |
|---|---|---|
| Extracción | AIProvider.extractLabs (adapter U0) | stub ahora; anthropic (visión) con key — punto único. |
| Reglas de flag | Tabla `LAB_RULES` en shared (pura) | Determinístico, testeable (PBT oracle). |
| Parseo numérico | Extraer número de strings ("15.9 g/dL"→15.9) | Tolerante a unidades. |
| GLP-1 | Lista + normalización (NFD, lowercase) | Detección robusta. |
| Handlers | pg-boss `work(queue, handler)` en worker | Pipeline event-driven. |
| Tests | Vitest + fast-check | PBT. |

## Secrets (U2)
- ANTHROPIC_API_KEY — sólo cuando AI_PROVIDER=anthropic (diferido). Stub no requiere secreto.
