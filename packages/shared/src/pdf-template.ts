import type { DocumentJSON, DocField } from './document';

export interface Branding {
  logoUrl?: string | null;
  signatureUrl?: string | null;
  doctorName: string;
  specialty?: string | null;
  registry?: string | null;
  footer?: string | null;
}

export interface BuildOpts {
  draft?: boolean;
  fechaValoracion?: string; // ISO/legible — se pasa desde afuera (sin Date.now en shared)
}

/** Escapa HTML para prevenir inyección desde datos del paciente (SECURITY-05). */
export function escapeHtml(s: unknown): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function isExamPending(doc: DocumentJSON): boolean {
  const ex = doc.examen_fisico ?? {};
  const vals = Object.values(ex);
  if (vals.length === 0) return true;
  return vals.some((f) => f?.estado === 'pendiente_examen');
}

function fieldVal(f: DocField | undefined): string {
  if (!f || f.valor == null || f.estado !== 'ok') return '—';
  return escapeHtml(f.valor);
}

/** Partículas que van en minúscula dentro de un nombre propio en español. */
const NAME_PARTICLES = new Set(['de', 'del', 'la', 'las', 'los', 'y', 'e', 'da', 'do', 'dos']);

/**
 * Title-Case para nombres propios en español. Respeta partículas (de, la, y…),
 * corrige MAYÚSCULAS o minúsculas del paciente ("juan de la cruz" → "Juan de la Cruz").
 */
export function toTitleCase(raw: string): string {
  const words = raw.trim().toLowerCase().split(/\s+/);
  return words
    .map((w, i) => {
      if (i > 0 && NAME_PARTICLES.has(w)) return w;
      return w.charAt(0).toLocaleUpperCase('es') + w.slice(1);
    })
    .join(' ');
}

/** Línea bajo la firma: especialidad · RM, omitiendo partes vacías. */
function firmaSub(branding: Branding): string {
  const parts: string[] = [];
  if (branding.specialty) parts.push(escapeHtml(branding.specialty));
  if (branding.registry) parts.push('RM ' + escapeHtml(branding.registry));
  return parts.length ? `<div class="sub">${parts.join(' · ')}</div>` : '';
}

/** Celda del encabezado con el nombre normalizado a Title-Case. */
function nameCell(section: Record<string, DocField>, key: string, label: string): string {
  const f = section[key];
  const display: DocField | undefined =
    f && f.valor != null && f.estado === 'ok'
      ? { ...f, valor: toTitleCase(String(f.valor)) }
      : f;
  return `<div class="cell"><span class="k">${escapeHtml(label)}</span><span class="v${f?.alerta ? ' alerta' : ''}">${fieldVal(display)}</span></div>`;
}

function alertClass(f: DocField | undefined): string {
  return f?.alerta ? ' class="alerta"' : '';
}

/** Renderiza una celda etiqueta/valor del encabezado de identificación. */
function idCell(section: Record<string, DocField>, key: string, label: string): string {
  const f = section[key];
  return `<div class="cell"><span class="k">${escapeHtml(label)}</span><span class="v${f?.alerta ? ' alerta' : ''}">${fieldVal(f)}</span></div>`;
}

/** Bloque de 12 campos del encabezado (3 columnas × 4 filas), fiel a la referencia. */
function idGrid(section: Record<string, DocField>, cells: [string, string][]): string {
  return `<div class="idgrid">${cells
    .map(([key, label]) => (key === 'paciente' ? nameCell(section, key, label) : idCell(section, key, label)))
    .join('')}</div>`;
}

/** ¿Campo derivado por IA (dato inferido, no reportado directamente por el paciente)? */
function isDerived(f: DocField | undefined): boolean {
  return !!f && f.estado === 'ok' && typeof f.fuente === 'string' && f.fuente.startsWith('derivado');
}

/**
 * Filas etiqueta/valor. `skipAbsent`: omite filas cuyo campo no existe (p. ej. GLP-1
 * si no se declaró). Etiquetas en negrita terminadas en ":". Los campos derivados por IA
 * se marcan con ° (dato inferido — verificar).
 */
function rows(section: Record<string, DocField>, labels: [string, string][], skipAbsent = false): string {
  const visible = labels.filter(([key]) => !skipAbsent || section[key] !== undefined);
  return visible
    .map(([key, label], i) => {
      const f = section[key];
      const shade = i % 2 === 1 ? ' class="alt"' : '';
      const mark = isDerived(f) ? '<span class="der-mark" title="Dato inferido — verificar">°</span>' : '';
      return `<tr${shade}><th>${escapeHtml(label)}:</th><td${alertClass(f)}>${fieldVal(f)}${mark}</td></tr>`;
    })
    .join('');
}

/**
 * Construye el HTML del documento fiel al Diseño Oficial (docs/diseno-oficial.md).
 * Puro y determinístico. Marca de agua BORRADOR si draft o examen pendiente (CS3).
 */
export function buildDocumentHtml(doc: DocumentJSON, branding: Branding, opts: BuildOpts = {}): string {
  const draft = opts.draft || isExamPending(doc);
  const id: Record<string, DocField> = { ...(doc.identificacion ?? {}) };
  // Fecha de valoración: si el documento no la trae, usar la que pasa el renderer (sin Date.now en shared).
  if ((id.fecha_valoracion == null || id.fecha_valoracion.estado !== 'ok') && opts.fechaValoracion) {
    id.fecha_valoracion = { valor: opts.fechaValoracion, estado: 'ok', fuente: 'sistema:render' };
  }
  const ant = doc.antecedentes ?? {};
  const vp = doc.valoracion_plan ?? {};

  const paraclinicos = Object.entries(doc.paraclinicos ?? {})
    .map(([k, f], i) => {
      const shade = i % 2 === 1 ? ' class="alt"' : '';
      return `<tr${shade}><th>${escapeHtml(k.replace(/_/g, ' '))}</th><td${alertClass(f)}>${fieldVal(f)}</td></tr>`;
    })
    .join('') || '<tr><td colspan="2">No se cargaron paraclínicos.</td></tr>';

  const watermark = draft
    ? '<div class="watermark">BORRADOR — PENDIENTE DE EXAMEN Y APROBACIÓN</div>'
    : '';

  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><style>
  * { box-sizing: border-box; }
  body { font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 10px; color: #14212b; margin: 0; padding: 18px 22px 40px; position: relative; }
  .watermark { position: fixed; top: 42%; left: 8%; transform: rotate(-24deg); font-size: 34px; color: rgba(179,38,30,.14); font-weight: 800; letter-spacing: 2px; pointer-events: none; }
  header { display: grid; grid-template-columns: 120px 1fr 120px; align-items: center; border-bottom: 2px solid #0b5c6b; padding-bottom: 8px; }
  header .logo { display: flex; align-items: center; }
  header img { height: 44px; max-width: 120px; object-fit: contain; }
  header .title { text-align: center; }
  header .title h1 { margin: 0; font-size: 15px; color: #0b5c6b; letter-spacing: 1px; }
  header .title p { margin: 2px 0 0; font-size: 9px; color: #5b6b73; }
  h2.band { background: #084651; color: #fff; font-size: 10.5px; font-weight: 700; padding: 5px 9px; margin: 13px 0 0; letter-spacing: .6px; text-transform: uppercase; border-radius: 3px 3px 0 0; }
  table { width: 100%; border-collapse: collapse; background: #fbfdfd; border: 1px solid #d9e6e8; border-top: none; }
  th, td { text-align: left; padding: 3px 9px; vertical-align: top; }
  th { width: 34%; color: #0a3b44; font-weight: 700; }
  tr.alt { background: #eef5f6; }
  td.alerta { color: #b3261e; font-weight: 700; }
  .der-mark { color: #c8881a; font-weight: 700; margin-left: 2px; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0 14px; }
  .idgrid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 1px; background: #bcd0d3; border: 1px solid #bcd0d3; border-top: none; margin: 0 0 2px; }
  .idgrid .cell { background: #fff; padding: 5px 8px; min-width: 0; }
  .idgrid .cell .k { display: block; font-size: 7.5px; text-transform: uppercase; letter-spacing: .4px; color: #0a505d; font-weight: 700; margin-bottom: 1px; }
  .idgrid .cell .v { display: block; font-size: 10px; color: #14212b; overflow-wrap: anywhere; font-weight: 500; }
  .idgrid .cell .v.alerta { color: #b3261e; font-weight: 700; }
  .nota { font-size: 8px; color: #5b6b73; font-style: italic; margin-top: 3px; }
  .legend { font-size: 7.5px; color: #7a6a3a; background: #fdf6e8; border: 1px solid #ecdcb8; border-radius: 4px; padding: 4px 8px; margin-top: 8px; }
  .legend b { color: #c8881a; }
  .narrativo td { white-space: pre-line; }
  footer { position: fixed; bottom: 10px; left: 22px; right: 22px; font-size: 8px; color: #5b6b73; border-top: 1px solid #cdd7da; padding-top: 4px; display: flex; justify-content: space-between; }
  .firma { margin-top: 22px; page-break-inside: avoid; }
  .firma .sig-space { min-height: 40px; display: flex; align-items: flex-end; }
  .firma img { height: 40px; }
  .firma .line { border-top: 1px solid #14212b; width: 220px; margin-top: 2px; padding-top: 2px; font-weight: 600; }
  .firma .sub { font-size: 9px; color: #5b6b73; margin-top: 1px; }
  </style></head><body>
  ${watermark}
  <header>
    <div class="logo">${branding.logoUrl ? `<img src="${escapeHtml(branding.logoUrl)}" alt="logo">` : ''}</div>
    <div class="title"><h1>VALORACIÓN PREANESTÉSICA</h1><p>Evaluación preoperatoria para procedimiento electivo</p></div>
    <div></div>
  </header>

  <h2 class="band">IDENTIFICACIÓN</h2>
  ${idGrid(id, [
    ['paciente','Paciente'],['documento','Documento'],['edad_sexo','Edad / Sexo'],
    ['peso_talla_imc','Peso / Talla / IMC'],['diagnostico_preoperatorio','Diagnóstico preoperatorio'],['procedimiento','Procedimiento'],
    ['fecha_valoracion','Fecha de valoración'],['fecha_procedimiento','Fecha del procedimiento'],['capacidad_funcional','Capacidad funcional'],
    ['asa','Clasificación ASA'],['tipo_cirugia','Tipo de cirugía'],['condicion_actual','Condición actual'],
  ])}

  <h2 class="band">ANTECEDENTES Y MEDICACIÓN</h2>
  <table>${rows(ant, [
    ['patologicos','Patológicos'],['quirurgicos','Quirúrgicos'],['medicamentos','Medicamentos'],
    ['glp1','Uso de agonistas GLP-1'],['alergias','Alergias'],['transfusionales','Transfusionales'],
    ['protesis_dental','Prótesis dental / diseño de sonrisa'],['habitos','Hábitos'],
    ['grupo_sanguineo','Grupo sanguíneo'],
  ], true)}</table>

  <h2 class="band">PARACLÍNICOS DISPONIBLES</h2>
  <table>${paraclinicos}</table>

  <h2 class="band">EXAMEN FÍSICO</h2>
  <table>${rows(doc.examen_fisico ?? {}, [
    ['peso_talla_imc','Peso / Talla / IMC'],
    ['signos_vitales','Signos vitales'],['via_aerea','Vía aérea'],['cuello','Cuello'],
    ['cardiovascular_respiratorio','Cardiovascular / respiratorio'],['abdomen','Abdomen'],
    ['extremidades','Extremidades'],['snc','Sistema nervioso central'],
  ])}</table>
  <p class="nota">Los datos inferidos del examen físico y los signos vitales deben corroborarse antes del procedimiento.</p>

  <h2 class="band">VALORACIÓN Y PLAN</h2>
  <table class="narrativo">${rows(vp, [['concepto','Concepto anestésico'],['plan','Plan anestésico'],['recomendaciones','Recomendaciones']])}</table>

  ${draft ? '<div class="legend">Los datos marcados con <b>°</b> son inferidos por el sistema a partir de las respuestas del paciente y <b>deben ser verificados</b> por el anestesiólogo antes de aprobar el documento.</div>' : ''}

  <div class="firma">
    <div class="sig-space">${branding.signatureUrl ? `<img src="${escapeHtml(branding.signatureUrl)}" alt="firma">` : ''}</div>
    <div class="line">${escapeHtml(toTitleCase(branding.doctorName))}</div>
    ${firmaSub(branding)}
  </div>

  <footer><span>${escapeHtml(branding.footer ?? 'AnestIA')}</span><span>${escapeHtml(opts.fechaValoracion ?? '')}</span></footer>
  </body></html>`;
}
