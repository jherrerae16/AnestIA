# U4 — NFR Requirements

| Category | Requirement |
|---|---|
| Fidelity | PDF fiel al Diseño Oficial; una página; branding del perfil. |
| Security | Escape de datos en HTML (anti-XSS en el PDF); fail-closed. |
| Performance | Render < ~5s; reutilizar browser Playwright. |
| Reliability | Handler idempotente; borrador regenerable. |
| Safety | Borrador marcado mientras examen pendiente (CS3). |

## Extension NFRs
- Security 05 (escape), 15 (fail-closed).
- PBT: buildHtml determinismo + watermark invariant.
