# U4 Documento — Consolidated Design Plan (FD + NFR)

U4 = PDF fiel al Diseño Oficial. `document.render` (último handler del pipeline): plantilla HTML/CSS → Playwright (Chromium) → PDF. Story US-4.1.

## Alcance
- **Plantilla HTML/CSS** fiel a `docs/diseno-oficial.md`: encabezado (logo perfil), identificación (rejilla), antecedentes+medicación (incl. grupo sanguíneo, transfusiones, prótesis dental), paraclínicos (alertas destacadas), examen físico (pendiente), valoración/plan, firma (imagen+nombre+registro), pie. Una página, banda de color, filas alternas.
- **`document.render`** (handler): toma GeneratedAssessment → renderiza HTML → Playwright PDF → guarda vía StorageProvider → estado PENDIENTE_REVISION → notifica.
- **Draft-only**: mientras examen físico pendiente o campos obligatorios vacíos, marca de agua "BORRADOR" y no es final (US-4.1, CS3).

## Testable Properties (PBT-01)
- **buildHtml(assessment, branding)** — determinístico; invariante: si examen pendiente ⇒ incluye watermark BORRADOR + nota de corroboración.
- Escape HTML de valores (no inyección desde datos del paciente).

## Extension compliance (U4)
- Security: 05 (escape de datos en HTML → sin XSS en el PDF), 15 (fail-closed).
- PBT: buildHtml determinismo/watermark invariant.

---

## Question 1 — Instalación de Playwright (Chromium)
Playwright descarga Chromium (~150 MB). ¿Lo instalo ahora?

A) Sí — `npm i playwright` + `npx playwright install chromium`. Necesario para renderizar el PDF de verdad. (recomendado)
B) Instalar sólo el paquete; el navegador lo bajas tú después (el render fallaría hasta entonces).
X) Other (describe después de [Answer]:)

[Answer]: A

## Question 2 — Assets de branding (logo/firma)
El seed usa placeholders (`/branding/logo-placeholder.png`, `/branding/firma-placeholder.png`). Para renderizar:

A) Genero placeholders reales (PNG simples: logo con texto "Clínica Portoazul" y una firma de ejemplo) en `apps/api/public/branding/`, servidos por la API. Los reemplazas por los reales del Dr. Luquetta cuando los tengas. (recomendado)
B) Me esperas y pasas logo+firma reales antes de renderizar.
X) Other (describe después de [Answer]:)

[Answer]: A

## Question 3 — Marca de agua de borrador
Mientras el examen está pendiente, el documento NO es final. ¿Cómo lo marco?

A) Marca de agua diagonal "BORRADOR — PENDIENTE DE EXAMEN Y APROBACIÓN" + nota de corroboración al pie de examen físico. El PDF final (post-aprobación, U5) la quita. (recomendado)
X) Other (describe después de [Answer]:)

[Answer]:  A

---

## Artifacts to generate (this gate)
- [x] functional-design/business-logic-model.md
- [x] functional-design/business-rules.md
- [x] functional-design/domain-entities.md
- [x] nfr-requirements/nfr-requirements.md
- [x] nfr-requirements/tech-stack-decisions.md
- [x] nfr-design/nfr-design-patterns.md
- [x] nfr-design/logical-components.md
