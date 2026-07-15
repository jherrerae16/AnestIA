# U3 — Domain Entities (touched)

- **GeneratedAssessment** — creado por clinical.generate. fields=DocumentJSON (secciones × DocField), promptVersion, modelUsed.
- **Case** — status LABS_ANALIZADOS → BORRADOR_GENERADO.
- **FormResponse / ExtractedLabResult** — leídos (input).
- **AuditLog** — clinical.generated, rechazo si aplica.

## Shared additions
- `clinical.ts`: `computeIMC`, `suggestASA`, `enforceGuardrails`, `ClinicalInput` type, `PROMPT_MAESTRO_VERSION`.
- documentSchema (ya existe, se usa como contrato de generateObject).
