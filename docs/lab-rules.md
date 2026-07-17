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

## Reconocimiento de analitos

El flagging casa el analito por nombre. Los informes reales no lo nombran a secas
("CREATININA EN SUERO (SERICA)", "RECUENTO TOTAL DE PLAQUETAS"), así que además de la igualdad
exacta hay **matching por patrón** que reconoce esos nombres largos. Los patrones excluyen homónimos:
la creatinina **en orina** no es la sérica, el cociente albúmina/creatinina no es creatinina, los
leucocitos del **sedimento** no son los del hemograma, el MCH no es hemoglobina. Un analito con regla
que no se reconozca caería como NORMAL sin evaluarse — de ahí la importancia de ampliar los patrones,
no solo la tabla de sinónimos.

## Agrupación y fecha (para el documento)

- **Grupo (tipo de estudio):** cada lab lleva `grupo` (hemograma, coagulación, bioquímica,
  uroanálisis, perfil hormonal, inmunología, microbiología, otros). Lo asigna el extractor desde el
  **encabezado del informe**, no por el nombre del analito. En el documento, los paraclínicos se
  muestran una fila por estudio, no una por analito.
- **Fecha del informe (`reportDate`):** se lee la fecha impresa (toma/proceso), no la de carga.
  Un examen de ≥3 meses se marca para verificar vigencia. Si el informe no la trae, se declara
  ausente — nunca se asume reciente (CS2). Ojo con el formato colombiano DD/MM/AAAA.
