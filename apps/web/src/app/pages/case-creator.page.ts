import { Component, inject, signal, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../core/api.service';

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

        <div class="field">
          <label class="ki-label" for="proc">Procedimiento (opcional)</label>
          <input class="ki-input" id="proc" [(ngModel)]="procedure" data-testid="case-procedure-input" />
        </div>

        <button class="btn btn-primary create-action" (click)="create()" [disabled]="!presetId() || loading()" data-testid="case-create-button">
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
  procedure = signal('');
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
      const res = await this.api.createCase(this.presetId(), this.procedure() || undefined);
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
