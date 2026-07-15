import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ApiService } from '../core/api.service';

@Component({
  selector: 'app-review-approval',
  standalone: true,
  styles: [`
    .cols { display:grid; grid-template-columns:1.3fr 1fr; gap:1rem; }
    .card { background:#fff; padding:1rem; border-radius:10px; box-shadow:0 1px 6px rgba(0,0,0,.05); }
    h3 { color:var(--brand); margin:.2rem 0 .6rem; font-size:1rem; }
    .field { padding:.35rem 0; border-bottom:1px solid #eef2f3; font-size:.9rem; }
    .field .k { color:#5b6b73; font-size:.8rem; }
    .derivado { border-left:3px solid #f0a500; padding-left:.5rem; }
    .alerta { color:var(--error); font-weight:600; }
    .pending { color:#b58100; }
    .bar { position:sticky; bottom:0; background:#fff; padding:1rem; margin-top:1rem; border-top:2px solid #e3eaec; border-radius:10px; }
    .blockers { background:#fdecea; color:var(--error); padding:.7rem; border-radius:8px; font-size:.85rem; margin-bottom:.6rem; }
    button { padding:.6rem 1.1rem; border:0; border-radius:8px; cursor:pointer; margin-right:.5rem; }
    .approve { background:#1e7e34; color:#fff; } .approve:disabled { opacity:.5; cursor:not-allowed; }
    .reject { background:#fff; border:1px solid var(--error); color:var(--error); }
    .exam { background:var(--brand-dark); color:#fff; }
    .ok-badge { background:#e6f4ea; color:#1e7e34; padding:1rem; border-radius:8px; }
  `],
  template: `
    @if (loading()) { <p>Cargando…</p> }
    @else if (approved()) {
      <div class="ok-badge" data-testid="review-approved">✔ Caso APROBADO. El documento final está firmado e inmutable.</div>
      <div class="card" style="margin-top:1rem">
        <h3>Distribuir reporte</h3>
        @for (c of contacts(); track c.id) {
          <label style="display:block;padding:.2rem 0">
            <input type="checkbox" [value]="c.id" (change)="toggle(c.id, $event)" data-testid="distribute-contact-checkbox" /> {{ c.label }} — {{ c.email }}
          </label>
        }
        <button class="exam" (click)="doDistribute()" data-testid="distribute-send-button" style="margin-top:.5rem">Generar enlace / enviar</button>
        @for (d of deliveries(); track d.token) {
          <div style="margin-top:.5rem;font-size:.85rem"><input readonly [value]="d.url" style="width:70%" /> <button (click)="copy(d.url)">Copiar</button></div>
        }
      </div>
    }
    @else {
      <div class="cols">
        <div class="card">
          <h3>Borrador de valoración</h3>
          @for (sec of sections; track sec.key) {
            <h4>{{ sec.label }}</h4>
            @for (f of entries(sec.key); track f.k) {
              <div class="field" [class.derivado]="isDerived(f.v)">
                <span class="k">{{ f.k }}:</span>
                <span [class.alerta]="f.v?.alerta" [class.pending]="f.v?.estado==='pendiente_examen'">
                  {{ f.v?.estado==='pendiente_examen' ? 'PENDIENTE DE EXAMEN' : (f.v?.valor ?? '—') }}
                </span>
              </div>
            }
          }
        </div>
        <div class="card">
          <h3>Fuente</h3>
          <h4>Laboratorios</h4>
          @for (l of labs(); track l.analyte) {
            <div class="field"><span class="k">{{ l.analyte }}:</span>
              <span [class.alerta]="l.flag!=='NORMAL'">{{ l.value }} {{ l.unit }} ({{ l.flag }})</span>
              <span class="k"> · {{ l.sourceRef }}</span>
            </div>
          }
        </div>
      </div>

      <div class="bar">
        @if (!check()?.ok) {
          <div class="blockers" data-testid="review-blockers">
            @for (b of check()?.blockers ?? []; track b) { <div>⛔ {{ b }}</div> }
          </div>
          <button class="exam" (click)="loadNormal()" data-testid="exam-load-normal-button">Cargar examen normal</button>
        }
        <button class="approve" [disabled]="!check()?.ok" (click)="approve()" data-testid="review-approve-button">Aprobar y firmar</button>
        <button class="reject" (click)="reject()" data-testid="review-reject-button">Rechazar</button>
      </div>
    }
  `,
})
export class ReviewApprovalPage implements OnInit {
  private api = inject(ApiService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  sections = [
    { key: 'identificacion', label: 'Identificación' },
    { key: 'antecedentes', label: 'Antecedentes' },
    { key: 'paraclinicos', label: 'Paraclínicos' },
    { key: 'examen_fisico', label: 'Examen físico' },
    { key: 'valoracion_plan', label: 'Valoración y plan' },
  ];
  caseId = '';
  loading = signal(true);
  approved = signal(false);
  fields = signal<any>({});
  labs = signal<any[]>([]);
  check = signal<{ ok: boolean; blockers: string[] } | null>(null);
  contacts = signal<any[]>([]);
  deliveries = signal<any[]>([]);
  private selectedContacts = new Set<string>();

  async ngOnInit() {
    this.caseId = this.route.snapshot.paramMap.get('id') ?? '';
    await this.reload();
    this.loading.set(false);
  }

  async reload() {
    const r = await this.api.getReview(this.caseId);
    this.fields.set(r.fields ?? {});
    this.labs.set(r.labs ?? []);
    this.check.set(r.canApprove);
    const isApproved = r.approved || r.status === 'APROBADO' || r.status === 'ENTREGADO';
    this.approved.set(isApproved);
    if (isApproved) this.contacts.set((await this.api.listContacts()).contacts);
  }

  toggle(id: string, ev: Event) {
    const checked = (ev.target as HTMLInputElement).checked;
    if (checked) this.selectedContacts.add(id); else this.selectedContacts.delete(id);
  }
  async doDistribute() {
    if (this.selectedContacts.size === 0) return;
    const res = await this.api.distribute(this.caseId, [...this.selectedContacts], 'link');
    this.deliveries.set(res.deliveries ?? []);
  }
  async copy(url: string) { await navigator.clipboard.writeText(url); }

  entries(section: string): { k: string; v: any }[] {
    const sec = this.fields()[section] ?? {};
    return Object.entries(sec).map(([k, v]) => ({ k, v }));
  }
  isDerived(v: any) { return v?.fuente?.startsWith?.('derivado'); }

  async loadNormal() { await this.api.loadExamNormal(this.caseId); await this.reload(); }
  async approve() {
    const res = await this.api.approve(this.caseId);
    if (res.ok) this.approved.set(true);
    else this.check.set({ ok: false, blockers: res.blockers ?? [] });
  }
  async reject() {
    const reason = prompt('Motivo del rechazo:') ?? '';
    await this.api.reject(this.caseId, reason);
    this.router.navigate(['/dashboard']);
  }
}
