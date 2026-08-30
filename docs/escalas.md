# Escalas de riesgo perioperatorio

> Documento que el Dr. Luquetta revisa y firma. Los **puntos de corte** viven en
> `packages/shared/src/scales/cutpoints.ts`; mientras una escala esté `SIN_VALIDAR`, el sistema
> publica el puntaje y **retiene la interpretación**.

## Los cuatro estados

Cada escala termina en uno de estos (Especificación §17):

| Estado | Significado | ¿Bloquea aprobar? |
|---|---|---|
| `NO_INDICADA` | El perfil o el procedimiento no cumplen criterios de activación. | No |
| `PENDIENTE` | Falta una variable indispensable. | **No** |
| `CALCULADA` | Variables completas, coherentes y validadas. | No |
| `REVISION_CLINICA` | Discordancia o criterio profesional necesario. | **Sí**, sin resolver |

`PENDIENTE` no bloquea a propósito: bloquear presionaría al médico a inventar el dato que falta
para destrabar el PDF, que es el modo de falla que CS3 existe para prevenir, invertido.

## Las ocho

| Escala | Se activa | Variables que consume |
|---|---|---|
| **DASI** | Tamizaje funcional dudoso, síntomas o cirugía elevada | `D01`–`D12` con sus pesos originales |
| **STOP-Bang** | Todos los adultos | `SB01`–`SB03`, HTA de antecedentes, IMC, edad, cuello, sexo |
| **Apfel** | Cuando el plan anestésico permite estimar NVPO | Sexo, tabaco, NVPO o cinetosis (**un solo factor**), opioides `PX11` |
| **FRAIL** | ≥ 65 años, o disparadores de dependencia | `FR01`–`FR05` |
| **Caprini** | Cirugía mayor, hospitalización, oncología, inmovilidad o TEV | Edad, IMC, `TE01`–`TE12` |
| **RCRI** | Cirugía no cardíaca con evaluación pertinente | `PX09`, antecedentes, insulina, **creatinina de laboratorio** |
| **ARISCAT** | Estratificación pulmonar | Edad, **SpO2 medida**, infección respiratoria, **Hb de laboratorio**, `PX06`–`PX08` |
| **POVOC** | Paciente pediátrico | Edad, duración, estrabismo, `PD10` |

## Reglas que el motor respeta

- **CS9 — ninguna variable sale de un dato no medido.** Una variable sólo es admisible si su
  procedencia está en la lista blanca: `formulario:`, `agenda:`, `lab:`, `documento:`,
  `anestesiologo:` o `sistema:calculo`. Nunca `derivado:` ni un estimado del sistema.
- **SpO2, tensión, frecuencias, vía aérea, CFS y ASA definitiva son exclusivamente del
  anestesiólogo.** La Especificación lo dice sin matices: la SpO2 "nunca se infiere". Sin ella
  medida, ARISCAT queda `PENDIENTE` — no se completa con un valor de referencia.
- **CS10 — "No sabe" no es "no".** Deja la variable sin resolver y la escala en `PENDIENTE`.
- **Las calcula el código, nunca el modelo.** Mismo patrón que los paraclínicos: se arman por
  código y se sobrescribe lo que devuelva el proveedor. Un puntaje que firma el anestesiólogo no
  puede depender de que un modelo lo recuerde bien.
- **Cada resultado guarda las variables exactas** que lo sustentan, con su valor, su procedencia
  y los puntos que aportó. Un puntaje sin sus variables no es auditable.

## Pendiente antes de producción

Las ocho están **`SIN_VALIDAR`**. Las decisiones que faltan están recogidas, una por una y en
forma de casillas, en **[`manual-clinico-decisiones.md`](manual-clinico-decisiones.md)** — esa es
la hoja que el Dr. revisa y firma. En resumen, falta definir:

1. **Caprini**: qué versión (2005, 2010 o 2013) aplica a cada especialidad. La Especificación
   advierte: *"No mezclar versiones ni duplicar un mismo factor"*. Hoy está sembrado 2005.
2. **Derechos de uso**: STOP-Bang (Universidad de Toronto) y DASI (Duke) exigen permiso para uso
   comercial.
3. **Umbrales de conducta**: qué puntaje dispara qué acción en la institución.

Las fuentes bibliográficas de cada tabla están en `cutpoints.ts`, tomadas de las que citan los
tres documentos del Dr.
