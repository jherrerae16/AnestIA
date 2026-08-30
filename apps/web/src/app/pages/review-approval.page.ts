import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ApiService } from '../core/api.service';
import { ScheduleFormComponent } from '../core/schedule-form.component';
import type { ScheduleDef } from '@anestia/shared';

/** Agenda en blanco, para abrir el editor cuando el caso aún no tiene programación. */
const AGENDA_VACIA: ScheduleDef = {
  procedimiento: '', diagnosticoPreop: null, fechaHora: null, especialidad: null,
  modalidad: null, prioridad: null, sitioQuirurgico: null, duracionEstimada: null,
  altoRiesgoRcri: null, anestesiaProbable: null, opioidesPostop: null,
};

const SECTION_LABELS: Record<string, string> = {
  paciente: 'Paciente', documento: 'Documento', edad: 'Edad', sexo: 'Sexo',
  edad_sexo: 'Edad / Sexo', peso_talla_imc: 'Peso / Talla / IMC', imc: 'IMC', procedimiento: 'Procedimiento',
  diagnostico_preoperatorio: 'Diagnóstico preoperatorio', asa: 'ASA',
  fecha_valoracion: 'Fecha de valoración', fecha_procedimiento: 'Fecha del procedimiento',
  capacidad_funcional: 'Capacidad funcional', condicion_actual: 'Condición actual',
  patologicos: 'Patológicos', medicamentos: 'Medicamentos', glp1: 'Uso de GLP-1',
  alergias: 'Alergias', grupo_sanguineo: 'Grupo sanguíneo', transfusionales: 'Transfusionales',
  protesis_dental: 'Prótesis dental', signos_vitales: 'Signos vitales', via_aerea: 'Vía aérea',
  cuello: 'Cuello', cardiovascular_respiratorio: 'Cardiovascular / respiratorio', abdomen: 'Abdomen',
  extremidades: 'Extremidades', snc: 'Sistema nervioso central',
  concepto: 'Concepto anestésico', plan: 'Plan anestésico', recomendaciones: 'Recomendaciones',
};

/** Preferencia de colapso del banner de notas — expandido por defecto. */
const NOTE_COLLAPSED_KEY = 'anestia.caseNoteCollapsed';
function readNoteCollapsedPref(): boolean {
  try { return localStorage.getItem(NOTE_COLLAPSED_KEY) === '1'; } catch { return false; }
}

/** Fecha de HOY en zona horaria de Colombia (America/Bogota), formato DD/MM/AAAA. */
function hoyBogota(): string {
  // Intl con timeZone da la fecha de Colombia sin importar el reloj del navegador/servidor.
  const fmt = new Intl.DateTimeFormat('es-CO', { timeZone: 'America/Bogota', year: 'numeric', month: '2-digit', day: '2-digit' });
  const parts = fmt.formatToParts(new Date());
  const g = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  return `${g('day')}/${g('month')}/${g('year')}`;
}

/** Normaliza coma decimal ("1,83" → 1.83) y devuelve número, o null. Mismo criterio que C-3. */
function parseDecimalLocal(raw: string): number | null {
  const s = (raw ?? '').trim().replace(',', '.');
  const m = s.match(/-?\d+(?:\.\d+)?/);
  if (!m) return null;
  const n = parseFloat(m[0]);
  return isFinite(n) && n > 0 ? n : null;
}

/** IMC = kg/(m^2), 1 decimal. talla en cm o m (autodetecta). null si datos inválidos. */
function imcLocal(pesoKg: number | null, tallaRaw: number | null): number | null {
  if (pesoKg == null || tallaRaw == null) return null;
  const m = tallaRaw > 3 ? tallaRaw / 100 : tallaRaw; // 170 → 1.70; 1.70 → 1.70
  if (m <= 0) return null;
  const imc = pesoKg / (m * m);
  return isFinite(imc) ? Math.round(imc * 10) / 10 : null;
}

@Component({
  selector: 'app-review-approval',
  standalone: true,
  imports: [FormsModule, NgTemplateOutlet, ScheduleFormComponent],
  styles: [`
    /* Escalas de riesgo: el estado se lee de un vistazo, junto al puntaje. */
    .esc-panel { margin: 0 0 16px; border: 1px solid var(--border); border-radius: 10px; overflow: hidden; }
    .esc-panel-head { background: var(--it-50); padding: 9px 14px; font-size: 11px; font-weight: 700;
      text-transform: uppercase; letter-spacing: .06em; color: var(--primary); }
    .esc-row { display: flex; gap: 11px; align-items: flex-start; padding: 11px 14px;
      border-top: 1px solid var(--border); }
    .esc-body { flex: 1; min-width: 0; }
    .esc-nombre { font-size: 13px; font-weight: 600; color: var(--text); }
    .esc-puntaje { font-size: 12.5px; color: var(--text); margin-top: 2px; }
    .esc-retenida { font-size: 11.5px; color: var(--muted); font-style: italic; }
    .esc-falta { font-size: 11.5px; color: #b54708; margin-top: 3px; }
    .esc-ver { font-size: 10px; color: var(--muted2); white-space: nowrap; }
    .esc-resolver { margin-top: 8px; }
    .esc-resolver-acciones { display: flex; gap: 6px; justify-content: flex-end; margin-top: 6px; }
    .esc-btn { margin-top: 5px; background: none; border: none; color: #b42318; font-weight: 700;
      text-decoration: underline; cursor: pointer; font-size: 11.5px; padding: 0; }
    .esc-resuelta { font-size: 11.5px; color: #027a48; margin-top: 3px; }
    .esc-chip { font-size: 10px; font-weight: 700; padding: 2px 8px; border-radius: 10px; white-space: nowrap; }
    .esc-calculada { background: #ecfdf3; color: #027a48; }
    .esc-pendiente { background: #fffaeb; color: #b54708; }
    .esc-revision_clinica { background: #fef3f2; color: #b42318; }

    .btn-completar { display: inline-block; margin-left: 8px; background: none; border: none;
      color: #93370d; font-weight: 700; text-decoration: underline; cursor: pointer; font-size: 12.5px; }
    .agenda-editor { margin: 0 0 16px; padding: 16px 18px; border: 1px solid var(--border);
      border-radius: 10px; background: var(--bg2, #fff); }
    .agenda-editor-head { font-size: 11px; font-weight: 700; text-transform: uppercase;
      letter-spacing: .06em; color: var(--primary); margin-bottom: 10px; }
    .agenda-editor-acciones { display: flex; gap: 8px; justify-content: flex-end; margin-top: 8px; }

    /* Programación incompleta: no bloquea nada, avisa de qué escalas quedarán pendientes. */
    .agenda-faltante { margin: 0 0 16px; padding: 12px 15px; border-radius: 10px;
      background: #fffaeb; border: 1px solid #fedf89; font-size: 12.5px; color: #93370d; }
    .agenda-faltante strong { display: block; margin-bottom: 3px; }

    .page-head { display:flex; align-items:flex-end; justify-content:space-between; margin-bottom:18px; gap:16px; flex-wrap:wrap; }
    .page-head h2 { font-size:26px; letter-spacing:-0.6px; }
    .page-head p { font-size:13px; color:var(--muted); margin-top:3px; }

    /* 3 columnas (rediseño A): contexto | documento | decisión. Con la topbar (sin sidebar) hay
       ancho de sobra. Reparte la info en horizontal para reducir el scroll vertical. */
    .cols { display:grid; grid-template-columns: 300px minmax(0,1fr) 340px; gap:16px; align-items:start; max-width:100%; }
    .col-ctx, .col-doc, .col-act { display:flex; flex-direction:column; gap:16px; min-width:0; }
    .col-ctx > .card, .col-doc > .card, .col-act > .card { min-width:0; max-width:100%; }
    .col-act { position:sticky; top:76px; }   /* debajo de la topbar (60px) */
    @media (max-width:1150px) {
      .cols { grid-template-columns: 1fr; }
      .col-act { position:static; }
      .col-doc { order:-1; }
    }
    .side { display:flex; flex-direction:column; gap:16px; min-width:0; }
    .attach { display:flex; align-items:center; justify-content:space-between; gap:10px; padding:7px 0; border-bottom:1px solid var(--border); }
    /* Fechas de informes de lab, dentro del box de adjuntos (no en la prosa del documento). */
    .attach-dates { margin-top:12px; padding-top:10px; border-top:1px solid var(--border); }
    .attach-dates .ad-title { font-size:10px; font-weight:600; text-transform:uppercase; letter-spacing:.08em; color:var(--muted); margin-bottom:6px; }
    .attach-dates .ad-row { display:flex; justify-content:space-between; gap:10px; font-size:12px; color:var(--muted); padding:3px 0; }
    .attach-dates .ad-row .ad-date { font-family:var(--font-mono); color:var(--text); }
    .attach-dates .ad-row.stale .ad-date { color:var(--sev-stale); font-weight:600; }
    .attach:last-of-type { border-bottom:none; }
    .a-name { font-size:12.5px; overflow-wrap:anywhere; }
    .a-actions { display:flex; gap:6px; flex-shrink:0; }
    .lab-date { font-size:11px; font-weight:500; margin-left:4px; }
    .lab-date.alerta { color:var(--sev-critico); font-weight:700; }
    .sec-block { margin-bottom:18px; }
    .sec-block:last-child { margin-bottom:0; }
    .field { display:flex; gap:10px; padding:7px 0; border-bottom:1px solid var(--border); font-size:13px; min-width:0; }
    .field:last-child { border-bottom:none; }
    .field .k { color:var(--muted); flex:0 0 40%; font-weight:500; min-width:0; overflow-wrap:anywhere; }
    /* Corta el texto largo (la prosa densa de paraclínicos rompía el ancho). */
    .field .v { color:var(--text); flex:1; min-width:0; overflow-wrap:anywhere; word-break:break-word; }
    .edit-hint { font-size:11.5px; color:var(--muted2); margin:0 0 12px; }
    .v.editable { cursor:pointer; border-radius:5px; padding:1px 4px; margin:-1px -4px; transition:background .12s; position:relative; }
    .v.editable:hover { background:var(--it-50); }
    .edit-pencil { opacity:0; font-size:11px; color:var(--primary); margin-left:6px; transition:opacity .12s; }
    .v.editable:hover .edit-pencil { opacity:1; }
    .v-edit { flex:1; display:flex; flex-direction:column; gap:7px; }
    .edit-input { width:100%; padding:8px 10px; border:1.5px solid var(--primary); border-radius:8px; font-family:var(--font-body); font-size:13px; color:var(--text); resize:vertical; outline:none; box-shadow:0 0 0 3px rgba(11,92,107,.12); }
    .edit-actions { display:flex; gap:8px; }
    .field.derivado { border-left:3px solid var(--gold); padding-left:9px; margin-left:-9px; }
    .v.alerta { color:var(--red-text); font-weight:700; }
    .field-nota { display:block; font-size:11.5px; color:var(--muted); font-style:italic; margin-top:3px; }
    .v.pending { color:var(--amber-text); font-weight:600; }
    .lab-flag { font-family:var(--font-mono); font-size:11px; }
    /* #2 capacidad funcional: hint de UX en pantalla (NO va al PDF). */
    .hint-eval { color:var(--muted2); font-style:italic; }
    /* #5 signos vitales estimados en standby: etiqueta visible de "no medido". */
    .est-tag { color:var(--red-text); font-style:italic; font-size:11px; font-weight:600; }
    /* #6 fecha con botón Hoy */
    .fecha-edit { display:flex; gap:8px; align-items:center; }
    .fecha-edit .edit-input { flex:1; }
    /* #7 editor guiado peso/talla/IMC */
    .pt-edit { display:flex; flex-direction:column; gap:6px; }
    .pt-row { display:flex; align-items:center; gap:6px; flex-wrap:wrap; }
    .pt-num { width:74px; text-align:right; }
    .pt-u { color:var(--muted); font-size:12px; }
    .pt-sep { color:var(--muted2); margin:0 2px; }
    .pt-imc { font-size:12.5px; color:var(--text); }
    .pt-imc b { color:var(--primary); }

    /* Labs por severidad (Bloque 2). Los ojos van primero a los rojos; lo "por revisar" es discreto. */
    .lab-summary { font-size:12px; color:var(--muted); background:var(--bg3); border:1px solid var(--border);
      border-radius:8px; padding:8px 11px; margin-bottom:12px; line-height:1.5; }
    .lab-summary b { color:var(--text); font-weight:700; }
    .lab-summary .pend { color:var(--sev-stale); font-weight:600; }
    .lab-summary .done { color:var(--green); font-weight:600; }
    .lab-stale { font-size:12px; color:var(--sev-stale); background:var(--sev-stale-bg); border:1px solid var(--sev-stale-line);
      border-radius:8px; padding:8px 11px; margin-bottom:12px; }
    .lab-stale b { color:var(--sev-stale-strong); font-weight:700; }
    .lab-row { display:flex; align-items:center; gap:10px; padding:7px 9px; border-radius:7px; margin-bottom:3px;
      font-size:13px; border-left:3px solid transparent; transition:background .15s, border-color .15s; }
    .lab-row .lr-main { flex:1; min-width:0; display:flex; flex-direction:column; gap:1px; }
    .lab-row .lr-analyte { font-weight:500; color:var(--text); overflow:hidden; text-overflow:ellipsis; }
    .lab-row .lr-meta { font-size:11px; color:var(--muted2); }
    .lab-row .lr-value { font-weight:600; white-space:nowrap; }
    /* Severidad efectiva */
    .lab-row.sev-critico { background:var(--sev-critico-bg); border-left-color:var(--sev-critico); }
    .lab-row.sev-critico .lr-value { color:var(--sev-critico); }
    .lab-row.sev-alerta  { background:var(--sev-alerta-bg); border-left-color:var(--sev-alerta-line); }
    .lab-row.sev-alerta  .lr-value { color:var(--sev-alerta); }
    .lab-row.sev-normal  { background:transparent; }
    .lab-row.sev-normal  .lr-value { color:var(--text); }
    /* rangeUnparsed sin verdicto: gris discreto, NO compite con alerta real. Sin fondo de color. */
    .lab-row.sev-pendiente { background:transparent; border-left-color:var(--border2); }
    .lab-row.sev-pendiente .lr-value { color:var(--muted); }
    .lr-unparsed { font-size:11px; color:var(--muted2); cursor:help; margin-left:3px; }
    /* Marca de verdicto manual del médico */
    .lr-manual { font-size:10px; color:var(--primary); background:var(--it-50); border-radius:100px; padding:1px 7px; white-space:nowrap; }
    .lr-review { font-size:10px; color:var(--sev-stale); background:var(--sev-stale-bg); border:1px solid var(--sev-stale-line); border-radius:100px; padding:1px 7px; white-space:nowrap; }
    /* Botones ✓/✗ — pequeños y discretos por defecto. Un tap marca; otro deshace. */
    .lr-verdict { display:flex; gap:4px; flex-shrink:0; }
    .lr-btn { width:24px; height:24px; border-radius:6px; border:1px solid var(--border2); background:#fff; cursor:pointer;
      font-size:12px; line-height:1; display:flex; align-items:center; justify-content:center; padding:0; transition:all .12s; color:var(--muted); }
    .lr-btn:hover { border-color:var(--muted2); }
    .lr-btn.ok.on { background:var(--green); border-color:var(--green); color:#fff; }
    .lr-btn.bad.on { background:var(--sev-critico); border-color:var(--sev-critico); color:#fff; }

    /* Encabezado del documento final (título + botón "Abrir PDF"). */
    .preview-head { display:flex; align-items:center; justify-content:space-between; padding:2px 0; gap:12px; }

    /* Bloqueadores de aprobación (lista de motivos por los que aún no se puede firmar). */
    .blockers { background:var(--sev-alerta-bg); border:1px solid var(--sev-alerta-line); color:var(--sev-alerta); padding:11px 14px; border-radius:10px; font-size:13px; margin-bottom:12px; }
    .blockers div { margin:2px 0; }

    .ok-badge { background:rgba(46,158,99,.1); border:1px solid rgba(46,158,99,.28); color:var(--green-text); padding:16px 20px; border-radius:12px; font-weight:600; }

    .dist-row { display:flex; align-items:center; gap:10px; margin-top:8px; font-size:13px; }
    .dist-row input[readonly] { flex:1; padding:8px 11px; border:1px solid var(--border2); border-radius:8px; font-family:var(--font-mono); font-size:12px; }
    label.contact { display:flex; align-items:center; gap:8px; padding:6px 0; font-size:13px; }
    .contact-main { min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    .contact-type-badge { font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:.03em;
      padding:2px 6px; border-radius:20px; flex-shrink:0; background:var(--it-50); color:var(--muted); border:1px solid var(--border); }
    .contact-type-badge[data-type="MEDICO"] { background:rgba(11,92,107,.1); color:var(--primary); border-color:rgba(11,92,107,.22); }
    .contact-type-badge[data-type="CLINICA"] { background:rgba(46,158,99,.1); color:var(--green-text); border-color:rgba(46,158,99,.24); }
    .contact-type-badge[data-type="ASEGURADORA"] { background:rgba(224,138,30,.12); color:var(--amber); border-color:rgba(224,138,30,.26); }
    /* Directorio: buscador + chips de filtro */
    .dir-tools { display:flex; flex-direction:column; gap:9px; margin:4px 0 10px; }
    .dir-search { font-size:13px; }
    .dir-filters { display:flex; gap:6px; flex-wrap:wrap; }
    .dir-chip { font-size:12px; font-weight:600; padding:5px 12px; border-radius:20px; cursor:pointer;
      background:#fff; border:1px solid var(--border2); color:var(--muted); transition:all .15s; font-family:var(--font-body); }
    .dir-chip:hover { border-color:var(--primary); color:var(--primary); }
    .dir-chip.active { background:var(--primary); border-color:var(--primary); color:#fff; }

    /* Panel del auditor independiente */
    .audit-card { margin-bottom:16px; border-left:3px solid var(--gold); }
    .audit-head { display:flex; align-items:center; gap:12px; }
    .audit-count { font-family:var(--font-mono); font-size:11px; color:var(--muted); margin-left:auto; }
    /* Si no hay count, el botón toma el margin-left:auto para irse a la derecha. */
    .audit-reaudit { margin-left:auto; }
    .audit-count + .audit-reaudit { margin-left:12px; }
    .audit-intro { font-size:12.5px; color:var(--muted); margin:6px 0 14px; max-width:70ch; }
    .finding { display:flex; gap:10px; align-items:flex-start; padding:9px 0; border-top:1px solid var(--border); font-size:13px; }
    .f-level { font-family:var(--font-mono); font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:.04em;
      padding:2px 7px; border-radius:20px; flex-shrink:0; margin-top:1px; }
    .finding.bloqueante .f-level { background:rgba(179,38,30,.1); color:var(--red); border:1px solid rgba(179,38,30,.25); }
    .finding.advertencia .f-level { background:rgba(224,138,30,.12); color:var(--amber); border:1px solid rgba(224,138,30,.28); }
    .finding.informativo .f-level { background:var(--it-50); color:var(--muted); border:1px solid var(--border); }
    .f-msg { color:var(--text); line-height:1.5; }
    .composer { margin-top:14px; border:1px solid var(--border); border-radius:12px; padding:14px; background:var(--bg3); display:flex; flex-direction:column; gap:12px; animation:fadeIn .2s ease; }
    .comp-field { display:flex; flex-direction:column; gap:5px; }
    .comp-body { resize:vertical; min-height:120px; font-family:var(--font-body); line-height:1.5; }
    .comp-attach { display:flex; align-items:center; gap:10px; background:#fff; border:1px solid var(--border2); border-radius:9px; padding:9px 12px; }
    .pdf-ic { font-family:var(--font-mono); font-size:10px; font-weight:700; color:#fff; background:var(--red); padding:3px 6px; border-radius:4px; letter-spacing:.04em; }
    .pdf-name { font-size:13px; color:var(--text); font-weight:500; flex:1; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    .pdf-tag { font-size:11px; color:var(--muted); font-family:var(--font-mono); }
    .comp-hint { font-size:11.5px; color:var(--muted2); margin:0; }

    /* Banner de notas privadas — aparece solo arriba del caso cuando el paciente tiene notas. */
    .note-banner { background:var(--note-bg); border:1px solid var(--note-line); border-radius:10px; padding:12px 16px; margin-bottom:16px; }
    .note-banner-head { display:flex; align-items:center; gap:8px; }
    .note-banner-title { font-size:13px; font-weight:600; color:var(--text); }
    .note-banner-badge { font-size:11px; font-weight:600; color:var(--note-text); background:var(--note-badge-bg); border:1px solid var(--note-line); border-radius:100px; padding:2px 9px; }
    .note-banner-toggle { margin-left:auto; font-size:12px; color:var(--note-text); background:none; border:none; cursor:pointer; padding:0; }
    .note-banner-toggle:hover { text-decoration:underline; }
    .note-banner-body { font-size:13px; color:var(--text); margin-top:8px; white-space:pre-wrap; overflow-wrap:anywhere; }
    .note-edit { width:100%; min-height:80px; margin-top:8px; padding:9px 11px; border:1px solid var(--note-line2); border-radius:8px;
      font-family:var(--font-body); font-size:13px; color:var(--text); resize:vertical; outline:none; background:#fff; }
    .note-edit:focus { border-color:var(--primary); box-shadow:0 0 0 3px rgba(11,92,107,.12); }
    .note-edit-actions { display:flex; gap:8px; margin-top:8px; }
    .note-add-btn { font-size:12px; color:var(--note-text); background:var(--note-bg); border:1px solid var(--note-line); border-radius:8px;
      padding:6px 12px; cursor:pointer; margin-bottom:16px; }
    .note-add-btn:hover { background:var(--note-badge-bg); }
  `],
  template: `
    @if (loading()) { <div class="empty">Cargando…</div> }

    @else if (approved()) {
      <ng-container [ngTemplateOutlet]="agendaBanner" />
      <ng-container [ngTemplateOutlet]="escalasPanel" />
      <ng-container [ngTemplateOutlet]="noteBanner" />
      <div class="page-head">
        <div><h2>Caso aprobado</h2><p>El documento final está firmado. Puedes reabrirlo para corregir un error.</p></div>
        <button class="btn btn-sm" (click)="reopen()" [disabled]="reopening()" data-testid="review-reopen-button">
          {{ reopening() ? 'Reabriendo…' : '↺ Reabrir para corregir' }}
        </button>
      </div>
      <div class="ok-badge" data-testid="review-approved">✔ Caso APROBADO. Documento final firmado.</div>

      <div class="grid-3" style="margin-top:16px">
        <div class="card">
          <div class="preview-head">
            <span class="card-title">Documento final</span>
            <!-- Abre el PDF firmado en una pestaña nueva (no visor embebido). -->
            <a class="btn btn-sm btn-primary" [href]="rawPreview()" target="_blank" rel="noopener">Abrir PDF</a>
          </div>
          <p class="edit-hint" style="margin-top:10px">El documento final firmado. Ábrelo en una pestaña nueva para verlo o descargarlo.</p>
        </div>
        <div class="card">
          <div class="card-title" style="margin-bottom:12px">Distribuir reporte</div>

          <!-- Destinatarios -->
          <div class="section-label" style="margin:0 0 8px">Destinatarios</div>
          @if (patient()?.email) {
            <label class="contact">
              <input type="checkbox" [checked]="sendToPatient()" (change)="setSendToPatient($event)" data-testid="distribute-patient-checkbox" />
              <span>👤 Paciente — {{ patient()!.email }}</span>
            </label>
          } @else {
            <p class="muted" style="font-size:12px;margin-bottom:6px">El paciente no registró correo.</p>
          }
          <!-- Directorio: buscador + filtro por categoría -->
          @if (contacts().length) {
            <div class="dir-tools">
              <input class="ki-input dir-search" type="search" placeholder="Buscar en tu directorio…"
                [ngModel]="contactSearch()" (ngModelChange)="contactSearch.set($event)"
                data-testid="distribute-contact-search" />
              <div class="dir-filters" role="tablist" aria-label="Filtrar por categoría">
                @for (opt of typeFilters; track opt.value) {
                  <button type="button" class="dir-chip" [class.active]="contactTypeFilter() === opt.value"
                    (click)="contactTypeFilter.set(opt.value)"
                    [attr.aria-pressed]="contactTypeFilter() === opt.value"
                    [attr.data-testid]="'distribute-filter-' + opt.value">{{ opt.label }}</button>
                }
              </div>
            </div>
          }
          @for (c of filteredContacts(); track c.id) {
            <label class="contact">
              <input type="checkbox" [value]="c.id" [checked]="isContactSelected(c.id)" (change)="toggle(c.id, $event)" data-testid="distribute-contact-checkbox" />
              <span class="contact-type-badge" [attr.data-type]="c.type">{{ typeLabel(c.type) }}</span>
              <span class="contact-main">{{ c.label }} — {{ c.email }}</span>
            </label>
          }
          @if (contacts().length && !filteredContacts().length) {
            <p class="muted" style="font-size:12px;margin:6px 0">Sin contactos que coincidan.</p>
          }

          @if (!composerOpen()) {
            <div style="display:flex; gap:8px; margin-top:14px; flex-wrap:wrap">
              <button class="btn btn-primary btn-sm" (click)="openComposer()" data-testid="distribute-email-open">📧 Enviar por correo</button>
              <button class="btn btn-sm" (click)="generateLink()" data-testid="distribute-link-button">🔗 Generar enlace</button>
            </div>
          } @else {
            <!-- Compositor del correo -->
            <div class="composer" data-testid="email-composer">
              <div class="comp-field">
                <label class="ki-label">Asunto</label>
                <input class="ki-input" [ngModel]="emailSubject()" (ngModelChange)="emailSubject.set($event)" data-testid="email-subject" />
              </div>
              <div class="comp-attach">
                <span class="pdf-ic">PDF</span>
                <span class="pdf-name">{{ pdfName() }}</span>
                <span class="pdf-tag">adjunto</span>
              </div>
              <div class="comp-field">
                <label class="ki-label">Mensaje</label>
                <textarea class="ki-input comp-body" rows="8" [ngModel]="emailBody()" (ngModelChange)="emailBody.set($event)" data-testid="email-body"></textarea>
              </div>
              <p class="comp-hint">Se enviará a los destinatarios seleccionados con el PDF adjunto y un enlace de descarga.</p>
              <div style="display:flex; gap:8px">
                <button class="btn btn-primary btn-sm" (click)="sendEmail()" [disabled]="sending()" data-testid="email-send">
                  {{ sending() ? 'Enviando…' : 'Enviar correo' }}
                </button>
                <button class="btn btn-sm" (click)="composerOpen.set(false)">Cancelar</button>
              </div>
            </div>
          }

          @if (distError()) { <p class="v alerta" style="font-size:12px;margin-top:10px">{{ distError() }}</p> }
          @if (sentOk()) { <p style="font-size:12.5px;color:var(--green);margin-top:10px;font-weight:600">✔ Correo enviado.</p> }
          @for (d of deliveries(); track d.token) {
            <div class="dist-row">
              <input readonly [value]="d.url" />
              <button class="btn btn-sm" (click)="copy(d.url)">Copiar</button>
            </div>
          }
        </div>
      </div>
    }

    @else {
      <ng-container [ngTemplateOutlet]="agendaBanner" />
      <ng-container [ngTemplateOutlet]="escalasPanel" />
      <ng-container [ngTemplateOutlet]="noteBanner" />
      <div class="page-head">
        <div><h2>Revisión de valoración</h2><p>Verifica los datos antes de aprobar y firmar.</p></div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;">
          <!-- Ver PDF abre el documento en una pestaña nueva del navegador (no un visor embebido). -->
          <a class="btn btn-sm" [href]="rawPreview()" target="_blank" rel="noopener" data-testid="review-preview-button">Ver PDF</a>
        </div>
      </div>

      <div class="cols">
        <!-- ── Columna izquierda: paciente + adjuntos ── -->
        <div class="col-ctx">
          @if (patient(); as p) {
            <div class="card" data-testid="patient-card">
              <div class="card-title" style="margin-bottom:14px">Paciente</div>
              <div class="field"><span class="k">Nombre</span><span class="v">{{ p.fullName }}</span></div>
              <div class="field"><span class="k">Documento</span><span class="v">{{ p.documentId || '—' }}</span></div>
              <div class="field"><span class="k">Edad</span><span class="v">{{ p.edad != null ? p.edad + ' años' : '—' }}</span></div>
              <div class="field"><span class="k">Sexo</span><span class="v">{{ sexoLabel(p.sexAtBirth) }}</span></div>
              <div class="field">
                <span class="k">Teléfono</span>
                <span class="v">@if (p.phone) { <a [href]="'tel:' + p.phone">{{ p.phone }}</a> } @else { — }</span>
              </div>
              <div class="field">
                <span class="k">Correo</span>
                <span class="v">@if (p.email) { <a [href]="'mailto:' + p.email">{{ p.email }}</a> } @else { — }</span>
              </div>
              <div class="field"><span class="k">Aseguradora</span><span class="v">{{ p.insurer || '—' }}</span></div>
              <div class="field"><span class="k">Grupo sanguíneo</span><span class="v">{{ p.bloodType || '—' }}</span></div>
            </div>
          }

          <div class="card" data-testid="attachments-card">
            <div class="card-title" style="margin-bottom:14px">Exámenes adjuntos</div>
            <p class="edit-hint">Los archivos originales del paciente. Revísalos: lo del borrador es lo que la IA leyó de ellos.</p>
            @for (a of attachments(); track a.id) {
              <div class="attach">
                <span class="a-name">{{ a.filename }}</span>
                <!-- Solo "Abrir" (pestaña nueva). El visor embebido se retiró: abre el archivo real. -->
                <a class="btn btn-sm" [href]="a.url" target="_blank" rel="noopener" [attr.data-testid]="'attach-open-' + a.id">Abrir</a>
              </div>
            }
            @if (!attachments().length) { <div class="empty">El paciente no adjuntó exámenes.</div> }

            <!-- Fechas de los informes de laboratorio (para que el médico juzgue la vigencia). -->
            @if (labDates().length) {
              <div class="attach-dates">
                <div class="ad-title">Fechas de los informes</div>
                @for (d of labDates(); track d.label) {
                  <div class="ad-row" [class.stale]="d.desactualizado">
                    <span>{{ d.label }}</span>
                    <span class="ad-date">{{ d.fecha }}@if (d.desactualizado) { · ⚠ vencido }</span>
                  </div>
                }
              </div>
            }
          </div>
        </div>

        <!-- ── Columna central: borrador + paraclínicos ── -->
        <div class="col-doc">
        <div class="card">
          <div class="card-title" style="margin-bottom:14px">Borrador de valoración</div>
          <p class="edit-hint">Haz clic en cualquier valor para editarlo. Los cambios se guardan al confirmar.</p>
          @for (sec of sections; track sec.key) {
            <div class="sec-block">
              <div class="section-label">{{ sec.label }}</div>
              @for (f of entries(sec.key); track f.k) {
                <div class="field" [class.derivado]="isDerived(f.v)">
                  <span class="k">{{ labelFor(f.k) }}</span>
                  @if (editingKey() === sec.key + '.' + f.k) {
                    <span class="v-edit">
                      @switch (f.k) {
                        @case ('fecha_valoracion') {
                          <!-- #6: fecha con botón "Hoy" (zona Colombia) + placeholder DD/MM/AAAA. -->
                          <span class="fecha-edit">
                            <input class="edit-input" [ngModel]="editValue()" (ngModelChange)="editValue.set($event)"
                              (keydown.enter)="$event.preventDefault(); saveEdit(sec.key, f.k)"
                              placeholder="DD/MM/AAAA" [attr.data-testid]="'edit-' + f.k" />
                            <button class="btn btn-sm" (click)="editValue.set(hoyBogota())" data-testid="fecha-hoy">Hoy</button>
                          </span>
                        }
                        @case ('peso_talla_imc') {
                          <!-- #7: peso y talla aparte; el IMC se calcula solo, silencioso. -->
                          <span class="pt-edit">
                            <span class="pt-row">
                              <input class="edit-input pt-num" [ngModel]="ptPeso()" (ngModelChange)="ptPeso.set($event)"
                                inputmode="decimal" placeholder="Peso" [attr.data-testid]="'edit-peso'" /> <span class="pt-u">kg</span>
                              <span class="pt-sep">/</span>
                              <input class="edit-input pt-num" [ngModel]="ptTalla()" (ngModelChange)="ptTalla.set($event)"
                                inputmode="decimal" placeholder="Talla" [attr.data-testid]="'edit-talla'" /> <span class="pt-u">m</span>
                            </span>
                            <span class="pt-imc" data-testid="pt-imc">
                              @if (ptImc() != null) { IMC = <b>{{ ptImc() }}</b> kg/m² } @else { <span class="muted">IMC — ingresa peso y talla</span> }
                            </span>
                          </span>
                        }
                        @default {
                          <textarea class="edit-input" [ngModel]="editValue()" (ngModelChange)="editValue.set($event)" (keydown.enter)="$event.preventDefault(); saveEdit(sec.key, f.k)" rows="2" [attr.data-testid]="'edit-' + f.k"></textarea>
                        }
                      }
                      <span class="edit-actions">
                        <button class="btn btn-sm btn-primary" (click)="saveEdit(sec.key, f.k)" [disabled]="savingEdit()">Guardar</button>
                        <button class="btn btn-sm" (click)="cancelEdit()">Cancelar</button>
                      </span>
                    </span>
                  } @else {
                    <span class="v editable" [class.alerta]="f.v?.alerta" [class.pending]="f.v?.estado==='pendiente_examen' || f.v?.estado==='estimado_ia'"
                      (click)="startEdit(sec.key, f.k, f.v)" [attr.data-testid]="'field-' + f.k" title="Clic para editar">
                      @if (f.v?.estado==='pendiente_examen') { PENDIENTE DE EXAMEN }
                      @else if (f.v?.estado==='estimado_ia') { {{ f.v.valor }} <span class="est-tag">(estimado — confirmar)</span> }
                      @else if (f.v?.valor) { {{ f.v.valor }} }
                      @else if (f.k === 'capacidad_funcional') { <span class="hint-eval">Evaluar en examen</span> }
                      @else { — }
                      <span class="edit-pencil">✎</span>
                    </span>
                    <!-- Evolución entre informes sucesivos y avisos de lectura sin confirmar.
                         Se calculaban y no se mostraban en ningún lado. -->
                    @if (f.v?.nota) { <span class="field-nota">{{ f.v.nota }}</span> }
                  }
                </div>
              }
            </div>
          }
        </div>

        <!-- Paraclínicos: sección del borrador, en el centro. -->
        <div class="card">
          <div class="card-title" style="margin-bottom:12px">Paraclínicos</div>
          @if (labs().length) {
            <div class="lab-summary">
              Interpretados automáticamente <b>{{ labSummary().auto }}</b>@if (labSummary().manual) { + verificados por ti <b>{{ labSummary().manual }}</b> } = <b>{{ labSummary().resueltos }}</b> de <b>{{ labSummary().total }}</b>.
              @if (labSummary().pendientes) {
                <span class="pend">Quedan {{ labSummary().pendientes }} por revisar.</span>
              } @else {
                <span class="done">Todos los rangos evaluados.</span>
              }
            </div>

            @if (staleGroups().length) {
              <div class="lab-stale" data-testid="lab-stale">
                ⏳ Exámenes posiblemente vencidos para cirugía electiva:
                @for (g of staleGroups(); track g.grupo) {
                  <b>{{ g.label }}</b> ({{ formatFecha(g.fecha) }}){{ $last ? '' : ', ' }}
                }
                — verificar vigencia con el paciente.
              </div>
            }

            @for (l of sortedLabs(); track l.id) {
              <div class="lab-row" [class]="'lab-row sev-' + sevClass(l)" [attr.data-testid]="'lab-row'">
                <div class="lr-main">
                  <span class="lr-analyte">
                    {{ l.analyte }}
                    @if (needsVerdict(l) && !l.manualFlag) {
                      <span class="lr-unparsed" title="Rango de referencia no interpretado — verifica manualmente">?</span>
                    }
                  </span>
                  <span class="lr-meta">
                    {{ grupoLabel(l.grupo) }}@if (l.refRange) { · ref {{ l.refRange }} }
                  </span>
                </div>
                <span class="lr-value">{{ l.value }} {{ l.unit }}</span>
                @if (needsVerdict(l)) {
                  @if (l.manualFlag) {
                    <span class="lr-manual" [title]="manualTitle(l)">tu veredicto</span>
                  } @else {
                    <span class="lr-review">por revisar</span>
                  }
                  <div class="lr-verdict">
                    <button class="lr-btn ok" [class.on]="l.manualFlag==='NORMAL'"
                      (click)="setVerdict(l, 'NORMAL')" title="Marcar normal" data-testid="lab-ok">✓</button>
                    <button class="lr-btn bad" [class.on]="l.manualFlag && l.manualFlag!=='NORMAL'"
                      (click)="setVerdict(l, 'ALERTA')" title="Marcar fuera de rango" data-testid="lab-bad">✗</button>
                  </div>
                }
              </div>
            }
          } @else {
            <div class="empty">Sin laboratorios cargados.</div>
          }
        </div>
        </div>

        <!-- ── Columna derecha: auditor + aprobación (sticky) ── -->
        <div class="col-act">
          @if (fields()) {
            <div class="card audit-card" data-testid="audit-panel">
              <div class="audit-head">
                <span class="card-title">Revisión automática</span>
                @if (auditFindings().length) {
                  <span class="audit-count">{{ auditFindings().length }} hallazgo{{ auditFindings().length === 1 ? '' : 's' }}</span>
                }
                <button class="btn btn-sm audit-reaudit" (click)="reaudit()" [disabled]="reauditing()" data-testid="reaudit-button">
                  {{ reauditing() ? 'Revisando…' : '↻ Re-auditar' }}
                </button>
              </div>
              @if (auditFindings().length) {
                <p class="audit-intro">Un auditor independiente revisó este borrador contra las respuestas del paciente. Estos puntos requieren tu criterio.</p>
                @for (f of auditFindings(); track $index) {
                  <div class="finding" [class]="'finding ' + f.level" [attr.data-testid]="'finding-' + f.level">
                    <span class="f-level">{{ levelLabel(f.level) }}</span>
                    <span class="f-msg">{{ f.message }}</span>
                  </div>
                }
              } @else {
                <p class="audit-intro" data-testid="audit-clean">Sin hallazgos: el borrador pasó la revisión automática.</p>
              }
            </div>
          }

          <div class="card">
            <div class="card-title" style="margin-bottom:12px">Aprobación</div>
            @if (!check()?.ok) {
              <div class="blockers" data-testid="review-blockers">
                @for (b of check()?.blockers ?? []; track b) { <div>⛔ {{ b }}</div> }
              </div>
              <label class="contact" style="margin:10px 0;font-size:12.5px">
                <input type="checkbox" [checked]="examAttested()" (change)="setExamAttested($event)" data-testid="exam-attest-checkbox" />
                <span>Confirmo que examiné al paciente presencialmente y los hallazgos son normales.
                  Los signos vitales y el peso/talla los ingreso yo con los valores medidos.</span>
              </label>
              <button class="btn" style="width:100%;justify-content:center;margin-bottom:8px" [disabled]="!examAttested()" (click)="loadNormal()" data-testid="exam-load-normal-button">Confirmar hallazgos normales</button>
            }
            <button class="btn btn-primary" style="width:100%;justify-content:center;margin-bottom:8px" [disabled]="!check()?.ok" (click)="approve()" data-testid="review-approve-button">Aprobar y firmar</button>
            <button class="btn" style="width:100%;justify-content:center" (click)="reject()" data-testid="review-reject-button">Rechazar borrador</button>
          </div>
        </div>
      </div>
    }

    <!-- Escalas de riesgo. Se muestra el ESTADO junto al puntaje: una escala pendiente dice qué
         falta, en vez de quedarse muda o parecer calculada. -->
    <ng-template #escalasPanel>
      @if (escalas().length) {
        <div class="esc-panel" data-testid="review-escalas">
          <div class="esc-panel-head">Estratificación perioperatoria</div>
          @for (e of escalas(); track e.escala) {
            <div class="esc-row">
              <span class="esc-chip" [class]="'esc-chip esc-' + e.estado.toLowerCase()">
                {{ etiquetaEstado(e.estado) }}
              </span>
              <div class="esc-body">
                <div class="esc-nombre">{{ e.nombre }}</div>
                @if (e.puntaje !== null) {
                  <div class="esc-puntaje">
                    {{ e.puntaje }}
                    @if (e.categoria) { · {{ e.categoria }} }
                    @else { <span class="esc-retenida">interpretación pendiente de validación institucional</span> }
                  </div>
                }
                @if (e.faltantes.length) {
                  <div class="esc-falta">Falta: {{ e.faltantes.join(', ') }}</div>
                }
                @if (e.motivo) { <div class="esc-falta">{{ e.motivo }}</div> }
                @if (e.estado === 'REVISION_CLINICA' && !e.resueltoAt) {
                  <!-- Sin esto la escala bloqueaba la aprobación y no había forma de levantarla:
                       el caso quedaba trabado sin salida. -->
                  @if (resolviendo() === e.escala) {
                    <div class="esc-resolver">
                      <input class="ki-input" [ngModel]="notaResolucion()"
                             (ngModelChange)="notaResolucion.set($event)"
                             placeholder="¿Qué decidiste? Queda en el documento."
                             [attr.data-testid]="'esc-nota-' + e.escala" />
                      <div class="esc-resolver-acciones">
                        <button class="btn btn-sm" (click)="resolviendo.set(null)">Cancelar</button>
                        <button class="btn btn-primary btn-sm"
                                [disabled]="notaResolucion().trim().length < 3"
                                (click)="resolverEscala(e.escala)"
                                [attr.data-testid]="'esc-resolver-' + e.escala">Resolver</button>
                      </div>
                    </div>
                  } @else {
                    <button class="esc-btn" (click)="abrirResolucion(e.escala)"
                            [attr.data-testid]="'esc-abrir-' + e.escala">Resolver esta discordancia</button>
                  }
                }
                @if (e.resueltoAt) {
                  <div class="esc-resuelta">Resuelta por el anestesiólogo.</div>
                }
              </div>
              <span class="esc-ver">{{ e.version }}</span>
            </div>
          }
        </div>
      }
    </ng-template>

    <!-- Programación quirúrgica. Se muestra lo que falta porque, mientras falte, las escalas
         que dependen de esas variables quedan PENDIENTES en vez de calcularse con supuestos. -->
    <ng-template #agendaBanner>
      @if (agendaFaltante().length && !editandoAgenda()) {
        <div class="agenda-faltante" data-testid="review-agenda-faltante">
          <strong>Programación incompleta</strong>
          Las escalas que dependan de esto quedarán pendientes, no se calcularán con supuestos.
          Falta: {{ agendaFaltante().join(', ') }}.
          <button class="btn-completar" (click)="abrirAgenda()" data-testid="review-agenda-editar">
            Completar programación
          </button>
        </div>
      }
      @if (editandoAgenda()) {
        <!-- El aviso decía qué faltaba pero no había dónde llenarlo: el médico quedaba
             mirando una advertencia que no podía resolver. -->
        <div class="agenda-editor" data-testid="review-agenda-editor">
          <div class="agenda-editor-head">Programación quirúrgica</div>
          <app-schedule-form [(value)]="agendaEdit" prefijo="rev" [mostrarTitulo]="false" />
          <div class="agenda-editor-acciones">
            <button class="btn btn-sm" (click)="editandoAgenda.set(false)">Cancelar</button>
            <button class="btn btn-primary btn-sm" (click)="guardarAgenda()"
                    [disabled]="guardandoAgenda() || agendaEdit().procedimiento.trim().length < 2"
                    data-testid="review-agenda-guardar">
              {{ guardandoAgenda() ? 'Guardando…' : 'Guardar y recalcular escalas' }}
            </button>
          </div>
        </div>
      }
    </ng-template>

    <!-- Nota privada del médico sobre este paciente. Aparece sola (no hay que buscarla): arranca
         expandida; el médico puede colapsarla y la preferencia se recuerda en localStorage. -->
    <ng-template #noteBanner>
      <!-- Notas privadas: se pueden ver Y editar aquí, no sólo desde la ficha del paciente.
           Sólo hay UI si el caso tiene paciente vinculado (notePatientId). -->
      @if (notePatientId()) {
        @if (patientNote() || noteEditing()) {
          <div class="note-banner" data-testid="case-note-banner">
            <div class="note-banner-head">
              <span class="note-banner-title">Notas privadas de este paciente</span>
              <span class="note-banner-badge">🔒 solo tú ves esto</span>
              @if (!noteEditing()) {
                <button class="note-banner-toggle" (click)="startEditNote()" data-testid="case-note-edit">Editar</button>
                <button class="note-banner-toggle" (click)="toggleNote()" data-testid="case-note-toggle">
                  {{ noteCollapsed() ? 'Mostrar' : 'Ocultar' }}
                </button>
              }
            </div>
            @if (noteEditing()) {
              <textarea class="note-edit" [ngModel]="noteDraft()" (ngModelChange)="noteDraft.set($event)"
                placeholder="Ej: vía difícil — usar videolaringoscopio; prefiere menos midazolam…"
                data-testid="case-note-input"></textarea>
              <div class="note-edit-actions">
                <button class="btn btn-primary btn-sm" (click)="saveNote()" [disabled]="savingNote()" data-testid="case-note-save">
                  {{ savingNote() ? 'Guardando…' : 'Guardar' }}
                </button>
                <button class="btn btn-sm" (click)="cancelEditNote()">Cancelar</button>
              </div>
            } @else if (!noteCollapsed()) {
              <div class="note-banner-body" data-testid="case-note-body">{{ patientNote()!.content }}</div>
            }
          </div>
        } @else {
          <!-- Sin nota: botón discreto para añadir. La sección sólo existe cuando hay contenido o se edita. -->
          <button class="note-add-btn" (click)="startEditNote()" data-testid="case-note-add">+ Añadir nota privada</button>
        }
      }
    </ng-template>
  `,
})
export class ReviewApprovalPage implements OnInit {
  private api = inject(ApiService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  sections = [
    { key: 'identificacion', label: 'Identificación' },
    { key: 'antecedentes', label: 'Antecedentes' },
    { key: 'paraclinicos', label: 'Paraclínicos' },
    { key: 'examen_fisico', label: 'Examen físico' },
    { key: 'valoracion_plan', label: 'Valoración y plan' },
  ];
  caseId = '';
  loading = signal(true);
  approved = signal(false);
  fields = signal<any>({});
  labs = signal<any[]>([]);
  check = signal<{ ok: boolean; blockers: string[] } | null>(null);
  editingKey = signal<string | null>(null);
  editValue = signal('');
  // Editor guiado de peso/talla/IMC (#7): peso y talla se escriben aparte, el IMC se calcula solo.
  ptPeso = signal('');
  ptTalla = signal('');
  ptImc = computed(() => imcLocal(parseDecimalLocal(this.ptPeso()), parseDecimalLocal(this.ptTalla())));
  savingEdit = signal(false);
  reopening = signal(false);
  /** Nota privada del médico sobre este paciente (o null). Aparece sola en el caso. */
  /** Variables de la agenda que aún faltan. Vacío = programación completa. */
  agendaFaltante = signal<string[]>([]);
  /** Programación tal como está guardada, para poder editarla desde aquí. */
  agenda = signal<ScheduleDef | null>(null);
  agendaEdit = signal<ScheduleDef>(AGENDA_VACIA);
  editandoAgenda = signal(false);
  guardandoAgenda = signal(false);
  /** Escalas de riesgo del caso. Las NO_INDICADA no llegan aquí. */
  escalas = signal<{
    escala: string; nombre: string; version: string; estado: string;
    puntaje: number | null; categoria: string | null; faltantes: string[]; motivo: string | null;
    resueltoAt?: string | null;
  }[]>([]);
  /** Escala cuya discordancia se está resolviendo, o null. */
  resolviendo = signal<string | null>(null);
  notaResolucion = signal('');

  abrirResolucion(escala: string) {
    this.resolviendo.set(escala);
    this.notaResolucion.set('');
  }

  /**
   * Deja constancia de que el médico revisó la discordancia y asumió la decisión. NO recalcula
   * ni inventa un puntaje: la escala conserva su estado y su motivo, y deja de bloquear.
   */
  async resolverEscala(escala: string) {
    await this.api.resolverEscala(this.caseId, escala, this.notaResolucion().trim());
    this.resolviendo.set(null);
    await this.reload();
  }

  /** Abre el editor con lo que ya haya guardado. */
  abrirAgenda() {
    this.agendaEdit.set({ ...AGENDA_VACIA, ...(this.agenda() ?? {}) });
    this.editandoAgenda.set(true);
  }

  /**
   * Guarda la programación y recalcula. Completar la agenda destraba escalas: ARISCAT depende
   * del sitio y la duración, Caprini de la modalidad, Apfel del plan anestésico.
   */
  async guardarAgenda() {
    this.guardandoAgenda.set(true);
    try {
      await this.api.updateSchedule(this.caseId, this.agendaEdit());
      this.editandoAgenda.set(false);
      await this.reload();
    } finally {
      this.guardandoAgenda.set(false);
    }
  }

  /** Etiqueta del sexo registrado al nacer (el enum cambió con la especificación). */
  sexoLabel(sexo: string | null | undefined): string {
    if (!sexo) return '—';
    return (
      {
        MUJER: 'Mujer', HOMBRE: 'Hombre', INTERSEXUAL: 'Intersexual',
        NO_SABE: 'No sabe', PREFIERE_NO_RESPONDER: 'Prefiere no responder',
        FEMENINO: 'Mujer', MASCULINO: 'Hombre',
      }[sexo.toUpperCase()] ?? sexo
    );
  }

  /** Etiqueta legible del estado de una escala. */
  etiquetaEstado(e: string): string {
    return (
      { CALCULADA: 'Calculada', PENDIENTE: 'Pendiente', REVISION_CLINICA: 'Revisión clínica',
        NO_INDICADA: 'No indicada' }[e] ?? e
    );
  }
  patientNote = signal<{ content: string; updatedAt: string } | null>(null);
  /** patientId del caso (para crear/editar la nota desde aquí). null si el caso no tiene paciente. */
  notePatientId = signal<string | null>(null);
  /** Edición de la nota privada desde la revisión. */
  noteEditing = signal(false);
  noteDraft = signal('');
  savingNote = signal(false);
  /** Estado colapsado del banner de nota. Arranca expandido; se recuerda en localStorage. */
  noteCollapsed = signal<boolean>(readNoteCollapsedPref());
  /** Hallazgos del auditor independiente, ordenados por severidad. */
  auditFindings = signal<{ level: string; category: string; message: string; field?: string }[]>([]);
  /** Re-auditoría en curso (el auditor es determinístico: cero tokens, sólo un instante). */
  reauditing = signal(false);
  contacts = signal<any[]>([]);
  deliveries = signal<any[]>([]);
  patient = signal<{
    fullName: string;
    documentId?: string | null;
    edad?: number | null;
    sexAtBirth?: string | null;
    phone?: string | null;
    email?: string | null;
    insurer?: string | null;
    bloodType?: string | null;
  } | null>(null);
  attachments = signal<{ id: string; filename: string; url: string; viewable: boolean }[]>([]);
  /** Labs agrupados por estudio con fecha y vigencia — los resuelve el servidor. */
  labGroups = signal<
    { grupo: string; label: string; fecha: string | null; desactualizado: boolean; labs: any[] }[]
  >([]);
  /** Estudios cuya fecha excede la vigencia para cirugía electiva — alerta sólo para el médico. */
  staleGroups = computed(() => this.labGroups().filter((g) => g.desactualizado));
  /** Fechas de informe por estudio, para mostrarlas en el box de adjuntos (no en la prosa). */
  labDates = computed(() =>
    this.labGroups()
      .filter((g) => g.fecha)
      .map((g) => ({ label: g.label, fecha: g.fecha as string, desactualizado: g.desactualizado })),
  );
  sendToPatient = signal(false);
  distError = signal('');
  composerOpen = signal(false);
  emailSubject = signal('');
  emailBody = signal('');
  pdfName = signal('');
  sending = signal(false);
  sentOk = signal(false);
  examAttested = signal(false);
  rawPreview = signal('');
  /** IDs de contactos del directorio seleccionados (signal para reaccionar al filtrar). */
  selectedContacts = signal<Set<string>>(new Set());

  /** Buscador y filtro por categoría del directorio en el compositor. */
  contactSearch = signal('');
  contactTypeFilter = signal<'ALL' | 'MEDICO' | 'CLINICA' | 'ASEGURADORA' | 'OTRO'>('ALL');
  readonly typeFilters = [
    { value: 'ALL' as const, label: 'Todos' },
    { value: 'MEDICO' as const, label: 'Médico' },
    { value: 'CLINICA' as const, label: 'Clínica' },
    { value: 'ASEGURADORA' as const, label: 'Aseguradora' },
    { value: 'OTRO' as const, label: 'Otro' },
  ];
  private readonly TYPE_LABEL: Record<string, string> = {
    MEDICO: 'Médico', CLINICA: 'Clínica', ASEGURADORA: 'Aseguradora', PACIENTE: 'Paciente', OTRO: 'Otro',
  };
  typeLabel(t: string | null | undefined): string { return this.TYPE_LABEL[t ?? ''] ?? 'Otro'; }

  /** Contactos filtrados por texto (nombre/email) y categoría. PACIENTE cae en "Otro". */
  filteredContacts = computed(() => {
    const q = this.contactSearch().trim().toLowerCase();
    const cat = this.contactTypeFilter();
    return this.contacts().filter((c) => {
      const type = (c.type ?? 'OTRO') as string;
      const matchCat = cat === 'ALL'
        ? true
        : cat === 'OTRO'
          ? type === 'OTRO' || type === 'PACIENTE'
          : type === cat;
      if (!matchCat) return false;
      if (!q) return true;
      return `${c.label ?? ''} ${c.email ?? ''}`.toLowerCase().includes(q);
    });
  });
  isContactSelected(id: string): boolean { return this.selectedContacts().has(id); }

  async ngOnInit() {
    this.caseId = this.route.snapshot.paramMap.get('id') ?? '';
    this.rawPreview.set(this.api.previewUrl(this.caseId));
    await this.reload();
    this.loading.set(false);
  }

  /** Etiqueta legible del grupo de estudio (para el subtítulo de cada analito). */
  private static GRUPO_LABEL: Record<string, string> = {
    hemograma: 'Hemograma', coagulacion: 'Coagulación', bioquimica: 'Bioquímica',
    uroanalisis: 'Uroanálisis', endocrinologia: 'Perfil hormonal', inmunologia: 'Inmunología',
    microbiologia: 'Microbiología', otros: 'Otros',
  };
  grupoLabel(g: string | null): string {
    return g ? (ReviewApprovalPage.GRUPO_LABEL[g] ?? g) : 'Otros';
  }

  /** Fecha ISO (aaaa-mm-dd) → dd-mm-aaaa para mostrar; '' si no hay. */
  formatFecha(iso: string | null): string {
    if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return 'sin fecha';
    const [y, m, d] = iso.split('-');
    return `${d}-${m}-${y}`;
  }

  /** Flag efectivo de un analito: veredicto del médico si marcó, si no el del sistema. */
  effFlag(l: any): string {
    return l.manualFlag ?? l.flag ?? 'NORMAL';
  }
  /**
   * ¿El analito necesita veredicto del médico? Sólo los de rango ilegible: donde el sistema no
   * pudo decidir. Los interpretados (rango legible) NO — el sistema ya los evaluó y son
   * información, no trabajo. Un ilegible ya marcado sigue mostrando botones (para deshacer).
   */
  needsVerdict(l: any): boolean {
    return !!l.rangeUnparsed;
  }
  /** ¿Ilegible aún sin marcar? Es el trabajo real pendiente. */
  isPending(l: any): boolean {
    return !!l.rangeUnparsed && !l.manualFlag;
  }
  /** Clase de severidad efectiva. Los ilegibles SIN marcar son 'pendiente' (van primero). */
  sevClass(l: any): string {
    if (this.isPending(l)) return 'pendiente';
    const f = this.effFlag(l);
    if (f === 'CRITICO') return 'critico';
    if (f === 'ALERTA') return 'alerta';
    return 'normal';
  }
  private sevRank(l: any): number {
    const c = this.sevClass(l);
    // Lo clínicamente urgente primero: CRÍTICO → ALERTA (rojos/ámbar confirmados por el sistema)
    // → "por revisar" (ilegibles sin marcar) → normales. El médico ve de inmediato lo que está
    // fuera de rango; los "por revisar" quedan visibles en medio, antes de los normales.
    return c === 'critico' ? 0 : c === 'alerta' ? 1 : c === 'pendiente' ? 2 : 3;
  }
  manualTitle(l: any): string {
    return l.manualSource === 'anestesiologo:sobrescribio-sistema'
      ? `Sobrescribiste el veredicto del sistema (${l.flag})`
      : 'Verificado por ti';
  }

  /** Analitos ordenados: "por revisar" primero, luego interpretados por severidad. Estable. */
  sortedLabs = computed(() => {
    return [...this.labs()]
      .map((l, i) => ({ l, i }))
      .sort((a, b) => this.sevRank(a.l) - this.sevRank(b.l) || a.i - b.i)
      .map((x) => x.l);
  });

  /** Resumen agregado, en vivo. auto = rango leído sin marca; manual = marcados; pendientes = ilegibles sin marcar. */
  labSummary = computed(() => {
    const labs = this.labs();
    const manual = labs.filter((l) => l.manualFlag).length;
    const pendientes = labs.filter((l) => l.rangeUnparsed && !l.manualFlag).length;
    const auto = labs.length - manual - pendientes;
    return { total: labs.length, auto, manual, pendientes, resueltos: auto + manual };
  });

  /**
   * Marca (o deshace) el veredicto de un analito. Un tap marca; otro tap sobre el mismo botón
   * deshace. Actualiza el signal en vivo (sin recargar todo) para que la fila y el resumen
   * cambien al instante y el reordenamiento se aplique.
   */
  async setVerdict(l: any, verdict: 'NORMAL' | 'ALERTA' | 'CRITICO') {
    // Toggle: si ya está en ese veredicto, deshacer.
    const next = l.manualFlag === verdict ? null : verdict;
    // Optimista: actualiza en memoria de inmediato (feedback instantáneo).
    const prev = { manualFlag: l.manualFlag, manualSource: l.manualSource };
    this.labs.update((arr) =>
      arr.map((x) =>
        x.id === l.id
          ? { ...x, manualFlag: next, manualSource: next ? (x.rangeUnparsed ? 'anestesiologo:verificado-manualmente' : 'anestesiologo:sobrescribio-sistema') : null }
          : x,
      ),
    );
    try {
      await this.api.setLabVerdict(this.caseId, l.id, next);
    } catch {
      // Falló el guardado: revertir el cambio optimista.
      this.labs.update((arr) => arr.map((x) => (x.id === l.id ? { ...x, ...prev } : x)));
    }
  }

  async reload() {
    const r = await this.api.getReview(this.caseId);
    this.fields.set(r.fields ?? {});
    this.labs.set(r.labs ?? []);
    this.labGroups.set(r.labGroups ?? []);
    this.attachments.set(r.attachments ?? []);
    this.check.set(r.canApprove);
    this.patient.set(r.patient ?? null);
    this.agendaFaltante.set(r.agendaFaltante ?? []);
    this.agenda.set(r.schedule ?? null);
    this.escalas.set(r.escalas ?? []);
    this.patientNote.set(r.patientNote ?? null);
    this.notePatientId.set(r.patientId ?? null);
    this.setFindings(r.audit?.findings ?? []);
    const isApproved = r.approved || r.status === 'APROBADO' || r.status === 'ENTREGADO';
    this.approved.set(isApproved);
    if (isApproved) {
      this.contacts.set((await this.api.listContacts()).contacts);
      this.sendToPatient.set(Boolean(r.patient?.email)); // por defecto, marcar al paciente si tiene correo
    }
  }

  /** Ordena los hallazgos por severidad (lo más severo primero) y los publica. */
  private setFindings(findings: { level: string; category: string; message: string }[]) {
    const order: Record<string, number> = { bloqueante: 0, advertencia: 1, informativo: 2 };
    this.auditFindings.set([...findings].sort((x, y) => (order[x.level] ?? 9) - (order[y.level] ?? 9)));
  }

  /** Re-corre el auditor determinístico sobre el borrador actual. Cero tokens; útil tras editar. */
  async reaudit() {
    this.reauditing.set(true);
    try {
      const { audit } = await this.api.reaudit(this.caseId);
      this.setFindings(audit?.findings ?? []);
    } finally {
      this.reauditing.set(false);
    }
  }

  /** Colapsa/expande el banner de nota y recuerda la preferencia. */
  toggleNote() {
    const next = !this.noteCollapsed();
    this.noteCollapsed.set(next);
    try { localStorage.setItem(NOTE_COLLAPSED_KEY, next ? '1' : '0'); } catch { /* almacenamiento no disponible */ }
  }

  /** Abre el editor de la nota privada (con el contenido actual, si hay). */
  startEditNote() {
    this.noteDraft.set(this.patientNote()?.content ?? '');
    this.noteEditing.set(true);
    this.noteCollapsed.set(false); // asegurar que se vea al editar
  }
  cancelEditNote() { this.noteEditing.set(false); }

  /** Guarda la nota. Vaciar una nota existente = borrarla: se confirma antes (no silencioso). */
  async saveNote() {
    const patientId = this.notePatientId();
    if (!patientId) return;
    const content = this.noteDraft().trim();
    if (content.length === 0 && this.patientNote()) {
      if (!confirm('¿Borrar la nota privada de este paciente? No se puede deshacer.')) return;
    }
    this.savingNote.set(true);
    try {
      const { note } = await this.api.savePatientNote(patientId, content);
      this.patientNote.set(note);
      this.noteEditing.set(false);
    } finally {
      this.savingNote.set(false);
    }
  }

  toggle(id: string, ev: Event) {
    const checked = (ev.target as HTMLInputElement).checked;
    this.selectedContacts.update((s) => {
      const next = new Set(s);
      if (checked) next.add(id); else next.delete(id);
      return next;
    });
  }
  setSendToPatient(ev: Event) { this.sendToPatient.set((ev.target as HTMLInputElement).checked); }

  private hasRecipient(): boolean {
    return this.selectedContacts().size > 0 || this.sendToPatient();
  }

  /** Abre el compositor con asunto/cuerpo precargados desde el servidor. */
  async openComposer() {
    this.distError.set('');
    this.sentOk.set(false);
    if (!this.hasRecipient()) { this.distError.set('Selecciona al menos un destinatario.'); return; }
    if (!this.emailSubject()) {
      const d = await this.api.emailDraft(this.caseId);
      this.emailSubject.set(d.subject);
      this.emailBody.set(d.body);
      this.pdfName.set(d.pdfFilename);
    }
    this.composerOpen.set(true);
  }

  /** Envía el correo editado (con PDF adjunto) a los destinatarios seleccionados. */
  async sendEmail() {
    this.distError.set('');
    this.sending.set(true);
    try {
      const res = await this.api.distribute(this.caseId, {
        contactIds: [...this.selectedContacts()], channel: 'email', sendToPatient: this.sendToPatient(),
        subject: this.emailSubject(), body: this.emailBody(),
      });
      this.deliveries.set(res.deliveries ?? []);
      this.composerOpen.set(false);
      this.sentOk.set(true);
    } catch (err: unknown) {
      const body = (err as { error?: { error?: string } })?.error;
      this.distError.set(body?.error ?? 'No se pudo enviar el correo.');
    } finally {
      this.sending.set(false);
    }
  }

  /** Solo genera el enlace de descarga (sin correo). */
  async generateLink() {
    this.distError.set('');
    this.sentOk.set(false);
    if (!this.hasRecipient()) { this.distError.set('Selecciona al menos un destinatario.'); return; }
    try {
      const res = await this.api.distribute(this.caseId, {
        contactIds: [...this.selectedContacts()], channel: 'link', sendToPatient: this.sendToPatient(),
      });
      this.deliveries.set(res.deliveries ?? []);
    } catch (err: unknown) {
      const body = (err as { error?: { error?: string } })?.error;
      this.distError.set(body?.error ?? 'No se pudo generar el enlace.');
    }
  }
  async copy(url: string) { await navigator.clipboard.writeText(url); }

  entries(section: string): { k: string; v: any }[] {
    const sec = this.fields()[section] ?? {};
    return Object.entries(sec).map(([k, v]) => ({ k, v }));
  }
  labelFor(k: string) { return SECTION_LABELS[k] ?? k; }
  isDerived(v: any) { return v?.fuente?.startsWith?.('derivado'); }
  levelLabel(level: string) {
    return level === 'bloqueante' ? 'Bloqueante' : level === 'advertencia' ? 'Advertencia' : 'Informativo';
  }

  // ── Edición en línea del borrador ──
  hoyBogota() { return hoyBogota(); }

  startEdit(section: string, key: string, v: any) {
    const cur = v?.estado === 'pendiente_examen' ? '' : (v?.valor ?? '');
    this.editValue.set(String(cur));
    // #7: al abrir peso/talla, separa el valor actual "63 kg / 1.70 m / …" en peso y talla.
    if (key === 'peso_talla_imc') {
      const nums = String(cur).match(/-?\d+(?:[.,]\d+)?/g) ?? [];
      this.ptPeso.set(nums[0] ?? '');
      this.ptTalla.set(nums[1] ?? '');
    }
    this.editingKey.set(`${section}.${key}`);
  }
  cancelEdit() { this.editingKey.set(null); }
  async saveEdit(section: string, key: string) {
    this.savingEdit.set(true);
    try {
      let value = this.editValue().trim();
      // #7: peso/talla/IMC se compone desde los campos guiados; el IMC es el calculado.
      if (key === 'peso_talla_imc') {
        const peso = parseDecimalLocal(this.ptPeso());
        const tallaRaw = parseDecimalLocal(this.ptTalla());
        const imc = this.ptImc();
        if (peso == null || tallaRaw == null) { this.savingEdit.set(false); return; } // faltan datos
        const m = tallaRaw > 3 ? tallaRaw / 100 : tallaRaw;
        value = `${peso} kg / ${m.toFixed(2)} m${imc != null ? ` / ${imc} kg/m²` : ''}`;
      }
      await this.api.editField(this.caseId, section, key, value);
      this.editingKey.set(null);
      await this.reload();
    } finally {
      this.savingEdit.set(false);
    }
  }

  setExamAttested(ev: Event) { this.examAttested.set((ev.target as HTMLInputElement).checked); }
  async loadNormal() {
    if (!this.examAttested()) return;
    await this.api.loadExamNormal(this.caseId);
    await this.reload();
  }
  async approve() {
    const res = await this.api.approve(this.caseId);
    if (res.ok) { await this.reload(); }
    else this.check.set({ ok: false, blockers: res.blockers ?? [] });
  }
  async reject() {
    // Cancelar el prompt (null) aborta: no se rechaza sin un motivo real (acción trazable).
    const reason = prompt('Motivo del rechazo (queda registrado):');
    if (reason === null || !reason.trim()) return;
    await this.api.reject(this.caseId, reason.trim());
    this.router.navigate(['/dashboard']);
  }
  async reopen() {
    const reason = prompt('Motivo de la reapertura (queda registrado):');
    if (reason === null || !reason.trim()) return; // cancelar o motivo vacío → no reabrir
    this.reopening.set(true);
    try {
      await this.api.reopen(this.caseId, reason.trim());
      this.approved.set(false);
      this.editingKey.set(null);
      await this.reload();
    } finally {
      this.reopening.set(false);
    }
  }
}
