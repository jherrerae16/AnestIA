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

function alertClass(f: DocField | undefined): string {
  return f?.alerta ? ' class="alerta"' : '';
}

function rows(section: Record<string, DocField>, labels: [string, string][]): string {
  return labels
    .map(([key, label], i) => {
      const f = section[key];
      const shade = i % 2 === 1 ? ' class="alt"' : '';
      return `<tr${shade}><th>${escapeHtml(label)}</th><td${alertClass(f)}>${fieldVal(f)}</td></tr>`;
    })
    .join('');
}

/**
 * Construye el HTML del documento fiel al Diseño Oficial (docs/diseno-oficial.md).
 * Puro y determinístico. Marca de agua BORRADOR si draft o examen pendiente (CS3).
 */
export function buildDocumentHtml(doc: DocumentJSON, branding: Branding, opts: BuildOpts = {}): string {
  const draft = opts.draft || isExamPending(doc);
  const id = doc.identificacion ?? {};
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
  body { font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 10px; color: #14212b; margin: 0; padding: 18px 22px; position: relative; }
  .watermark { position: fixed; top: 42%; left: 8%; transform: rotate(-24deg); font-size: 34px; color: rgba(179,38,30,.14); font-weight: 800; letter-spacing: 2px; pointer-events: none; }
  header { display: flex; align-items: center; gap: 12px; border-bottom: 2px solid #0b5c6b; padding-bottom: 8px; }
  header img { height: 44px; }
  header .title { flex: 1; text-align: center; }
  header .title h1 { margin: 0; font-size: 15px; color: #0b5c6b; letter-spacing: 1px; }
  header .title p { margin: 2px 0 0; font-size: 9px; color: #5b6b73; }
  h2.band { background: #0b5c6b; color: #fff; font-size: 10px; padding: 3px 8px; margin: 10px 0 4px; letter-spacing: .5px; }
  table { width: 100%; border-collapse: collapse; }
  th, td { text-align: left; padding: 2px 6px; vertical-align: top; }
  th { width: 32%; color: #33474f; font-weight: 600; }
  tr.alt { background: #f2f6f7; }
  td.alerta { color: #b3261e; font-weight: 700; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0 14px; }
  .nota { font-size: 8px; color: #5b6b73; font-style: italic; margin-top: 3px; }
  .narrativo td { white-space: pre-line; }
  footer { position: fixed; bottom: 10px; left: 22px; right: 22px; font-size: 8px; color: #5b6b73; border-top: 1px solid #cdd7da; padding-top: 4px; display: flex; justify-content: space-between; }
  .firma { margin-top: 16px; }
  .firma img { height: 40px; }
  .firma .line { border-top: 1px solid #14212b; width: 220px; margin-top: 2px; padding-top: 2px; }
  </style></head><body>
  ${watermark}
  <header>
    ${branding.logoUrl ? `<img src="${escapeHtml(branding.logoUrl)}" alt="logo">` : ''}
    <div class="title"><h1>VALORACIÓN PREANESTÉSICA</h1><p>Evaluación preoperatoria para procedimiento electivo</p></div>
  </header>

  <h2 class="band">IDENTIFICACIÓN</h2>
  <div class="grid">
    <table>${rows(id, [['paciente','Paciente'],['documento','Documento'],['sexo','Sexo'],['imc','IMC']])}</table>
    <table>${rows(id, [['procedimiento','Procedimiento'],['diagnostico_preoperatorio','Diagnóstico preop.'],['asa','ASA']])}</table>
  </div>

  <h2 class="band">ANTECEDENTES Y MEDICACIÓN</h2>
  <table>${rows(ant, [
    ['patologicos','Patológicos'],['medicamentos','Medicamentos'],['glp1','Uso de GLP-1'],
    ['alergias','Alergias'],['grupo_sanguineo','Grupo sanguíneo'],['transfusionales','Transfusionales'],
    ['protesis_dental','Prótesis dental'],
  ])}</table>

  <h2 class="band">PARACLÍNICOS DISPONIBLES</h2>
  <table>${paraclinicos}</table>

  <h2 class="band">EXAMEN FÍSICO</h2>
  <table>${rows(doc.examen_fisico ?? {}, [
    ['signos_vitales','Signos vitales'],['via_aerea','Vía aérea'],['cuello','Cuello'],
    ['cardiovascular_respiratorio','Cardiovascular/respiratorio'],['abdomen','Abdomen'],
    ['extremidades','Extremidades'],['snc','SNC'],
  ])}</table>
  <p class="nota">Examen físico y signos vitales verificados por el anestesiólogo tratante.</p>

  <h2 class="band">VALORACIÓN Y PLAN</h2>
  <table class="narrativo">${rows(vp, [['concepto','Concepto anestésico'],['plan','Plan anestésico'],['recomendaciones','Recomendaciones']])}</table>

  <div class="firma">
    ${branding.signatureUrl ? `<img src="${escapeHtml(branding.signatureUrl)}" alt="firma">` : ''}
    <div class="line">${escapeHtml(branding.doctorName)}</div>
    <div>${escapeHtml(branding.specialty ?? '')} ${branding.registry ? '· RM ' + escapeHtml(branding.registry) : ''}</div>
  </div>

  <footer><span>${escapeHtml(branding.footer ?? 'AnestIA')}</span><span>${escapeHtml(opts.fechaValoracion ?? '')}</span></footer>
  </body></html>`;
}
