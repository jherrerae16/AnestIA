# U2 — Business Rules

- **BR-2.1** NUNCA se registra un valor de laboratorio ausente; sólo los efectivamente extraídos (CS2). [US-2.1]
- **BR-2.2** Cada ExtractedLabResult guarda `sourceRef` (referencia a la porción fuente) para verificación humana. [US-2.1, RF-4.5]
- **BR-2.3** El flagging es **determinístico** (sin LLM): función pura de (analito, valor, sexo) → NORMAL|ALERTA|CRITICO. [US-2.2]
- **BR-2.4** Umbrales default marcados "PENDIENTE validación clínica"; configurables. Reglas (por validar):
  - Hemoglobina: <12 (♀) / <13 (♂) → ALERTA (anemia); >17 → ALERTA (poliglobulia)
  - Plaquetas: <150.000 → ALERTA; <100.000 → CRITICO
  - INR: >1.4 → ALERTA
  - Leucocitos: <4.000 o >11.000 → ALERTA
  - Creatinina: >1.3 → ALERTA
  - Glucemia: >180 → ALERTA; >250 → CRITICO
- **BR-2.5** Un analito no reconocido se guarda pero queda NORMAL (sin regla aplicable). [US-2.2]
- **BR-2.6** Detección GLP-1: si P14 menciona un agonista de la lista (case-insensitive, sin acentos) → marca GLP-1 para la lógica de broncoaspiración (U3). [US-2.3, CS8]
- **BR-2.7** Handlers idempotentes y reintentables; fail-closed (no avanzan el estado si fallan). [SECURITY-15]
- **BR-2.8** monotonicidad: un valor más extremo nunca produce una severidad menor.
