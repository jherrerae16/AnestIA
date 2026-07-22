import { Component, inject, signal, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ApiService } from '../core/api.service';
import { statusLabel, badgeClass } from '../core/case-status';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [RouterLink],
  styles: [`
    .pending-links { font-size:12px; color:var(--muted); padding:10px 14px; border-top:1px solid var(--border); }
    .head { display:flex; align-items:flex-end; justify-content:space-between; margin-bottom:6px; gap:16px; flex-wrap:wrap; }
    .head h2 { font-size:26px; letter-spacing:-0.6px; }
    .head p { font-size:13px; color:var(--muted); margin-top:3px; }
    .export-msg { font-size:12px; color:var(--muted); margin:0 0 8px; }

    .kpi-row { grid-template-columns: repeat(3, 1fr); }
    /* En móvil 3 columnas dejan ~110px por tarjeta y "PENDIENTE REVISIÓN" se cortaba.
       Se pasa a 1 columna apilada por debajo de 560px. */
    @media (max-width:560px) {
      .kpi-row { grid-template-columns: 1fr; }
    }

    table { width:100%; border-collapse:collapse; }
    .table-card { padding:0; overflow:hidden; }
    /* Escritorio muestra tabla, oculta las tarjetas; móvil al revés. Una tabla ancha no se
       navega bien en el celular — el médico ve mejor una tarjeta por caso. */
    .case-cards { display:none; }
    @media (max-width:640px) {
      .table-card table { display:none; }
      .case-cards { display:flex; flex-direction:column; }
      .case-card { padding:14px 16px; border-bottom:1px solid var(--border); display:flex; flex-direction:column; gap:8px; }
      .case-card:last-child { border-bottom:none; }
      .cc-top { display:flex; justify-content:space-between; align-items:flex-start; gap:10px; }
      .cc-pt { display:flex; flex-direction:column; min-width:0; flex:1; }
      .cc-top .card-badge { flex-shrink:0; white-space:nowrap; }
      .cc-proc { font-size:14px; color:var(--text); }
      .cc-bottom { display:flex; justify-content:space-between; align-items:center; gap:10px; font-size:13px; }
      .case-cards .empty { padding:24px 16px; }
    }
    thead th {
      text-align:left; padding:12px 18px; font-size:10px; font-weight:600;
      text-transform:uppercase; letter-spacing:0.07em; color:var(--muted);
      background:var(--bg3); border-bottom:1px solid var(--border);
    }
    tbody td { padding:14px 18px; border-bottom:1px solid var(--border); font-size:13px; vertical-align:middle; }
    tbody tr:last-child td { border-bottom:none; }
    tbody tr { transition: background .12s; }
    tbody tr:hover { background:var(--row-hover); }
    .pt-name { font-weight:600; color:var(--text); }
    .pt-doc { color:var(--muted); font-size:11px; font-family:var(--font-mono); margin-left:6px; }
    .alerts { color:var(--red-text); font-weight:600; font-size:12px; }
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

      <!-- Escritorio: tabla. Móvil: lista de tarjetas (misma data, ver .case-cards). -->
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

        <!-- Móvil: una tarjeta por caso, más cómoda que scrollear una tabla en el celular. -->
        <div class="case-cards">
          @for (c of data()?.cases ?? []; track c.id) {
            <div class="case-card" data-testid="dashboard-case-card">
              <div class="cc-top">
                <div class="cc-pt">
                  <span class="pt-name">{{ c.patient?.fullName ?? '—' }}</span>
                  @if (c.patient?.documentId) { <span class="pt-doc">{{ c.patient.documentId }}</span> }
                </div>
                <span class="card-badge" [class]="'card-badge ' + badge(c.status)">{{ label(c.status) }}</span>
              </div>
              <div class="cc-proc">{{ c.procedure ?? 'Sin procedimiento' }}</div>
              <div class="cc-bottom">
                @if (c.alertas) { <span class="alerts">{{ c.alertas }} alerta{{ c.alertas === 1 ? '' : 's' }}</span> }
                @else { <span class="muted">Sin alertas</span> }
                @if (c.status==='PENDIENTE_REVISION' || c.status==='APROBADO' || c.status==='ENTREGADO') {
                  <a class="rev-link" [routerLink]="['/cases', c.id, 'review']">Revisar →</a>
                }
              </div>
            </div>
          }
          @if (!(data()?.cases ?? []).length) {
            <div class="empty">Aún no hay casos. Crea uno desde “Nuevo caso”.</div>
          }
        </div>
        <!-- Los enlaces que el paciente aún no respondió no son casos: se cuentan aparte
             en vez de llenar la tabla de filas en blanco. -->
        @if (data()?.indicadores?.enlacesPendientes) {
          <p class="pending-links" data-testid="pending-links">
            {{ data().indicadores.enlacesPendientes }}
            {{ data().indicadores.enlacesPendientes === 1 ? 'enlace enviado sigue' : 'enlaces enviados siguen' }}
            sin responder. Aparecerán aquí cuando el paciente complete el formulario.
          </p>
        }
      </div>
    </div>
  `,
})
export class DashboardPage implements OnInit {
  private api = inject(ApiService);
  data = signal<any>(null);
  exportMsg = signal('');
  async ngOnInit() { this.data.set(await this.api.dashboard()); }
  label(s: string) { return statusLabel(s); }
  badge(s: string) { return badgeClass(s); }
  async exportSheets() {
    this.exportMsg.set('Exportando…');
    const res = await this.api.exportSheets();
    this.exportMsg.set(res.ok ? `✔ Exportados ${res.count} casos a Sheets.` : `⚠ ${res.error}`);
  }
}
