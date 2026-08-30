# Manual Clínico — hoja de decisiones

> **Para el Dr. Jorge A. Luquetta.** Cada punto de este documento es una decisión **clínica e
> institucional** que el software no puede tomar. Mientras no estén firmadas, AnestIA calcula los
> puntajes y **retiene la interpretación**: el médico ve el número y las variables que lo
> sustentan, pero el documento no dice "riesgo alto".
>
> Estado: **sin firmar** · Última revisión técnica: 2026-08-30

---

## Por qué existe este documento

Los tres documentos de la Especificación remiten la versión final de cada instrumento, sus
puntos de corte y sus derechos de uso al **Manual Clínico**, que es institucional y todavía no
existe. Los instrumentos sí son internacionales y publicados, así que la tabla
(`packages/shared/src/scales/cutpoints.ts`) se sembró con los valores de las fuentes que la
propia Especificación cita, y las ocho quedaron marcadas `SIN_VALIDAR`.

**`SIN_VALIDAR` no significa "roto".** Significa que el puntaje se publica y la categoría no. Es
la única postura defendible: un umbral es una decisión de conducta institucional, y un documento
médico-legal firmado no debería decir "riesgo alto" apoyado en una tabla que nadie de la
institución revisó.

---

## Decisión 1 — Versión de Caprini

**La más urgente.** La Especificación advierte: *"No mezclar versiones ni duplicar un mismo
factor"*.

| | |
|---|---|
| Sembrado hoy | **Caprini 2005** (`caprini-2005@1`) |
| Alternativas | 2010 · 2013 |
| Qué cambia | El peso de varios factores y, con él, el umbral que dispara profilaxis |

Marque una: ☐ 2005 · ☐ 2010 · ☐ 2013 · ☐ una versión distinta por especialidad (indique cuál)

______________________________________________________________________________

## Decisión 2 — Puntos de corte de las ocho escalas

Cada tabla está sembrada con la fuente publicada. Marque **Acepto** o escriba el corte que
aplica en su institución.

| Escala | Versión sembrada | Fuente | Bandas sembradas | Acepto |
|---|---|---|---|---|
| **DASI** | `dasi-duke-1989@1` | Hlatky et al. (1989) | < 34.2 = reducida (< 4 METs) · ≥ 34.2 = conservada | ☐ |
| **STOP-Bang** | `stopbang-toronto@1` | stopbang.ca | 0-2 bajo · 3-4 intermedio · 5-8 alto | ☐ |
| **Apfel** | `apfel-1999@1` | Apfel (1999); Consenso PONV (2020) | 0 ~10 % · 1 ~20 % · 2 ~40 % · 3 ~60 % · 4 ~80 % | ☐ |
| **FRAIL** | `frail-spaqi@1` | SPAQI | 0 robusto · 1-2 prefrágil · 3-5 frágil | ☐ |
| **Caprini** | `caprini-2005@1` | Caprini RAM; ASH | 0-1 muy bajo · 2 bajo · 3-4 moderado · ≥ 5 alto | ☐ |
| **RCRI** | `rcri-lee@1` | Lee et al.; AHA/ACC 2024 | 0 ~0.4 % · 1 ~1 % · 2 ~2.4 % · ≥ 3 ≥ 5 % | ☐ |
| **ARISCAT** | `ariscat-canet-2010@1` | Canet et al. (2010) | < 26 bajo · 26-44 intermedio · ≥ 45 alto | ☐ |
| **POVOC** | `povoc-eberhart-2004@1` | Eberhart et al. (2004) | 0-1 ~10 % · 2 ~30 % · 3 ~55 % · 4 ~70 % | ☐ |

## Decisión 3 — Qué conducta dispara cada umbral

Un puntaje sin conducta asociada es un número. Para cada escala que vaya a usarse en la
práctica, indique qué debe pasar al superar el umbral (p. ej. *Caprini ≥ 5 → profilaxis
farmacológica salvo contraindicación*; *STOP-Bang ≥ 5 → considerar estudio de sueño previo*).

Esto **no** se automatiza: AnestIA no recomienda conducta. Sirve para que la recomendación que
usted escriba en el documento tenga un criterio escrito detrás.

______________________________________________________________________________

## Decisión 4 — Derechos de uso

| Instrumento | Titular | Situación |
|---|---|---|
| **STOP-Bang** | University Health Network / Universidad de Toronto | Exige permiso para uso comercial |
| **DASI** | Duke University | Exige permiso para uso comercial |

Marque: ☐ uso académico/interno, no comercial · ☐ se gestionará la licencia · ☐ se retiran del
sistema

## Decisión 5 — Umbrales de alerta de laboratorio

Hoy AnestIA **no usa umbrales propios**: marca cada resultado contra el **rango impreso en el
informe del propio paciente**. Es lo que pide la Especificación y evita heredar umbrales de otro
laboratorio.

Falta decidir sólo esto: ¿hay analitos donde el rango del laboratorio **no** basta y usted quiere
un umbral institucional? (p. ej. una hemoglobina "dentro de rango" que aun así cambia la
conducta anestésica). Si no los hay, marque ☐ *ninguno* y el comportamiento actual queda firmado.

## Decisión 6 — Vigencia de los exámenes

Sembrado: **3 meses** (`LAB_VIGENCIA_MESES`). La Especificación es explícita en que *no se
imponga una vigencia universal*: la aceptabilidad depende del analito y del paciente.

Hoy el sistema **avisa** de que un grupo está desactualizado, no lo descarta. Marque:
☐ 3 meses · ☐ otro plazo general (indique) · ☐ plazo por tipo de estudio (indique cuáles)

---

## Cuando esté firmado

El cambio en el código es **una línea por escala**: `validacion: 'VALIDADO'` en
`cutpoints.ts`, con la versión de la tabla que usted apruebe. A partir de ahí el documento
publica la categoría junto al puntaje. No hay que tocar nada más — los evaluadores, las
variables y los estados ya están construidos y probados.

Firma: ______________________________  Fecha: ______________

Dr. Jorge A. Luquetta — Anestesiología
