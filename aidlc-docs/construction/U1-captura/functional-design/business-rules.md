# U1 — Business Rules

- **BR-1.1** Editar un preset con casos ya enviados crea NUEVA versión; los casos existentes conservan su versión. [US-1.1, RF-1.9]
- **BR-1.2** `linkToken` único, ≥128 bits de entropía, no adivinable; `linkExpiresAt` default +7 días. [US-1.2, SECURITY-12]
- **BR-1.3** La plataforma NUNCA envía el enlace automáticamente; el anestesiólogo lo copia y envía. [CS1]
- **BR-1.4** El consentimiento Ley 1581 se acepta ANTES de recolectar cualquier respuesta; se persiste `Consent` (textVersion + timestamp). [US-1.3, RF-1.8]
- **BR-1.5** Validación de respuestas contra el preset versionado del caso: tipos coinciden, obligatorias presentes, condicionales respetadas (una pregunta oculta no es obligatoria). [US-1.4, US-1.7]
- **BR-1.6** Guardado parcial NO emite `form.submitted`; sólo el submit final lo hace. [US-1.6, US-1.7]
- **BR-1.7** Submit es idempotente: un caso ya enviado no re-dispara el pipeline. [US-1.7, idempotencia]
- **BR-1.8** Adjuntos: máx 10/caso, 15 MB c/u, tipos {PDF,JPG,PNG,WEBP,HEIC}; se guarda hash; se sirven sólo por ruta tokenizada ligada al caso. [US-1.5, SECURITY-05/08/09]
- **BR-1.9** Rutas `/api/form/[token]/**` autorizan por token (objeto), sin sesión; rutas `/api/panel/**` por sesión. [SECURITY-08]
- **BR-1.10** Persistencia de submit en UNA transacción (FormResponse + Attachments ya subidos + Patient upsert) antes de emitir el evento. [US-1.7]
- **BR-1.11** PostgreSQL es la única fuente de verdad de respuestas/adjuntos. [RF-2.5]
