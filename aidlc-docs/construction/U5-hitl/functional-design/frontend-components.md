# U5 — Frontend Components (Angular)

## ReviewApprovalPage (panel, guarded) [US-5.1…5.5]
Ruta `/cases/:id/review`.
- **Layout lado a lado**: columna borrador (campos editables) | columna fuente (respuestas + labs con sourceRef).
- **Resaltado**: campos derivados por IA (badge), alertas de lab (rojo), examen pendiente (amarillo).
- **Edición en línea**: inputs por campo → PATCH.
- **Panel examen físico**: inputs por sistema + botón "Cargar examen normal" (confirmación).
- **Barra de aprobación**: muestra blockers (si los hay) en rojo; botón "Aprobar y firmar" deshabilitado hasta que no haya blockers; botón "Rechazar".
- data-testid: `review-approve-button`, `review-reject-button`, `exam-load-normal-button`, `review-blockers`.

## API integration
- GET review, PATCH assessment, POST exam, GET can-approve, POST approve, POST reject.
