/**
 * Normalización de lenguaje coloquial → término médico para documentos clínicos.
 * Diccionario local determinístico (sin key). Lo que no esté aquí se deja capitalizado;
 * cuando exista la key, el motor clínico (Claude) refina los términos no reconocidos.
 *
 * Claves en minúscula sin acentos; se comparan por inclusión de palabra completa.
 */
interface TermRule {
  /** Patrones coloquiales (minúscula, sin acentos). */
  match: string[];
  /** Término médico correcto. */
  medical: string;
}

const TERMS: TermRule[] = [
  // Estética / plástica
  { match: ['lipo', 'liposuccion', 'lipoescultura'], medical: 'Liposucción' },
  { match: ['lipopapada'], medical: 'Liposucción submentoniana' },
  { match: ['bichectomia', 'bichectomía', 'bolas de bichat'], medical: 'Bichectomía' },
  { match: ['aumento de senos', 'aumento de busto', 'implante de senos', 'protesis mamaria', 'protesis de senos', 'pechos', 'busto'], medical: 'Mamoplastia de aumento' },
  { match: ['reduccion de senos', 'reduccion de busto'], medical: 'Mamoplastia de reducción' },
  { match: ['levantamiento de senos', 'levantamiento de busto'], medical: 'Mastopexia' },
  { match: ['pompis', 'cola', 'gluteos', 'levantamiento de cola', 'aumento de gluteos'], medical: 'Gluteoplastia' },
  { match: ['abdominoplastia', 'quitar la barriga', 'lagartija', 'delantal'], medical: 'Abdominoplastia' },
  { match: ['nariz', 'operacion de nariz', 'rinoplastia', 'arreglar la nariz'], medical: 'Rinoplastia' },
  { match: ['parpados', 'bolsas de los ojos', 'blefaroplastia'], medical: 'Blefaroplastia' },
  { match: ['estiramiento facial', 'lifting', 'ritidectomia'], medical: 'Ritidectomía' },
  { match: ['orejas', 'otoplastia'], medical: 'Otoplastia' },
  // Otorrino
  { match: ['tabique', 'desviacion del tabique', 'septoplastia'], medical: 'Septoplastia' },
  { match: ['cornetes', 'turbinoplastia'], medical: 'Turbinoplastia' },
  { match: ['amigdalas', 'anginas', 'amigdalectomia'], medical: 'Amigdalectomía' },
  { match: ['adenoides', 'adenoidectomia'], medical: 'Adenoidectomía' },
  // Abdominal / general
  { match: ['apendice', 'apendicitis', 'apendicectomia'], medical: 'Apendicectomía' },
  { match: ['vesicula', 'colecisto', 'colecistectomia', 'piedras en la vesicula'], medical: 'Colecistectomía' },
  { match: ['hernia', 'hernia inguinal', 'herniorrafia', 'hernioplastia'], medical: 'Herniorrafia' },
  { match: ['bypass gastrico', 'balon gastrico', 'manga gastrica', 'gastrectomia en manga', 'cirugia bariatrica'], medical: 'Cirugía bariátrica' },
  { match: ['apendicectomia laparoscopica'], medical: 'Apendicectomía laparoscópica' },
  // Gineco / uro
  { match: ['cesarea', 'cesárea'], medical: 'Cesárea' },
  { match: ['ligadura', 'ligadura de trompas', 'pomeroy'], medical: 'Ligadura de trompas' },
  { match: ['matriz', 'sacar la matriz', 'histerectomia'], medical: 'Histerectomía' },
  { match: ['legrado', 'curetaje'], medical: 'Legrado uterino' },
  { match: ['prostata', 'rtu', 'reseccion de prostata'], medical: 'Resección prostática' },
  { match: ['circuncision', 'postomia'], medical: 'Circuncisión' },
  { match: ['vasectomia'], medical: 'Vasectomía' },
  // Ortopedia
  { match: ['rodilla', 'menisco', 'artroscopia de rodilla'], medical: 'Artroscopia de rodilla' },
  { match: ['cadera', 'protesis de cadera', 'reemplazo de cadera'], medical: 'Artroplastia de cadera' },
  { match: ['tunel carpiano', 'sindrome del tunel'], medical: 'Liberación del túnel carpiano' },
  { match: ['osteosintesis', 'placas y tornillos', 'clavos'], medical: 'Osteosíntesis' },
  // Odonto / oftalmo
  { match: ['muela', 'muela del juicio', 'cordal', 'sacar muela', 'exodoncia'], medical: 'Exodoncia' },
  { match: ['diseno de sonrisa', 'diseño de sonrisa'], medical: 'Diseño de sonrisa' },
  { match: ['cataratas', 'facoemulsificacion'], medical: 'Facoemulsificación de catarata' },
  { match: ['pterigio', 'carnosidad'], medical: 'Pterigión' },
  // Vascular / cardio
  { match: ['varices', 'safenectomia'], medical: 'Safenectomía' },
  { match: ['cateterismo'], medical: 'Cateterismo cardíaco' },
];

/** Sufijos que indican abordaje/lateralidad y se preservan tras el término base. */
const MODIFIERS: [RegExp, string][] = [
  [/laparosc[oó]pic[ao]/i, 'laparoscópica'],
  [/bilateral/i, 'bilateral'],
  [/derech[ao]/i, 'derecha'],
  [/izquierd[ao]/i, 'izquierda'],
];

function norm(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

function titleCaseFirst(s: string): string {
  const t = s.trim();
  return t ? t.charAt(0).toLocaleUpperCase('es') + t.slice(1) : t;
}

/**
 * Traduce un término (o lista separada por comas/"y") a su equivalente médico.
 * - Reconocido → término médico + modificadores detectados.
 * - No reconocido → capitalizado tal cual (marcado para revisión/IA).
 * Devuelve { text, unresolved } donde `unresolved` lista lo que no se pudo traducir.
 */
/** Escapa un término para usarlo dentro de una expresión regular. */
function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * ¿El texto contiene el término como PALABRA completa?
 *
 * Con `includes` a secas, "lipoma" contenía "lipo" y un lipoma (tumor benigno) se traducía
 * a "Liposucción" en el documento firmado. El procedimiento del paciente no se adivina por
 * coincidencia de letras (CS2): o coincide la palabra, o el texto se deja tal cual.
 */
function matchesTerm(texto: string, termino: string): boolean {
  return new RegExp(`(?<![a-z0-9])${escapeRe(termino)}(?![a-z0-9])`, 'i').test(texto);
}

export function toMedicalTerms(raw: string): { text: string; unresolved: string[] } {
  const parts = raw
    .split(/,|\by\b|;|\/|\+/i)
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length === 0) return { text: titleCaseFirst(raw), unresolved: [] };

  const out: string[] = [];
  const unresolved: string[] = [];
  for (const part of parts) {
    const n = norm(part);
    const rule = TERMS.find((r) => r.match.some((m) => matchesTerm(n, m)));
    if (rule) {
      const mods = MODIFIERS.filter(([re]) => re.test(part)).map(([, label]) => label);
      out.push(mods.length ? `${rule.medical} ${mods.join(' ')}` : rule.medical);
    } else {
      out.push(titleCaseFirst(part));
      unresolved.push(part);
    }
  }
  return { text: out.join(', '), unresolved };
}

/** Solo el texto traducido (conveniencia). */
export function medicalTerm(raw: string | null | undefined): string | null {
  if (!raw || !raw.trim()) return null;
  return toMedicalTerms(raw).text;
}
