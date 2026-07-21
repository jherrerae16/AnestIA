# Próximos trabajos (registrados durante las tandas de corrección)

## Mejorar la extracción de `refRange`
**Origen:** Tanda A'' (rangos del examen). En una muestra real de 108 analitos (2 exámenes),
**27/108 quedaron con `refRange` vacío o ilegible** — no por fallo del parser, sino porque la
extracción no capturó el rango. Concentrado en:
- Cualitativos de uroanálisis (LEUCOCITOS/ESTEARASA, NITRITOS, PROTEINAS, CETONAS, BILIRRUBINA =
  "Negativo") — se extrajo el valor sin su rango/criterio.
- Algunos lípidos (HDL, LDL, Lipoproteína a) — `refRange=""`.

**Trabajo:** reforzar el prompt de extracción (`anthropic.ts` extractLabs / `docs/lab-rules.md`)
para capturar el rango de referencia con más fiabilidad, incluidos los criterios cualitativos.

**Métrica para medir mejora:** hoy = 27/108 vacíos (~25%). Re-medir tras el cambio con la misma
muestra real. El audit log `lab.range_unparsed` ya registra cada fallo con el string original —
usar esa evidencia para ajustar con datos, no adivinanzas.
