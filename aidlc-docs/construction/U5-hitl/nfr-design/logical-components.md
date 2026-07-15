# U5 — Logical Components

| Component | Type | Role |
|---|---|---|
| ApprovalService | api service | canApprove, editAssessment, setExam, approve (snapshot+PDF+lock), reject |
| canApprove / NORMAL_EXAM / applyExamNormal | shared pure | reglas de bloqueo + examen normal |
| review routes | api | GET review, PATCH assessment, POST exam, GET can-approve, POST approve/reject |
| ReviewApprovalPage | angular | UI lado a lado + aprobación |
| PdfRenderer + buildDocumentHtml | U4 | PDF final (draft:false) |
| AuditLogger | U1 | trazabilidad |

## Integration
- PENDIENTE_REVISION → (revisión humana) → APROBADO (PDF inmutable) o RESPONDIENDO (rechazo).
- Sin infra nueva.
