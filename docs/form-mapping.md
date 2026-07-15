# Form Mapping — 22 preguntas → Documento

Cuestionario base (preset "Preanestésica general"). ⭐ = campo nuevo respecto de la plantilla previa.
🫁 = relevancia directa para vía aérea/anestesia. Fuente exhaustiva: Anexo A del PRD.

| # | Pregunta | Campo documento | Tipo | Notas |
|---|---|---|---|---|
| 1 | Nombre completo | Paciente | texto | obligatorio |
| 2 | Nº de documento | Documento | texto | obligatorio |
| 3 | Fecha de nacimiento | Edad | fecha→derivada | calcula edad |
| 4 | Sexo | Sexo | selección | ajusta rangos de labs |
| 5 | Peso (kg) | Peso/IMC | número | → IMC |
| 6 | Estatura (cm) | Talla/IMC | número | convertir cm→m |
| 7 | Teléfono | Contacto | texto | |
| 8 | ⭐ Entidad aseguradora | Aseguradora/destinatario | texto | alimenta directorio |
| 9 | Cirugía/procedimiento | Procedimiento | texto | |
| 10 | Fecha de cirugía | Fecha procedimiento | fecha | prioriza por urgencia |
| 11 | ⭐ Grupo sanguíneo | Grupo sanguíneo | selección | |
| 12 | ¿Sufre alguna enfermedad? | Antecedentes patológicos | sí/no | gatilla P13 |
| 13 | Patologías (checklist) | Antecedentes patológicos | multiselección | 🫁 apnea del sueño, HTP |
| 14 | ¿Toma medicamentos? | Medicamentos | texto | detección GLP-1 |
| 15 | ¿Alergias? | Alergias | texto | |
| 16 | ¿Cirugías/anestesias previas? | Ant. quirúrgicos/anestésicos | texto | |
| 17 | ⭐ ¿Transfusiones previas? | Ant. transfusionales | sí/no+detalle | |
| 18 | ¿Sustancias psicoactivas? | Hábitos | sí/no | |
| 19 | ¿Alcohol? | Hábitos | sí/no | |
| 20 | ¿Fuma/vapea? | Hábitos | sí/no | gatilla P21 |
| 21 | Cigarrillos/vapeo por día | Hábitos | número (condicional) | 🫁 |
| 22 | ⭐🫁 ¿Prótesis dental / diseño de sonrisa? | Vía aérea | sí/no+detalle | relevante intubación |
| — | Adjuntos | Paraclínicos | archivo | hemograma, coagulación, ECG, eco |
| — | Examen físico/signos vitales | Examen físico | pendiente_examen | nunca inventar |
| — | Diagnóstico·ASA·Concepto·Plan·Recomendaciones | Valoración y plan | IA (HITL) | derivado |

Checklist de patologías (P13): HTA, diabetes mellitus, hipotiroidismo, hipertiroidismo, arritmia,
infarto de miocardio, EPOC, asma, hipertensión pulmonar, apnea del sueño, litiasis renal, infección
renal a repetición, insuficiencia renal, gastritis, migraña, enfermedades articulares, otra.
