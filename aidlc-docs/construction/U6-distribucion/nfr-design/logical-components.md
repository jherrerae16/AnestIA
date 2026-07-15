# U6 — Logical Components

| Component | Type | Role |
|---|---|---|
| DirectoryService | api | CRUD contactos |
| DistributionService | api | distribute (guard aprobado, DeliveryRecord, mailer/link, audit) |
| PatientService (ext) | api | search, getPatient, prefill |
| DashboardService | api | listCases + indicadores |
| Mailer (gmail-smtp/stub) | adapter (U0) | envío |
| SheetsExporter (noop) | adapter (U0) | export diferido |
| buildDeliveryEmail/prefillFromPatient | shared pure | correo + precarga |
| download/delivery route | api | descarga tokenizada + accessedAt |
| Dashboard/Directory/PatientHistory pages | angular | UI |

## Integration
- APROBADO → distribute → ENTREGADO. Historial/dashboard consultan datos existentes.
- Sin infra nueva (SMTP externo vía adaptador).
