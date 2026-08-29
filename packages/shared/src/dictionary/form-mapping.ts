import { GRUPOS_PATOLOGIAS } from './groups';
import { QUESTION_DICTIONARY } from './questions';

/**
 * Genera `docs/form-mapping.md` desde el diccionario.
 *
 * El documento se GENERA, no se edita: antes era una tercera copia a mano de la misma lista
 * (junto al seed y al bloque de preguntas del prompt) y las tres se desincronizaban. Un test
 * regenera y compara byte a byte, así que CI es el sincronizador.
 */
const OBLIGACION_LABEL: Record<string, string> = {
  O: 'Obligatoria',
  C: 'Condicional',
  S: 'Sistema/agenda',
  V: 'Verifica el anestesiólogo',
};

const FUENTE_LABEL: Record<string, string> = {
  P: 'Paciente',
  S: 'Agenda',
  D: 'Documento',
  C: 'Clínico',
};

function resumenRegla(q: (typeof QUESTION_DICTIONARY)[number]): string {
  if (!q.activacion) return '—';
  const r = q.activacion;
  switch (r.kind) {
    case 'always': return '—';
    case 'never': return 'nunca';
    case 'answer': return `${r.code} ${r.op}${r.value != null ? ` ${JSON.stringify(r.value)}` : ''}`;
    case 'fact': return `${r.fact} ${r.op}${r.value != null ? ` ${JSON.stringify(r.value)}` : ''}`;
    case 'all': return `todas (${r.rules.length})`;
    case 'any': return `alguna (${r.rules.length})`;
    case 'not': return 'negación';
  }
}

export function buildFormMappingDoc(): string {
  const L: string[] = [];
  L.push('# Form Mapping — diccionario de preguntas');
  L.push('');
  L.push('> **Generado.** No editar a mano: sale de `packages/shared/src/dictionary/questions.ts`.');
  L.push('> Un test regenera esta tabla y falla si difiere. Fuente clínica: Especificación de');
  L.push('> Datos Mínimos del Dr. Luquetta.');
  L.push('');
  L.push('**Los códigos son load-bearing**, no el orden. El motor clínico cita la fuente como');
  L.push('`formulario:CF01`, así que renombrar un código rompe la trazabilidad de todo documento');
  L.push('que ya lo referencie. El `order` es sólo presentación.');
  L.push('');
  L.push(`Total: **${QUESTION_DICTIONARY.length} ítems**, de los cuales ` +
    `**${QUESTION_DICTIONARY.filter((q) => q.fuente !== 'P').length}** no se le preguntan al paciente.`);
  L.push('');
  L.push('| Código | Pregunta | Tipo | Oblig. | Fuente | Se activa si | Alimenta |');
  L.push('|---|---|---|---|---|---|---|');
  for (const q of QUESTION_DICTIONARY) {
    const label = q.label.replace(/\|/g, '\\|');
    L.push(
      `| \`${q.code}\` | ${label} | ${q.type} | ${OBLIGACION_LABEL[q.obligacion]} | ` +
      `${FUENTE_LABEL[q.fuente]} | ${resumenRegla(q)} | ${(q.alimenta ?? []).join(', ') || '—'} |`,
    );
  }
  L.push('');
  L.push('## Grupos de antecedentes (acordeones)');
  L.push('');
  L.push('Cada grupo es **una** pregunta `ACORDEON_MULTIPLE`, no una pregunta por enfermedad.');
  L.push('`Ninguna de las anteriores` es excluyente y se valida también en el servidor.');
  L.push('');
  L.push('| Grupo | Opciones |');
  L.push('|---|---|');
  for (const g of GRUPOS_PATOLOGIAS) {
    L.push(`| **${g.label}** (\`${g.key}\`) | ${g.opciones.length} |`);
  }
  L.push('');
  L.push('## Reglas que el formulario respeta');
  L.push('');
  L.push('- `No sabe` nunca equivale a `No`. Un blanco tampoco produce una negación (CS2/CS10).');
  L.push('- Los datos de agenda (`Fuente: Agenda`) no se le muestran nunca al paciente.');
  L.push('- La edad y la ruta clínica se derivan de la fecha de nacimiento; el paciente no elige grupo.');
  L.push('- Al cerrarse una rama, sus respuestas se descartan antes de validar y de guardar.');
  L.push('');
  return L.join('\n');
}
