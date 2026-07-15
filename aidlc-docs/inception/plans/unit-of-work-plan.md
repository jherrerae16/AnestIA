# Unit of Work Plan — AnestIA

Decompose the system into units. AnestIA is a **monolith with logical modules** (single deployable app), NOT microservices. Units = the 8 build phases from `docs/implementation-prompt.md`, developed **sequentially** (each meets acceptance before the next). Story→unit mapping already exists in stories.md `[Fase N]` tags.

## Proposed decomposition (recommended)
| Unit | Module | Stories | Depends on |
|---|---|---|---|
| U0 | Fundaciones | US-0.1, US-0.2 | — |
| U1 | Captura | US-1.1…1.7 | U0 |
| U2 | Lab Intelligence | US-2.1…2.3 | U1 |
| U3 | Motor clínico | US-3.1…3.3 | U2 |
| U4 | Documento | US-4.1 | U3 |
| U5 | Revisión/aprobación HITL | US-5.1…5.5 | U4 |
| U6 | Distribución e historial | US-6.1…6.5 | U5 |
| U7 | Afinado | US-7.1…7.3 | U0–U6 |

Sequential because each unit consumes the prior unit's output (form → labs → clinical → document → review → distribution). This is a hard data dependency, not a preference.

---

## Question 1 — Secuencia de unidades
¿Confirmas 8 unidades secuenciales (U0→U7) tal como el plan de fases?

A) Sí — 8 unidades secuenciales, cada una con su gate de aceptación antes de la siguiente. (recomendado — dependencia de datos real)
B) Reagrupar/fusionar algunas unidades (dime cuáles).
X) Other (describe después de [Answer]:)

[Answer]: A

## Question 2 — Cadencia de aprobación dentro de cada unidad
Dentro de cada unidad, Construction corre: Functional Design → NFR Requirements → NFR Design → Code Generation (Planning+Generation) → [Build&Test al final de todas]. Cada sub-etapa tiene su gate de aprobación (regla AIDLC). Para una unidad grande esto son ~5 gates. ¿Prefieres?

A) Gates completos por sub-etapa (máxima trazabilidad AIDLC; más pausas por unidad). (recomendado para cumplir estricto)
B) Gate consolidado por unidad — presento el diseño completo de la unidad (FD+NFR juntos) en UN gate, luego Code Gen en otro. Menos pausas, sigue habiendo aprobación humana antes de codificar.
X) Other (describe después de [Answer]:)

[Answer]: B

---

## Execution Checklist (after approval)
- [x] `unit-of-work.md` — unit definitions, responsibilities, code organization strategy (greenfield).
- [x] `unit-of-work-dependency.md` — dependency matrix + build order.
- [x] `unit-of-work-story-map.md` — every story mapped to a unit (coverage check).
- [x] Validate unit boundaries + all stories assigned.
