# U4 Documento — Código generado (resumen)

## Qué hace
`document.render` — último handler del pipeline. Renderiza el PDF de borrador fiel al Diseño Oficial (Playwright/Chromium) con el branding del perfil, marca de agua BORRADOR mientras el examen está pendiente, y avanza el caso a PENDIENTE_REVISION.

## Archivos
**packages/shared/src/**: pdf-template.ts (`buildDocumentHtml`, `escapeHtml`, `Branding`), pdf-template.test.ts.
**apps/api/lib/**: pdf/renderer.ts (Playwright, browser singleton), services/document.service.ts (branding→dataURI, buildHtml→renderPdf→storage), queue/handlers.ts (+onDocumentRender), queue/worker.ts (+registro).
**apps/api/public/branding/**: logo-placeholder.svg, firma-placeholder.svg (reemplazables).

## Verificación (end-to-end, worker real)
- ✅ 34 tests verdes (29 shared incl. **PBT buildDocumentHtml determinismo + watermark invariant + escapeHtml anti-inyección**; 5 api).
- ✅ Playwright: Chromium lanzado, **PDF real generado: 101 KB, PDF v1.4, 1 página** (caso Ana López, con branding + marca BORRADOR).
- ✅ Pipeline COMPLETO verificado (audit trail): case.created → consent.accepted → form.submitted → glp1.detected → lab.extracted → lab.flagged → clinical.generated → **document.rendered**.
- ✅ Case.status → **PENDIENTE_REVISION** (fin del pipeline automático; sigue revisión humana U5).

## Decisiones/arreglos
- Branding incrustado como **data URI** (Playwright no depende de la red).
- Placeholders en **SVG** (Chromium los rasteriza en el PDF).
- `.gitignore` extendido a `**/storage/` (los PDFs/adjuntos van a `apps/api/storage`, cwd del worker — datos del paciente, nunca al repo).

## Pendiente
- Preview visual del PDF no disponible en el entorno (poppler no instalado); validado por tamaño/estructura + tests de plantilla. El detalle fino del layout se afina en Build&Test / con assets reales.
- PDF final inmutable = al aprobar (U5).
