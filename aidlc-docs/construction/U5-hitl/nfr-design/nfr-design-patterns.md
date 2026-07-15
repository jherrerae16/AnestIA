# U5 — NFR Design Patterns

## Safety (gate humano)
- `canApprove` = función pura sobre fields; **re-evaluada server-side** en approve (no confiar en el cliente). Blockers explícitos.
- IA nunca llama a approve; sólo un handler autenticado del anestesiólogo (CS1).
- "Cargar examen normal" setea fuente='anestesiologo' → confirmación activa, no invención (CS3/§17).

## Integrity (inmutabilidad)
- Al aprobar: snapshot de fields en ApprovalRecord + hash SHA-256; lockedPdfUrl (PDF final).
- Guard: PATCH assessment / exam rechazado si el caso está APROBADO (fail-closed).
- Audit append-only (assessment.approved/edited/rejected).

## Security
- Todas las rutas: requireSession + verificar case.anesthesiologistId === session (ownership, anti-IDOR). [SECURITY-08]
- Edits validados por Zod. [SECURITY-05]
