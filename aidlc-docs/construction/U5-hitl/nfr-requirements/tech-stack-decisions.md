# U5 — Tech Stack Decisions

| Concern | Choice | Rationale |
|---|---|---|
| Bloqueo de aprobación | `canApprove` pura (shared), re-chequeada en servidor | Testeable (PBT), no burlable desde el cliente. |
| Inmutabilidad | ApprovalRecord snapshot (fields JSON) + hash + lockedPdfUrl; guard de edición | Piloto sin cripto; trazabilidad por plataforma (§13). |
| PDF final | buildDocumentHtml(draft:false) → renderPdf | Reusa U4 sin marca de agua. |
| Edición | PATCH validado (Zod) | SECURITY-05. |
| Front | Angular signals, vista lado a lado | PRD. |

## Secrets (U5)
- Ninguno nuevo.
