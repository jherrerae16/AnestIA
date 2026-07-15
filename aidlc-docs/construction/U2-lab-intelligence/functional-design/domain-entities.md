# U2 — Domain Entities (touched)

- **ExtractedLabResult** — creado por lab.extract, flag actualizado por lab.flag. Campos: analyte, value, unit, refRange, flag, sourceRef.
- **Case** — status transitions (RESPUESTAS_RECIBIDAS → [extract] → LABS_ANALIZADOS). GLP-1 marker stored via AuditLog/meta.
- **Attachment** — leído (FileRef) por lab.extract.
- **AuditLog** — GLP-1 detection + job completion entries.

## Shared additions
- `lab.ts`: `canonicalAnalyte`, `flagLab`, `LAB_RULES` table, `LabFlag` re-export.
- `glp1.ts`: `GLP1_DRUGS` list, `detectGLP1`.
