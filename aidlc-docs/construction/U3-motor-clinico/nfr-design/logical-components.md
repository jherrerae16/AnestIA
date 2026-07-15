# U3 — Logical Components

| Component | Type | Role |
|---|---|---|
| clinical.generate handler | pg-boss worker | orquesta input→IA→guardarraíles→persist→publica document.render |
| ClinicalEngine (service) | api service | assembleInput, generate, enforceGuardrails |
| computeIMC / suggestASA / enforceGuardrails | shared pure | derivaciones + guardarraíles |
| AIProvider.generateAssessment | adapter (U0) | stub/anthropic (generateObject) |
| documentSchema | shared | contrato de salida |
| promptMaestroV2 loader | api | system prompt |

## Integration
- lab.flag → clinical.generate → document.render (U4).
- Sin infra nueva.
