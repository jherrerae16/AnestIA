# U4 — Logical Components

| Component | Type | Role |
|---|---|---|
| document.render handler | pg-boss worker | render + guardar + status + notificar |
| buildHtml + escapeHtml | pure | plantilla Diseño Oficial |
| PdfRenderer (Playwright) | adapter | HTML→PDF, browser singleton |
| StorageProvider (local) | adapter (U0) | guardar PDF borrador |
| branding assets | static | logo/firma placeholder |

## Integration
- clinical.generate → document.render → (fin del pipeline automático; sigue revisión humana U5).
- Sin infra nueva salvo el binario de Chromium (local).
