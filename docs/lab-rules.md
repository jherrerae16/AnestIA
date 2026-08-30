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

## Procedencia y confianza (Especificación §15)

Cada resultado guarda de dónde salió y con qué seguridad se leyó:

| Campo | Qué guarda |
|---|---|
| `attachmentId` + `page` | Archivo y página del informe. Sin esto un valor no se puede rastrear. |
| `analyteRaw` / `valueRaw` | Nombre y valor **tal como están impresos**, antes de normalizar. |
| `unitRaw` + `conversionRule` | Unidad impresa y la regla aplicada, si hubo conversión. |
| `institucion` | Laboratorio que emite el informe. |
| `confidence` | Confianza de la lectura, 0-1. La aporta el extractor. |
| `estadoExtraccion` | `AUTOMATICO` · `PENDIENTE_CONFIRMACION` · `CONFIRMADO`. |
| `collectedAt` | Fecha de **toma** de la muestra, distinta de la de emisión. |
| `identityMatch` | `COINCIDE` · `NO_COINCIDE` · `NO_VERIFICABLE`. |

### Verificación de identidad

La Especificación §15 abre el procesamiento con *"verificar paciente, documento y fecha"*. El
riesgo es concreto: un paciente sube por error el examen de un familiar, y esos valores
alimentarían las escalas y las alertas de otra persona.

El **documento manda**: si coincide, coincide, aunque el nombre esté escrito distinto. Sin
documento en el informe se cae al nombre, tolerando el orden y las partículas ("URIBE GONZALEZ
ROBERTO MARIO" concuerda con "Roberto Mario Uribe González"). Sin ninguno de los dos queda
`NO_VERIFICABLE`, que **no es** lo mismo que "no coincide": el resultado se conserva y se marca
para revisión, en vez de descartarlo o darlo por bueno.

Un `NO_COINCIDE` va siempre a revisión humana, por buena que sea la lectura, y no alimenta
escalas.

### Qué pasa a revisión humana

Un resultado va a `PENDIENTE_CONFIRMACION` si tiene **confianza < 0.7**, **no trae unidad**,
**no se pudo asociar a un archivo** o **la identidad no concuerda**. No se descarta —perderlo sería peor— pero **no alimenta
escalas ni alertas** hasta que el médico lo confirme. Dejar una escala pendiente es correcto;
puntuarla con un número dudoso, no.

### Conversión de unidades

Tabla **cerrada** en `packages/shared/src/lab-units.ts`. Lo que no está ahí no se convierte: se
deja como vino. Adivinar un factor es peor que no convertir — uno equivocado en una hemoglobina
cambia una anemia por una policitemia en un documento firmado.

El valor y la unidad originales se conservan **siempre**, incluso cuando sí se convierte.

Las reglas se escriben con el nombre **canónico** del analito (el que devuelve `canonicalAnalyte`:
"Glucemia", no "Glucosa"). Un nombre coloquial no coincide nunca y la conversión se perdería sin
error visible; hay un test que lo comprueba.


## Tendencia entre informes sucesivos (§16)

Cada resultado se conserva con su fecha; la prosa del documento lista **sólo el más reciente** de
cada analito y añade una nota de evolución con el anterior:

> Hemoglobina 9.8 g/dL. Dentro de los rangos reportados.
> *Evolución — Hemoglobina: 13.9 → 9.8 g/dL en 21 días (-29.5 %)*

Reglas:

- Manda la **fecha de toma** (`collectedAt`) sobre la de emisión (`reportDate`).
- Un cambio menor al **5 %** se considera estable y no genera nota: por debajo de eso suele ser
  ruido de método entre laboratorios, y marcarlo añade alarma sin información.
- Un analito con un solo resultado no produce tendencia.
- Si a algún resultado de un analito le falta la fecha, se listan **todos** los suyos: sin fecha
  no hay forma de saber cuál es el último.
- El informe del valor previo se añade a la `fuente` del campo: la nota cita una cifra que ya no
  aparece en la prosa y tiene que seguir siendo rastreable (CS2).

## Informes que no son de laboratorio (§16)

ECG, ecocardiograma, radiografía de tórax y espirometría se guardan en `ExtractedStudy`, no en
`ExtractedLabResult`. Del ECG se transcriben **ritmo, frecuencia, intervalos y conclusión**; de
los demás, la conclusión y los hallazgos que el informe separe.

- **Se transcribe, no se interpreta.** El sistema no decide si un estudio es normal ni traduce un
  hallazgo a un diagnóstico. Eso lo firma el anestesiólogo.
- **No alimentan escalas.** `estudio:*` no está en la lista blanca de CS9, y hay un test que lo
  comprueba: un RCRI no se puntúa porque un ECG mencione ondas Q.
- Confianza baja, sin archivo de procedencia o identidad discordante → `PENDIENTE_CONFIRMACION`.
  El estudio **se muestra igual**, diciendo que la lectura está sin confirmar: ocultarlo le
  escondería al médico un informe que existe.
- Un estudio sin ningún campo legible no se guarda: una fila que sólo diga "Electrocardiograma"
  sugiere que se leyó algo.
