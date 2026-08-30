import { normalizeValue } from './rules';

/**
 * Concordancia de identidad entre un informe de laboratorio y el caso activo.
 *
 * La Especificación §15 lo pide en el primer paso del procesamiento: *"Verificar paciente,
 * documento y fecha"*, y entre los metadatos obligatorios exige *"identidad del paciente y
 * concordancia con el caso activo"*.
 *
 * El riesgo que cubre es concreto: un paciente sube por error el examen de un familiar, o el
 * laboratorio adjunta el informe equivocado. Sin esta comprobación, esos valores alimentarían
 * escalas y alertas de otra persona en un documento firmado.
 */

export type IdentityMatch = 'COINCIDE' | 'NO_COINCIDE' | 'NO_VERIFICABLE';

export interface IdentidadCaso {
  fullName: string;
  documentId: string;
}

/** Lo que el extractor pudo leer de la cabecera del informe. Todo opcional: puede no aparecer. */
export interface IdentidadInforme {
  nombre?: string | null;
  documento?: string | null;
}

export interface ResultadoIdentidad {
  match: IdentityMatch;
  /** Explicación para el médico. Nunca "no coincide" a secas. */
  motivo: string;
}

/** Sólo dígitos, para comparar documentos con y sin puntos de miles. */
function soloDigitos(v: string): string {
  return v.replace(/\D/g, '');
}

/**
 * Compara nombres tolerando el orden y las partículas.
 *
 * Un informe puede decir "URIBE GONZALEZ ROBERTO MARIO" y el caso "Roberto Mario Uribe
 * González". Exigir igualdad literal marcaría como discordante casi todo.
 */
function nombresConcuerdan(a: string, b: string): boolean {
  const partes = (s: string) =>
    new Set(
      normalizeValue(s)
        .split(/\s+/)
        .filter((p) => p.length > 2 && !['de', 'del', 'la', 'las', 'los'].includes(p)),
    );
  const A = partes(a);
  const B = partes(b);
  if (A.size === 0 || B.size === 0) return false;

  const comunes = [...A].filter((p) => B.has(p)).length;
  // Dos apellidos o un nombre y un apellido en común bastan; pedir coincidencia total fallaría
  // con nombres compuestos que el laboratorio abrevia.
  return comunes >= 2 || comunes === Math.min(A.size, B.size);
}

/**
 * Verifica que el informe sea del paciente del caso.
 *
 * El documento manda: si coincide, coincide, aunque el nombre esté escrito distinto. Si no hay
 * documento en el informe, se cae al nombre. Si no hay ninguno de los dos, es `NO_VERIFICABLE`
 * — que NO es lo mismo que "no coincide": el resultado se conserva y se marca para que el
 * médico lo revise, en vez de descartarlo o darlo por bueno.
 */
export function verificarIdentidad(
  caso: IdentidadCaso,
  informe: IdentidadInforme,
): ResultadoIdentidad {
  const docInforme = soloDigitos(String(informe.documento ?? ''));
  const docCaso = soloDigitos(caso.documentId ?? '');

  if (docInforme && docCaso) {
    if (docInforme === docCaso) {
      return { match: 'COINCIDE', motivo: 'El documento del informe coincide con el del caso.' };
    }
    return {
      match: 'NO_COINCIDE',
      motivo: `El informe está a nombre del documento ${informe.documento}, y el caso es de ${caso.documentId}.`,
    };
  }

  const nombreInforme = String(informe.nombre ?? '').trim();
  if (nombreInforme && caso.fullName) {
    if (nombresConcuerdan(nombreInforme, caso.fullName)) {
      return {
        match: 'COINCIDE',
        motivo: 'El nombre del informe concuerda con el del paciente (el informe no trae documento).',
      };
    }
    return {
      match: 'NO_COINCIDE',
      motivo: `El informe está a nombre de "${nombreInforme}" y el paciente es ${caso.fullName}.`,
    };
  }

  return {
    match: 'NO_VERIFICABLE',
    motivo: 'El informe no trae nombre ni documento legibles; no se pudo confirmar de quién es.',
  };
}

/** ¿Estos resultados pueden alimentar escalas y alertas? Sólo si la identidad no discrepa. */
export function identidadUsable(match: IdentityMatch): boolean {
  return match !== 'NO_COINCIDE';
}
