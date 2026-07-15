# U4 — Tech Stack Decisions

| Concern | Choice | Rationale |
|---|---|---|
| Render PDF | Playwright (headless Chromium) | PRD; HTML/CSS fiel al Diseño Oficial. |
| Plantilla | HTML/CSS string (buildHtml) | Determinístico, testeable. |
| Escape | escapeHtml propio | Anti-XSS (SECURITY-05). |
| Branding assets | PNG placeholders en apps/api/public/branding | Reemplazables por los reales. |
| Storage | StorageProvider (local) | PDF de borrador. |
| Browser reuse | singleton chromium | Perf. |

## Deps nuevas
- `playwright` + `npx playwright install chromium` (~150 MB).
