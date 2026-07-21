# ¿Cómo funciona AnestIA? (explicado fácil)

> Este documento está escrito para **cualquier persona**, sin importar si sabe de tecnología
> o de medicina. Explica, paso a paso y con palabras sencillas, qué hace el programa.

---

## En una frase

**AnestIA ayuda al anestesiólogo a preparar, más rápido y con menos errores, el documento que
se necesita antes de una cirugía** — ese documento donde se revisa si el paciente está en
condiciones de ser anestesiado.

El programa hace el trabajo pesado (leer, ordenar, redactar un borrador), pero **el médico
siempre revisa y aprueba al final**. Nada sale sin su firma.

---

## ¿Qué problema resuelve?

Antes de operar a alguien, el anestesiólogo tiene que hacer una **valoración preanestésica**:
revisar la historia del paciente, sus exámenes de sangre, sus alergias, sus medicamentos, y
decidir si es seguro dormirlo para la cirugía y con qué plan.

Hacer eso a mano, paciente por paciente, toma tiempo: hay que leer papeles, pasar datos, escribir
el documento, revisar que no falte nada. AnestIA automatiza esa parte tediosa **sin quitarle al
médico la decisión final**.

---

## La idea más importante de todas

> **El programa nunca se inventa nada.**

Esta es la regla de oro. Cada dato que aparece en el documento tiene que venir de algún lugar
real:

- lo que **el paciente respondió** en un formulario,
- lo que **estaba escrito en un examen** que subió,
- o algo que **el propio médico** escribió o confirmó.

Si un dato no existe, el programa lo deja **en blanco** (dice "pendiente" o "no reportado"). Nunca
rellena con un valor "probable". Esto es porque el documento es **legal y médico**: una cifra
inventada podría hacer daño a una persona real.

---

## El recorrido completo, paso a paso

Imagina el viaje de un paciente por el programa, de principio a fin.

### Paso 1 — El médico crea un caso y envía un enlace

El anestesiólogo entra a su panel y crea un "caso" nuevo para un paciente. El programa genera un
**enlace único** (como un link privado). El médico se lo manda al paciente por WhatsApp, con su
propio teléfono. No hay nada complicado que configurar.

### Paso 2 — El paciente llena un formulario desde su celular

El paciente abre el enlace y responde un cuestionario sencillo: nombre, edad, peso, estatura, qué
cirugía le van a hacer, qué enfermedades tiene, qué medicamentos toma, si es alérgico, etc. También
puede **subir fotos o PDFs de sus exámenes de laboratorio** (por ejemplo, un examen de sangre).

Cuando termina y le da "enviar", empieza la parte automática.

### Paso 3 — El programa lee los exámenes de laboratorio

Aquí ocurre algo interesante. El programa tiene que sacar los números de los exámenes que el
paciente subió (hemoglobina, plaquetas, etc.). Lo hace **en cascada**, de lo más barato a lo más
costoso, para no gastar de más:

1. **Primero intenta leer el texto del PDF directamente.** Muchos PDFs de laboratorio ya traen el
   texto adentro (no son solo una foto). Si es así, sacar los datos es prácticamente gratis.
2. **Si el texto sirve, una IA pequeña lo ordena** en una tabla limpia (qué analito, qué valor,
   qué unidad).
3. **Si el PDF es solo una foto o está ilegible** (por ejemplo, una foto escaneada torcida),
   el programa **sube automáticamente a una IA con "visión"** que sabe leer imágenes. Esto pasa
   solo cuando de verdad hace falta, y queda registrado por qué.

Lo importante: **el programa solo escribe los valores que realmente leyó del examen.** Si no leyó
nada, no pone nada.

### Paso 4 — El programa marca los valores fuera de lo normal

Una vez tiene los números, el programa los compara con **rangos de referencia** (lo que se
considera normal). Si algo está fuera de rango — por ejemplo, hemoglobina muy baja o plaquetas
muy bajas — lo **marca con una alerta** para que el médico lo vea de inmediato.

Esto lo hace con reglas fijas y claras, no "a ojo". (Nota: estos rangos son un punto que el
Dr. Luquetta debe validar clínicamente antes de dejarlos definitivos.)

### Paso 5 — El programa redacta un borrador de la valoración

Ahora la IA principal (la más capaz, la que se usa para lo médico) arma el **borrador del
documento clínico**. Con los datos reales del paciente:

- **Copia** lo que el paciente respondió (antecedentes, medicamentos, alergias…), citando de
  dónde salió cada cosa.
- **Calcula** lo que se puede calcular con seguridad: el IMC (índice de masa corporal) se saca
  del peso y la talla con una fórmula, no lo "opina" la IA.
- **Deriva** con cuidado algunas cosas a partir de datos reales: una sugerencia de riesgo
  (clasificación "ASA"), un diagnóstico preoperatorio, un borrador de plan y de recomendaciones.
  Todo esto queda **marcado como derivado**, para que el médico sepa que debe revisarlo.

**Lo que el programa NUNCA hace solo:** llenar el examen físico ni los signos vitales (presión,
frecuencia cardíaca, etc.). Esos **siempre quedan en "pendiente"**, porque nadie los ha medido
todavía — los tiene que tomar el médico en persona. El documento **no se puede aprobar** mientras
esos campos sigan pendientes.

### Paso 6 — Un segundo revisor automático (auditor)

Antes de mostrarle nada al médico, un **segundo módulo independiente revisa el borrador**, como
un corrector. Busca cosas que no cuadren: un campo sin fuente, un valor que parezca inventado, un
examen que se haya llenado cuando debería estar pendiente. Si encuentra problemas, los deja
anotados para que el médico los vea.

### Paso 7 — Se arma el documento en PDF (borrador)

Con todo listo, el programa genera un **PDF con la apariencia oficial** (logo de la clínica, datos
del médico, etc.). Mientras el examen físico esté pendiente, el PDF lleva una **marca de agua que
dice "BORRADOR"**, para que a nadie se le olvide que todavía no está aprobado. Los valores
derivados llevan una marquita (°) que recuerda "esto hay que verificarlo".

### Paso 8 — El médico revisa y aprueba (el momento clave)

El anestesiólogo recibe aviso de que hay un caso listo para revisar. Abre su panel y ve:

- El borrador completo, campo por campo, con la fuente de cada dato.
- Los **exámenes originales** que subió el paciente (puede abrirlos y verlos él mismo).
- Los laboratorios agrupados y con su fecha.
- Las **notas privadas** que él haya escrito sobre ese paciente (su libreta personal — ver más
  abajo).
- Las observaciones del auditor automático.

El médico **completa el examen físico y los signos vitales** (los que midió en persona), corrige
lo que haga falta, y cuando está conforme, **aprueba y firma**. Solo entonces el documento deja de
ser borrador.

Una vez aprobado, el documento queda **congelado (inmutable)**: no se puede cambiar. Si hubo un
error, se puede reabrir el caso, pero eso queda registrado (quién, qué, cuándo).

### Paso 9 — Se distribuye el documento final

El médico puede enviar el PDF firmado a quien corresponda (la clínica, el paciente, otro
especialista) desde el mismo programa.

---

## Dos ayudas extra que tiene el médico

### El calendario de cirugías

Como el paciente dice en el formulario **qué día es su cirugía**, el programa arma un
**calendario** en el panel del médico. Ahí ve todas sus cirugías del mes o de la semana, con el
nombre del paciente, el procedimiento y en qué estado va cada caso.

- Si una cirugía es **en menos de 48 horas y la valoración todavía no está aprobada**, aparece con
  una **alerta roja** — es trabajo urgente que el médico debe atender.
- Puede **"Añadir a mi calendario"** con un toque: el programa entrega un archivo que abre
  directamente la app de calendario del celular o del computador. Sin configurar nada.
- Además, cada mañana le llega un **correo** con las cirugías de hoy y de mañana, destacando las
  que están en menos de 48 horas sin aprobar. Si no tiene cirugías, no le llega correo (para no
  llenarle la bandeja).

### Las notas privadas del paciente

Cuando un paciente vuelve para otra cirugía, el médico a veces quiere recordar cosas de la vez
anterior que **no van en el documento oficial**: "prefiere menos midazolam", "familia muy
ansiosa", "vía aérea difícil, usar videolaringoscopio".

El programa le deja guardar **notas privadas** por paciente. Son suyas:

- **Solo él las ve.** Ningún otro médico ni el paciente.
- **Nunca entran al documento oficial ni al PDF ni a lo que se envía.** Son su libreta personal.
- Cuando abre un caso nuevo de un paciente que ya tiene notas, **aparecen solas** en la pantalla,
  sin que tenga que buscarlas.

---

## ¿Por qué es confiable? (las reglas de seguridad)

El programa está construido sobre unas reglas que **no se pueden saltar**, pensadas para que nunca
haga daño:

1. **Siempre decide el médico.** La IA nunca envía ni aprueba nada sola.
2. **Nunca inventa datos clínicos.** Todo tiene que venir de una fuente real.
3. **El examen físico y los signos vitales siempre quedan pendientes** hasta que el médico los
   mida. Nunca se ponen "normales" por defecto.
4. **La IA puede calcular y derivar de datos reales, pero no inventar.**
5. **Todo lo que produce la IA se revisa contra un formato estricto**; si trae algo raro o un
   campo que no debería, se rechaza.
6. **Todo dato que entra o sale se valida.**
7. **La versión aprobada es inmutable y queda registro de todo** (quién hizo qué y cuándo).

---

## Una analogía para cerrar

Piensa en AnestIA como **un asistente muy ordenado y muy honesto**:

- Recoge los papeles del paciente y los pasa en limpio.
- Subraya lo que parece fuera de lo normal.
- Escribe un **primer borrador** del informe, diciendo siempre de dónde sacó cada dato.
- Deja **en blanco, a propósito**, todo lo que no le consta.
- Y le entrega ese borrador al médico para que **él lo complete, lo corrija y lo firme**.

El asistente hace rápido lo aburrido. El médico pone el criterio y la responsabilidad. Ninguno
hace el trabajo del otro — y por eso el resultado es a la vez **rápido y seguro**.
