import { Component, inject, signal, OnInit } from '@angular/core';
import { ApiService } from '../core/api.service';

@Component({
  selector: 'app-preset-list',
  standalone: true,
  styles: [`
    .card { background:#fff; padding:1.5rem; border-radius:12px; max-width:640px; box-shadow:0 2px 12px rgba(0,0,0,.06); }
    .preset { padding:.75rem; border:1px solid #e3eaec; border-radius:8px; margin-bottom:.5rem; }
    .count { color:#5b6b73; font-size:.85rem; }
  `],
  template: `
    <div class="card" data-testid="preset-list">
      <h2>Mis cuestionarios</h2>
      @for (p of presets(); track p.id) {
        <div class="preset">
          <strong>{{ p.name }}</strong> <span class="count">v{{ p.version }} · {{ p.questions.length }} preguntas @if (p.isDefault) { · por defecto }</span>
        </div>
      }
      <p class="count">El constructor visual de preguntas llega en una iteración posterior; el preset base ya está sembrado.</p>
    </div>
  `,
})
export class PresetListPage implements OnInit {
  private api = inject(ApiService);
  presets = signal<any[]>([]);
  async ngOnInit() {
    const res = await this.api.listPresets();
    this.presets.set(res.presets);
  }
}
