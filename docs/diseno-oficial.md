# Diseño Oficial — Plantilla de salida (PDF)

Contrato de render. El motor llena campos; Playwright arma el PDF. Una página cuando sea posible.
Fuente exhaustiva y ejemplo de referencia (caso Roberto Mario Uribe): Anexo C del PRD.

## Estructura
1. **Encabezado:** logo de clínica (perfil) · título "VALORACIÓN PREANESTÉSICA" · subtítulo.
2. **Identificación (rejilla):** Paciente · Documento · Edad/Sexo · Peso/Talla/IMC · Diagnóstico
   preoperatorio · Procedimiento · Fecha valoración · Fecha procedimiento · Capacidad funcional (METs) ·
   ASA · Condición actual. (Procedimiento y "tipo de cirugía" se fusionaron en un solo campo.)
3. **Antecedentes y medicación:** Patológicos · Quirúrgicos · Anestésicos · Medicamentos ·
   Uso de GLP-1 (con última dosis) · Alergias · Grupo sanguíneo ⭐ · Transfusionales ⭐ ·
   Prótesis dental ⭐ · Hábitos · Síntomas actuales.
4. **Paraclínicos disponibles:** tabla Estudio | Resultado relevante (solo lo cargado/extraído;
   alertas destacadas).
5. **Examen físico:** Peso/Talla/IMC · Signos vitales · Vía aérea · Cuello · Cardiovascular/respiratorio ·
   Abdomen · Extremidades · SNC. **Pendiente hasta que el anestesiólogo lo confirme.**
   Nota: "Examen físico y signos vitales verificados por el anestesiólogo tratante."
6. **Valoración y plan:** Concepto anestésico · Plan anestésico · Recomendaciones.
7. **Firma:** firma visual del perfil · nombre · especialidad · registro médico.
8. **Pie:** texto institucional + paginación.

## Estilo
Encabezados de sección con banda de color; filas con sombreado alterno; branding del perfil
(logo/firma/colores); densidad alta pero legible; una página.
