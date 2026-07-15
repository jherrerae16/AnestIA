# Story Generation Plan — AnestIA

Product-owner role. Convert PRD §7 (12 modules) + clinical-safety rules into user stories (INVEST) with acceptance criteria, plus personas. The PRD is exhaustive, so few decisions remain — mostly format/organization. Answer the 4 questions, then approve the plan.

## Proposed Approach (defaults)
- **Breakdown**: **Hybrid — Persona-grouped epics, feature-based stories inside** (anesthesiologist / patient / recipient / system). Each story maps to a PRD RF-x and to a build phase (Fase 0–7).
- **Format**: `As a <persona>, I want <capability>, so that <benefit>.` + Gherkin-style acceptance criteria (Given/When/Then), with clinical-safety criteria called out explicitly.
- **Granularity**: One story per user-visible capability (not per screen, not per RF sub-bullet). ~25–35 stories total.
- **Traceability**: Each story tagged with `[RF-x]` and `[Fase N]`.

---

## Planning Questions

## Question 1 — Story breakdown approach
¿Confirmas el enfoque híbrido (épicas por persona, historias por feature dentro), o prefieres otro?

A) Híbrido persona+feature (recomendado) — épicas por persona, historias por capability, cada una mapeada a RF-x y Fase N.
B) Solo feature-based (agrupadas por los 12 módulos del PRD).
C) Solo journey-based (siguen el flujo end-to-end del §6).
X) Other (describe después de [Answer]:)

[Answer]: A

## Question 2 — Nivel de detalle de criterios de aceptación
¿Qué formato de criterios de aceptación?

A) Gherkin Given/When/Then + criterios de seguridad clínica explícitos por historia (recomendado — feed directo a tests PBT + example-based).
B) Lista simple de bullets (checklist) por historia.
X) Other (describe después de [Answer]:)

[Answer]: A

## Question 3 — Personas a documentar
El PRD §5 lista: anestesiólogo, paciente, administrador de clínica, destinatario, auxiliar. En el piloto solo hay perfil único y envío manual. ¿Qué personas documento?

A) Solo las 3 activas del piloto: Anestesiólogo (Luquetta), Paciente, Destinatario. Admin/auxiliar como "personas futuras" mencionadas sin historias. (recomendado)
B) Las 5 completas del PRD, con historias para todas (incluye admin/auxiliar aunque estén fuera del piloto).
X) Other (describe después de [Answer]:)

[Answer]: A

## Question 4 — Alcance de las historias
¿Las historias cubren solo el piloto o el producto completo del PRD?

A) Piloto — historias para lo que se construye ahora (Fases 0–7 tal como están, con los deltas del piloto: envío manual, stub IA, SMTP real, etc.). Extensiones futuras solo se listan. (recomendado)
B) Producto completo — incluir historias de extensiones futuras (WhatsApp API, firma certificada, HL7/FHIR, multi-clínica).
X) Other (describe después de [Answer]:)

[Answer]: A

---

## Execution Checklist (runs after plan approval)
- [x] Generate `personas.md` (per Q3 decision) — archetype, goals, context, pains, access mode.
- [x] Generate `stories.md` — persona-grouped epics; stories in `As a / I want / so that` + acceptance criteria (per Q2).
- [x] Ensure every story is Independent, Negotiable, Valuable, Estimable, Small, Testable (INVEST).
- [x] Tag each story with `[RF-x]` and `[Fase N]`.
- [x] Call out clinical-safety acceptance criteria explicitly (HITL blocks, no-fabrication, exam-pending, immutability).
- [x] Map personas → stories.
- [x] Cross-check coverage: all 12 PRD modules represented; all 8 clinical-safety rules have at least one enforcing story.
