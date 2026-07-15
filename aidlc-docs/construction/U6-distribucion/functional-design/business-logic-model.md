# U6 — Business Logic Model

## Directorio [US-6.1]
CRUD de DirectoryContact (label, email, type, notes). Alta rápida desde la pantalla de envío.

## Distribución [US-6.1/6.5]
1. `distribute(caseId, contactIds, channels)`:
   - Guard: sólo si el caso está APROBADO (existe ApprovalRecord con lockedPdfUrl). Si no → 409/422.
   - Para cada contacto: genera DeliveryRecord (token único, channel), y si channel incluye email → Mailer.send con enlace de descarga; si sólo link → registra el enlace para copiar.
   - Aseguradora (P8) sugerida como destinatario.
   - Audit document.delivered. Case.status → ENTREGADO.
2. `GET /download/delivery/[token]`: sirve el PDF final inmutable; marca accessedAt.

## Historial de pacientes [US-6.3]
- `searchPatients(query)`: por documento/nombre.
- `getPatient(id)`: ficha + sus Case (fecha, procedimiento, ASA, estado, PDF final).
- `prefillFromPatient(patientId)`: datos base para precargar un caso nuevo (marcados para reconfirmación).

## Dashboard [US-6.4]
- `listCases(filter)`: por estado/fecha/paciente/procedimiento; indicadores (pendiente revisión, alertas rojas, próximos a cirugía).

## Export [US-6.2]
- `exportSheets(caseIds)`: adaptador (noop por defecto).

## Funciones puras (shared)
- `buildDeliveryEmail(caseInfo, downloadUrl)` → {subject, html}.
- `prefillFromPatient(patient)` → parcial de respuestas base.
