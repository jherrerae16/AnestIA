import { Component, inject, signal, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../core/api.service';

@Component({
  selector: 'app-case-creator',
  standalone: true,
  imports: [FormsModule],
  styles: [`
    .card { background:#fff; padding:1.5rem; border-radius:12px; max-width:560px; box-shadow:0 2px 12px rgba(0,0,0,.06); }
    label { display:block; font-size:.85rem; margin:.5rem 0 .25rem; }
    select, input { width:100%; padding:.55rem; border:1px solid #cdd7da; border-radius:8px; }
    button { margin-top:1rem; padding:.6rem 1rem; background:var(--brand); color:#fff; border:0; border-radius:8px; cursor:pointer; }
    .link-box { margin-top:1.2rem; padding:1rem; background:#eef5f6; border-radius:8px; }
    .link-row { display:flex; gap:.5rem; margin-top:.5rem; }
    .link-row input { font-family:monospace; font-size:.8rem; }
    .copy { background:var(--brand-dark); }
    .hint { font-size:.8rem; color:#5b6b73; }
  `],
  template: `
    <div class="card">
      <h2>Nuevo caso</h2>
      <label for="preset">Cuestionario</label>
      <select id="preset" [(ngModel)]="presetId" data-testid="case-preset-select">
        @for (p of presets(); track p.id) {
          <option [value]="p.id">{{ p.name }} (v{{ p.version }})</option>
        }
      </select>
      <label for="proc">Procedimiento (opcional)</label>
      <input id="proc" [(ngModel)]="procedure" data-testid="case-procedure-input" />
      <button (click)="create()" [disabled]="!presetId() || loading()" data-testid="case-create-button">
        {{ loading() ? 'Creando…' : 'Crear y generar enlace' }}
      </button>

      @if (link()) {
        <div class="link-box">
          <strong>Enlace para el paciente</strong>
          <p class="hint">Cópialo y envíalo por tu WhatsApp. Expira: {{ expires() }}.</p>
          <div class="link-row">
            <input #linkInput [value]="link()" readonly data-testid="case-link-input" />
            <button class="copy" (click)="copy(linkInput)" data-testid="case-link-copy-button">Copiar</button>
          </div>
          @if (copied()) { <span class="hint">✔ Copiado</span> }
        </div>
      }
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
