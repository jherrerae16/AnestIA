import { getMulti } from '../answers';
import type { FormAnswers } from '../form';
import { INSTANCE_SEP } from '../rules';
import { CODIGOS_ACORDEON } from './codes';
import { OPCIONES_CIERRE, PATOLOGIA_POR_SLUG, SLUG_POR_LABEL } from './groups';

/**
 * Instancias de las preguntas repetidas por enfermedad.
 *
 * La Especificación §5 pide, para CADA enfermedad seleccionada, saber si está controlada
 * (`AP01`). Una sola pregunta para el conjunto no sirve: un paciente puede tener la hipertensión
 * controlada y la diabetes no, y esa diferencia cambia el ASA y el plan.
 *
 * Cada instancia se guarda con la clave `AP01#<slug>`, donde el slug es el identificador estable
 * de la patología — no su etiqueta, para que reescribir el texto no huerfane las respuestas.
 */

export interface InstanciaPatologia {
  /** Clave de respuesta: `AP01#hipertension_arterial`. */
  key: string;
  /** Slug de la patología. */
  slug: string;
  /** Etiqueta que ve el paciente. */
  label: string;
}

/** ¿Es una opción de cierre ("Ninguna", "Otra", "No sabe") y no un diagnóstico? */
function esCierre(opcion: string): boolean {
  return (OPCIONES_CIERRE as readonly string[]).includes(opcion) || opcion.startsWith('Otra: ');
}

/**
 * Patologías realmente marcadas por el paciente, en todos los acordeones.
 *
 * Se descartan las opciones de cierre: "Ninguna de las anteriores" no es una enfermedad de la
 * que preguntar si está controlada.
 */
export function patologiasMarcadas(answers: FormAnswers): InstanciaPatologia[] {
  const out: InstanciaPatologia[] = [];
  const vistos = new Set<string>();

  for (const code of CODIGOS_ACORDEON) {
    for (const label of getMulti(answers, code)) {
      if (esCierre(label)) continue;
      const slug = SLUG_POR_LABEL.get(
        label.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''),
      );
      if (!slug || vistos.has(slug)) continue;
      vistos.add(slug);
      out.push({ key: `AP01${INSTANCE_SEP}${slug}`, slug, label });
    }
  }
  return out;
}

/**
 * Instancias de una pregunta repetible, dadas las respuestas actuales.
 *
 * Hoy sólo `AP01` repite; la función queda genérica para las que la especificación añada.
 */
export function instanciasDe(code: string, answers: FormAnswers): InstanciaPatologia[] {
  return code === 'AP01' ? patologiasMarcadas(answers) : [];
}

/** Enfermedades marcadas cuyo control aún no se respondió. */
export function controlesFaltantes(answers: FormAnswers): InstanciaPatologia[] {
  return patologiasMarcadas(answers).filter((i) => {
    const v = answers[i.key]?.value;
    return v == null || String(v).trim() === '';
  });
}

/** Enfermedades declaradas NO controladas. Alimentan el ASA y el plan. */
export function noControladas(answers: FormAnswers): InstanciaPatologia[] {
  return patologiasMarcadas(answers).filter(
    (i) => String(answers[i.key]?.value ?? '').toLowerCase().startsWith('no controlada'),
  );
}

export { PATOLOGIA_POR_SLUG };
