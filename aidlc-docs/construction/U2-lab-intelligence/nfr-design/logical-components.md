# U2 — Logical Components

| Component | Type | Role |
|---|---|---|
| lab.extract handler | pg-boss worker | extrae (AIProvider) + persiste + GLP-1 + publica lab.flag |
| lab.flag handler | pg-boss worker | flag determinístico + publica clinical.generate |
| LabEngine (`flagLab`, `canonicalAnalyte`, LAB_RULES) | shared pure | reglas |
| detectGLP1 / GLP1_DRUGS | shared pure | GLP-1 |
| AIProvider.extractLabs | adapter (U0) | extracción (stub/visión) |
| worker.ts | proceso | registra handlers |

## Integration
- form.submitted → lab.extract → lab.flag → clinical.generate (U3).
- Sin infraestructura nueva; todo sobre pg-boss + Postgres.
