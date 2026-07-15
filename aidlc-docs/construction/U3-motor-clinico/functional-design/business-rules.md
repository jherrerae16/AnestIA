# U3 — Business Rules

- **BR-3.1** Salida SIEMPRE validada contra `documentSchema` (Zod); malformada → rechazada, no persiste (CS5). [US-3.1]
- **BR-3.2** Examen físico y signos vitales → `estado='pendiente_examen'`, `valor=null`. El motor nunca genera "normales" por defecto (CS3). Si el LLM los puebla, `enforceGuardrails` los limpia. [US-3.1]
- **BR-3.3** IMC calculado por CÓDIGO (peso/talla, cm→m), no por el LLM (CS4). Se sobrescribe el valor del modelo. [US-3.3]
- **BR-3.4** Cada campo con datos lleva `fuente` (formulario:Pn / lab:analito / anestesiologo). Sin fuente → no se puebla (CS2). [US-3.1]
- **BR-3.5** ASA/diagnóstico/concepto/plan/recomendaciones = DERIVADOS de datos reales, marcados para revisión (CS4). ASA con justificación breve. [US-3.1]
- **BR-3.6** Ningún campo con `estado≠'ok'` tiene un `valor` inventado (CS2). [US-3.1]
- **BR-3.7** GLP-1 detectado → recomendaciones de ayuno/dieta líquida/confirmar síntomas GI/considerar ecografía gástrica/manejo estómago lleno (CS8). [US-3.2]
- **BR-3.8** GeneratedAssessment registra `promptVersion` ("prompt-maestro-v2") y `modelUsed` (stub o modelo real) para trazabilidad. [US-3.1]
- **BR-3.9** Handler idempotente, fail-closed. [SECURITY-15]
