import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { ApiService } from '../core/api.service';
import { COUNTRIES } from '../core/countries';

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

interface Q {
  order: number;
  label: string;
  type: string;
  required: boolean;
  options?: string[] | null;
  conditional?: { showIf?: { questionOrder: number; equals: string } } | null;
}

interface Section {
  title: string;
  icon: string;
  /** rango de `order` (inclusive) que agrupa esta sección. */
  from: number;
  to: number;
  /** órdenes sueltos adicionales fuera del rango (p. ej. correo P23 en Contacto). */
  extra?: number[];
}

/**
 * Secciones del formulario preanestésico (piloto "Preanestésica general").
 * Agrupan preguntas por `order`. Cubren los 26 órdenes del preset base.
 *
 * TODO (C-2 / bloqueado por el editor de cuestionarios, C-6): NO hay catch-all "Otros datos".
 * Una pregunta con `order` fuera de todo rango (p. ej. 27+ de un preset custom) se omite
 * silenciosamente del formulario. Al implementar presets editables, agregar una sección
 * catch-all que recoja los órdenes no cubiertos, o derivar los rangos del propio preset.
 */
const SECTIONS: Section[] = [
  { title: 'Información personal', icon: '👤', from: 1, to: 6 },
  { title: 'Contacto y aseguradora', icon: '📇', from: 7, to: 8, extra: [26] },
  { title: 'Cirugía programada', icon: '🏥', from: 9, to: 11 },
  { title: 'Antecedentes médicos', icon: '🩺', from: 12, to: 21 },
  { title: 'Hábitos', icon: '🚭', from: 22, to: 25 },
];

/** Normaliza para comparar condicionales ('sí'→'si'). */
function norm(v: unknown): string {
  return String(v ?? '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

/**
 * Formulario del paciente — scroll único con secciones (estilo brainnovation).
 * Todas las preguntas visibles en una página, agrupadas por encabezado; un solo
 * envío al final. Más cómodo en móvil y escritorio.
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
      font-size:15px; font-family:var(--font-body); color:var(--text); background:#fff;
      transition:border-color .15s, box-shadow .15s; outline:none;
    }
    .finp:focus { border-color:var(--primary); box-shadow:0 0 0 4px rgba(11,92,107,.1); }
    textarea.finp { resize:vertical; min-height:80px; }
    .finp::placeholder { color:var(--border2); }
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
    .opt {
      display:flex; align-items:center; gap:12px; padding:12px 15px;
      border:1.5px solid var(--border2); border-radius:var(--r-md); cursor:pointer;
      transition:all .13s; background:#fff; font-size:14.5px; color:var(--text); font-weight:500; user-select:none;
    }
    .opt:hover { border-color:var(--primary); background:var(--blue-light); }
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
    .drop input { display:none; }
    .drop-label { cursor:pointer; color:var(--primary); font-weight:600; font-size:15px; }
    .drop-hint { font-size:12px; color:var(--muted); margin-top:5px; }
    .uploaded-list { margin-top:12px; display:flex; flex-direction:column; gap:6px; }
    .up-item { display:flex; align-items:center; gap:8px; font-size:13px; color:var(--muted); background:var(--blue-light); padding:8px 12px; border-radius:8px; }

    /* ERRORS */
    .errors { background:rgba(220,64,64,.08); border:1px solid rgba(220,64,64,.25); color:var(--red); padding:13px 16px; border-radius:var(--r-md); font-size:13px; margin:22px 0; }
    .errors div { margin:2px 0; }

    /* SUBMIT BAR */
    .submit-bar { position:sticky; bottom:0; background:rgba(255,255,255,0.95); backdrop-filter:blur(10px); border-top:1px solid var(--border); padding:14px 20px; display:flex; gap:10px; justify-content:flex-end; align-items:center; z-index:50; flex-wrap:wrap; }
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
  `],
  template: `
    <div class="nav">
      <span class="nav-icon" [class.has-logo]="!!branding()?.logo">
        @if (branding()?.logo) { <img [src]="branding()!.logo" alt="" /> } @else { A }
      </span>
      <div>
        <div class="nav-title">Valoración preanestésica</div>
        <div class="nav-sub">{{ branding()?.doctor }}</div>
      </div>
    </div>

    @if (!loading() && !invalid() && !done() && consentAccepted()) {
      <div class="prog-wrap"><div class="prog-fill" [style.width.%]="progress()"></div></div>
    }

    @if (loading()) {
      <div class="center"><div class="spin"></div></div>
    } @else if (invalid()) {
      <div class="center"><div class="errors" style="max-width:420px">Este enlace no es válido o expiró. Pídele a tu anestesiólogo uno nuevo.</div></div>
    } @else if (done()) {
      <div class="ty" data-testid="form-done">
        <div class="chk-circle">✓</div>
        <h1>¡Gracias!</h1>
        <p>Tus respuestas fueron enviadas. Tu anestesiólogo las revisará y preparará tu valoración preanestésica.</p>
      </div>
    } @else if (!consentAccepted()) {
      <!-- CONSENTIMIENTO -->
      <div class="consent">
        <div class="badge">Autorización de datos</div>
        <h2>Antes de empezar</h2>
        <div class="consent-body">{{ consentText() }}</div>
        <label class="consent-check">
          <input type="checkbox" [(ngModel)]="consentChecked" data-testid="consent-accept-checkbox" />
          <span>He leído y acepto el tratamiento de mis datos personales y de salud (Ley 1581 de 2012).</span>
        </label>
        <button class="btn-cta" [disabled]="!consentChecked()" (click)="acceptConsent()" data-testid="consent-continue-button">
          Continuar →
        </button>
      </div>
    } @else {
      <!-- FORMULARIO SCROLL CON SECCIONES -->
      <div class="hero">
        <div class="badge">{{ answeredCount() }} de {{ requiredCount() }} obligatorias respondidas</div>
        <h1>Cuéntanos sobre ti</h1>
        <p>Responde estas preguntas para tu valoración. Toma unos 5 minutos.</p>
      </div>

      <div class="form-body">
        @for (sec of populatedSections(); track sec.title) {
          <div class="section">
            <div class="section-head">
              <span class="section-ic">{{ sec.icon }}</span>
              <span class="section-title">{{ sec.title }}</span>
            </div>
            <div class="section-line"></div>

            @for (q of sec.questions; track q.order) {
              <div class="q" [class.q-conditional]="!!q.conditional" [id]="'q-' + q.order">
                <div class="q-label">{{ q.label }} @if (q.required) { <span class="req">*</span> }</div>

                @switch (q.type) {
                  @case ('SI_NO') {
                    <div class="opts inline">
                      @for (o of [['si','Sí'],['no','No']]; track o[0]) {
                        <div class="opt" [class.sel]="valueOf(q.order)===o[0]" (click)="setAnswer(q, o[0])" [attr.data-testid]="'q-' + q.order + '-' + o[0]">
                          <span class="chk"></span>{{ o[1] }}
                        </div>
                      }
                    </div>
                  }
                  @case ('SELECCION_UNICA') {
                    <div class="opts">
                      @for (o of q.options ?? []; track o) {
                        <div class="opt" [class.sel]="isSelectedOption(q.order, o)" (click)="setChoice(q, o)" [attr.data-testid]="'q-' + q.order">
                          <span class="chk"></span>{{ o }}
                        </div>
                      }
                    </div>
                    @if (isOtherChosen(q.order)) {
                      <input class="finp" style="margin-top:8px" [ngModel]="otherText(q.order)" (ngModelChange)="setOther(q, $event)" [attr.data-testid]="'q-' + q.order + '-other'" placeholder="Especifique…" />
                    }
                  }
                  @case ('SELECCION_MULTIPLE') {
                    <div class="opts">
                      @for (o of q.options ?? []; track o) {
                        <div class="opt" [class.sel]="isChecked(q.order, o)" (click)="toggleMulti(q, o)" [attr.data-testid]="'q-' + q.order">
                          <span class="chk box"></span>{{ o }}
                        </div>
                      }
                    </div>
                    @if (isChecked(q.order, 'Otra')) {
                      <input class="finp" style="margin-top:8px" [ngModel]="multiOtherText(q.order)" (ngModelChange)="setMultiOther(q, $event)" [attr.data-testid]="'q-' + q.order + '-other'" placeholder="¿Cuál otra patología?" />
                    }
                  }
                  @case ('TEXTO_LARGO') {
                    <textarea class="finp" rows="3" [ngModel]="valueOf(q.order)" (ngModelChange)="setAnswer(q, $event)" [attr.data-testid]="'q-' + q.order" placeholder="Escribe aquí…"></textarea>
                  }
                  @case ('NUMERO') {
                    <input class="finp" type="number" [ngModel]="valueOf(q.order)" (ngModelChange)="setAnswer(q, $event)" [attr.data-testid]="'q-' + q.order" placeholder="0" />
                  }
                  @case ('FECHA') {
                    <input class="finp" type="text" inputmode="numeric" maxlength="10"
                      [ngModel]="dateDisplay(q.order)" (ngModelChange)="setDate(q, $event)"
                      [attr.data-testid]="'q-' + q.order" placeholder="dd/mm/aaaa" />
                    @if (dateError(q.order)) { <div class="date-err">Fecha inválida. Usa dd/mm/aaaa.</div> }
                  }
                  @default {
                    @if (isPhone(q)) {
                      <div class="phone-wrap">
                        <span class="phone-cc-box">
                          <span class="phone-cc-display">{{ dialFlag(q.order) }} +{{ dialOf(q.order) }}</span>
                          <span class="phone-cc-caret">▾</span>
                          <select class="phone-cc-select" [ngModel]="dialOf(q.order)" (ngModelChange)="setDial(q, $event)" [attr.data-testid]="'q-' + q.order + '-cc'">
                            @for (c of countries; track c.iso) {
                              <option [value]="c.dial">{{ c.flag }} +{{ c.dial }} · {{ c.name }}</option>
                            }
                          </select>
                        </span>
                        <input class="finp phone-num" type="tel" inputmode="tel" autocomplete="tel"
                          [ngModel]="phoneNumOf(q.order)" (ngModelChange)="setPhoneNum(q, $event)"
                          [attr.data-testid]="'q-' + q.order" placeholder="Número" />
                      </div>
                    } @else if (isDocument(q)) {
                      <input class="finp" type="text" [ngModel]="valueOf(q.order)" (ngModelChange)="setDocument(q, $event)" [attr.data-testid]="'q-' + q.order" placeholder="Cédula" />
                    } @else {
                      <input class="finp" [type]="inputType(q)" [attr.inputmode]="inputType(q)==='email' ? 'email' : null" [ngModel]="valueOf(q.order)" (ngModelChange)="setAnswer(q, $event)" [attr.data-testid]="'q-' + q.order" [placeholder]="inputType(q)==='email' ? 'nombre@correo.com' : 'Escribe aquí…'" />
                    }
                  }
                }
              </div>
            }
          </div>
        }

        <!-- ADJUNTOS -->
        <div class="section">
          <div class="section-head">
            <span class="section-ic">📎</span>
            <span class="section-title">Exámenes (opcional)</span>
          </div>
          <div class="section-line"></div>
          <div class="q-label" style="font-weight:500;color:var(--muted)">Si cuenta con exámenes recientes (laboratorios, electrocardiograma, ecocardiograma u otros estudios), adjúntelos para complementar su valoración preanestésica.</div>
          <div class="drop">
            <input type="file" id="fileup" multiple (change)="onFiles($event)" data-testid="form-attachment-input" />
            <label for="fileup" class="drop-label">Seleccionar archivos</label>
            <div class="drop-hint">PDF o imágenes</div>
          </div>
          @if (uploaded().length) {
            <div class="uploaded-list">
              @for (f of uploaded(); track f) { <div class="up-item">✓ {{ f }}</div> }
            </div>
          }
        </div>

        @if (errors().length) {
          <div class="errors" data-testid="form-errors">
            @for (e of errors(); track e) { <div>• {{ e }}</div> }
          </div>
        }
      </div>

      <div class="submit-bar">
        <span class="submit-hint">
          @if (missingRequired()) { Faltan {{ missingRequired() }} preguntas obligatorias } @else { Todo listo para enviar }
        </span>
        <button class="btn-ghost" (click)="savePartial()" data-testid="form-save-partial-button">Guardar</button>
        <button class="btn-send" (click)="submit()" [disabled]="submitting()" data-testid="form-submit-button">
          {{ submitting() ? 'Enviando…' : 'Enviar respuestas' }}
        </button>
      </div>
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
  branding = signal<{ logo?: string; doctor?: string } | null>(null);
  questions = signal<Q[]>([]);
  consentText = signal('');
  consentAccepted = signal(false);
  consentChecked = signal(false);
  answers = signal<Record<number, { value: unknown; type: string }>>({});
  errors = signal<string[]>([]);
  uploaded = signal<string[]>([]);

  /** Preguntas visibles según condicionales. */
  visibleQuestions = computed(() =>
    this.questions().filter((q) => {
      const s = q.conditional?.showIf;
      if (!s) return true;
      return norm(this.answers()[s.questionOrder]?.value) === norm(s.equals);
    }),
  );

  /** Secciones con sus preguntas visibles (omite secciones vacías). */
  populatedSections = computed(() => {
    const vis = this.visibleQuestions();
    return SECTIONS.map((sec) => ({
      ...sec,
      questions: vis.filter(
        (q) => (q.order >= sec.from && q.order <= sec.to) || (sec.extra?.includes(q.order) ?? false),
      ),
    })).filter((s) => s.questions.length > 0);
  });

  requiredCount = computed(() => this.visibleQuestions().filter((q) => q.required).length);
  answeredCount = computed(() =>
    this.visibleQuestions().filter((q) => q.required && this.hasValue(q.order)).length,
  );
  missingRequired = computed(() => this.requiredCount() - this.answeredCount());
  progress = computed(() => {
    const total = this.requiredCount();
    return total ? Math.round((this.answeredCount() / total) * 100) : 0;
  });

  async ngOnInit() {
    this.token = this.route.snapshot.paramMap.get('token') ?? '';
    try {
      const form = await this.api.getForm(this.token);
      this.branding.set(form.branding);
      this.questions.set(form.questions);
      this.consentText.set(form.consent.text);
      this.consentAccepted.set(form.consentAccepted);
      this.done.set(form.submitted);
      this.answers.set(form.answers ?? {});
    } catch {
      this.invalid.set(true);
    } finally {
      this.loading.set(false);
    }
  }

  /** Tipo de input HTML: 'email' si la etiqueta pide correo, si no 'text'. */
  inputType(q: Q): string {
    return /correo|e-?mail/i.test(q.label) ? 'email' : 'text';
  }

  /** ¿Es el campo de documento de identificación? */
  isDocument(q: Q): boolean {
    return /documento|identificaci[oó]n|c[eé]dula/i.test(q.label);
  }
  /** Formatea el documento al escribir (cédula con puntos; pasaporte tal cual). */
  setDocument(q: Q, value: string) {
    this.setAnswer(q, formatDocumentId(value));
  }

  // ── Teléfono con código de país ──
  countries = COUNTRIES;
  /** Código de marcación por pregunta (default Colombia +57). */
  private dials = signal<Record<number, string>>({});
  private dateErrors = signal<Record<number, boolean>>({});

  isPhone(q: Q): boolean {
    return /tel[eé]fono|celular|m[oó]vil|whatsapp|contacto/i.test(q.label);
  }
  /** Código actual (parsea el valor guardado "+57 300…"; default 57). */
  dialOf(order: number): string {
    const explicit = this.dials()[order];
    if (explicit) return explicit;
    const v = String(this.answers()[order]?.value ?? '');
    const m = v.match(/^\+(\d{1,4})\s/);
    return m?.[1] ?? '57';
  }
  phoneNumOf(order: number): string {
    const v = String(this.answers()[order]?.value ?? '');
    return v.replace(/^\+\d{1,4}\s?/, '').trim();
  }
  /** Bandera del país actualmente seleccionado (para la vista compacta). */
  dialFlag(order: number): string {
    const dial = this.dialOf(order);
    return this.countries.find((c) => c.dial === dial)?.flag ?? '🌐';
  }
  private commitPhone(q: Q, dial: string, num: string) {
    const clean = num.replace(/[^\d\s-]/g, '').trim();
    const value = clean ? `+${dial} ${clean}` : '';
    this.setAnswer(q, value);
  }
  setDial(q: Q, dial: string) {
    this.dials.update((d) => ({ ...d, [q.order]: dial }));
    this.commitPhone(q, dial, this.phoneNumOf(q.order));
  }
  setPhoneNum(q: Q, num: string) {
    this.commitPhone(q, this.dialOf(q.order), num);
  }

  // ── Fecha dd/mm/aaaa (guarda ISO yyyy-mm-dd) ──
  /** Muestra el valor ISO guardado como dd/mm/aaaa. */
  dateDisplay(order: number): string {
    const iso = String(this.answers()[order]?.value ?? '');
    const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
    return m ? `${m[3]}/${m[2]}/${m[1]}` : iso;
  }
  dateError(order: number): boolean {
    return this.dateErrors()[order] ?? false;
  }
  /** Recibe dd/mm/aaaa, auto-inserta '/', valida y guarda ISO. */
  setDate(q: Q, raw: string) {
    // Auto-formato: sólo dígitos → dd/mm/aaaa.
    const digits = raw.replace(/\D/g, '').slice(0, 8);
    let display = digits;
    if (digits.length > 4) display = `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
    else if (digits.length > 2) display = `${digits.slice(0, 2)}/${digits.slice(2)}`;

    const m = display.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (!m) {
      // Incompleto: guarda el texto crudo para no perder tecleo; marca no-error aún.
      this.setAnswer(q, display);
      this.dateErrors.update((e) => ({ ...e, [q.order]: false }));
      return;
    }
    const [, dd, mm, yyyy] = m;
    const d = Number(dd), mo = Number(mm), y = Number(yyyy);
    const dt = new Date(y, mo - 1, d);
    const valid = mo >= 1 && mo <= 12 && d >= 1 && d <= 31 &&
      dt.getFullYear() === y && dt.getMonth() === mo - 1 && dt.getDate() === d;
    if (valid) {
      this.setAnswer(q, `${yyyy}-${mm}-${dd}`); // ISO para el backend
      this.dateErrors.update((e) => ({ ...e, [q.order]: false }));
    } else {
      this.setAnswer(q, display);
      this.dateErrors.update((e) => ({ ...e, [q.order]: true }));
    }
  }

  valueOf(order: number) {
    return this.answers()[order]?.value ?? '';
  }

  // ── SELECCION_UNICA con opción "Otra" (texto libre) ──
  /** Modo "Otra" activo por pregunta (el valor guardado es el texto escrito). */
  private otherMode = signal<Record<number, boolean>>({});
  private isOtherOption(o: string): boolean {
    return /^otra?$|^other$|^otro$/i.test(o.trim());
  }
  /** Marca visualmente la opción seleccionada (incluye "Otra" en modo texto). */
  isSelectedOption(order: number, o: string): boolean {
    if (this.otherMode()[order]) return this.isOtherOption(o);
    return this.valueOf(order) === o;
  }
  setChoice(q: Q, o: string) {
    if (this.isOtherOption(o)) {
      this.otherMode.update((m) => ({ ...m, [q.order]: true }));
      this.setAnswer(q, ''); // se llenará con el texto escrito
    } else {
      this.otherMode.update((m) => ({ ...m, [q.order]: false }));
      this.setAnswer(q, o);
    }
  }
  isOtherChosen(order: number): boolean {
    return this.otherMode()[order] ?? false;
  }
  otherText(order: number): string {
    return String(this.valueOf(order) ?? '');
  }
  setOther(q: Q, text: string) {
    this.setAnswer(q, text);
  }
  hasValue(order: number): boolean {
    const v = this.answers()[order]?.value;
    if (Array.isArray(v)) return v.length > 0;
    return String(v ?? '').trim() !== '';
  }
  setAnswer(q: Q, value: unknown) {
    this.answers.update((a) => ({ ...a, [q.order]: { value, type: q.type } }));
  }

  /** Multiselección: alterna una opción dentro del array. */
  isChecked(order: number, option: string): boolean {
    const v = this.answers()[order]?.value;
    return Array.isArray(v) && v.includes(option);
  }
  toggleMulti(q: Q, option: string) {
    this.answers.update((a) => {
      const cur = Array.isArray(a[q.order]?.value) ? [...(a[q.order].value as string[])] : [];
      const idx = cur.indexOf(option);
      if (idx >= 0) cur.splice(idx, 1); else cur.push(option);
      return { ...a, [q.order]: { value: cur, type: q.type } };
    });
  }

  /** Texto libre de la opción "Otra" en multiselección (se fusiona al enviar). */
  private multiOthers = signal<Record<number, string>>({});
  multiOtherText(order: number): string { return this.multiOthers()[order] ?? ''; }
  setMultiOther(q: Q, text: string) {
    this.multiOthers.update((m) => ({ ...m, [q.order]: text }));
  }

  async acceptConsent() {
    await this.api.acceptConsent(this.token);
    this.consentAccepted.set(true);
  }

  private answersForApi() {
    const out: Record<string, { value: unknown; type: string }> = {};
    for (const [k, v] of Object.entries(this.answers())) {
      // Fusiona el texto de "Otra" en multiselección: 'Otra' → 'Otra: <detalle>'.
      const other = this.multiOthers()[Number(k)];
      if (other && Array.isArray(v.value)) {
        const arr = (v.value as string[]).map((o) => (o === 'Otra' ? `Otra: ${other}` : o));
        out[k] = { value: arr, type: v.type };
      } else {
        out[k] = v;
      }
    }
    return out;
  }

  async savePartial() {
    await this.api.savePartial(this.token, this.answersForApi());
    this.errors.set([]);
  }

  async submit() {
    this.submitting.set(true);
    this.errors.set([]);
    try {
      const res = await this.api.submit(this.token, this.answersForApi());
      if (res.ok) this.done.set(true);
      else {
        this.errors.set(res.errors ?? ['No se pudo enviar.']);
        window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
      }
    } catch (err: unknown) {
      // HttpClient lanza en 4xx: recupera los errores de validación del cuerpo (422).
      const body = (err as { error?: { errors?: string[] } })?.error;
      if (body?.errors?.length) {
        this.errors.set(body.errors);
      } else {
        this.errors.set(['No se pudo enviar. Revisa tu conexión.']);
      }
      window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
    } finally {
      this.submitting.set(false);
    }
  }

  async onFiles(ev: Event) {
    const input = ev.target as HTMLInputElement;
    if (!input.files) return;
    for (const file of Array.from(input.files)) {
      try {
        await this.api.upload(this.token, file, 'OTRO');
        this.uploaded.update((u) => [...u, file.name]);
      } catch {
        this.errors.update((e) => [...e, `No se pudo subir ${file.name}.`]);
      }
    }
  }
}
