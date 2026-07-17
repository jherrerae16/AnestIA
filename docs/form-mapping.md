# Form Mapping — cuestionario base → Documento

Cuestionario base (preset "Preanestésica general"), tal como está sembrado en `prisma/seed.ts`.
**Los números (P#) son load-bearing:** el motor lee las respuestas por `order`, así que este mapping
debe coincidir con el seed y con la constante `PREGUNTAS` de `lib/ai/anthropic.ts`. 🫁 = relevancia
directa para vía aérea/anestesia. Fuente exhaustiva del dominio: Anexo A del PRD.

26 preguntas; varias son condicionales (se muestran según una respuesta previa).

| P# | Pregunta | Tipo | Campo documento | Notas |
|---|---|---|---|---|
| 1 | Nombre completo | texto | Paciente | obligatorio; Title-Case al guardar |
| 2 | Número de documento | texto | Documento | obligatorio; sin puntos de miles |
| 3 | Fecha de nacimiento | fecha | Edad (derivada) | calcula edad |
| 4 | Sexo | selección | Edad/Sexo | Hombre/Mujer/Prefiero no decirlo; ajusta rangos de labs |
| 5 | Peso (kg) | número | Peso/Talla/IMC | → IMC |
| 6 | Estatura (cm) | número | Peso/Talla/IMC | cm→m |
| 7 | Teléfono de contacto | texto | Contacto | |
| 8 | Entidad aseguradora | selección | Aseguradora | Particular/Otra |
| 9 | Cirugía o procedimiento | texto | Procedimiento | traducción coloquial→médico (por palabra) |
| 10 | Fecha de cirugía | fecha | Fecha procedimiento | |
| 11 | Grupo sanguíneo | selección | Grupo sanguíneo | |
| 12 | ¿Sufre de alguna enfermedad? | sí/no | Antec. patológicos | gatilla P13 |
| 13 | Patologías (checklist) | multiselección | Antec. patológicos | condicional (P12=sí); 🫁 apnea, HTP |
| 14 | ¿Toma medicamentos actualmente? | sí/no | Medicamentos | gatilla P15 |
| 15 | ¿Cuáles medicamentos? | texto | Medicamentos | condicional (P14=sí); **detección GLP-1** |
| 16 | ¿Es alérgico a algún medicamento/sustancia? | sí/no | Alergias | gatilla P17 |
| 17 | ¿A qué es alérgico? | texto | Alergias | condicional (P16=sí) |
| 18 | ¿Cirugía/anestesia previa? | sí/no | Ant. quirúrgicos | gatilla P19 |
| 19 | ¿Cuáles cirugías? | texto | Ant. quirúrgicos | condicional (P18=sí); traducción médica |
| 20 | ¿Transfusión sanguínea previa? | sí/no | Ant. transfusionales | |
| 21 | 🫁 ¿Prótesis dental / diseño de sonrisa? | sí/no | Vía aérea | relevante para intubación |
| 22 | ¿Fuma o vapea? | sí/no | Hábitos | gatilla P23 |
| 23 | 🫁 ¿Cuántos cigarrillos/vapeo al día? | texto | Hábitos | condicional (P22=sí) |
| 24 | ¿Consume alcohol? | sí/no | Hábitos | |
| 25 | ¿Consume sustancias psicoactivas? | sí/no | Hábitos | |
| 26 | Correo electrónico | texto | Contacto/destinatario | |
| — | Adjuntos (opcional) | archivo | Paraclínicos | extracción en cascada (texto→visión) |
| — | Examen físico / signos vitales | — | Examen físico | `pendiente_examen`; nunca inventar (CS3) |
| — | Diagnóstico·ASA·Concepto·Plan·Recomendaciones | — | Valoración y plan | IA derivado, confirma el médico (HITL) |

**Negaciones (CS2):** para los sí/no, el documento sólo escribe "Niega X" si el paciente respondió
**No** explícitamente. Si dejó la pregunta en blanco, el campo queda sin reportar — no se afirma una
negación que el paciente no hizo.

**GLP-1:** se detecta del detalle de medicamentos (P15), no del sí/no (P14).
