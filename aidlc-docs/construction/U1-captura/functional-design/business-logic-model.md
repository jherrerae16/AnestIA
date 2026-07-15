# U1 — Business Logic Model

## Panel flows (P1, sesión requerida)

### F1 — Gestión de presets [US-1.1]
- List/create/update presets del anesthesiologist. Editar el base crea nueva versión (no rompe casos enviados).
- Question CRUD: order, label, type, required, options (select), conditional.

### F2 — Crear caso + enlace [US-1.2]
1. `createCase({presetId, patientHint?})` → genera `linkToken` (≥128 bits, base64url), `linkExpiresAt` (default +7d), status=ENVIADO_AL_PACIENTE.
2. Devuelve `linkUrl` para copiar. La plataforma NO envía (CS1) — envío manual.

## Patient form flows (P2, por token, sin sesión)

### F3 — Abrir formulario [US-1.3, US-1.4]
1. `GET /api/form/[token]` → valida token (existe, no expirado). Si inválido/expirado → 410/404.
2. Devuelve preset (preguntas + condicionales) + estado de consentimiento + respuestas parciales previas.
3. UI muestra consentimiento Ley 1581 (versionado) ANTES de cualquier dato. Aceptar → persiste `Consent`.

### F4 — Guardado parcial [US-1.6]
- `POST /api/form/[token]/save` → valida contra preset, guarda `FormResponse.partial=true`. NO emite evento.

### F5 — Adjuntos [US-1.5]
- `POST /api/form/[token]/upload` → valida tipo/tamaño, StorageProvider.put → crea Attachment (type, url/key, hash). Sirve por ruta tokenizada.

### F6 — Submit [US-1.7]
1. `POST /api/form/[token]/submit` → valida completitud (obligatorias presentes, condicionales respetadas).
2. Transacción: FormResponse.partial=false + submittedAt + status RESPUESTAS_RECIBIDAS.
3. Emite `form.submitted {caseId}` (pg-boss). Idempotente: si ya se envió, no re-emite.
4. Upsert Patient desde respuestas (nombre, doc, nacimiento, sexo, aseguradora, grupo sanguíneo).

## Motor condicional
`isVisible(question, answers)`: si `question.conditional.showIf` → visible sólo si `answers[showIf.questionOrder] == showIf.equals`. Sin conditional → siempre visible. Una pregunta oculta NO cuenta como obligatoria.
