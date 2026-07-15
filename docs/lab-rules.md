# Lab Rules — Rangos y alertas rojas (configurables)

Reglas determinísticas aplicadas tras la extracción. Rangos ilustrativos: deben ser validados por el
Dr. Luquetta antes de producción. El motor NUNCA fabrica valores; solo evalúa los presentes.

| Analito | Condición de alerta | Relevancia anestésica |
|---|---|---|
| Hemoglobina | < 12 g/dL (♀) / < 13 (♂), o elevada | anemia / poliglobulia |
| Plaquetas | < 150.000 (alerta) / < 100.000 (crítico) | riesgo de sangrado / neuroaxial |
| INR / TP / TPT | prolongados | coagulopatía |
| Leucocitos | leucocitosis / leucopenia | infección / inmunosupresión |
| Creatinina / TFG | elevada / TFG baja | función renal, dosificación |
| Glucemia | hiperglucemia marcada | descompensación metabólica |
| GLP-1 (declarado) | última dosis reciente | vaciamiento gástrico → ayuno/broncoaspiración |

Estados: `NORMAL | ALERTA | CRITICO`. Cada resultado guarda `sourceRef` a la porción del documento
original para verificación humana en la pantalla de revisión.
