import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../core/api.service';
import type { ScheduleDef } from '@anestia/shared';
import { ScheduleFormComponent } from '../core/schedule-form.component';

@Component({
  selector: 'app-case-creator',
  standalone: true,
  imports: [FormsModule, ScheduleFormComponent],
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

        <app-schedule-form [(value)]="schedule" prefijo="case" />

        <button class="btn btn-primary create-action" (click)="create()" [disabled]="!presetId() || schedule().procedimiento.trim().length < 2 || loading()" data-testid="case-create-button">
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

  presets = signal<any[]>([]);
  presetId = signal('');

  /** Agenda quirúrgica (PX01–PX11). El paciente no ve nada de esto. */
  schedule = signal<ScheduleDef>({
    procedimiento: '', diagnosticoPreop: null, fechaHora: null, especialidad: null,
    modalidad: null, prioridad: null, sitioQuirurgico: null, duracionEstimada: null,
    altoRiesgoRcri: null, anestesiaProbable: null, opioidesPostop: null,
  });

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
