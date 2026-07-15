# U4 — NFR Design Patterns

## Fidelity
- Plantilla HTML/CSS que mapea 1:1 las secciones del Diseño Oficial; banda de color, filas alternas, una página (A4, márgenes ajustados).

## Security
- `escapeHtml` en TODO valor proveniente de datos (respuestas, labs) antes de interpolar. [SECURITY-05]
- Playwright con `setContent` (no navega a URLs externas); CSP del PDF no aplica pero se evita cargar recursos remotos (assets locales/data URIs).

## Reliability / perf
- Browser Chromium como singleton (lanzar una vez, reusar); cerrar en shutdown.
- Handler idempotente (regenera borrador); fail-closed.

## Safety
- `buildHtml` añade marca de agua BORRADOR si examen pendiente / obligatorias vacías → invariante testeable (CS3).
