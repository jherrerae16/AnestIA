import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ApiService } from '../core/api.service';

const STATUS_LABEL: Record<string, string> = {
  BORRADOR: 'Borrador', ENVIADO_AL_PACIENTE: 'Enviado', RESPONDIENDO: 'Respondiendo',
  RESPUESTAS_RECIBIDAS: 'Respuestas recibidas', LABS_ANALIZADOS: 'Labs analizados',
  BORRADOR_GENERADO: 'Borrador generado', PENDIENTE_REVISION: 'Pendiente revisión',
  APROBADO: 'Aprobado', ENTREGADO: 'Entregado',
};

/** Clase de badge por estado — reutiliza el design system. */
function badgeClass(status: string): string {
  switch (status) {
    case 'PENDIENTE_REVISION': return 'badge-amber';
    case 'APROBADO': return 'badge-green';
    case 'ENTREGADO': return 'badge-blue';
    case 'BORRADOR': case 'ENVIADO_AL_PACIENTE': case 'RESPONDIENDO': return 'badge-muted';
    default: return 'badge-blue';
  }
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [RouterLink],
  styles: [`
    .head { display:flex; align-items:flex-end; justify-content:space-between; margin-bottom:6px; gap:16px; flex-wrap:wrap; }
    .head h2 { font-size:22px; }
    .head p { font-size:13px; color:var(--muted); margin-top:2px; }
    .export-msg { font-size:12px; color:var(--muted); margin:0 0 8px; }

    .kpi-row { grid-template-columns: repeat(3, 1fr); }

    table { width:100%; border-collapse:collapse; }
    .table-card { padding:0; overflow:hidden; }
    thead th {
      text-align:left; padding:12px 18px; font-size:10px; font-weight:600;
      text-transform:uppercase; letter-spacing:0.07em; color:var(--muted);
      background:var(--bg3); border-bottom:1px solid var(--border);
    }
    tbody td { padding:13px 18px; border-bottom:1px solid var(--border); font-size:13px; vertical-align:middle; }
    tbody tr:last-child td { border-bottom:none; }
    tbody tr { transition: background .12s; }
    tbody tr:hover { background:var(--it-50); }
    .pt-name { font-weight:600; color:var(--text); }
    .pt-doc { color:var(--muted); font-size:11px; font-family:var(--font-mono); margin-left:6px; }
    .alerts { color:var(--red); font-weight:600; font-size:12px; }
    .rev-link { font-weight:600; }
    .muted { color:var(--muted2); }
  `],
  template: `
    <div data-testid="dashboard-root">
      <div class="head">
        <div>
          <h2>Casos</h2>
          <p>Valoraciones preanestésicas de tus pacientes</p>
        </div>
        <button class="btn btn-primary btn-sm" (click)="exportSheets()" data-testid="export-sheets-button">
          Exportar a Sheets
        </button>
      </div>
      @if (exportMsg()) { <p class="export-msg">{{ exportMsg() }}</p> }

      <div class="kpi-row" style="margin-top:16px">
        <div class="kpi-card k-blue">
          <div class="kpi-label">Total</div>
          <div class="kpi-value">{{ data()?.indicadores?.total ?? 0 }}</div>
          <div class="kpi-sub">casos en el sistema</div>
        </div>
        <div class="kpi-card k-amber">
          <div class="kpi-label">Pendiente revisión</div>
          <div class="kpi-value">{{ data()?.indicadores?.pendienteRevision ?? 0 }}</div>
          <div class="kpi-sub">requieren tu aprobación</div>
        </div>
        <div class="kpi-card k-red">
          <div class="kpi-label">Con alertas</div>
          <div class="kpi-value">{{ data()?.indicadores?.conAlertas ?? 0 }}</div>
          <div class="kpi-sub">hallazgos que revisar</div>
        </div>
      </div>

      <div class="card table-card">
        <table>
          <thead>
            <tr><th>Paciente</th><th>Procedimiento</th><th>Estado</th><th>Alertas</th><th></th></tr>
          </thead>
          <tbody>
            @for (c of data()?.cases ?? []; track c.id) {
              <tr data-testid="dashboard-case-row">
                <td>
                  <span class="pt-name">{{ c.patient?.fullName ?? '—' }}</span>
                  @if (c.patient?.documentId) { <span class="pt-doc">{{ c.patient.documentId }}</span> }
                </td>
                <td>{{ c.procedure ?? '—' }}</td>
                <td><span class="card-badge" [class]="'card-badge ' + badge(c.status)">{{ label(c.status) }}</span></td>
                <td>@if (c.alertas) { <span class="alerts">{{ c.alertas }}</span> } @else { <span class="muted">—</span> }</td>
                <td>
                  @if (c.status==='PENDIENTE_REVISION' || c.status==='APROBADO' || c.status==='ENTREGADO') {
                    <a class="rev-link" [routerLink]="['/cases', c.id, 'review']">Revisar →</a>
                  }
                </td>
              </tr>
            }
            @if (!(data()?.cases ?? []).length) {
              <tr><td colspan="5"><div class="empty">Aún no hay casos. Crea uno desde “Nuevo caso”.</div></td></tr>
            }
          </tbody>
        </table>
      </div>
    </div>
  `,
})
export class DashboardPage implements OnInit {
  private api = inject(ApiService);
  data = signal<any>(null);
  exportMsg = signal('');
  async ngOnInit() { this.data.set(await this.api.dashboard()); }
  label(s: string) { return STATUS_LABEL[s] ?? s; }
  badge(s: string) { return badgeClass(s); }
  async exportSheets() {
    this.exportMsg.set('Exportando…');
    const res = await this.api.exportSheets();
    this.exportMsg.set(res.ok ? `✔ Exportados ${res.count} casos a Sheets.` : `⚠ ${res.error}`);
  }
}
