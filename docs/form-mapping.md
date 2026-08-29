# Form Mapping — diccionario de preguntas

> **Generado.** No editar a mano: sale de `packages/shared/src/dictionary/questions.ts`.
> Un test regenera esta tabla y falla si difiere. Fuente clínica: Especificación de
> Datos Mínimos del Dr. Luquetta.

**Los códigos son load-bearing**, no el orden. El motor clínico cita la fuente como
`formulario:CF01`, así que renombrar un código rompe la trazabilidad de todo documento
que ya lo referencie. El `order` es sólo presentación.

Total: **134 ítems**, de los cuales **12** no se le preguntan al paciente.

| Código | Pregunta | Tipo | Oblig. | Fuente | Se activa si | Alimenta |
|---|---|---|---|---|---|---|
| `ID01` | Nombre completo | TEXTO_CORTO | Obligatoria | Paciente | — | — |
| `ID02` | Número de documento de identificación | DOCUMENTO_ID | Obligatoria | Paciente | — | — |
| `ID03` | Fecha de nacimiento | FECHA | Obligatoria | Paciente | — | STOP_BANG, CAPRINI, ARISCAT, FRAIL, POVOC |
| `ID04` | Sexo registrado al nacer (dato usado para escalas clínicas y embarazo) | SELECCION_UNICA | Obligatoria | Paciente | — | STOP_BANG, APFEL |
| `ID05` | Número de teléfono de contacto | TELEFONO | Obligatoria | Paciente | — | — |
| `ID06` | Entidad aseguradora | SELECCION_UNICA | Obligatoria | Paciente | — | — |
| `ID07` | ¿Quién está respondiendo? | SELECCION_UNICA | Obligatoria | Paciente | — | — |
| `ID08` | Nombre y relación del acudiente | TEXTO_CORTO | Condicional | Paciente | alguna (2) | — |
| `ID09` | Grupo sanguíneo, si lo conoce | SELECCION_UNICA | Obligatoria | Paciente | — | — |
| `ID10` | ¿Cuál es su peso actual? | NUMERO | Obligatoria | Paciente | — | STOP_BANG, CAPRINI |
| `ID11` | ¿Cuál es su estatura? | NUMERO | Obligatoria | Paciente | — | STOP_BANG, CAPRINI |
| `ID12` | Correo electrónico | CORREO | Obligatoria | Paciente | — | — |
| `GO01` | ¿Existe posibilidad de embarazo actualmente? | SELECCION_UNICA | Condicional | Paciente | todas (3) | — |
| `GO02` | Fecha de la última menstruación | FECHA | Condicional | Paciente | todas (2) | — |
| `GO03` | ¿Tiene embarazo confirmado? | SELECCION_UNICA | Condicional | Paciente | GO01 in ["si","no sabe"] | — |
| `GO04` | Semanas de embarazo, si las conoce | NUMERO | Condicional | Paciente | GO03 equals "si" | — |
| `GO05` | ¿Está en las primeras 6 semanas después de un parto? | SI_NO_NOSABE | Condicional | Paciente | todas (3) | CAPRINI |
| `GO06` | ¿Usa anticonceptivos con estrógeno o terapia hormonal? | SI_NO_NOSABE | Condicional | Paciente | todas (3) | CAPRINI |
| `PX01` | Cirugía o procedimiento programado | TEXTO_CORTO | Sistema/agenda | Agenda | — | — |
| `PX02` | Diagnóstico preoperatorio | TEXTO_CORTO | Sistema/agenda | Agenda | — | — |
| `PX03` | Fecha del procedimiento | FECHA | Sistema/agenda | Agenda | — | — |
| `PX04` | Especialidad | SELECCION_UNICA | Sistema/agenda | Agenda | — | — |
| `PX05` | Modalidad | SELECCION_UNICA | Sistema/agenda | Agenda | — | CAPRINI |
| `PX06` | Prioridad | SELECCION_UNICA | Sistema/agenda | Agenda | — | ARISCAT |
| `PX07` | Sitio quirúrgico ARISCAT | SELECCION_UNICA | Sistema/agenda | Agenda | — | ARISCAT |
| `PX08` | Duración estimada | SELECCION_UNICA | Sistema/agenda | Agenda | — | ARISCAT, POVOC |
| `PX09` | Cirugía cardiovascular de alto riesgo RCRI | SELECCION_UNICA | Sistema/agenda | Agenda | — | RCRI |
| `PX10` | Anestesia probable | SELECCION_UNICA | Verifica el anestesiólogo | Agenda | — | APFEL |
| `PX11` | ¿Se esperan opioides posoperatorios? | SELECCION_UNICA | Verifica el anestesiólogo | Agenda | — | APFEL |
| `AP00` | ¿Un médico le ha diagnosticado alguna enfermedad o condición de salud? | SI_NO_NOSABE | Obligatoria | Paciente | — | — |
| `AG01` | Corazón y circulación | ACORDEON_MULTIPLE | Condicional | Paciente | AP00 equals "si" | — |
| `AG02` | Respiración y pulmones | ACORDEON_MULTIPLE | Condicional | Paciente | AP00 equals "si" | — |
| `AG03` | Hormonas y metabolismo | ACORDEON_MULTIPLE | Condicional | Paciente | AP00 equals "si" | — |
| `AG04` | Riñones e hígado | ACORDEON_MULTIPLE | Condicional | Paciente | AP00 equals "si" | — |
| `AG05` | Sangre y coagulación | ACORDEON_MULTIPLE | Condicional | Paciente | AP00 equals "si" | — |
| `AG06` | Sistema nervioso | ACORDEON_MULTIPLE | Condicional | Paciente | AP00 equals "si" | — |
| `AG07` | Digestión | ACORDEON_MULTIPLE | Condicional | Paciente | AP00 equals "si" | — |
| `AG08` | Cáncer y defensas | ACORDEON_MULTIPLE | Condicional | Paciente | AP00 equals "si" | — |
| `AG09` | Huesos, músculos y articulaciones | ACORDEON_MULTIPLE | Condicional | Paciente | AP00 equals "si" | — |
| `AG10` | Salud mental | ACORDEON_MULTIPLE | Condicional | Paciente | AP00 equals "si" | — |
| `AG11` | Otras condiciones | ACORDEON_MULTIPLE | Condicional | Paciente | AP00 equals "si" | — |
| `AP01` | ¿Está controlada? | SELECCION_UNICA | Condicional | Paciente | AP00 equals "si" | — |
| `AP02` | ¿Ha sido hospitalizado por esta enfermedad en los últimos 6 meses? | SI_NO_NOSABE | Condicional | Paciente | AP00 equals "si" | — |
| `AP03` | ¿Presenta actualmente alguno de estos síntomas? | SELECCION_MULTIPLE | Obligatoria | Paciente | ruta in ["ADULTO","ADULTO_MAYOR"] | DASI, RCRI |
| `AP04` | Durante el último mes, ¿ha tenido infección respiratoria? | SELECCION_UNICA | Obligatoria | Paciente | — | ARISCAT |
| `AP05` | ¿Tiene actualmente tos, fiebre, flema, congestión o silbidos? | SELECCION_MULTIPLE | Obligatoria | Paciente | — | — |
| `RX01` | ¿Toma actualmente medicamentos, inyecciones, inhaladores, gotas, vitaminas o productos naturales? | SI_NO_NOSABE | Obligatoria | Paciente | — | — |
| `RX02` | Agregue cada medicamento | REPETIDOR | Condicional | Paciente | RX01 equals "si" | — |
| `RX03` | ¿Utiliza anticoagulantes? | SELECCION_MULTIPLE | Condicional | Paciente | RX01 equals "si" | — |
| `RX04` | ¿Utiliza antiagregantes? | SELECCION_MULTIPLE | Condicional | Paciente | RX01 equals "si" | — |
| `RX05` | ¿Utiliza insulina? | SI_NO_NOSABE | Condicional | Paciente | alguna (2) | RCRI |
| `RX06` | Tipo, dosis y horario de la insulina | TEXTO_LARGO | Condicional | Paciente | RX05 equals "si" | — |
| `RX07` | ¿Utiliza medicamentos SGLT2? | SELECCION_MULTIPLE | Condicional | Paciente | RX01 equals "si" | — |
| `RX08` | ¿Usa corticoides por tiempo prolongado? | SELECCION_MULTIPLE | Condicional | Paciente | RX01 equals "si" | — |
| `RX09` | ¿Usa medicamentos naturales o suplementos? | TEXTO_LARGO | Condicional | Paciente | RX01 equals "si" | — |
| `GL01` | ¿Utiliza medicamentos para diabetes o pérdida de peso de este grupo? | SELECCION_MULTIPLE | Condicional | Paciente | alguna (2) | — |
| `GL02` | ¿Con qué frecuencia lo utiliza? | SELECCION_UNICA | Condicional | Paciente | todas (2) | — |
| `GL03` | ¿Cuándo fue la última dosis? | SELECCION_UNICA | Condicional | Paciente | todas (2) | — |
| `GL04` | ¿Está aumentando actualmente la dosis? | SI_NO_NOSABE | Condicional | Paciente | todas (2) | — |
| `GL05` | ¿Presenta síntomas digestivos actuales? | SELECCION_MULTIPLE | Condicional | Paciente | todas (2) | — |
| `AL01` | ¿Es alérgico a algún medicamento, alimento o sustancia? | SI_NO_NOSABE | Obligatoria | Paciente | — | — |
| `AL02` | ¿A qué es alérgico? | SELECCION_MULTIPLE | Condicional | Paciente | AL01 equals "si" | — |
| `AL03` | ¿Qué reacción presentó? | SELECCION_MULTIPLE | Condicional | Paciente | AL01 equals "si" | — |
| `AN01` | ¿Ha recibido anestesia o sedación previamente? | SI_NO_NOSABE | Obligatoria | Paciente | — | — |
| `AN02` | ¿Qué cirugías o procedimientos le realizaron? | TEXTO_LARGO | Condicional | Paciente | AN01 equals "si" | — |
| `AN03` | ¿Tuvo alguna complicación con la anestesia? | SELECCION_MULTIPLE | Condicional | Paciente | AN01 equals "si" | APFEL |
| `AN04` | ¿Algún familiar tuvo una complicación grave con la anestesia? | SI_NO_NOSABE | Obligatoria | Paciente | — | — |
| `AN05` | Describa la complicación del familiar | TEXTO_LARGO | Condicional | Paciente | AN04 equals "si" | — |
| `TR01` | ¿Ha recibido transfusión de sangre? | SI_NO_NOSABE | Obligatoria | Paciente | — | — |
| `TR02` | ¿Tuvo reacción a una transfusión? | SI_NO_NOSABE | Condicional | Paciente | TR01 equals "si" | — |
| `TR03` | ¿Acepta transfusiones si fueran necesarias? | SELECCION_UNICA | Obligatoria | Paciente | — | — |
| `DE01` | ¿Tiene prótesis dental, implantes, diseño de sonrisa o dientes flojos? | SELECCION_MULTIPLE | Obligatoria | Paciente | — | — |
| `HB01` | ¿Fuma cigarrillos o utiliza vapeadores? | SELECCION_UNICA | Obligatoria | Paciente | — | APFEL |
| `HB02` | ¿Cuántos cigarrillos fuma al día? | NUMERO | Condicional | Paciente | HB01 in ["cigarrillos actuales","ambos"] | — |
| `HB03` | ¿Cuántas veces usa el vapeador al día? | NUMERO | Condicional | Paciente | HB01 in ["vapeador actual","ambos"] | — |
| `HB04` | ¿Cuándo dejó de fumar? | TEXTO_CORTO | Condicional | Paciente | HB01 in ["exfumador"] | — |
| `HB05` | ¿Con qué frecuencia consume alcohol? | SELECCION_UNICA | Obligatoria | Paciente | — | — |
| `HB06` | ¿Ha consumido sustancias psicoactivas recientemente? | SELECCION_MULTIPLE | Obligatoria | Paciente | — | — |
| `HB07` | ¿Cuándo fue el último consumo? | SELECCION_UNICA | Condicional | Paciente | todas (2) | — |
| `CF01` | ¿Puede subir dos pisos por escaleras sin detenerse por falta de aire, dolor en el pecho, mareo o cansancio intenso? | SELECCION_UNICA | Obligatoria | Paciente | ruta in ["ADULTO","ADULTO_MAYOR"] | DASI |
| `CF02` | ¿Puede caminar cuatro cuadras o realizar labores domésticas moderadas sin esos síntomas? | SELECCION_UNICA | Obligatoria | Paciente | ruta in ["ADULTO","ADULTO_MAYOR"] | DASI |
| `D01` | Cuidarse personalmente: comer, vestirse, bañarse o usar el baño. | SELECCION_UNICA | Condicional | Paciente | todas (2) | DASI |
| `D02` | Caminar dentro de la casa. | SELECCION_UNICA | Condicional | Paciente | todas (2) | DASI |
| `D03` | Caminar una o dos cuadras en terreno plano. | SELECCION_UNICA | Condicional | Paciente | todas (2) | DASI |
| `D04` | Subir un piso o caminar por una pendiente. | SELECCION_UNICA | Condicional | Paciente | todas (2) | DASI |
| `D05` | Correr una distancia corta. | SELECCION_UNICA | Condicional | Paciente | todas (2) | DASI |
| `D06` | Realizar labores domésticas ligeras. | SELECCION_UNICA | Condicional | Paciente | todas (2) | DASI |
| `D07` | Realizar labores domésticas moderadas. | SELECCION_UNICA | Condicional | Paciente | todas (2) | DASI |
| `D08` | Realizar labores domésticas pesadas. | SELECCION_UNICA | Condicional | Paciente | todas (2) | DASI |
| `D09` | Realizar trabajo en el jardín. | SELECCION_UNICA | Condicional | Paciente | todas (2) | DASI |
| `D10` | Mantener actividad sexual. | SELECCION_UNICA | Condicional | Paciente | todas (2) | DASI |
| `D11` | Realizar actividades recreativas moderadas. | SELECCION_UNICA | Condicional | Paciente | todas (2) | DASI |
| `D12` | Practicar deportes o ejercicio intenso. | SELECCION_UNICA | Condicional | Paciente | todas (2) | DASI |
| `SB01` | ¿Ronca fuerte, más fuerte que hablar o se escucha desde otra habitación? | SI_NO_NOSABE | Obligatoria | Paciente | ruta in ["ADULTO","ADULTO_MAYOR"] | STOP_BANG |
| `SB02` | ¿Se siente cansado, fatigado o somnoliento durante el día? | SI_NO_NOSABE | Obligatoria | Paciente | ruta in ["ADULTO","ADULTO_MAYOR"] | STOP_BANG |
| `SB03` | ¿Alguien ha observado que deja de respirar mientras duerme? | SI_NO_NOSABE | Obligatoria | Paciente | ruta in ["ADULTO","ADULTO_MAYOR"] | STOP_BANG |
| `SB04` | ¿Tiene diagnóstico de apnea del sueño? | SI_NO_NOSABE | Obligatoria | Paciente | ruta in ["ADULTO","ADULTO_MAYOR"] | — |
| `SB05` | ¿Utiliza CPAP u otro dispositivo para dormir? | SELECCION_UNICA | Condicional | Paciente | alguna (2) | — |
| `SB06` | ¿Traerá su dispositivo el día del procedimiento? | SELECCION_UNICA | Condicional | Paciente | SB05 in ["si y lo uso regularmente","si pero no lo uso"] | — |
| `SB07` | Circunferencia del cuello | NUMERO | Verifica el anestesiólogo | Paciente | ruta in ["ADULTO","ADULTO_MAYOR"] | STOP_BANG |
| `NV01` | ¿Ha presentado náuseas o vómitos intensos después de una anestesia? | SI_NO_NOSABE | Obligatoria | Paciente | ruta in ["ADULTO","ADULTO_MAYOR"] | APFEL |
| `NV02` | ¿Se marea o vomita fácilmente durante viajes? | SI_NO_NOSABE | Obligatoria | Paciente | ruta in ["ADULTO","ADULTO_MAYOR"] | APFEL |
| `FR01` | ¿Se siente cansado la mayor parte del tiempo? | SI_NO_NOSABE | Condicional | Paciente | alguna (3) | FRAIL |
| `FR02` | ¿Tiene dificultad para subir un piso por escaleras? | SI_NO_NOSABE | Condicional | Paciente | alguna (3) | FRAIL |
| `FR03` | ¿Tiene dificultad para caminar una cuadra? | SI_NO_NOSABE | Condicional | Paciente | alguna (3) | FRAIL |
| `FR04` | ¿Tiene cinco o más enfermedades diagnosticadas? | SI_NO_NOSABE | Condicional | Agenda | alguna (3) | FRAIL |
| `FR05` | ¿Ha perdido más del 5% de su peso durante el último año sin proponérselo? | SI_NO_NOSABE | Condicional | Paciente | alguna (3) | FRAIL |
| `FR06` | ¿Usa ayuda para caminar? | SELECCION_UNICA | Condicional | Paciente | alguna (3) | — |
| `FR07` | ¿Necesita ayuda para bañarse, vestirse, alimentarse o usar el baño? | SELECCION_MULTIPLE | Condicional | Paciente | alguna (3) | — |
| `FR08` | ¿Ha tenido caídas durante el último año? | SELECCION_UNICA | Condicional | Paciente | alguna (3) | — |
| `FR09` | ¿Dispone de cuidador o apoyo después del procedimiento? | SELECCION_UNICA | Condicional | Paciente | alguna (3) | — |
| `TE01` | ¿Ha tenido trombosis venosa profunda o embolia pulmonar? | SI_NO_NOSABE | Condicional | Paciente | alguna (5) | CAPRINI |
| `TE02` | ¿Padres, hermanos o hijos han tenido trombosis o embolia? | SI_NO_NOSABE | Condicional | Paciente | alguna (5) | CAPRINI |
| `TE03` | ¿Le han diagnosticado una trombofilia? | SELECCION_MULTIPLE | Condicional | Paciente | alguna (5) | CAPRINI |
| `TE04` | ¿Tiene actualmente una pierna hinchada? | SI_NO_NOSABE | Condicional | Paciente | alguna (5) | — |
| `TE05` | ¿Tiene várices visibles? | SI_NO_NOSABE | Condicional | Paciente | alguna (5) | CAPRINI |
| `TE06` | ¿Ha permanecido en cama durante 3 días o más recientemente? | SI_NO_NOSABE | Condicional | Paciente | alguna (5) | CAPRINI |
| `TE07` | ¿Tiene yeso, férula o inmovilizador? | SI_NO_NOSABE | Condicional | Paciente | alguna (5) | CAPRINI |
| `TE08` | ¿Ha tenido sepsis, neumonía o infarto durante el último mes? | SELECCION_MULTIPLE | Condicional | Paciente | alguna (5) | CAPRINI |
| `TE09` | ¿Tiene enfermedad inflamatoria intestinal? | SI_NO_NOSABE | Condicional | Paciente | alguna (5) | CAPRINI |
| `TE10` | ¿Tiene cáncer activo o recibe quimioterapia? | SELECCION_UNICA | Condicional | Paciente | alguna (5) | CAPRINI |
| `TE11` | ¿Tiene un catéter venoso central? | SI_NO_NOSABE | Condicional | Paciente | alguna (5) | CAPRINI |
| `TE12` | ¿Ha tenido accidente cerebrovascular, fractura de cadera, pelvis o pierna, trauma mayor o lesión medular reciente? | SELECCION_MULTIPLE | Condicional | Paciente | alguna (5) | CAPRINI |
| `PD01` | ¿De cuántas semanas de embarazo nació el niño? | NUMERO | Condicional | Paciente | banda_etaria in ["NEONATO","LACTANTE","NINO"] | — |
| `PD02` | ¿Nació prematuro? | SI_NO_NOSABE | Condicional | Paciente | banda_etaria in ["NEONATO","LACTANTE","NINO"] | — |
| `PD03` | ¿Ha presentado apnea o pausas respiratorias? | SI_NO_NOSABE | Condicional | Paciente | ruta equals "PEDIATRICA" | — |
| `PD04` | ¿Tiene cardiopatía congénita, síndrome genético o enfermedad neuromuscular? | SI_NO_NOSABE | Condicional | Paciente | ruta equals "PEDIATRICA" | — |
| `PD05` | ¿Ha tenido recientemente resfriado, tos, fiebre, flema, congestión o silbidos? | SELECCION_MULTIPLE | Obligatoria | Paciente | ruta equals "PEDIATRICA" | ARISCAT |
| `PD06` | ¿Ronca o deja de respirar mientras duerme? | SELECCION_UNICA | Obligatoria | Paciente | ruta equals "PEDIATRICA" | — |
| `PD07` | ¿Ha sido hospitalizado por problemas respiratorios? | SI_NO_NOSABE | Condicional | Paciente | ruta equals "PEDIATRICA" | — |
| `PD08` | Fecha y motivo de la hospitalización respiratoria | TEXTO_LARGO | Condicional | Paciente | PD07 equals "si" | — |
| `PD09` | ¿Tiene dificultades importantes de comunicación, conducta o cooperación? | SI_NO_NOSABE | Condicional | Paciente | ruta equals "PEDIATRICA" | — |
| `PD10` | ¿El niño o un familiar ha presentado vómito después de una anestesia? | SELECCION_UNICA | Condicional | Paciente | ruta equals "PEDIATRICA" | POVOC |
| `DC01` | Adjunte sus exámenes de laboratorio e informes | ARCHIVO | Condicional | Paciente | — | — |

## Grupos de antecedentes (acordeones)

Cada grupo es **una** pregunta `ACORDEON_MULTIPLE`, no una pregunta por enfermedad.
`Ninguna de las anteriores` es excluyente y se valida también en el servidor.

| Grupo | Opciones |
|---|---|
| **Corazón y circulación** (`cardiovascular`) | 12 |
| **Respiración y pulmones** (`respiratorio`) | 8 |
| **Hormonas y metabolismo** (`endocrino_metabolico`) | 7 |
| **Riñones e hígado** (`renal_hepatico`) | 7 |
| **Sangre y coagulación** (`hematologico`) | 6 |
| **Sistema nervioso** (`neurologico`) | 7 |
| **Digestión** (`digestivo`) | 6 |
| **Cáncer y defensas** (`oncologico_inmune`) | 6 |
| **Huesos, músculos y articulaciones** (`musculoesqueletico`) | 6 |
| **Salud mental** (`psiquiatrico`) | 5 |
| **Otras condiciones** (`otras`) | 4 |

## Reglas que el formulario respeta

- `No sabe` nunca equivale a `No`. Un blanco tampoco produce una negación (CS2/CS10).
- Los datos de agenda (`Fuente: Agenda`) no se le muestran nunca al paciente.
- La edad y la ruta clínica se derivan de la fecha de nacimiento; el paciente no elige grupo.
- Al cerrarse una rama, sus respuestas se descartan antes de validar y de guardar.
