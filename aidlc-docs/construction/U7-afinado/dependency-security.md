# U7 — Estado de seguridad de dependencias (npm audit)

Fecha: 2026-07-15. Decisión (Q1=A): documentar, lockear, **no** `npm audit fix --force` (rompe la build verificada con breaking changes). [SECURITY-10]

## Resumen
- **Producción** (`npm audit --omit=dev`): 8 vulnerabilidades (3 moderate, 5 high). Todas transitivas en la cadena de **Next.js / postcss** (framework), no en código de la aplicación.
- **Total (incl. dev)**: 32 (1 low, 15 moderate, 15 high, 1 critical) — mayormente toolchain de Angular/Next dev.

## Aceptación de riesgo (piloto local)
- El piloto corre en **local, sin exposición pública** (hosting diferido). El vector de las vulnerabilidades de build/dev no aplica a un despliegue.
- `package-lock.json` está commiteado (versiones fijas, reproducible).
- **Antes de producción**: actualizar Next.js/Angular a versiones parcheadas y re-verificar la build; correr un escáner de dependencias en CI (SECURITY-10). No se ejecuta `fix --force` ahora para no romper la build ya verificada de las 8 unidades.

## Acción pendiente (producción)
- [ ] Actualizar Next.js a una versión sin las CVE de postcss.
- [ ] Escáner de deps en CI (p.ej. `npm audit --audit-level=high` como gate, o Grype/Dependabot).
- [ ] Re-verificar build + tests tras la actualización.
