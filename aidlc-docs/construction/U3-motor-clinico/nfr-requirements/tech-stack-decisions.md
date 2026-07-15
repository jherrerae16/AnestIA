# U3 — Tech Stack Decisions

| Concern | Choice | Rationale |
|---|---|---|
| Salida estructurada | Vercel AI SDK `generateObject` + documentSchema (Zod) | PRD; fuerza el contrato, rechaza malformado. |
| System prompt | docs/prompt-maestro-v2.md (cargado como texto) | Jerarquía documental. |
| IMC / ASA | Código puro (shared) | Determinístico, no LLM (CS4). |
| Modelo objetivo | Opus (claude-opus-…) vía AI_PROVIDER=anthropic | PRD; diferido a la key. |
| Guardarraíles | `enforceGuardrails` post-parse | Segunda línea sobre el schema. |
| Tests | Vitest + fast-check | PBT. |

## Secrets (U3)
- ANTHROPIC_API_KEY — necesaria SÓLO para AI_PROVIDER=anthropic. Stub cubre el flujo completo aguas abajo (U4-U6).
