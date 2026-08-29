import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../core/api.service';
import {
  ANESTESIAS,
  DURACIONES,
  ESPECIALIDADES,
  ETIQUETAS_AGENDA,
  MODALIDADES,
  PRIORIDADES,
  SITIOS_ARISCAT,
  faltantesDeAgenda,
  type ScheduleDef,
} from '@anestia/shared';

@Component({
  selector: 'app-case-creator',
  standalone: true,
  imports: [FormsModule],
  styles: [`
    .creator-wrap { max-width: 560px; margin: 0 auto; padding: 1.5rem; position: relative; z-index: 1; }
    .creator-card { padding: 24px 26px; }
    .creator-title { font-family: var(--font-display); font-size: 22px; font-weight: 600; letter-spacing: -0.5px; color: var(--text); margin: 0 0 4px; }
    .creator-sub { font-size: 13px; color: var(--muted); margin: 0 0 20px; }
    .field { margin-bottom: 16px; }
    .create-action { margin-top: 8px; }
    .link-box { margin-top: 24px; padding: 16px 18px; background: var(--it-50); border: 1px solid var(--it-100); border-radius: 10px; }
    .link-box-title { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.07em; color: var(--muted); }
    .hint { font-size: 12px; color: var(--muted); margin: 4px 0 0; }
    .link-row { display: flex; gap: 8px; margin-top: 12px; }
    .link-row .ki-input { font-family: var(--font-mono); font-size: 12px; }
    .copied { display: inline-block; margin-top: 10px; font-size: 12px; color: var(--green); font-weight: 500; }
    .creator-wrap { max-width: 640px; }
    .grupo { margin: 22px 0 6px; font-size: 11px; font-weight: 700; text-transform: uppercase;
      letter-spacing: .07em; color: var(--muted); }
    .fila { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
    @media (max-width: 560px) { .fila { grid-template-columns: 1fr; } }
    .por-que { font-size: 11px; color: var(--muted); margin-top: 4px; }
    /* Aviso de escalas que quedarán pendientes por falta de datos de agenda. */
    .pendientes { margin-top: 18px; padding: 13px 15px; border-radius: 10px;
      background: #fffaeb; border: 1px solid #fedf89; font-size: 12.5px; color: #93370d; }
    .pendientes strong { display: block; margin-bottom: 3px; }
  `],
  template: `
    <div class="creator-wrap">
      <div class="card creator-card">
        <h2 class="creator-title">Nuevo caso</h2>
        <p class="creator-sub">Genera un enlace tokenizado para enviar al paciente.</p>

        <div class="field">
          <label class="ki-label" for="preset">Cuestionario</label>
          <select class="ki-select" id="preset" [(ngModel)]="presetId" data-testid="case-preset-select">
            @for (p of presets(); track p.id) {
              <option [value]="p.id">{{ p.name }} (v{{ p.version }})</option>
            }
          </select>
        </div>

        <div class="grupo">Programación quirúrgica</div>

        <div class="field">
          <label class="ki-label" for="proc">Cirugía o procedimiento *</label>
          <input class="ki-input" id="proc" [(ngModel)]="procedimiento"
                 data-testid="case-procedure-input" placeholder="Colecistectomía laparoscópica" />
        </div>

        <div class="fila">
          <div class="field">
            <label class="ki-label" for="dx">Diagnóstico preoperatorio</label>
            <input class="ki-input" id="dx" [(ngModel)]="diagnosticoPreop"
                   data-testid="case-dx-input" placeholder="Colelitiasis" />
            <div class="por-que">No se le exige al paciente conocerlo.</div>
          </div>
          <div class="field">
            <label class="ki-label" for="fecha">Fecha del procedimiento</label>
            <input class="ki-input" id="fecha" type="date" [(ngModel)]="fechaHora"
                   data-testid="case-date-input" />
            <div class="por-que">De aquí sale la edad y la ruta clínica del paciente.</div>
          </div>
        </div>

        <div class="fila">
          <div class="field">
            <label class="ki-label" for="esp">Especialidad</label>
            <select class="ki-select" id="esp" [(ngModel)]="especialidad" data-testid="case-especialidad">
              <option value="">—</option>
              @for (o of especialidades; track o) {
                <option [value]="o">{{ etiquetas.especialidad[o] }}</option>
              }
            </select>
          </div>
          <div class="field">
            <label class="ki-label" for="mod">Modalidad</label>
            <select class="ki-select" id="mod" [(ngModel)]="modalidad" data-testid="case-modalidad">
              <option value="">—</option>
              @for (o of modalidades; track o) {
                <option [value]="o">{{ etiquetas.modalidad[o] }}</option>
              }
            </select>
            <div class="por-que">Alimenta Caprini.</div>
          </div>
        </div>

        <div class="fila">
          <div class="field">
            <label class="ki-label" for="pri">Prioridad</label>
            <select class="ki-select" id="pri" [(ngModel)]="prioridad" data-testid="case-prioridad">
              <option value="">—</option>
              @for (o of prioridades; track o) {
                <option [value]="o">{{ etiquetas.prioridad[o] }}</option>
              }
            </select>
            <div class="por-que">Alimenta ARISCAT.</div>
          </div>
          <div class="field">
            <label class="ki-label" for="sitio">Sitio quirúrgico</label>
            <select class="ki-select" id="sitio" [(ngModel)]="sitioQuirurgico" data-testid="case-sitio">
              <option value="">—</option>
              @for (o of sitios; track o) {
                <option [value]="o">{{ etiquetas.sitioQuirurgico[o] }}</option>
              }
            </select>
            <div class="por-que">Alimenta ARISCAT.</div>
          </div>
        </div>

        <div class="fila">
          <div class="field">
            <label class="ki-label" for="dur">Duración estimada</label>
            <select class="ki-select" id="dur" [(ngModel)]="duracionEstimada" data-testid="case-duracion">
              <option value="">—</option>
              @for (o of duraciones; track o) {
                <option [value]="o">{{ etiquetas.duracionEstimada[o] }}</option>
              }
            </select>
            <div class="por-que">Alimenta ARISCAT y POVOC.</div>
          </div>
          <div class="field">
            <label class="ki-label" for="anes">Anestesia probable</label>
            <select class="ki-select" id="anes" [(ngModel)]="anestesiaProbable" data-testid="case-anestesia">
              <option value="">—</option>
              @for (o of anestesias; track o) {
                <option [value]="o">{{ etiquetas.anestesiaProbable[o] }}</option>
              }
            </select>
            <div class="por-que">Alimenta Apfel.</div>
          </div>
        </div>

        <div class="fila">
          <div class="field">
            <label class="ki-label" for="rcri">Cirugía cardiovascular de alto riesgo</label>
            <select class="ki-select" id="rcri" [(ngModel)]="altoRiesgoRcri" data-testid="case-rcri">
              <option value="">Pendiente de clasificación</option>
              <option value="si">Sí</option>
              <option value="no">No</option>
            </select>
            <div class="por-que">Alimenta RCRI.</div>
          </div>
          <div class="field">
            <label class="ki-label" for="opio">¿Se esperan opioides posoperatorios?</label>
            <select class="ki-select" id="opio" [(ngModel)]="opioidesPostop" data-testid="case-opioides">
              <option value="">Por definir</option>
              <option value="si">Sí</option>
              <option value="no">No</option>
            </select>
            <div class="por-que">Alimenta Apfel. No lo estima el paciente.</div>
          </div>
        </div>

        @if (pendientes().length) {
          <div class="pendientes" data-testid="case-pendientes">
            <strong>Faltan datos de programación</strong>
            Puedes crear el caso igual: las escalas que dependan de esto quedarán
            <em>pendientes</em> en vez de calcularse con supuestos. Falta:
            {{ pendientes().join(', ') }}.
          </div>
        }

        <button class="btn btn-primary create-action" (click)="create()" [disabled]="!presetId() || procedimiento().trim().length < 2 || loading()" data-testid="case-create-button">
          {{ loading() ? 'Creando…' : 'Crear y generar enlace' }}
        </button>

        @if (link()) {
          <div class="link-box">
            <div class="link-box-title">Enlace para el paciente</div>
            <p class="hint">Cópialo y envíalo por tu WhatsApp. Expira: {{ expires() }}.</p>
            <div class="link-row">
              <input class="ki-input" #linkInput [value]="link()" readonly data-testid="case-link-input" />
              <button class="btn btn-sm" (click)="copy(linkInput)" data-testid="case-link-copy-button">Copiar</button>
            </div>
            @if (copied()) { <span class="copied">✔ Copiado</span> }
          </div>
        }
      </div>
    </div>
  `,
})
export class CaseCreatorPage implements OnInit {
  private api = inject(ApiService);

  readonly especialidades = ESPECIALIDADES;
  readonly modalidades = MODALIDADES;
  readonly prioridades = PRIORIDADES;
  readonly sitios = SITIOS_ARISCAT;
  readonly duraciones = DURACIONES;
  readonly anestesias = ANESTESIAS;
  readonly etiquetas = ETIQUETAS_AGENDA;

  presets = signal<any[]>([]);
  presetId = signal('');

  // Agenda quirúrgica (PX01–PX11). El paciente no ve nada de esto.
  procedimiento = signal('');
  diagnosticoPreop = signal('');
  fechaHora = signal('');
  especialidad = signal('');
  modalidad = signal('');
  prioridad = signal('');
  sitioQuirurgico = signal('');
  duracionEstimada = signal('');
  anestesiaProbable = signal('');
  altoRiesgoRcri = signal('');
  opioidesPostop = signal('');

  /** Qué escalas quedarán pendientes por falta de programación. */
  pendientes = computed(() => faltantesDeAgenda(this.schedule()));

  /** La agenda tal como la espera el contrato compartido. */
  private schedule = computed<ScheduleDef>(() => ({
    procedimiento: this.procedimiento().trim(),
    diagnosticoPreop: this.diagnosticoPreop().trim() || null,
    fechaHora: this.fechaHora() || null,
    especialidad: (this.especialidad() || null) as ScheduleDef['especialidad'],
    modalidad: (this.modalidad() || null) as ScheduleDef['modalidad'],
    prioridad: (this.prioridad() || null) as ScheduleDef['prioridad'],
    sitioQuirurgico: (this.sitioQuirurgico() || null) as ScheduleDef['sitioQuirurgico'],
    duracionEstimada: (this.duracionEstimada() || null) as ScheduleDef['duracionEstimada'],
    anestesiaProbable: (this.anestesiaProbable() || null) as ScheduleDef['anestesiaProbable'],
    // '' significa "sin definir", que NO es "no". Un null deja la escala pendiente.
    altoRiesgoRcri: this.altoRiesgoRcri() === '' ? null : this.altoRiesgoRcri() === 'si',
    opioidesPostop: this.opioidesPostop() === '' ? null : this.opioidesPostop() === 'si',
  }));

  loading = signal(false);
  link = signal<string | null>(null);
  expires = signal('');
  copied = signal(false);

  async ngOnInit() {
    const res = await this.api.listPresets();
    this.presets.set(res.presets);
    const def = res.presets.find((p) => p.isDefault) ?? res.presets[0];
    if (def) this.presetId.set(def.id);
  }

  async create() {
    this.loading.set(true);
    this.copied.set(false);
    try {
      const res = await this.api.createCase(this.presetId(), this.schedule());
      this.link.set(`${location.origin}/form/${res.linkToken}`);
      this.expires.set(new Date(res.linkExpiresAt).toLocaleDateString('es-CO'));
    } finally {
      this.loading.set(false);
    }
  }

  async copy(input: HTMLInputElement) {
    await navigator.clipboard.writeText(input.value);
    this.copied.set(true);
  }
}
