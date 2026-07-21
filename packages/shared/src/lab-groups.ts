/**
 * Agrupación de paraclínicos por tipo de estudio (hemograma, coagulación, bioquímica…).
 *
 * El grupo lo asigna el extractor de visión leyendo los encabezados del informe real
 * (el PDF de laboratorio ya viene seccionado). Aquí sólo se normaliza esa etiqueta a un
 * conjunto cerrado y se ordena para el render: el documento agrupa una fila por estudio
 * en vez de una fila por analito, que es lo que alargaba el PDF.
 *
 * CS2: un grupo que no se reconoce cae en OTROS. Nunca se adivina el estudio de un analito.
 */

/** Grupos conocidos, en el orden en que aparecen en el documento. */
export const LAB_GRUPOS = [
  'hemograma',
  'coagulacion',
  'bioquimica',
  'uroanalisis',
  'endocrinologia',
  'inmunologia',
  'microbiologia',
  'otros',
] as const;
export type LabGrupo = (typeof LAB_GRUPOS)[number];

/** Etiqueta del estudio para el encabezado de la fila del documento. */
const ETIQUETAS: Record<LabGrupo, string> = {
  hemograma: 'Hemograma',
  coagulacion: 'Coagulación',
  bioquimica: 'Bioquímica',
  uroanalisis: 'Uroanálisis',
  endocrinologia: 'Perfil hormonal',
  inmunologia: 'Inmunología',
  microbiologia: 'Microbiología',
  otros: 'Otros estudios',
};

export function grupoLabel(grupo: LabGrupo): string {
  return ETIQUETAS[grupo];
}

/** ¿La clave es uno de los grupos canónicos? (el render la distingue de claves antiguas). */
export function isLabGrupo(key: string): key is LabGrupo {
  return (LAB_GRUPOS as readonly string[]).includes(key);
}

/** Sinónimos frecuentes en los informes colombianos → grupo canónico. */
const SINONIMOS: [RegExp, LabGrupo][] = [
  [/hemograma|cuadro\s*hematico|hematolog|sangre\s*perif/, 'hemograma'],
  [/coagul|hemostas|pruebas\s*de\s*coag/, 'coagulacion'],
  [/bioquim|quimica\s*sangu|perfil\s*(lipid|renal|hepat|metabol)|electrolit|glucosa|funcion\s*(renal|hepat)/, 'bioquimica'],
  [/uroanal|parcial\s*de\s*orina|urian|citoquimico\s*de\s*orina|orina/, 'uroanalisis'],
  [/endocrin|hormon|tiroid|tsh|t3|t4|cortisol|insulina/, 'endocrinologia'],
  [/inmuno|serolog|marcador/, 'inmunologia'],
  [/microbiol|cultivo|gram|antibiog/, 'microbiologia'],
];

/** Quita tildes y baja a minúsculas para comparar etiquetas del informe. */
function normalize(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

/**
 * Normaliza la etiqueta de grupo que devolvió el extractor a un grupo canónico.
 * Lo que no se reconoce (o viene vacío) → 'otros'.
 */
export function normalizeGrupo(raw: string | null | undefined): LabGrupo {
  const n = normalize(raw ?? '');
  if (!n) return 'otros';
  if ((LAB_GRUPOS as readonly string[]).includes(n)) return n as LabGrupo;
  for (const [re, grupo] of SINONIMOS) {
    if (re.test(n)) return grupo;
  }
  return 'otros';
}

/** Orden estable de los grupos para el render. */
export function sortGrupos(grupos: LabGrupo[]): LabGrupo[] {
  return [...grupos].sort((a, b) => LAB_GRUPOS.indexOf(a) - LAB_GRUPOS.indexOf(b));
}

/** Lab ya extraído y flageado, tal como entra al motor clínico. */
export interface GroupableLab {
  analyte: string;
  value: string;
  unit?: string | null;
  grupo?: string | null;
  flag?: string | null;
  /** Fecha del informe (AAAA-MM-DD) leída del examen. Null si el informe no la traía. */
  reportDate?: string | null;
  sourceRef?: string | null;
}

/**
 * Meses tras los cuales un paraclínico se considera desactualizado para cirugía electiva.
 * Umbral por defecto — PENDIENTE de validación del Dr. Luquetta, igual que lab-rules.md.
 */
export const LAB_VIGENCIA_MESES = 3;

/** Fecha del grupo: la más antigua de sus analitos (la que marca la vigencia). */
function oldestDate(labs: GroupableLab[]): string | null {
  const fechas = labs.map((l) => l.reportDate).filter((d): d is string => !!d && /^\d{4}-\d{2}-\d{2}$/.test(d));
  return fechas.length ? fechas.sort()[0]! : null;
}

/** "2026-04-10" → "10-04-2026" (formato del documento). */
export function formatReportDate(iso: string): string {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : iso;
}

/** Meses transcurridos entre dos fechas ISO. `hoy` se pasa desde afuera (sin Date.now aquí). */
function mesesDesde(iso: string, hoy: string): number | null {
  const a = new Date(`${iso}T00:00:00Z`);
  const b = new Date(`${hoy}T00:00:00Z`);
  if (isNaN(a.getTime()) || isNaN(b.getTime())) return null;
  return (b.getUTCFullYear() - a.getUTCFullYear()) * 12 + (b.getUTCMonth() - a.getUTCMonth());
}

/** "Hemoglobina" + "15.9" + "g/dL" → "Hemoglobina 15.9 g/dL". */
function analyteText(l: GroupableLab): string {
  const unit = l.unit?.trim();
  return `${l.analyte.trim()} ${l.value.trim()}${unit ? ' ' + unit : ''}`;
}

/**
 * Frase de cierre del grupo. Sólo dice lo que sostienen los flags: enumera lo alterado,
 * o declara que lo reportado está en rango. Nunca interpreta más allá de eso (CS2).
 */
function closingSentence(labs: GroupableLab[]): string {
  const alterados = labs.filter((l) => l.flag && l.flag !== 'NORMAL');
  if (alterados.length === 0) return 'Dentro de los rangos reportados.';
  const lista = alterados
    .map((l) => `${l.analyte.trim()} (${String(l.flag).toLowerCase()})`)
    .join(', ');
  return `Alteración en: ${lista}. Correlacionar clínicamente.`;
}

/**
 * Agrupa los labs por tipo de estudio y devuelve, por grupo, una sola línea en prosa:
 * "Hb 15.9 g/dL; Hto 48.2%; … Dentro de los rangos reportados."
 *
 * Una fila por estudio en vez de una por analito — así el documento no crece sin control.
 * El grupo lo trae el extractor; lo que no se reconoce cae en OTROS, no se adivina (CS2).
 */
export function groupLabsToProse(
  labs: GroupableLab[],
  hoy?: string,
): {
  grupo: LabGrupo;
  label: string;
  texto: string;
  alerta: boolean;
  fecha: string | null;
  desactualizado: boolean;
  fuentes: string[];
}[] {
  const porGrupo = new Map<LabGrupo, GroupableLab[]>();
  for (const l of labs ?? []) {
    const g = normalizeGrupo(l.grupo);
    const arr = porGrupo.get(g);
    if (arr) arr.push(l);
    else porGrupo.set(g, [l]);
  }

  return sortGrupos([...porGrupo.keys()]).map((grupo) => {
    const items = porGrupo.get(grupo)!;
    const valores = items.map(analyteText).join('; ');
    const fecha = oldestDate(items);

    // Antigüedad: sólo se afirma si el informe traía fecha. Sin fecha se dice que falta,
    // nunca se asume que el examen es reciente (CS2).
    const meses = fecha && hoy ? mesesDesde(fecha, hoy) : null;
    const desactualizado = meses != null && meses >= LAB_VIGENCIA_MESES;

    // La prosa del DOCUMENTO no incluye la fecha del informe: al receptor final no le incumbe.
    // La fecha y la vigencia viajan como metadato estructurado (`fecha`/`desactualizado`) para
    // que la UI de revisión avise SÓLO al médico si el examen está viejo. No se pierde el dato,
    // se saca del texto que llega al PDF.
    const partes = [`${valores}.`, closingSentence(items)];

    return {
      grupo,
      label: grupoLabel(grupo),
      texto: partes.join(' '),
      // Un examen viejo se marca en rojo igual que un valor alterado: cambia la lectura.
      alerta: items.some((l) => l.flag && l.flag !== 'NORMAL') || desactualizado,
      fecha,
      desactualizado,
      fuentes: items.map((l) => l.sourceRef).filter((s): s is string => !!s),
    };
  });
}
