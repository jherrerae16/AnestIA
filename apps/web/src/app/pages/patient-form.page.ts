import { Component, inject, signal, computed, effect, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { ApiService } from '../core/api.service';
import { COUNTRIES } from '../core/countries';
import {
  buildFacts,
  buildScreens,
  progreso,
  pruneHiddenAnswers,
  puedeEnviar,
  summaryRows,
  type Screen,
  type ScheduleFacts,
  type SummaryRow,
} from '@anestia/shared';
import type { FormAnswers, QuestionDef } from '@anestia/shared';

/**
 * Formato del documento: cédula (solo dígitos) → puntos de miles (1.042.246.578);
 * pasaporte u otro con letras (PE19028) → tal cual en mayúsculas, sin puntos.
 */
function formatDocumentId(raw: string): string {
  const v = (raw ?? '').trim();
  if (!v) return '';
  const digits = v.replace(/[.\s]/g, '');
  if (/^\d+$/.test(digits)) return digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return v.toUpperCase();
}

/** Pregunta tal como llega del servidor: el MISMO tipo que valida el backend. */
type Q = QuestionDef;

interface CampoRep {
  key: string;
  label: string;
  type: string;
  opciones?: string[];
  requerido?: boolean;
}

type Valor = string | number | boolean | string[] | null;
/** Mismo contrato que valida el servidor: un solo esquema Zod en los tres bordes. */
type Respuestas = FormAnswers;

/** Título y emoji por clave de sección. El ORDEN y la pertenencia los da el diccionario. */
const SECTION_META: Record<string, { title: string; icon: string }> = {
  identificacion: { title: 'Sus datos', icon: '\u{1F464}' },
  gineco_obstetrico: { title: 'Embarazo', icon: '\u{1FAC4}' },
  procedimiento: { title: 'Cirugía programada', icon: '\u{1F3E5}' },
  antecedentes: { title: 'Su salud', icon: '\u{1FA7A}' },
  medicamentos: { title: 'Medicamentos', icon: '\u{1F48A}' },
  alergias_anestesia: { title: 'Alergias y anestesias previas', icon: '\u{26A0}\u{FE0F}' },
  habitos: { title: 'Hábitos', icon: '\u{1F6AD}' },
  capacidad_funcional: { title: 'Actividad física', icon: '\u{1F6B6}' },
  sueno_nauseas: { title: 'Sueño y náuseas', icon: '\u{1F634}' },
  fragilidad: { title: 'Día a día', icon: '\u{1F9D3}' },
  tromboembolico: { title: 'Circulación', icon: '\u{1FA78}' },
  pediatrico: { title: 'Sobre el niño o la niña', icon: '\u{1F9D2}' },
  documentos: { title: 'Exámenes', icon: '\u{1F4CE}' },
  otros: { title: 'Otros datos', icon: '\u{1F4CB}' },
};

/** Opción excluyente de un acordeón. */
const ES_NINGUNA = /^(ninguna de las anteriores|ninguno|ninguna)$/i;

/** Normaliza para comparar ('sí'→'si'). */
function norm(v: unknown): string {
  return String(v ?? '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

/** Clave de borrador local, por enlace. Sobrevive a que el navegador mate la pestaña. */
const draftKey = (token: string) => `anestia:draft:${token}`;

/**
 * Formulario del paciente — recorrido POR PASOS.
 *
 * La Especificación del Dr. Luquetta lo pide así: "Una pregunta o un grupo corto por pantalla;
 * botones grandes y lenguaje no técnico", "Guardar avance automático y permitir regresar sin
 * perder respuestas", y un resumen final que muestre "exclusivamente campos faltantes o
 * inconsistentes; nunca obliga a repetir todo el cuestionario".
 *
 * Este componente es un RENDERIZADOR: qué pantallas hay, qué falta y qué se oculta lo decide
 * `@anestia/shared` (`form-engine.ts`, `rules.ts`), que sí tiene tests. `apps/web` no los tiene.
 */
@Component({
  selector: 'app-patient-form',
  standalone: true,
  imports: [FormsModule],
  styles: [`
    :host {
      --blue: var(--primary);
      --blue-dark: var(--primary-dark);
      --blue-light: var(--it-50);
      --dot: rgba(11,92,107,0.09);
      --r-md: 12px; --r-pill: 100px;
      display: block; min-height: 100vh; background: #fff;
    }
    * { box-sizing: border-box; }

    /* NAV */
    .nav {
      position: sticky; top: 0; z-index: 100;
      background: rgba(255,255,255,0.94); backdrop-filter: blur(12px);
      border-bottom: 1px solid var(--border);
      padding: 0 24px; height: 62px; display: flex; align-items: center; gap: 11px;
    }
    .nav-icon {
      width: 40px; height: 40px; border-radius: 9px; overflow: hidden; flex-shrink: 0;
      background: linear-gradient(135deg, var(--primary), var(--blue2));
      display: flex; align-items: center; justify-content: center; color: #fff; font-weight: 700;
    }
    .nav-icon.has-logo { background: #fff; border: 1px solid var(--border); padding: 3px; }
    .nav-icon img { width: 100%; height: 100%; object-fit: contain; }
    .nav-title { font-family: var(--font-display); font-weight: 700; font-size: 14px; color: var(--text); letter-spacing: -0.3px; }
    .nav-sub { font-size: 11px; color: var(--muted); }

    /* PROGRESS (refleja respuestas completadas) */
    .prog-wrap { height: 3px; background: var(--it-100); position: sticky; top: 62px; z-index: 99; }
    .prog-fill { height: 100%; background: linear-gradient(90deg, var(--primary), var(--blue)); transition: width .4s ease; border-radius: 0 3px 3px 0; }

    /* HERO */
    .hero { text-align: center; padding: 40px 24px 12px; position: relative; overflow: hidden; }
    .hero::before { content:''; position:absolute; inset:0; background-image: radial-gradient(circle, var(--dot) 1.5px, transparent 1.5px); background-size: 22px 22px; }
    .hero > * { position: relative; z-index: 1; }
    .badge { display:inline-flex; align-items:center; gap:7px; background:var(--blue-light); color:var(--primary); font-size:12px; font-weight:600; padding:6px 15px; border-radius:var(--r-pill); margin-bottom:16px; }
    .badge::before { content:''; width:7px; height:7px; background:var(--primary); border-radius:50%; animation:pulse 2s infinite; }
    .hero h1 { font-family:var(--font-display); font-size:clamp(26px,4vw,40px); font-weight:700; line-height:1.15; letter-spacing:-1px; color:var(--text); margin-bottom:10px; }
    .hero p { font-size:15px; color:var(--muted); max-width:480px; margin:0 auto; line-height:1.55; }

    .form-body { max-width: 660px; margin: 0 auto; padding: 24px 20px 60px; }

    /* SECTION */
    .section { margin-bottom: 14px; }
    .section-head { display:flex; align-items:center; gap:11px; margin: 30px 0 4px; }
    .section-ic { width:34px; height:34px; border-radius:9px; background:var(--blue-light); display:flex; align-items:center; justify-content:center; font-size:17px; flex-shrink:0; }
    .section-title { font-family:var(--font-display); font-size:18px; font-weight:700; color:var(--text); letter-spacing:-.3px; }
    .section-line { height:1px; background:var(--border); margin: 8px 0 20px; }

    /* QUESTION */
    .q { margin-bottom: 22px; scroll-margin-top: 80px; }
    /* Pregunta condicional (aparece al responder "Sí"): sangrada + conector visual. */
    .q-conditional { margin-left: 16px; padding-left: 16px; border-left: 2px solid var(--it-200); animation: revealDown .25s ease; }
    .q-conditional .q-label::before { content: '↳ '; color: var(--primary); font-weight: 700; }
    @keyframes revealDown { from { opacity:0; transform:translateY(-4px); } to { opacity:1; transform:translateY(0); } }
    .q-label { font-size:14.5px; font-weight:600; color:var(--text); margin-bottom:9px; line-height:1.4; }
    .q-label .req { color:var(--red); }

    .finp {
      width:100%; padding:12px 15px; border:1.5px solid var(--border2); border-radius:var(--r-md);
      /* 16px evita el auto-zoom de iOS al enfocar un campo (formulario móvil-first). */
      font-size:16px; font-family:var(--font-body); color:var(--text); background:#fff;
      transition:border-color .15s, box-shadow .15s; outline:none;
    }
    .finp:focus { border-color:var(--primary); box-shadow:0 0 0 4px rgba(11,92,107,.1); }
    textarea.finp { resize:vertical; min-height:80px; }
    .finp::placeholder { color:var(--muted2); }
    .phone-wrap { display:flex; gap:8px; align-items:stretch; }
    /* Selector país: muestra compacto (bandera + código); el nombre completo aparece al desplegar. */
    .phone-cc-box { position:relative; flex:0 0 92px; width:92px; display:inline-flex; align-items:center;
      border:1.5px solid var(--border2); border-radius:var(--r-md); background:#fff; padding:0 8px; cursor:pointer; }
    .phone-cc-box:focus-within { border-color:var(--primary); box-shadow:0 0 0 4px rgba(11,92,107,.1); }
    .phone-cc-display { font-size:14.5px; color:var(--text); white-space:nowrap; }
    .phone-cc-caret { margin-left:auto; font-size:10px; color:var(--muted); pointer-events:none; }
    .phone-cc-select { position:absolute; inset:0; width:100%; height:100%; opacity:0; cursor:pointer; border:none; font-size:16px; }
    .phone-num { flex:1; min-width:0; }
    .date-err { color:var(--red); font-size:12px; margin-top:6px; }

    /* OPTIONS */
    .opts { display:flex; flex-direction:column; gap:7px; }
    .opts.inline { flex-direction:row; flex-wrap:wrap; }
    .opts.inline .opt { flex:1; min-width:120px; }
    /* .opt es un <button> (accesible por teclado): se resetea la apariencia nativa y se estira. */
    .opt {
      appearance:none; width:100%; text-align:left; font-family:var(--font-body);
      display:flex; align-items:center; gap:12px; padding:12px 15px; min-height:48px;
      border:1.5px solid var(--border2); border-radius:var(--r-md); cursor:pointer;
      transition:border-color .13s, background .13s, color .13s; background:#fff; font-size:15px; color:var(--text); font-weight:500; user-select:none;
    }
    .opts.inline .opt { text-align:center; justify-content:center; }
    .opt:hover { border-color:var(--primary); background:var(--blue-light); }
    .opt:focus-visible { outline:2px solid var(--primary); outline-offset:2px; }
    .opt.sel { border-color:var(--primary); background:var(--blue-light); color:var(--primary-dark); }
    .chk { width:19px; height:19px; border:2px solid var(--border2); border-radius:50%; flex-shrink:0; display:flex; align-items:center; justify-content:center; transition:all .13s; }
    .chk.box { border-radius:5px; }
    .opt.sel .chk { background:var(--primary); border-color:var(--primary); }
    .chk::after { content:''; width:8px; height:8px; border-radius:50%; background:#fff; opacity:0; transition:opacity .13s; }
    .chk.box::after { border-radius:2px; width:9px; height:9px; }
    .opt.sel .chk::after { opacity:1; }

    /* UPLOAD */
    .drop { border:2px dashed var(--border2); border-radius:var(--r-md); padding:26px; text-align:center; background:var(--bg3); transition:border-color .15s; }
    .drop:hover { border-color:var(--primary); }
    /* Oculto visualmente pero accesible por teclado (no display:none, que lo saca del tab-order).
       El label asociado (for="fileup") lo activa; recibe foco vía el label. */
    .drop input { position:absolute; width:1px; height:1px; opacity:0; overflow:hidden; }
    .drop input:focus-visible + .drop-label { outline:2px solid var(--primary); outline-offset:3px; border-radius:4px; }
    .drop-label { cursor:pointer; color:var(--primary); font-weight:600; font-size:15px; display:inline-block; }
    .drop-hint { font-size:12px; color:var(--muted); margin-top:5px; }
    .uploaded-list { margin-top:12px; display:flex; flex-direction:column; gap:6px; }
    .up-item { display:flex; align-items:center; gap:8px; font-size:13px; color:var(--muted); background:var(--blue-light); padding:8px 12px; border-radius:8px; }

    /* ERRORS */
    .errors { background:rgba(220,64,64,.08); border:1px solid rgba(220,64,64,.25); color:var(--red); padding:13px 16px; border-radius:var(--r-md); font-size:13px; margin:22px 0; }
    .errors div { margin:2px 0; }

    /* SUBMIT BAR */
    /* padding-bottom con safe-area: el botón "Enviar" no queda tapado por el home indicator del iPhone. */
    .submit-bar { position:sticky; bottom:0; background:rgba(255,255,255,0.95); backdrop-filter:blur(10px); border-top:1px solid var(--border); padding:14px 20px calc(14px + env(safe-area-inset-bottom)); display:flex; gap:10px; justify-content:flex-end; align-items:center; z-index:50; flex-wrap:wrap; }
    .submit-hint { font-size:12px; color:var(--muted); margin-right:auto; }
    /* En móvil el hint + 2 botones no caben en una fila (375px): el contador se cortaba y
       "Enviar respuestas" partía en dos líneas. Se apila el hint arriba y los botones abajo. */
    @media (max-width:480px) {
      .submit-bar { flex-direction:column; align-items:stretch; gap:8px; padding:12px 16px; }
      .submit-hint { margin-right:0; text-align:center; }
      .submit-bar .btn-ghost, .submit-bar .btn-send { width:100%; }
    }
    .btn-ghost { background:none; border:1.5px solid var(--border2); color:var(--muted); padding:11px 20px; border-radius:var(--r-pill); font-size:14px; font-weight:500; cursor:pointer; transition:all .15s; font-family:var(--font-body); }
    .btn-ghost:hover { border-color:var(--muted); color:var(--text); }
    .btn-send { background:var(--primary); color:#fff; border:none; padding:12px 28px; border-radius:var(--r-pill); font-size:14.5px; font-weight:600; cursor:pointer; transition:all .2s; font-family:var(--font-body); }
    .btn-send:hover:not(:disabled) { background:var(--primary-dark); transform:translateY(-1px); box-shadow:0 6px 20px rgba(11,92,107,.28); }
    .btn-send:disabled { background:var(--border2); cursor:not-allowed; }

    /* CONSENT */
    .consent { max-width:640px; margin:0 auto; padding:36px 24px 64px; }
    .consent h2 { font-family:var(--font-display); font-size:22px; font-weight:700; color:var(--text); margin-bottom:16px; letter-spacing:-.4px; }
    .consent-body { background:var(--bg3); border:1px solid var(--border); border-radius:var(--r-md); padding:18px; font-size:13.5px; line-height:1.6; color:var(--muted); white-space:pre-line; max-height:300px; overflow:auto; margin-bottom:18px; }
    .consent-check { display:flex; gap:11px; align-items:flex-start; font-size:14px; color:var(--text); margin-bottom:24px; cursor:pointer; }
    .consent-check input { width:22px; height:22px; margin-top:1px; accent-color:var(--primary); flex-shrink:0; }
    .btn-cta { display:inline-flex; align-items:center; gap:8px; background:var(--primary); color:#fff; font-size:15px; font-weight:600; padding:14px 32px; border-radius:var(--r-pill); border:none; cursor:pointer; transition:all .2s; font-family:var(--font-body); }
    .btn-cta:hover:not(:disabled) { background:var(--primary-dark); transform:translateY(-2px); box-shadow:0 8px 24px rgba(11,92,107,.3); }
    .btn-cta:disabled { background:var(--border2); cursor:not-allowed; transform:none; box-shadow:none; }

    /* THANK YOU */
    .ty { min-height:calc(100vh - 65px); display:flex; flex-direction:column; align-items:center; justify-content:center; text-align:center; padding:60px 24px; }
    .chk-circle { width:68px; height:68px; background:var(--green); border-radius:50%; display:flex; align-items:center; justify-content:center; margin:0 auto 24px; animation:pop .4s cubic-bezier(.175,.885,.32,1.275); font-size:32px; color:#fff; }
    .ty h1 { font-family:var(--font-display); font-size:clamp(26px,4vw,36px); font-weight:700; letter-spacing:-.8px; color:var(--text); margin-bottom:14px; }
    .ty p { font-size:15px; color:var(--muted); max-width:460px; line-height:1.6; }

    /* STATES */
    .center { min-height:60vh; display:flex; align-items:center; justify-content:center; color:var(--muted); }
    .spin { width:40px; height:40px; border:3px solid var(--it-100); border-top-color:var(--primary); border-radius:50%; animation:spin .8s linear infinite; }

    @keyframes pulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.5;transform:scale(1.3)} }
    @keyframes pop { from{transform:scale(0);opacity:0} to{transform:scale(1);opacity:1} }
    @keyframes spin { to{transform:rotate(360deg)} }
    @media (prefers-reduced-motion: reduce) { *,*::before,*::after { animation-duration:.01ms !important; transition-duration:.01ms !important; } }

    /* ── PASOS (Fase 1B) ───────────────────────────────────────────────────── */
    /* La Especificación pide "una pregunta o un grupo corto por pantalla, botones grandes
       y lenguaje no técnico". El scroll único quedó atrás. */
    .screen { max-width: 640px; margin: 0 auto; padding: 20px 20px 140px; animation: revealDown .2s ease; }
    .screen-head { display:flex; align-items:center; gap:11px; margin: 8px 0 22px; }
    .step-count { font-size: 12px; color: var(--muted); font-variant-numeric: tabular-nums; }
    .q-big .q-label { font-size: 19px; line-height: 1.35; font-weight: 650; }
    .q-help { font-size: 13px; color: var(--muted); margin: 6px 0 12px; line-height: 1.5; }
    /* Botones grandes: 52px de alto mínimo, cómodos con el pulgar en móvil. */
    .opt { min-height: 52px; }
    .navbar {
      position: fixed; left: 0; right: 0; bottom: 0; z-index: 90;
      background: rgba(255,255,255,0.96); backdrop-filter: blur(12px);
      border-top: 1px solid var(--border);
      padding: 12px 20px calc(12px + env(safe-area-inset-bottom));
      display: flex; gap: 10px; align-items: center; justify-content: space-between;
    }
    .navbar .grow { flex: 1; }
    .btn-back { background: none; border: 1px solid var(--border); border-radius: var(--r-pill);
      padding: 12px 20px; font-size: 15px; font-weight: 600; color: var(--muted); cursor: pointer; min-height: 48px; }
    .btn-next { background: var(--primary); color: #fff; border: none; border-radius: var(--r-pill);
      padding: 13px 30px; font-size: 15px; font-weight: 650; cursor: pointer; min-height: 48px; }
    .btn-next:disabled { opacity: .45; cursor: not-allowed; }
    .save-hint { font-size: 12px; color: var(--muted); }

    /* ── ACORDEÓN DE ANTECEDENTES ──────────────────────────────────────────── */
    /* Las opciones de cierre ("Ninguna", "No sabe") se separan de los diagnósticos. */
    .acc-none { margin-top: 10px; padding-top: 10px; border-top: 1px dashed var(--border); }

    /* Instancias de una pregunta repetida por enfermedad. */
    .inst { margin-bottom: 18px; padding-left: 14px; border-left: 3px solid var(--it-200); }
    .inst-label { font-size: 14px; font-weight: 600; color: var(--text); margin-bottom: 8px; }

    /* ── REPETIDOR (medicamentos) ──────────────────────────────────────────── */
    .rep-item { border: 1px solid var(--border); border-radius: var(--r-md); padding: 14px; margin-bottom: 10px; }
    .rep-item-head { display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; }
    .rep-field { margin-bottom: 10px; }
    .rep-field label { display:block; font-size:12px; color: var(--muted); margin-bottom: 4px; }
    .btn-add { background: var(--blue-light); color: var(--primary); border: none; border-radius: var(--r-pill);
      padding: 11px 20px; font-size: 14px; font-weight: 600; cursor: pointer; min-height: 44px; }
    .btn-del { background:none; border:none; color: var(--danger, #b42318); font-size: 13px; cursor: pointer; }

    /* ── RESUMEN FINAL ─────────────────────────────────────────────────────── */
    /* "El sistema muestra exclusivamente campos faltantes o inconsistentes; nunca obliga a
       repetir todo el cuestionario." */
    .sum-row { display:flex; gap:12px; align-items:flex-start; padding: 13px 0; border-bottom: 1px solid var(--border); }
    .sum-row button { background:none; border:none; color: var(--primary); font-weight:600; cursor:pointer; font-size:13px; padding:0; }
    .sum-tag { font-size:11px; font-weight:700; padding:3px 9px; border-radius:var(--r-pill); white-space:nowrap; }
    .sum-tag.falta { background:#fef3f2; color:#b42318; }
    .sum-tag.no_sabe { background:#fffaeb; color:#b54708; }
    .sum-tag.inconsistente { background:#fef3f2; color:#b42318; }
    .sum-ok { text-align:center; padding: 30px 0; }
    .sum-ok .big { font-size: 42px; }
    .restored { background: var(--blue-light); color: var(--primary); border-radius: var(--r-md);
      padding: 12px 14px; font-size: 13px; margin-bottom: 18px; }

  `],
  template: `
    @if (loading()) {
      <div class="center"><div class="spin"></div></div>
    } @else if (invalid()) {
      <div class="center">
        <div class="errors" style="max-width:420px">
          Este enlace no es válido o expiró. Pídele a tu anestesiólogo uno nuevo.
        </div>
      </div>
    } @else if (done()) {
      <div class="ty" data-testid="form-done">
        <div class="chk-circle">✓</div>
        <h1>¡Gracias!</h1>
        <p>Tus respuestas fueron enviadas. Tu anestesiólogo las revisará y preparará tu
           valoración preanestésica.</p>
      </div>
    } @else {
      <div class="nav">
        <div class="nav-icon" [class.has-logo]="branding()?.logo">
          @if (branding()?.logo) { <img [src]="branding()!.logo" alt="" /> } @else { A }
        </div>
        <div>
          <div class="nav-title">Valoración preanestésica</div>
          <div class="nav-sub">{{ branding()?.doctor }}</div>
        </div>
      </div>
      <div class="prog-wrap"><div class="prog-fill" [style.width.%]="progress().pct"></div></div>

      @if (!consentAccepted()) {
        <!-- Consentimiento Ley 1581: antes de cualquier pregunta clínica. -->
        <div class="screen">
          <h2>Antes de empezar</h2>
          <div class="consent-body">{{ consentText() }}</div>
          <label class="consent-check">
            <input type="checkbox" [ngModel]="consentChecked()"
                   (ngModelChange)="consentChecked.set($event)"
                   data-testid="consent-accept-checkbox" />
            <span>He leído y acepto el tratamiento de mis datos.</span>
          </label>
        </div>
        <div class="navbar">
          <span class="grow"></span>
          <button class="btn-next" [disabled]="!consentChecked()" (click)="acceptConsent()"
                  data-testid="consent-continue-button">Continuar</button>
        </div>
      } @else if (showSummary()) {
        <!-- Resumen: SOLO lo que falta o no cuadra. Nunca se repite todo el cuestionario. -->
        <div class="screen" data-testid="form-summary">
          <div class="screen-head">
            <div class="section-ic">📋</div>
            <div class="section-title">Revisa antes de enviar</div>
          </div>
          @if (summary().length === 0) {
            <div class="sum-ok">
              <div class="big">🎉</div>
              <p>Está todo completo. Puedes enviar tus respuestas.</p>
            </div>
          } @else {
            <p class="q-help">Solo te mostramos lo que falta o lo que conviene revisar.</p>
            @for (row of summary(); track row.code) {
              <div class="sum-row">
                <span class="sum-tag" [class]="'sum-tag ' + row.motivo">
                  {{ row.motivo === 'falta' ? 'Falta' : row.motivo === 'no_sabe' ? 'No sabe' : 'Revisar' }}
                </span>
                <div style="flex:1">
                  <div>{{ row.label }}</div>
                  <div class="q-help" style="margin:2px 0 0">{{ row.detalle }}</div>
                </div>
                <button (click)="goToCode(row.code)" [attr.data-testid]="'sum-goto-' + row.code">Ir</button>
              </div>
            }
          }
          @if (errors().length) {
            <div class="errors" data-testid="form-errors">
              @for (e of errors(); track e) { <div>{{ e }}</div> }
            </div>
          }
        </div>
        <div class="navbar">
          <button class="btn-back" (click)="backFromSummary()">Volver</button>
          <span class="grow"></span>
          <button class="btn-next" [disabled]="!canSubmit() || submitting()" (click)="submit()"
                  data-testid="form-submit-button">
            {{ submitting() ? 'Enviando…' : 'Enviar respuestas' }}
          </button>
        </div>
      } @else {
        @if (current(); as sc) {
        <div class="screen">
          @if (restored()) {
            <div class="restored">Recuperamos tus respuestas anteriores. Puedes seguir donde ibas.</div>
          }
          <div class="screen-head">
            <div class="section-ic">{{ meta(sc.seccion).icon }}</div>
            <div>
              <div class="section-title">{{ meta(sc.seccion).title }}</div>
              <div class="step-count">Paso {{ screenIndex() + 1 }} de {{ screens().length }}</div>
            </div>
          </div>

          @for (q of sc.questions; track q.code) {
            <div class="q q-big" [id]="'q-' + q.code">
              <div class="q-label">{{ q.label }}@if (q.required) { <span class="req">*</span> }</div>
              @if (q.ayuda) { <div class="q-help">{{ q.ayuda }}</div> }

              @if (sc.instancias?.length) {
                <!--
                  Pregunta repetida por enfermedad marcada. La Especificación §5 la pide "para
                  cada enfermedad seleccionada": una sola respuesta para el conjunto no distingue
                  la hipertensión controlada de la diabetes que no lo está.
                -->
                @for (inst of sc.instancias ?? []; track inst.key) {
                  <div class="inst">
                    <div class="inst-label">{{ inst.label }}</div>
                    <div class="opts" role="radiogroup">
                      @for (o of q.options ?? []; track o) {
                        <button type="button" class="opt" role="radio"
                                [attr.aria-checked]="valueOf(inst.key) === o"
                                [class.sel]="valueOf(inst.key) === o"
                                (click)="setInstancia(q, inst.key, o)"
                                [attr.data-testid]="'q-' + inst.key">{{ o }}</button>
                      }
                    </div>
                  </div>
                }
              } @else {

              @switch (q.type) {
                @case ('SI_NO_NOSABE') {
                  <!-- Tres estados. "No sabe" es una respuesta, no una negación (CS10). -->
                  <div class="opts" role="radiogroup">
                    @for (o of ternaryOptions; track o[0]) {
                      <button type="button" class="opt" role="radio"
                              [attr.aria-checked]="valueOf(q.code) === o[0]"
                              [class.sel]="valueOf(q.code) === o[0]"
                              (click)="setAnswer(q, o[0])"
                              [attr.data-testid]="'q-' + q.code + '-' + o[0]">{{ o[1] }}</button>
                    }
                  </div>
                }
                @case ('SI_NO') {
                  <div class="opts" role="radiogroup">
                    @for (o of yesNoOptions; track o[0]) {
                      <button type="button" class="opt" role="radio"
                              [attr.aria-checked]="valueOf(q.code) === o[0]"
                              [class.sel]="valueOf(q.code) === o[0]"
                              (click)="setAnswer(q, o[0])"
                              [attr.data-testid]="'q-' + q.code + '-' + o[0]">{{ o[1] }}</button>
                    }
                  </div>
                }
                @case ('SELECCION_UNICA') {
                  <div class="opts" role="radiogroup">
                    @for (o of q.options ?? []; track o) {
                      <button type="button" class="opt" role="radio"
                              [attr.aria-checked]="isSelectedOption(q.code, o)"
                              [class.sel]="isSelectedOption(q.code, o)"
                              (click)="setChoice(q, o)"
                              [attr.data-testid]="'q-' + q.code">{{ o }}</button>
                    }
                  </div>
                  @if (isOtherChosen(q.code)) {
                    <input class="finp" style="margin-top:8px" [ngModel]="otherText(q.code)"
                           (ngModelChange)="setOther(q, $event)"
                           [attr.data-testid]="'q-' + q.code + '-other'" placeholder="Especifique…" />
                  }
                }
                @case ('SELECCION_MULTIPLE') {
                  <div class="opts" role="group" [attr.aria-label]="q.label">
                    @for (o of q.options ?? []; track o) {
                      <button type="button" class="opt" role="checkbox"
                              [attr.aria-checked]="isChecked(q.code, o)"
                              [class.sel]="isChecked(q.code, o)"
                              (click)="toggleMulti(q, o)"
                              [attr.data-testid]="'q-' + q.code">
                        <span class="chk box"></span>{{ o }}
                      </button>
                    }
                  </div>
                  @if (hasOtherChecked(q.code)) {
                    <input class="finp" style="margin-top:8px" [ngModel]="otherOf(q.code)"
                           (ngModelChange)="setMultiOther(q, $event)"
                           [attr.data-testid]="'q-' + q.code + '-other'" placeholder="¿Cuál otra?" />
                  }
                }
                @case ('ACORDEON_MULTIPLE') {
                  <!-- "Ninguna de las anteriores" desmarca el resto (Especificación §5). -->
                  <div class="opts" role="group" [attr.aria-label]="q.label">
                    @for (o of normalOptions(q); track o) {
                      <button type="button" class="opt" role="checkbox"
                              [attr.aria-checked]="isChecked(q.code, o)"
                              [class.sel]="isChecked(q.code, o)"
                              (click)="toggleMulti(q, o)"
                              [attr.data-testid]="'q-' + q.code">
                        <span class="chk box"></span>{{ o }}
                      </button>
                    }
                  </div>
                  <div class="acc-none opts" role="group">
                    @for (o of closingOptions(q); track o) {
                      <button type="button" class="opt" role="checkbox"
                              [attr.aria-checked]="isChecked(q.code, o)"
                              [class.sel]="isChecked(q.code, o)"
                              (click)="toggleMulti(q, o)"
                              [attr.data-testid]="'q-' + q.code + '-' + o">
                        <span class="chk box"></span>{{ o }}
                      </button>
                    }
                  </div>
                  @if (hasOtherChecked(q.code)) {
                    <input class="finp" style="margin-top:8px" [ngModel]="otherOf(q.code)"
                           (ngModelChange)="setMultiOther(q, $event)"
                           [attr.data-testid]="'q-' + q.code + '-other'" placeholder="¿Cuál otra?" />
                  }
                }
                @case ('REPETIDOR') {
                  <!-- Cada medicamento con sus campos, en vez de un texto libre. -->
                  <!--
                    filaIdx es un alias explícito del índice de la FILA. Sin él, el bucle
                    interno de campos sombrea el $index de la fila y cada campo escribía en
                    una fila distinta: la dosis (campo 1) iba a la fila 1 y la frecuencia
                    (campo 2) creaba una fila vacía. Los medicamentos salían batidos.
                  -->
                  @for (fila of repItems(q.code); track $index; let filaIdx = $index) {
                    <div class="rep-item">
                      <div class="rep-item-head">
                        <strong>{{ filaIdx + 1 }}</strong>
                        <button class="btn-del" (click)="repRemove(q, filaIdx)"
                                [attr.data-testid]="'rep-del-' + q.code + '-' + filaIdx">Quitar</button>
                      </div>
                      @for (c of camposDe(q); track c.key) {
                        <div class="rep-field">
                          <label [attr.for]="'rep-' + q.code + '-' + filaIdx + '-' + c.key">{{ c.label }}</label>
                          <!--
                            Enlace UNIDIRECCIONAL a propósito: [value] + (input), sin ngModel.
                            El bucle reconstruye la fila en cada ciclo de detección, y con ngModel
                            eso realimentaba el valor anterior al input: las filas se mezclaban
                            entre sí (una perdía la dosis, la siguiente el nombre).
                          -->
                          @if (c.type === 'SELECCION_UNICA') {
                            <select class="finp" [id]="'rep-' + q.code + '-' + filaIdx + '-' + c.key"
                                    [value]="repValue(q.code, filaIdx, c.key)"
                                    (change)="repSet(q, filaIdx, c.key, asValue($event))">
                              <option value="">—</option>
                              @for (o of c.opciones ?? []; track o) {
                                <option [value]="o" [selected]="repValue(q.code, filaIdx, c.key) === o">{{ o }}</option>
                              }
                            </select>
                          } @else {
                            <input class="finp" [id]="'rep-' + q.code + '-' + filaIdx + '-' + c.key"
                                   [value]="repValue(q.code, filaIdx, c.key)"
                                   (input)="repSet(q, filaIdx, c.key, asValue($event))"
                                   [attr.data-testid]="'rep-' + q.code + '-' + filaIdx + '-' + c.key" />
                          }
                        </div>
                      }
                    </div>
                  }
                  <button class="btn-add" (click)="repAdd(q)"
                          [attr.data-testid]="'rep-add-' + q.code">+ Agregar</button>
                }
                @case ('ARCHIVO') {
                  <!-- Antes ARCHIVO no tenía rama y caía a un input de texto: al paciente se le
                       pedía subir un examen y le aparecía una caja para escribir. -->
                  <div class="drop">
                    <input type="file" [id]="'file-' + q.code" multiple accept="application/pdf,image/*"
                           (change)="onFiles($event)" data-testid="form-attachment-input" />
                    <label [attr.for]="'file-' + q.code" class="drop-label">Seleccionar archivos</label>
                    <div class="drop-hint">PDF o fotos de sus exámenes.</div>
                  </div>
                  @if (uploaded().length) {
                    <div class="uploaded-list">
                      @for (u of uploaded(); track u) { <div class="up-item">✓ {{ u }}</div> }
                    </div>
                  }
                }
                @case ('TEXTO_LARGO') {
                  <textarea class="finp" rows="3" [ngModel]="valueOf(q.code)"
                            (ngModelChange)="setAnswer(q, $event)"
                            [attr.data-testid]="'q-' + q.code" placeholder="Escribe aquí…"></textarea>
                }
                @case ('NUMERO') {
                  <input class="finp" type="number" inputmode="decimal" [ngModel]="valueOf(q.code)"
                         (ngModelChange)="setAnswer(q, $event)"
                         [attr.data-testid]="'q-' + q.code" placeholder="0" />
                  @if (q.validacion?.['unidad']) { <span class="q-help">{{ q.validacion!['unidad'] }}</span> }
                }
                @case ('FECHA') {
                  <input class="finp" type="text" inputmode="numeric" maxlength="10"
                         [ngModel]="dateDisplay(q.code)" (ngModelChange)="setDate(q, $event)"
                         [attr.data-testid]="'q-' + q.code" placeholder="dd/mm/aaaa" />
                  @if (dateError(q.code)) { <div class="date-err">Fecha inválida. Usa dd/mm/aaaa.</div> }
                }
                @case ('TELEFONO') {
                  <div class="phone-wrap">
                    <div class="phone-cc-box">
                      <span class="phone-cc-display">{{ dialFlag(q.code) }} +{{ dialOf(q.code) }}</span>
                      <span class="phone-cc-caret">▼</span>
                      <select class="phone-cc-select" [ngModel]="dialOf(q.code)"
                              (ngModelChange)="setDial(q, $event)"
                              [attr.data-testid]="'q-' + q.code + '-cc'">
                        @for (c of countries; track c.dial) {
                          <option [value]="c.dial">{{ c.flag }} {{ c.name }} +{{ c.dial }}</option>
                        }
                      </select>
                    </div>
                    <input class="finp" type="tel" inputmode="tel"
                           [ngModel]="phoneNumOf(q.code)" (ngModelChange)="setPhoneNum(q, $event)"
                           [attr.data-testid]="'q-' + q.code" placeholder="Número" />
                  </div>
                }
                @case ('DOCUMENTO_ID') {
                  <input class="finp" type="text" [ngModel]="valueOf(q.code)"
                         (ngModelChange)="setDocument(q, $event)"
                         [attr.data-testid]="'q-' + q.code" placeholder="Número de documento" />
                }
                @case ('CORREO') {
                  <input class="finp" type="email" inputmode="email" [ngModel]="valueOf(q.code)"
                         (ngModelChange)="setAnswer(q, $event)"
                         [attr.data-testid]="'q-' + q.code" placeholder="nombre@correo.com" />
                }
                @default {
                  <input class="finp" type="text" [ngModel]="valueOf(q.code)"
                         (ngModelChange)="setAnswer(q, $event)"
                         [attr.data-testid]="'q-' + q.code" placeholder="Escribe aquí…" />
                }
              }
              }
            </div>
          }
        </div>

        <div class="navbar">
          @if (screenIndex() > 0) {
            <button class="btn-back" (click)="back()" data-testid="form-back">Atrás</button>
          }
          <span class="grow"></span>
          <span class="save-hint">
            {{ saveState() === 'saving' ? 'Guardando…' : saveState() === 'saved' ? 'Guardado' : '' }}
          </span>
          <button class="btn-next" (click)="next()" data-testid="form-next">
            {{ isLastScreen() ? 'Revisar' : 'Siguiente' }}
          </button>
        </div>
        }
      }
    }

  `,
})
export class PatientFormPage implements OnInit {
  private api = inject(ApiService);
  private route = inject(ActivatedRoute);

  token = '';
  loading = signal(true);
  invalid = signal(false);
  done = signal(false);
  submitting = signal(false);
  saveState = signal<'idle' | 'saving' | 'saved'>('idle');
  branding = signal<{ logo?: string; doctor?: string } | null>(null);
  questions = signal<Q[]>([]);
  consentText = signal('');
  consentAccepted = signal(false);
  consentChecked = signal(false);
  answers = signal<Respuestas>({});
  procedureDate = signal<string>('');
  /**
   * Atributos de la agenda quirúrgica. NO son preguntas: son hechos con los que el motor decide
   * qué ramas abrir (Caprini por cirugía mayor, DASI por sitio quirúrgico elevado). El paciente
   * nunca los ve ni los responde.
   */
  schedule = signal<ScheduleFacts | null>(null);
  errors = signal<string[]>([]);
  uploaded = signal<string[]>([]);
  /** Se recuperó un borrador del navegador: se avisa en vez de reaparecer datos sin explicación. */
  restored = signal(false);

  screenIndex = signal(0);
  showSummary = signal(false);

  readonly countries = COUNTRIES;
  readonly ternaryOptions: [string, string][] = [['si', 'Sí'], ['no', 'No'], ['no_sabe', 'No sabe']];
  readonly yesNoOptions: [string, string][] = [['si', 'Sí'], ['no', 'No']];

  facts = computed(() =>
    buildFacts({
      answers: this.answers(),
      schedule: this.schedule(),
      refDateISO: this.procedureDate() || null,
    }),
  );

  /** Pantallas del recorrido. La lógica vive en `@anestia/shared` y está cubierta por tests. */
  screens = computed<Screen[]>(() =>
    buildScreens(this.questions(), this.answers(), this.facts()),
  );

  current = computed<Screen | null>(() => this.screens()[this.screenIndex()] ?? null);
  isLastScreen = computed(() => this.screenIndex() >= this.screens().length - 1);
  progress = computed(() => progreso(this.questions(), this.answers(), this.facts()));
  summary = computed<SummaryRow[]>(() =>
    summaryRows(this.questions(), this.answers(), this.facts()),
  );
  canSubmit = computed(() => puedeEnviar(this.summary()));

  constructor() {
    // Autoguardado. Dos capas, y las dos hacen falta:
    //  (1) espejo síncrono en localStorage en cada cambio — es lo que salva al paciente cuando
    //      el navegador del móvil mata la pestaña, que es donde responde la mayoría;
    //  (2) guardado parcial al servidor con debounce, para que el médico vea el avance.
    // Antes sólo existía un botón "Guardar" manual: cerrar la pestaña perdía todo.
    effect(() => {
      const a = this.answers();
      if (this.loading() || this.done() || !this.token) return;
      this.mirrorLocal(a);
      this.queueSave();
    });
  }

  private saveTimer: ReturnType<typeof setTimeout> | null = null;

  private mirrorLocal(a: Respuestas) {
    try {
      localStorage.setItem(draftKey(this.token), JSON.stringify(a));
    } catch {
      // Modo privado o almacenamiento lleno: el guardado al servidor sigue funcionando.
    }
  }

  private queueSave() {
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => void this.savePartial(), 900);
  }

  async ngOnInit() {
    this.token = this.route.snapshot.paramMap.get('token') ?? '';
    try {
      const form = await this.api.getForm(this.token);
      this.branding.set(form.branding);
      this.questions.set(form.questions);
      this.consentText.set(form.consent.text);
      this.consentAccepted.set(form.consentAccepted);
      this.procedureDate.set(form.procedureDate ?? '');
      this.schedule.set(form.schedule ?? null);
      this.done.set(form.submitted);

      // El servidor manda; el borrador local sólo aporta lo que aún no llegó a guardarse.
      const delServidor: Respuestas = form.answers ?? {};
      const local = this.readLocal();
      const combinado = { ...local, ...delServidor };
      const soloLocal = Object.keys(local).filter((k) => !(k in delServidor));
      this.answers.set(combinado);
      this.restored.set(soloLocal.length > 0);
    } catch {
      this.invalid.set(true);
    } finally {
      this.loading.set(false);
    }
  }

  private readLocal(): Respuestas {
    try {
      const raw = localStorage.getItem(draftKey(this.token));
      return raw ? (JSON.parse(raw) as Respuestas) : {};
    } catch {
      return {};
    }
  }

  /** Campos declarados de un REPETIDOR (llegan como JSON desde la BD). */
  camposDe(q: Q): CampoRep[] {
    return (q.campos ?? []) as CampoRep[];
  }

  meta(seccion: string) {
    return SECTION_META[seccion] ?? SECTION_META['otros']!;
  }

  // ── Navegación ────────────────────────────────────────────────────────────
  next() {
    this.restored.set(false);
    if (this.isLastScreen()) {
      this.showSummary.set(true);
      window.scrollTo({ top: 0 });
      return;
    }
    this.screenIndex.update((i) => i + 1);
    window.scrollTo({ top: 0 });
  }

  back() {
    this.screenIndex.update((i) => Math.max(0, i - 1));
    window.scrollTo({ top: 0 });
  }

  backFromSummary() {
    this.showSummary.set(false);
    this.screenIndex.set(Math.max(0, this.screens().length - 1));
  }

  /** Salta a la pantalla donde vive una pregunta (desde el resumen). */
  goToCode(code: string) {
    const idx = this.screens().findIndex((s) => s.questions.some((q) => q.code === code));
    if (idx < 0) return;
    this.showSummary.set(false);
    this.screenIndex.set(idx);
    setTimeout(() => document.getElementById('q-' + code)?.scrollIntoView({ block: 'center' }), 60);
  }

  // ── Lectura y escritura de respuestas ─────────────────────────────────────
  valueOf(code: string): string {
    const v = this.answers()[code]?.value;
    return Array.isArray(v) ? v.join(', ') : String(v ?? '');
  }

  /**
   * Escribe una respuesta y descarta las de las ramas que se hayan cerrado.
   *
   * Sin la limpieza, responder "Sí", escribir el detalle y volver a "No" dejaba el detalle
   * guardado y se enviaba igual — que es lo que disparaba contradicciones del auditor sobre
   * datos fantasma.
   */
  /**
   * Responde una instancia de pregunta repetible (`AP01#hipertension_arterial`).
   *
   * Comparte la limpieza de ramas de `setAnswer`, pero escribe bajo la clave de instancia: la
   * clave base no se usa nunca en una repetible.
   */
  setInstancia(q: Q, key: string, value: Valor) {
    this.answers.update((a) => {
      const next: Respuestas = { ...a, [key]: { value, type: q.type } };
      return pruneHiddenAnswers(
        this.questions().map((x) => ({ code: x.code, activacion: x.conditional ?? null })),
        next,
        buildFacts({ answers: next, schedule: this.schedule(), refDateISO: this.procedureDate() || null }),
      ) as Respuestas;
    });
  }

  setAnswer(q: Q, value: Valor) {
    this.answers.update((a) => {
      const next: Respuestas = { ...a, [q.code]: { value, type: q.type } };
      return pruneHiddenAnswers(
        this.questions().map((x) => ({ code: x.code, activacion: x.conditional ?? null })),
        next,
        buildFacts({
          answers: next,
          schedule: this.schedule(),
          refDateISO: this.procedureDate() || null,
        }),
      ) as Respuestas;
    });
  }

  // ── Selección única, con escape "Otra" ────────────────────────────────────
  private isOtherOption(o: string): boolean {
    return /^otra?$|^other$|^otro$/i.test(o.trim());
  }
  private otherMode = signal<Record<string, boolean>>({});
  isSelectedOption(code: string, o: string): boolean {
    if (this.otherMode()[code]) return this.isOtherOption(o);
    return this.valueOf(code) === o;
  }
  setChoice(q: Q, o: string) {
    if (this.isOtherOption(o)) {
      this.otherMode.update((m) => ({ ...m, [q.code]: true }));
      this.setAnswer(q, '');
    } else {
      this.otherMode.update((m) => ({ ...m, [q.code]: false }));
      this.setAnswer(q, o);
    }
  }
  isOtherChosen(code: string): boolean { return this.otherMode()[code] ?? false; }
  otherText(code: string): string { return this.valueOf(code); }
  setOther(q: Q, text: string) { this.setAnswer(q, text); }

  // ── Multiselección y acordeones ───────────────────────────────────────────
  normalOptions(q: Q): string[] {
    return (q.options ?? []).filter((o) => !ES_NINGUNA.test(o) && !/^no sabe$/i.test(o));
  }
  closingOptions(q: Q): string[] {
    return (q.options ?? []).filter((o) => ES_NINGUNA.test(o) || /^no sabe$/i.test(o));
  }
  isChecked(code: string, option: string): boolean {
    const v = this.answers()[code]?.value;
    return Array.isArray(v) && v.includes(option);
  }
  hasOtherChecked(code: string): boolean {
    const v = this.answers()[code]?.value;
    return Array.isArray(v) && v.some((o) => this.isOtherOption(o) || o.startsWith('Otra: '));
  }

  /** Alterna una opción. "Ninguna" es excluyente en ambos sentidos. */
  toggleMulti(q: Q, option: string) {
    const v = this.answers()[q.code]?.value;
    const cur = Array.isArray(v) ? [...v] : [];
    const i = cur.indexOf(option);
    let next: string[];
    if (i >= 0) next = cur.filter((_, k) => k !== i);
    else if (ES_NINGUNA.test(option)) next = [option];
    else next = [...cur.filter((o) => !ES_NINGUNA.test(o)), option];
    this.setAnswer(q, next);
  }

  /**
   * Texto libre de "Otra" en una multiselección.
   *
   * Se fusiona en `answers` de inmediato como `"Otra: <texto>"`. Antes vivía en una signal
   * aparte que sólo se unía al enviar: no contaba para el progreso y se perdía si se cerraba
   * la pestaña.
   */
  otherOf(code: string): string {
    const v = this.answers()[code]?.value;
    if (!Array.isArray(v)) return '';
    const found = v.find((o) => o.startsWith('Otra: '));
    return found ? found.slice(6) : '';
  }
  setMultiOther(q: Q, text: string) {
    const v = this.answers()[q.code]?.value;
    const cur = Array.isArray(v) ? [...v] : [];
    const sin = cur.filter((o) => !o.startsWith('Otra: ') && !this.isOtherOption(o));
    this.setAnswer(q, text.trim() ? [...sin, `Otra: ${text.trim()}`] : [...sin, 'Otra']);
  }

  // ── Repetidor (medicamentos y similares) ──────────────────────────────────
  repItems(code: string): Record<string, string>[] {
    const v = this.answers()[code]?.value;
    if (!Array.isArray(v)) return [];
    return v.map((s) => { try { return JSON.parse(s) as Record<string, string>; } catch { return { nombre: s }; } });
  }
  /** ¿La fila no tiene ningún campo con contenido? */
  private repVacia(fila: Record<string, string>): boolean {
    return !Object.values(fila).some((v) => String(v ?? '').trim() !== '');
  }

  /**
   * Guarda las filas, descartando las vacías salvo la última.
   *
   * La última se conserva porque es la que el paciente acaba de añadir y está escribiendo; el
   * resto son basura que sólo ensucia el documento y se acumula entre guardados parciales.
   */
  private repWrite(q: Q, items: Record<string, string>[]) {
    const limpias = items.filter((f, i) => !this.repVacia(f) || i === items.length - 1);
    this.setAnswer(q, limpias.map((i) => JSON.stringify(i)));
  }

  /** Añade una fila. Si la última sigue vacía, no apila otra encima. */
  repAdd(q: Q) {
    const items = this.repItems(q.code);
    const ultima = items[items.length - 1];
    if (ultima && this.repVacia(ultima)) return;
    this.repWrite(q, [...items, {}]);
  }
  repRemove(q: Q, index: number) {
    this.repWrite(q, this.repItems(q.code).filter((_, i) => i !== index));
  }
  /** Valor de un campo de una fila del repetidor. */
  repValue(code: string, index: number, key: string): string {
    return this.repItems(code)[index]?.[key] ?? '';
  }

  /** Valor de un evento de input/select, tipado para la plantilla. */
  asValue(ev: Event): string {
    return (ev.target as HTMLInputElement | HTMLSelectElement).value;
  }

  repSet(q: Q, index: number, key: string, value: string) {
    const items = this.repItems(q.code);
    const item = items[index];
    if (!item) return;
    items[index] = { ...item, [key]: value };
    this.repWrite(q, items);
  }

  // ── Documento, teléfono y fecha ───────────────────────────────────────────
  setDocument(q: Q, raw: string) { this.setAnswer(q, formatDocumentId(raw)); }

  private dials = signal<Record<string, string>>({});
  dialOf(code: string): string {
    const explicit = this.dials()[code];
    if (explicit) return explicit;
    const v = String(this.answers()[code]?.value ?? '');
    const m = v.match(/^\+(\d{1,4})\s/);
    return m?.[1] ?? '57';
  }
  phoneNumOf(code: string): string {
    const v = String(this.answers()[code]?.value ?? '');
    return v.replace(/^\+\d{1,4}\s/, '');
  }
  dialFlag(code: string): string {
    const d = this.dialOf(code);
    return COUNTRIES.find((c) => c.dial === d)?.flag ?? '🌐';
  }
  setDial(q: Q, dial: string) {
    this.dials.update((m) => ({ ...m, [q.code]: dial }));
    this.setAnswer(q, `+${dial} ${this.phoneNumOf(q.code)}`.trim());
  }
  setPhoneNum(q: Q, num: string) {
    this.setAnswer(q, `+${this.dialOf(q.code)} ${num.replace(/[^\d\s-]/g, '')}`.trim());
  }

  private dateErrors = signal<Record<string, boolean>>({});
  dateError(code: string): boolean { return this.dateErrors()[code] ?? false; }
  dateDisplay(code: string): string {
    const iso = String(this.answers()[code]?.value ?? '');
    const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    return m ? `${m[3]}/${m[2]}/${m[1]}` : iso;
  }
  setDate(q: Q, typed: string) {
    // Máscara dd/mm/aaaa con barras automáticas; se guarda en ISO.
    const digits = typed.replace(/\D/g, '').slice(0, 8);
    const parts = [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4, 8)].filter(Boolean);
    const shown = parts.join('/');
    if (digits.length < 8) {
      this.dateErrors.update((m) => ({ ...m, [q.code]: false }));
      this.setAnswer(q, shown);
      return;
    }
    const [dd, mm, yyyy] = [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4, 8)];
    const d = new Date(`${yyyy}-${mm}-${dd}`);
    const valida =
      !isNaN(d.getTime()) && d.getUTCDate() === Number(dd) && d.getUTCMonth() + 1 === Number(mm);
    this.dateErrors.update((m) => ({ ...m, [q.code]: !valida }));
    this.setAnswer(q, valida ? `${yyyy}-${mm}-${dd}` : shown);
  }

  // ── Servidor ──────────────────────────────────────────────────────────────
  async acceptConsent() {
    await this.api.acceptConsent(this.token);
    this.consentAccepted.set(true);
  }

  private async savePartial() {
    this.saveState.set('saving');
    try {
      await this.api.savePartial(this.token, this.answers());
      this.saveState.set('saved');
      setTimeout(() => this.saveState.set('idle'), 2500);
    } catch {
      this.saveState.set('idle');
    }
  }

  async submit() {
    this.submitting.set(true);
    this.errors.set([]);
    try {
      const res = await this.api.submit(this.token, this.answers());
      if (res.ok) {
        try { localStorage.removeItem(draftKey(this.token)); } catch { /* nada que limpiar */ }
        this.done.set(true);
      } else {
        this.errors.set(res.errors ?? ['No pudimos enviar tus respuestas.']);
      }
    } catch {
      this.errors.set(['No pudimos enviar tus respuestas. Revisa tu conexión.']);
    } finally {
      this.submitting.set(false);
    }
  }

  async onFiles(ev: Event) {
    const input = ev.target as HTMLInputElement;
    for (const file of Array.from(input.files ?? [])) {
      try {
        await this.api.upload(this.token, file, 'OTRO');
        this.uploaded.update((u) => [...u, file.name]);
      } catch {
        this.errors.update((e) => [...e, `No se pudo subir ${file.name}.`]);
      }
    }
    input.value = '';
  }
}
