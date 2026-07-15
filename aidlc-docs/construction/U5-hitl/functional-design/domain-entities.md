# U5 — Domain Entities (touched)

- **GeneratedAssessment** — leído + editado (fields) hasta aprobar; luego bloqueado.
- **ApprovalRecord** — creado al aprobar: approvedById, approvedAt, lockedPdfUrl, edits (JSON snapshot + cambios).
- **Case** — status PENDIENTE_REVISION → APROBADO (o → RESPONDIENDO si rechazo).
- **AuditLog** — assessment.approved, assessment.edited, assessment.rejected.

## Shared additions
- `approval.ts`: `canApprove(fields)`, `NORMAL_EXAM`, `applyExamNormal`, `REQUIRED_ID_FIELDS`.
