import { Component, inject, signal, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ApiService } from '../core/api.service';

@Component({
  selector: 'app-preset-list',
  standalone: true,
  imports: [RouterLink],
  styles: [`
    .wrap { max-width: 720px; }
    .page-heading { font-family: var(--font-display); font-size: 22px; font-weight: 600; letter-spacing: -0.5px; color: var(--text); margin-bottom: 4px; }
    .page-sub { font-size: 13px; color: var(--muted); margin-bottom: 24px; }
    .preset-list { display: flex; flex-direction: column; gap: 12px; }
    .preset-row { display: flex; align-items: center; gap: 14px; padding: 16px 18px; background: var(--bg2);
      border: 1px solid var(--border); border-radius: 12px; box-shadow: var(--shadow-sm);
      transition: border-color 180ms ease, box-shadow 180ms ease; }
    .preset-row:hover { border-color: var(--border2); box-shadow: 0 4px 16px rgba(6,42,49,0.08); }
    .preset-main { flex: 1; min-width: 0; }
    .preset-name { font-family: var(--font-display); font-size: 15px; font-weight: 600; color: var(--text); }
    .preset-meta { display: flex; align-items: center; gap: 10px; margin-top: 5px; }
    .preset-version { font-family: var(--font-mono); font-size: 11px; color: var(--muted2); }
    .preset-count { font-size: 12px; color: var(--muted); }
    .note { font-size: 12px; color: var(--muted); margin-top: 20px; line-height: 1.6; }
    .preset-edit { font-size: 12.5px; color: var(--brand); white-space: nowrap; }
  `],
  template: `
    <div class="wrap" data-testid="preset-list">
      <div class="page-heading">Mis cuestionarios</div>
      <div class="page-sub">Presets de valoración preanestésica disponibles.</div>

      <div class="preset-list">
        @for (p of presets(); track p.id) {
          <div class="preset-row">
            <div class="preset-main">
              <div class="preset-name">{{ p.name }}</div>
              <div class="preset-meta">
                <span class="preset-version">v{{ p.version }}</span>
                <span class="preset-count">{{ p.questions.length }} preguntas</span>
              </div>
            </div>
            @if (p.isDefault) {
              <span class="card-badge badge-green">Por defecto</span>
            }
            <a class="preset-edit" [routerLink]="['/presets', p.id, 'preguntas']"
               [attr.data-testid]="'editar-' + p.id">Mis preguntas →</a>
          </div>
        } @empty {
          <div class="empty">Aún no hay cuestionarios.</div>
        }
      </div>

      <p class="note">
        Las preguntas de la Especificación del Dr. Luquetta no se editan: de ellas dependen la
        trazabilidad de cada dato del documento y las variables de las ocho escalas de riesgo.
        En <b>Mis preguntas</b> puedes añadir las tuyas, que se muestran a todos los pacientes y
        no alimentan ninguna escala.
      </p>
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
