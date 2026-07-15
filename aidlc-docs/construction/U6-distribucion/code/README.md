# U6 Distribución e Historial — Código generado (resumen)

## Qué hace
Cierra el ciclo: directorio de contactos, distribución del PDF final aprobado (SMTP Gmail / enlace tokenizado), DeliveryRecord con trazabilidad de acceso, historial de pacientes con búsqueda + precarga, y dashboard de casos por estado.

## Archivos
**prisma/**: migración `delivery_token` (DeliveryRecord.token @unique).
**packages/shared/src/**: distribution.ts (`buildDeliveryEmail`, `prefillFromPatient`), distribution.test.ts.
**apps/api/lib/**: mailer/index.ts (+GmailSmtpMailer nodemailer), services/{directory,distribution,dashboard}.service.ts, patient.service.ts (+search/history).
**apps/api/app/api/**: panel/directory, panel/cases/[id]/distribute, panel/patients(+[id]), panel/dashboard, download/delivery/[token].
**apps/web/**: dashboard.page (real), directory.page, patient-history.page, distribución en review-approval.page + rutas + nav + ApiService.

## Verificación (backend smoke)
- ✅ 40 tests verdes (35 shared incl. **PBT buildDeliveryEmail/prefillFromPatient**; 5 api). Angular build OK.
- ✅ Distribución end-to-end:
  1. crear contacto (Clínica Portoazul)
  2. **distribuir (link) → DeliveryRecord + token + url**
  3. Case → **ENTREGADO**
  4. **abrir enlace → 200, application/pdf** (1 página, PDF final)
  5. **accessedAt registrado** (trazabilidad)
  6. **distribuir caso NO aprobado → 422** (CS7 — sólo el inmutable)
- ✅ búsqueda de pacientes ("Ana" → 2), dashboard (indicadores + 3 casos).

## Envío por correo real
- Con `MAILER_PROVIDER=gmail-smtp` + `SMTP_USER`/`SMTP_PASS` (Gmail App Password) → envío real por nodemailer. Sin credencial → enlace de descarga tokenizado (funciona igual). **Pásame el App Password cuando quieras activar correo.**

## Pendiente
- Export a Sheets: adaptador noop (diferido; requiere OAuth Google).
- Front live-serve (build verificado).
