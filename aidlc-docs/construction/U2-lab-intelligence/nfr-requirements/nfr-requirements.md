# U2 — NFR Requirements

| Category | Requirement |
|---|---|
| Correctness | Flagging determinístico y monótono; nunca fabricar valores. |
| Reliability | Handlers idempotentes, reintentables, fail-closed. |
| Performance | Extracción + análisis < 30s (PRD). Stub instantáneo; visión real depende de la API. |
| Traceability | sourceRef por valor; GLP-1 y jobs en audit. |
| Maintainability | Reglas y umbrales en tabla configurable; funciones puras testeables. |

## Extension NFRs
- Security: 15 (fail-closed jobs). Sin endpoints nuevos.
- PBT (full): flag determinista/monótono (oracle+invariant), GLP-1 (invariant), extract idempotente (idempotence).
