import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../core/api.service';

@Component({
  selector: 'app-patient-history',
  standalone: true,
  imports: [FormsModule],
  styles: [`
    .wrap { max-width: 760px; }
    .page-heading { font-family: var(--font-display); font-size: 22px; font-weight: 600; letter-spacing: -0.5px; color: var(--text); margin-bottom: 4px; }
    .page-sub { font-size: 13px; color: var(--muted); margin-bottom: 20px; }
    .search-box { margin-bottom: 20px; }
    .search-box .ki-input { max-width: 340px; }
    .results-table { width: 100%; border-collapse: collapse; }
    .results-table thead th { background: var(--bg3); font-size: 10px; font-weight: 600; text-transform: uppercase;
      letter-spacing: 0.07em; color: var(--muted); text-align: left; padding: 9px 14px; border-bottom: 1px solid var(--border); }
    .results-table tbody td { padding: 11px 14px; border-bottom: 1px solid var(--border); font-size: 13px; color: var(--text); }
    .results-table tbody tr { cursor: pointer; transition: background 140ms ease; }
    .results-table tbody tr:hover { background: var(--it-50); }
    .results-table tbody tr:last-child td { border-bottom: none; }
    .patient-name { font-weight: 600; }
    .doc { font-family: var(--font-mono); font-size: 12px; color: var(--muted2); }
    .detail-title { font-family: var(--font-display); font-size: 15px; font-weight: 600; color: var(--text); margin-bottom: 12px; }
    .case-row { display: flex; align-items: center; gap: 10px; padding: 10px 0; border-bottom: 1px solid var(--border); }
    .case-row:last-child { border-bottom: none; }
    .case-proc { font-size: 13px; color: var(--text); flex: 1; }
    .case-status { font-size: 12px; color: var(--muted); }
  `],
  template: `
    <div class="wrap">
      <div class="page-heading">Historial de pacientes</div>
      <div class="page-sub">Busca por documento o nombre para ver las valoraciones asociadas.</div>

      <div class="card">
        <div class="search-box">
          <input
            class="ki-input"
            placeholder="Buscar por documento o nombre"
            [(ngModel)]="q"
            (ngModelChange)="search()"
            data-testid="patient-search-input" />
        </div>

        @if (results().length) {
          <table class="results-table">
            <thead>
              <tr>
                <th>Paciente</th>
                <th>Documento</th>
              </tr>
            </thead>
            <tbody>
              @for (p of results(); track p.id) {
                <tr (click)="open(p.id)">
                  <td class="patient-name">{{ p.fullName }}</td>
                  <td class="doc">{{ p.documentId }}</td>
                </tr>
              }
            </tbody>
          </table>
        }

        @if (selected()) {
          <div class="section-label">Valoraciones</div>
          <div class="detail-title">{{ selected().fullName }}</div>
          @for (c of selected().cases ?? []; track c.id) {
            <div class="case-row">
              <span class="case-proc">{{ c.procedure ?? 'Sin procedimiento' }}</span>
              <span class="case-status">{{ c.status }}</span>
              @if (c.approval) {
                <span class="card-badge badge-green">Aprobado</span>
              }
            </div>
          }
        }
      </div>
    </div>
  `,
})
export class PatientHistoryPage {
  private api = inject(ApiService);
  q = '';
  results = signal<any[]>([]);
  selected = signal<any>(null);
  async search() {
    if (this.q.length < 2) { this.results.set([]); return; }
    this.results.set((await this.api.searchPatients(this.q)).patients);
  }
  async open(id: string) { this.selected.set((await this.api.getPatient(id)).patient); }
}
