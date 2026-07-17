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
    /* 5 columnas no caben en móvil: scroll dentro del contenedor, no en el body. */
    .table-scroll { overflow-x: auto; -webkit-overflow-scrolling: touch; }
    .table-scroll .results-table { min-width: 560px; }
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
    .pt-grid { display:grid; grid-template-columns:repeat(auto-fit, minmax(190px, 1fr)); gap:1px; background:var(--border, #e6edee); border:1px solid var(--border, #e6edee); border-radius:6px; margin-bottom:18px; }
    .pt-cell { background:var(--surface, #fff); padding:8px 11px; min-width:0; }
    .pt-k { display:block; font-size:10px; text-transform:uppercase; letter-spacing:.4px; color:var(--muted); font-weight:600; margin-bottom:2px; }
    .pt-v { display:block; font-size:13px; overflow-wrap:anywhere; }
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
          <div class="table-scroll">
          <table class="results-table">
            <thead>
              <tr>
                <th>Paciente</th>
                <th>Documento</th>
                <th>Edad / Sexo</th>
                <th>Teléfono</th>
                <th>Aseguradora</th>
              </tr>
            </thead>
            <tbody>
              @for (p of results(); track p.id) {
                <tr (click)="open(p.id)">
                  <td class="patient-name">{{ p.fullName }}</td>
                  <td class="doc">{{ p.documentId }}</td>
                  <td>{{ edadSexo(p) }}</td>
                  <td class="doc">{{ p.phone || '—' }}</td>
                  <td>{{ p.insurer || '—' }}</td>
                </tr>
              }
            </tbody>
          </table>
          </div>
        }

        @if (selected(); as p) {
          <div class="section-label">Ficha del paciente</div>
          <div class="detail-title">{{ p.fullName }}</div>
          <div class="pt-grid" data-testid="patient-detail">
            <div class="pt-cell"><span class="pt-k">Documento</span><span class="pt-v">{{ p.documentId || '—' }}</span></div>
            <div class="pt-cell"><span class="pt-k">Edad / Sexo</span><span class="pt-v">{{ edadSexo(p) }}</span></div>
            <div class="pt-cell"><span class="pt-k">Grupo sanguíneo</span><span class="pt-v">{{ p.bloodType || '—' }}</span></div>
            <div class="pt-cell">
              <span class="pt-k">Teléfono</span>
              <span class="pt-v">@if (p.phone) { <a [href]="'tel:' + p.phone">{{ p.phone }}</a> } @else { — }</span>
            </div>
            <div class="pt-cell">
              <span class="pt-k">Correo</span>
              <span class="pt-v">@if (p.email) { <a [href]="'mailto:' + p.email">{{ p.email }}</a> } @else { — }</span>
            </div>
            <div class="pt-cell"><span class="pt-k">Aseguradora</span><span class="pt-v">{{ p.insurer || '—' }}</span></div>
          </div>

          <div class="section-label">Valoraciones</div>
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

  /** "54 años / Masculino". Omite lo que el paciente no reportó — nunca lo rellena (CS2). */
  edadSexo(p: { birthDate?: string | null; sex?: string | null }): string {
    const partes: string[] = [];
    const edad = this.edadDe(p.birthDate);
    if (edad != null) partes.push(`${edad} años`);
    if (p.sex) partes.push(this.sexoLabel(p.sex));
    return partes.length ? partes.join(' / ') : '—';
  }

  private edadDe(birthDate?: string | null): number | null {
    if (!birthDate) return null;
    const d = new Date(birthDate);
    if (isNaN(d.getTime())) return null;
    const hoy = new Date();
    let edad = hoy.getFullYear() - d.getFullYear();
    const m = hoy.getMonth() - d.getMonth();
    if (m < 0 || (m === 0 && hoy.getDate() < d.getDate())) edad--;
    return edad >= 0 && edad < 130 ? edad : null;
  }

  private sexoLabel(sex: string): string {
    const s = sex.toUpperCase();
    return s === 'MASCULINO' ? 'Masculino' : s === 'FEMENINO' ? 'Femenino' : sex;
  }
}
