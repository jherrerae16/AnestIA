# U6 — Domain Entities (touched)

- **DirectoryContact** — CRUD (label, email, type, notes).
- **DeliveryRecord** — creado al distribuir (contactId, channel, sentAt, accessedAt, token).
- **Case** — status APROBADO → ENTREGADO; listado en dashboard.
- **Patient** — búsqueda/ficha/precarga (creado en U1).
- **ApprovalRecord** — leído (lockedPdfUrl) para servir el PDF final.
- **AuditLog** — document.delivered, document.accessed.

## Schema nota
`DeliveryRecord` en el schema no tiene campo `token` explícito; se usa un token derivado/guardado en meta o se añade columna. Piloto: añadir `token String? @unique` a DeliveryRecord (migración menor).

## Shared additions
- `distribution.ts`: `buildDeliveryEmail`, `prefillFromPatient`, `ContactTypeT`.
