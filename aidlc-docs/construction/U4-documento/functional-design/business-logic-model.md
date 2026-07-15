# U4 — Business Logic Model

## Handler: document.render [US-4.1]
Trigger: `clinical.generate` → `document.render {caseId}`.
1. Idempotencia: regenera el borrador (sobrescribe) — el PDF de borrador no es inmutable (el final sí, en U5).
2. Cargar GeneratedAssessment + perfil (branding) + labs (para alertas).
3. `buildHtml(assessment, branding, {draft:true})` → HTML fiel al Diseño Oficial.
4. Playwright: HTML → PDF (A4, una página cuando sea posible).
5. Guardar PDF vía StorageProvider (key del caso, tipo=draft).
6. Case.status → PENDIENTE_REVISION; notificar (audit + in-app).

## buildHtml (pura, testeable)
- Secciones del Diseño Oficial. Escapa todo valor de datos (anti-XSS).
- Si `draft` o examen pendiente → marca de agua "BORRADOR" + nota de corroboración.
- Alertas de lab (flag≠NORMAL) resaltadas.
- Branding: logo, firma, nombre, especialidad, registro del perfil.

## renderPdf (Playwright)
- launch chromium (headless) → setContent(html) → pdf({format:'A4', printBackground:true}) → Buffer.
- Reutiliza el browser entre renders (perf).
