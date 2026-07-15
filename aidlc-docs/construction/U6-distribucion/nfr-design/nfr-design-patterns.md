# U6 — NFR Design Patterns

## Integrity
- `distribute` guard: exige ApprovalRecord (aprobado) antes de enviar; si no → rechazo. Sólo lockedPdfUrl.

## Security
- Descarga por token de DeliveryRecord (sin sesión); sirve sólo el PDF final; registra accessedAt. [SECURITY-08]
- SMTP App Password vía env, nunca en código/logs. [SECURITY-12]
- Panel: sesión + ownership del caso/contacto. [SECURITY-08]

## Reliability
- Mailer adapter: stub/gmail-smtp; fallo de envío no pierde el DeliveryRecord (se registra intento).

## Traceability
- DeliveryRecord + audit (delivered/accessed).
