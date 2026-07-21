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

/**
 * Auto-corrección CONSERVADORA para el pipeline: sólo devuelve un texto corregido cuando la
 * traducción es SEGURA y SIN PÉRDIDA — es decir, cuando el texto original, separado por comas/"y",
 * está compuesto EXCLUSIVAMENTE de términos que el diccionario reconoce por completo. Si alguna
 * parte lleva calificadores no reconocidos ("candidato a cirugía bariátrica", "obesidad mórbida"),
 * devuelve null: en esos casos traducir borraría contexto clínico, así que se deja para el criterio
 * del médico (el auditor lo señala como advertencia, no se auto-corrige).
 *
 * Ejemplos:
 *  - "vesícula"                              → "Colecistectomía"   (seguro)
 *  - "lipo, papada"                          → "Liposucción, …"    (todas reconocidas)
 *  - "Obesidad, candidato a cirugía bariátrica" → null             (se perdería "candidato a")
 *  - "operación de la nariz"                 → null                (ambiguo, no se elige)
 */
export function autoCorrectTerm(raw: string | null | undefined): string | null {
  if (!raw || !raw.trim()) return null;
  if (isAmbiguousProcedure(raw)) return null; // "operación de <parte>": nunca se elige
  const parts = raw.split(/,|\by\b|;|\/|\+/i).map((p) => p.trim()).filter(Boolean);
  if (parts.length === 0) return null;

  const out: string[] = [];
  let changed = false;
  for (const part of parts) {
    const n = norm(part);
    const rule = TERMS.find((r) => r.match.some((m) => matchesTerm(n, m)));
    if (!rule) {
      // Parte no reconocida: sólo es SEGURA si NO contiene ningún término de diccionario oculto
      // tras calificadores (p. ej. "candidato a cirugía bariátrica" contiene "cirugia bariatrica").
      const oculto = TERMS.find((r) => r.match.some((m) => matchesTerm(n, m)));
      if (oculto) return null; // hay un término dentro pero con contexto → no se puede sin perder
      out.push(part);
      continue;
    }
    // Parte reconocida: sólo es sin pérdida si la parte ES el término (más modificadores de
    // abordaje/lateralidad conocidos), no si trae palabras extra ("candidato a …").
    const mods = MODIFIERS.filter(([re]) => re.test(part)).map(([, label]) => label);
    const matched = rule.match.find((m) => matchesTerm(n, m)) ?? '';
    // Palabras de la parte que no son el término coloquial ni un modificador → contexto que se
    // perdería. Si las hay, no auto-corregir.
    const resto = n
      .replace(new RegExp(escapeRe(matched), 'ig'), ' ')
      .replace(/\b(laparosc[oó]pic[ao]|bilateral|derech[ao]|izquierd[ao])\b/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (resto !== '') return null; // había calificadores → dejar al médico
    out.push(mods.length ? `${rule.medical} ${mods.join(' ')}` : rule.medical);
    if (norm(rule.medical) !== n) changed = true;
  }
  const result = out.join(', ');
  return changed && norm(result) !== norm(raw) ? result : null;
}

/**
 * Partes del cuerpo que, dichas en coloquial ("operación de la nariz"), NO identifican un
 * procedimiento único — cada una admite varias cirugías con manejo anestésico distinto. Cuando
 * el paciente describe su cirugía como "operación/cirugía de <una de estas>", NO se debe elegir
 * un procedimiento específico (guardarraíl determinístico, CS2/seguridad clínica): el modelo
 * tiende a resolver "nariz"→rinoplastia por sesgo, y en anestesia eso es peligroso.
 *
 * Esta es una lista de PARTES ambiguas, no de procedimientos prohibidos. Un órgano unívoco
 * (vesícula, apéndice) NO va aquí porque su cirugía sí es única.
 */
const PARTES_AMBIGUAS = [
  'nariz', 'corazon', 'rodilla', 'ojo', 'ojos', 'espalda', 'columna', 'hombro', 'cadera',
  'muñeca', 'muneca', 'tobillo', 'cuello', 'garganta', 'oido', 'oreja', 'pie', 'mano',
  'estomago', 'cerebro', 'cabeza', 'pierna', 'brazo', 'pecho', 'senos', 'seno',
];

/**
 * ¿El procedimiento declarado es una descripción ambigua del tipo "operación de <parte>"?
 * Si lo es, el término del paciente debe conservarse tal cual (no elegir una cirugía específica).
 * Determinístico y puro.
 */
export function isAmbiguousProcedure(raw: string | null | undefined): boolean {
  if (!raw || !raw.trim()) return false;
  const n = norm(raw); // minúsculas, sin tildes
  // Patrón: "(operacion|cirugia|intervencion|procedimiento) [de/del/de la/en] <parte ambigua>"
  const m = n.match(/^(operacion|cirugia|intervencion|procedimiento)\s+(de\s+la\s+|de\s+las\s+|del\s+|de\s+los\s+|de\s+|en\s+la\s+|en\s+el\s+|en\s+)?([a-z\s]+?)$/);
  if (!m) return false;
  const parte = (m[3] ?? '').trim();
  // La parte (o su primera palabra) está en la lista de partes ambiguas.
  return PARTES_AMBIGUAS.some((p) => parte === p || parte.startsWith(p + ' ') || parte.endsWith(' ' + p) || parte.split(/\s+/).includes(p));
}
