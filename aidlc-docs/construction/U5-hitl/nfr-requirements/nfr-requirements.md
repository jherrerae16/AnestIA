# U5 — NFR Requirements

| Category | Requirement |
|---|---|
| Safety (clínica) | Aprobación bloqueante server-side (examen pendiente / obligatorias); IA nunca aprueba; examen confirmado activamente. CS1/CS3. |
| Integrity | Inmutabilidad post-aprobación (snapshot + guard + PDF final); audit inmutable. CS7. |
| Security | Sesión + ownership en cada ruta; edits validados; fail-closed. |
| Usability | Vista lado a lado clara; blockers explícitos; resaltado de derivados/alertas. |
| Traceability | ApprovalRecord (quién/cuándo/qué editó); audit. |

## Extension NFRs
- Security 05/08/13/14/15.
- PBT (full): canApprove invariante (bloqueo), applyExamNormal/applyEdits.
