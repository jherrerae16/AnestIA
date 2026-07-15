import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../core/api.service';

@Component({
  selector: 'app-patient-history',
  standalone: true,
  imports: [FormsModule],
  styles: [`
    .card { background:#fff; padding:1.2rem; border-radius:10px; max-width:720px; box-shadow:0 1px 6px rgba(0,0,0,.05); }
    input { padding:.55rem; border:1px solid #cdd7da; border-radius:8px; width:280px; }
    .p { padding:.5rem 0; border-bottom:1px solid #eef2f3; cursor:pointer; }
    .case { font-size:.85rem; color:#5b6b73; padding:.2rem 0 .2rem 1rem; }
  `],
  template: `
    <div class="card">
      <h2>Historial de pacientes</h2>
      <input placeholder="Buscar por documento o nombre" [(ngModel)]="q" (ngModelChange)="search()" data-testid="patient-search-input" />
      @for (p of results(); track p.id) {
        <div class="p" (click)="open(p.id)"><strong>{{ p.fullName }}</strong> — {{ p.documentId }}</div>
      }
      @if (selected()) {
        <h3>{{ selected().fullName }} — valoraciones</h3>
        @for (c of selected().cases ?? []; track c.id) {
          <div class="case">{{ c.procedure ?? 'Sin procedimiento' }} · {{ c.status }} @if (c.approval) { · aprobado }</div>
        }
      }
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
