import type { DocumentJSON, DocField, ScaleSnapshot } from './document';
import { grupoLabel, isLabGrupo } from './lab-groups';

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
  // Un estimado en standby ('estimado_ia') NO es examen resuelto: mantiene la marca BORRADOR.
  return vals.some((f) => f?.estado === 'pendiente_examen' || f?.estado === 'estimado_ia');
}

function fieldVal(f: DocField | undefined): string {
  if (!f || f.valor == null) return '—';
  // Estimado en standby: se muestra el valor pero SIEMPRE etiquetado como no medido (CS3),
  // para que nadie lo lea como una medición real en el documento firmado.
  if (f.estado === 'estimado_ia') {
    return `${escapeHtml(f.valor)} <span class="est-mark">(estimado — sin medir)</span>`;
  }
  if (f.estado !== 'ok') return '—';
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

/**
 * El realce rojo de alerta y la marca ° de derivado son HERRAMIENTAS DE TRABAJO del borrador:
 * ayudan al médico a revisar. En el documento FINAL aprobado no van — el médico ya dio su visto
 * bueno consciente y los hallazgos ya están explicados en su concepto/recomendaciones; los rojos
 * en un entregable formal generan alarma innecesaria y se ven poco profesionales. Por eso ambos
 * se condicionan a `draft`.
 */

/** Celda del encabezado con el nombre normalizado a Title-Case. */
function nameCell(section: Record<string, DocField>, key: string, label: string, draft: boolean): string {
  const f = section[key];
  const display: DocField | undefined =
    f && f.valor != null && f.estado === 'ok'
      ? { ...f, valor: toTitleCase(String(f.valor)) }
      : f;
  return `<div class="cell"><span class="k">${escapeHtml(label)}</span><span class="v${draft && f?.alerta ? ' alerta' : ''}">${fieldVal(display)}</span></div>`;
}

/** Clase de alerta (rojo) — solo en el borrador. */
function alertClass(f: DocField | undefined, draft: boolean): string {
  return draft && f?.alerta ? ' class="alerta"' : '';
}

/** Renderiza una celda etiqueta/valor del encabezado de identificación. */
function idCell(section: Record<string, DocField>, key: string, label: string, draft: boolean): string {
  const f = section[key];
  return `<div class="cell"><span class="k">${escapeHtml(label)}</span><span class="v${draft && f?.alerta ? ' alerta' : ''}">${fieldVal(f)}</span></div>`;
}

/** Bloque de 12 campos del encabezado (3 columnas × 4 filas), fiel a la referencia. */
function idGrid(section: Record<string, DocField>, cells: [string, string][], draft: boolean): string {
  return `<div class="idgrid">${cells
    .map(([key, label]) => (key === 'paciente' ? nameCell(section, key, label, draft) : idCell(section, key, label, draft)))
    .join('')}</div>`;
}

/** Primera letra en mayúscula, resto tal cual ("grupo sanguineo" → "Grupo sanguineo"). */
function sentenceCase(s: string): string {
  return s.charAt(0).toLocaleUpperCase('es') + s.slice(1);
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
function rows(section: Record<string, DocField>, labels: [string, string][], draft: boolean, skipAbsent = false): string {
  const visible = labels.filter(([key]) => !skipAbsent || section[key] !== undefined);
  return visible
    .map(([key, label], i) => {
      const f = section[key];
      const shade = i % 2 === 1 ? ' class="alt"' : '';
      // La marca ° de derivado solo en el borrador (herramienta de revisión, no del entregable).
      const mark = draft && isDerived(f) ? '<span class="der-mark" title="Dato inferido — verificar">°</span>' : '';
      return `<tr${shade}><th>${escapeHtml(label)}:</th><td${alertClass(f, draft)}>${fieldVal(f)}${mark}</td></tr>`;
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
  if ((id['fecha_valoracion'] == null || id['fecha_valoracion'].estado !== 'ok') && opts.fechaValoracion) {
    id['fecha_valoracion'] = { valor: opts.fechaValoracion, estado: 'ok', fuente: 'sistema:render' };
  }
  const escalasHtml = renderEscalas(doc.escalas ?? []);
  const ant = doc.antecedentes ?? {};
  const vp = doc.valoracion_plan ?? {};

  // Paraclínicos: una fila por tipo de estudio. Las claves ya vienen agrupadas desde el
  // motor (clinical.service); las de documentos antiguos (una clave por analito) siguen
  // renderizando con su propio nombre.
  const paraclinicos = Object.entries(doc.paraclinicos ?? {})
    .map(([k, f], i) => {
      const shade = i % 2 === 1 ? ' class="alt"' : '';
      const label = isLabGrupo(k) ? grupoLabel(k) : sentenceCase(k.replace(/_/g, ' '));
      return `<tr${shade}><th class="estudio">${escapeHtml(label)}</th><td${alertClass(f, draft)}>${fieldVal(f)}</td></tr>`;
    })
    .join('') || '<tr><td colspan="2">No se cargaron paraclínicos.</td></tr>';

  const watermark = draft
    ? '<div class="watermark">BORRADOR — PENDIENTE DE EXAMEN Y APROBACIÓN</div>'
    : '';

  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><style>
  * { box-sizing: border-box; }
  body { font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 10px; color: #14212b; margin: 0; padding: 0; position: relative; }
  .watermark { position: fixed; top: 42%; left: 8%; transform: rotate(-24deg); font-size: 34px; color: rgba(179,38,30,.14); font-weight: 800; letter-spacing: 2px; pointer-events: none; }
  header { display: grid; grid-template-columns: 120px 1fr 120px; align-items: center; border-bottom: 2px solid #0b5c6b; padding-bottom: 8px; }
  header .logo { display: flex; align-items: center; }
  header img { height: 44px; max-width: 120px; object-fit: contain; }
  header .title { text-align: center; }
  header .title h1 { margin: 0; font-size: 15px; color: #0b5c6b; letter-spacing: 1px; }
  header .title p { margin: 2px 0 0; font-size: 9px; color: #5b6b73; }
  h2.band { background: #084651; color: #fff; font-size: 10.5px; font-weight: 700; padding: 5px 9px; margin: 13px 0 0; letter-spacing: .6px; border-radius: 3px 3px 0 0; }
  /* Escalas de riesgo: el estado se lee de un vistazo, junto al puntaje. */
  .esc-chip { display: inline-block; font-size: 8px; font-weight: 700; padding: 1px 6px; border-radius: 8px; letter-spacing: .3px; margin-right: 5px; vertical-align: middle; }
  .esc-calculada { background: #ecfdf3; color: #027a48; }
  .esc-pendiente { background: #fffaeb; color: #b54708; }
  .esc-revision_clinica { background: #fef3f2; color: #b42318; }
  .esc-no_indicada { background: #f2f4f7; color: #475467; }
  .esc-falta { font-size: 8.5px; color: #b54708; margin-top: 2px; }
  .esc-nota { font-size: 8.5px; color: #667085; font-style: italic; }
  .esc-ver { font-size: 7.5px; color: #98a2b3; margin-top: 1px; }
  table { width: 100%; border-collapse: collapse; background: #fbfdfd; border: 1px solid #d9e6e8; border-top: none; }
  th, td { text-align: left; padding: 3px 9px; vertical-align: top; }
  th { width: 34%; color: #0a3b44; font-weight: 700; }
  th.estudio { width: 22%; letter-spacing: .3px; }
  tr { page-break-inside: avoid; }
  tr.alt { background: #eef5f6; }
  td.alerta { color: #b3261e; font-weight: 700; }
  .der-mark { color: #c8881a; font-weight: 700; margin-left: 2px; }
  .est-mark { color: #b3261e; font-weight: 600; font-style: italic; font-size: 8.5px; }
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

  <h2 class="band">Identificación</h2>
  ${idGrid(id, [
    ['paciente','Paciente'],['documento','Documento'],['edad_sexo','Edad / Sexo'],
    ['peso_talla_imc','Peso / Talla / IMC'],['diagnostico_preoperatorio','Diagnóstico preoperatorio'],['procedimiento','Procedimiento'],
    ['fecha_valoracion','Fecha de valoración'],['fecha_procedimiento','Fecha del procedimiento'],['capacidad_funcional','Capacidad funcional'],
    ['asa','Clasificación ASA'],['condicion_actual','Condición actual'],
  ], draft)}

  <h2 class="band">Antecedentes y medicación</h2>
  <table>${rows(ant, [
    ['patologicos','Patológicos'],['quirurgicos','Quirúrgicos'],['medicamentos','Medicamentos'],
    ['glp1','Uso de agonistas GLP-1'],['alergias','Alergias'],['transfusionales','Transfusionales'],
    ['protesis_dental','Prótesis dental / diseño de sonrisa'],['habitos','Hábitos'],
    ['grupo_sanguineo','Grupo sanguíneo'],
  ], draft, true)}</table>

  <h2 class="band">Paraclínicos disponibles</h2>
  <table>${paraclinicos}</table>

  ${escalasHtml}

  <h2 class="band">Examen físico</h2>
  <table>${rows(doc.examen_fisico ?? {}, [
    ['peso_talla_imc','Peso / Talla / IMC'],
    ['signos_vitales','Signos vitales'],['via_aerea','Vía aérea'],['cuello','Cuello'],
    ['cardiovascular_respiratorio','Cardiovascular / respiratorio'],['abdomen','Abdomen'],
    ['extremidades','Extremidades'],['snc','Sistema nervioso central'],
  ], draft)}</table>
  <p class="nota">Los datos inferidos del examen físico y los signos vitales deben corroborarse antes del procedimiento.</p>

  <h2 class="band">Valoración y plan</h2>
  <table class="narrativo">${rows(vp, [['concepto','Concepto anestésico'],['plan','Plan anestésico'],['recomendaciones','Recomendaciones']], draft)}</table>

  ${draft ? '<div class="legend">Los datos marcados con <b>°</b> son inferidos por el sistema a partir de las respuestas del paciente y <b>deben ser verificados</b> por el anestesiólogo antes de aprobar el documento.</div>' : ''}

  <div class="firma">
    <div class="sig-space">${branding.signatureUrl ? `<img src="${escapeHtml(branding.signatureUrl)}" alt="firma">` : ''}</div>
    <div class="line">${escapeHtml(toTitleCase(branding.doctorName))}</div>
    ${firmaSub(branding)}
  </div>

  </body></html>`;
}

/**
 * Pie de página del PDF. Va como `footerTemplate` de Playwright, NO dentro del body:
 * un `position: fixed` en el body sólo se ancla al viewport de impresión y el contenido
 * de las páginas siguientes le pasa por encima. El margin box de Chromium sí lo reserva
 * en todas las páginas.
 */
export function buildFooterTemplate(branding: Branding, opts: BuildOpts = {}): string {
  return `<div style="width:100%; margin:0 10mm; font-family:'Helvetica Neue',Arial,sans-serif;
    font-size:8px; color:#5b6b73; border-top:1px solid #cdd7da; padding-top:4px;
    display:flex; justify-content:space-between; align-items:center;">
    <span>${escapeHtml(branding.footer ?? 'AnestIA')}</span>
    <span>${escapeHtml(opts.fechaValoracion ?? '')}</span>
  </div>`;
}

/** Cabecera vacía: Chromium exige un template si displayHeaderFooter está activo. */
export const EMPTY_HEADER_TEMPLATE = '<div></div>';

const ETIQUETA_ESTADO_PDF: Record<string, string> = {
  NO_INDICADA: 'No indicada',
  PENDIENTE: 'Pendiente',
  CALCULADA: 'Calculada',
  REVISION_CLINICA: 'Revisión clínica',
};

/**
 * Banda de escalas de riesgo (Especificación §17).
 *
 * Se muestra el ESTADO junto al puntaje, no sólo el número: una escala pendiente dice qué falta,
 * en vez de quedarse muda o —peor— parecer calculada. La categoría sólo aparece cuando los
 * puntos de corte están validados institucionalmente; mientras tanto se publica el puntaje y se
 * retiene la interpretación.
 */
function renderEscalas(escalas: readonly ScaleSnapshot[]): string {
  if (escalas.length === 0) return '';
  const filas = escalas
    .map((e) => {
      const chip =
        `<span class="esc-chip esc-${e.estado.toLowerCase()}">` +
        `${ETIQUETA_ESTADO_PDF[e.estado] ?? e.estado}</span>`;
      const puntaje = e.puntaje != null ? `<strong>${e.puntaje}</strong>` : '&mdash;';
      const categoria = e.categoria
        ? ` &middot; ${escapeHtml(e.categoria)}`
        : e.puntaje != null
          ? ' &middot; <span class="esc-nota">interpretaci\u00f3n pendiente de validaci\u00f3n institucional</span>'
          : '';
      const detalle =
        e.estado === 'PENDIENTE' && e.faltantes.length
          ? `<div class="esc-falta">Falta: ${escapeHtml(e.faltantes.join(', '))}</div>`
          : e.motivo
            ? `<div class="esc-falta">${escapeHtml(e.motivo)}</div>`
            : '';
      return (
        `<tr><th>${escapeHtml(e.nombre)}</th><td>${chip} ${puntaje}${categoria}${detalle}` +
        `<div class="esc-ver">${escapeHtml(e.version)}</div></td></tr>`
      );
    })
    .join('');
  return `<h2 class="band">Estratificaci\u00f3n perioperatoria</h2><table>${filas}</table>`;
}
