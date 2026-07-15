import { Component, inject, signal, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ApiService } from '../core/api.service';

const STATUS_LABEL: Record<string, string> = {
  BORRADOR: 'Borrador', ENVIADO_AL_PACIENTE: 'Enviado', RESPONDIENDO: 'Respondiendo',
  RESPUESTAS_RECIBIDAS: 'Respuestas recibidas', LABS_ANALIZADOS: 'Labs analizados',
  BORRADOR_GENERADO: 'Borrador generado', PENDIENTE_REVISION: 'Pendiente revisión',
  APROBADO: 'Aprobado', ENTREGADO: 'Entregado',
};

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [RouterLink],
  styles: [`
    .kpis { display:flex; gap:1rem; margin-bottom:1rem; }
    .kpi { background:#fff; padding:.8rem 1.2rem; border-radius:10px; box-shadow:0 1px 6px rgba(0,0,0,.05); }
    .kpi b { display:block; font-size:1.5rem; color:var(--brand); }
    table { width:100%; border-collapse:collapse; background:#fff; border-radius:10px; overflow:hidden; }
    th, td { text-align:left; padding:.6rem .8rem; border-bottom:1px solid #eef2f3; font-size:.9rem; }
    th { background:#f2f6f7; color:#33474f; }
    .badge { padding:.15rem .5rem; border-radius:20px; font-size:.75rem; background:#e3eaec; }
    .rev { background:#fff3cd; } .apr { background:#d4edda; } .ent { background:#cfe2ff; }
    .alert { color:var(--error); font-weight:600; }
    a { color:var(--brand); }
  `],
  template: `
    <div data-testid="dashboard-root">
      <h2>Casos</h2>
      <div class="kpis">
        <div class="kpi"><b>{{ data()?.indicadores?.total ?? 0 }}</b>Total</div>
        <div class="kpi"><b>{{ data()?.indicadores?.pendienteRevision ?? 0 }}</b>Pendiente revisión</div>
        <div class="kpi"><b>{{ data()?.indicadores?.conAlertas ?? 0 }}</b>Con alertas</div>
      </div>
      <table>
        <thead><tr><th>Paciente</th><th>Procedimiento</th><th>Estado</th><th>Alertas</th><th></th></tr></thead>
        <tbody>
          @for (c of data()?.cases ?? []; track c.id) {
            <tr data-testid="dashboard-case-row">
              <td>{{ c.patient?.fullName ?? '—' }} <small>{{ c.patient?.documentId }}</small></td>
              <td>{{ c.procedure ?? '—' }}</td>
              <td><span class="badge" [class.rev]="c.status==='PENDIENTE_REVISION'" [class.apr]="c.status==='APROBADO'" [class.ent]="c.status==='ENTREGADO'">{{ label(c.status) }}</span></td>
              <td>@if (c.alertas) { <span class="alert">{{ c.alertas }}</span> } @else { — }</td>
              <td>@if (c.status==='PENDIENTE_REVISION' || c.status==='APROBADO' || c.status==='ENTREGADO') { <a [routerLink]="['/cases', c.id, 'review']">Revisar</a> }</td>
            </tr>
          }
        </tbody>
      </table>
    </div>
  `,
})
export class DashboardPage implements OnInit {
  private api = inject(ApiService);
  data = signal<any>(null);
  async ngOnInit() { this.data.set(await this.api.dashboard()); }
  label(s: string) { return STATUS_LABEL[s] ?? s; }
}
