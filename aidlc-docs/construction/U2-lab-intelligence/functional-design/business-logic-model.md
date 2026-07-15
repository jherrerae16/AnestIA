# U2 — Business Logic Model

## Pipeline handlers (pg-boss, consumen del anterior)

### H1 — lab.extract [US-2.1, US-2.3]
Trigger: `form.submitted {caseId}`.
1. Idempotencia: si el caso ya tiene ExtractedLabResult, saltar extracción (no duplicar).
2. Cargar adjuntos del caso (FileRef desde Attachment).
3. `AIProvider.extractLabs(files)` → lista de {analyte, value, unit, refRange, sourceRef}. Stub: valores de ejemplo; anthropic: visión con key. **Sólo valores presentes** (CS2).
4. Persistir cada uno como `ExtractedLabResult` (flag=NORMAL inicial, sourceRef).
5. Detección GLP-1: leer respuesta P14 → si contiene un agonista de la lista → registrar marcador GLP-1 (en meta del caso / audit) con fecha de última dosis si el paciente la declaró.
6. Actualizar Case.status; publicar `lab.flag {caseId}`.

### H2 — lab.flag [US-2.2]
Trigger: `lab.flag {caseId}`.
1. Cargar ExtractedLabResult del caso + sexo del paciente.
2. Para cada resultado: `flag(canonical(analyte), numericValue, sex)` → NORMAL|ALERTA|CRITICO (determinístico, sin LLM).
3. Actualizar cada ExtractedLabResult.flag.
4. Case.status → LABS_ANALIZADOS; publicar `clinical.generate {caseId}` (consumido en U3).

## Funciones puras (shared)
- `canonicalAnalyte(name): string|null` — sinónimos → canónico.
- `flagLab(analyte, value, sex): LabFlag` — reglas determinísticas de lab-rules.md.
- `detectGLP1(text): {declared, drug?}` — busca agonistas.
