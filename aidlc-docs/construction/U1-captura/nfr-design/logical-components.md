# U1 — Logical Components

| Component | Type | Role |
|---|---|---|
| PresetService | service | CRUD + versioning |
| CaseService | service | createCase + token + state transitions + emit event |
| FormService | service | validate answers vs preset, partial save, submit, consent |
| PatientService.upsertFromForm | service | create/update patient from answers |
| conditional engine (`isVisible`) | shared pure fn | condicional |
| formAnswersSchema (dynamic) | shared | validación contra preset |
| StorageProvider (local) | adapter (U0) | adjuntos |
| QueueManager.publish | adapter (U0) | form.submitted |
| verifyCaseToken | auth | autorización por token |

## Integration
- Panel routes → services (session-guarded). Form routes → services (token-guarded).
- Submit → transaction → publish `form.submitted` → (U2 handlers consume).
- No new infra components (local pilot).
