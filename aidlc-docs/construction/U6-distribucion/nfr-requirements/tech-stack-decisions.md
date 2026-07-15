# U6 — Tech Stack Decisions

| Concern | Choice | Rationale |
|---|---|---|
| Envío correo | Mailer adapter: nodemailer + Gmail SMTP (App Password) / stub | Punto único; sin credencial → enlace. |
| Enlace descarga | Token por DeliveryRecord (crypto.randomBytes) | SECURITY-08. |
| Export Sheets | Sheets adapter noop (diferido) | Sin dependencia Google ahora. |
| Búsqueda pacientes | Prisma where documentId/fullName contains | Suficiente para el piloto. |
| Front | Angular signals | PRD. |

## Deps nuevas
- `nodemailer` (para el modo gmail-smtp del mailer).

## Secrets (U6, diferidos)
- SMTP_HOST/PORT/USER/PASS (Gmail App Password) — para envío real.
- Google OAuth — para Sheets (si se activa).
