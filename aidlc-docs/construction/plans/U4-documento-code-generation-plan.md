# U4 Documento — Code Generation Plan

Builds on U0-U3. Story US-4.1. Handler document.render.

## Steps
### Step 1 — Shared: plantilla HTML
- [x] `packages/shared/src/pdf-template.ts`: `escapeHtml`, `buildDocumentHtml(assessment, branding, opts)` → HTML string fiel al Diseño Oficial (secciones, banda color, filas alternas, alertas, watermark BORRADOR si pendiente/draft, nota corroboración). Pura.
- [x] export; tests (PBT: determinismo, watermark invariant, escape).

### Step 2 — PdfRenderer (Playwright)
- [x] `apps/api/lib/pdf/renderer.ts`: browser singleton (chromium headless), `renderPdf(html): Buffer` (A4, printBackground), close on shutdown.

### Step 3 — Branding placeholders
- [x] `apps/api/public/branding/logo-placeholder.png` + `firma-placeholder.png` (PNG simples generados).

### Step 4 — document.render handler + service
- [x] `lib/services/document.service.ts`: renderDraftForCase (load assessment+branding+labs → buildHtml → renderPdf → StorageProvider.put → status PENDIENTE_REVISION).
- [x] `lib/queue/handlers.ts`: `onDocumentRender` (idempotent regen, notify via audit).
- [x] `lib/queue/worker.ts`: register document.render.

### Step 5 — Tests
- [x] PBT: buildDocumentHtml determinismo; examen pendiente ⇒ watermark BORRADOR presente; escapeHtml previene inyección.
- [x] Example: reference assessment → HTML contains logo, secciones, ASA, GLP-1 alert, watermark.

### Step 6 — Docs + verify
- [x] README; run worker → document.render produces a real PDF for a case; verify file exists + status PENDIENTE_REVISION.

## Story traceability
US-4.1→1,2,3,4,5.

## Verification target
Borrador se ve como el Diseño Oficial, una página, branding del perfil; PDF generado y guardado; estado PENDIENTE_REVISION.
