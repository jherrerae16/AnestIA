import { Component, inject, signal, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { ApiService } from '../core/api.service';

const SECTION_LABELS: Record<string, string> = {
  paciente: 'Paciente', documento: 'Documento', edad: 'Edad', sexo: 'Sexo',
  edad_sexo: 'Edad / Sexo', peso_talla_imc: 'Peso / Talla / IMC', imc: 'IMC', procedimiento: 'Procedimiento',
  diagnostico_preoperatorio: 'Diagnóstico preoperatorio', asa: 'ASA', tipo_cirugia: 'Tipo de cirugía',
  fecha_valoracion: 'Fecha de valoración', fecha_procedimiento: 'Fecha del procedimiento',
  capacidad_funcional: 'Capacidad funcional', condicion_actual: 'Condición actual',
  patologicos: 'Patológicos', medicamentos: 'Medicamentos', glp1: 'Uso de GLP-1',
  alergias: 'Alergias', grupo_sanguineo: 'Grupo sanguíneo', transfusionales: 'Transfusionales',
  protesis_dental: 'Prótesis dental', signos_vitales: 'Signos vitales', via_aerea: 'Vía aérea',
  cuello: 'Cuello', cardiovascular_respiratorio: 'Cardiovascular / respiratorio', abdomen: 'Abdomen',
  extremidades: 'Extremidades', snc: 'Sistema nervioso central',
  concepto: 'Concepto anestésico', plan: 'Plan anestésico', recomendaciones: 'Recomendaciones',
};

@Component({
  selector: 'app-review-approval',
  standalone: true,
  imports: [FormsModule],
  styles: [`
    .page-head { display:flex; align-items:flex-end; justify-content:space-between; margin-bottom:18px; gap:16px; flex-wrap:wrap; }
    .page-head h2 { font-size:22px; }
    .page-head p { font-size:13px; color:var(--muted); margin-top:2px; }

    .cols { display:grid; grid-template-columns: 1.25fr 1fr; gap:16px; align-items:start; }
    .sec-block { margin-bottom:18px; }
    .sec-block:last-child { margin-bottom:0; }
    .field { display:flex; gap:10px; padding:7px 0; border-bottom:1px solid var(--border); font-size:13px; }
    .field:last-child { border-bottom:none; }
    .field .k { color:var(--muted); flex:0 0 42%; font-weight:500; }
    .field .v { color:var(--text); flex:1; }
    .edit-hint { font-size:11.5px; color:var(--muted2); margin:0 0 12px; }
    .v.editable { cursor:pointer; border-radius:5px; padding:1px 4px; margin:-1px -4px; transition:background .12s; position:relative; }
    .v.editable:hover { background:var(--it-50); }
    .edit-pencil { opacity:0; font-size:11px; color:var(--primary); margin-left:6px; transition:opacity .12s; }
    .v.editable:hover .edit-pencil { opacity:1; }
    .v-edit { flex:1; display:flex; flex-direction:column; gap:7px; }
    .edit-input { width:100%; padding:8px 10px; border:1.5px solid var(--primary); border-radius:8px; font-family:var(--font-body); font-size:13px; color:var(--text); resize:vertical; outline:none; box-shadow:0 0 0 3px rgba(11,92,107,.12); }
    .edit-actions { display:flex; gap:8px; }
    .field.derivado { border-left:3px solid var(--gold); padding-left:9px; margin-left:-9px; }
    .v.alerta { color:var(--red); font-weight:700; }
    .v.pending { color:var(--amber); font-weight:600; }
    .lab-flag { font-family:var(--font-mono); font-size:11px; }

    /* PREVIEW */
    .preview-card { padding:0; overflow:hidden; }
    .preview-head { display:flex; align-items:center; justify-content:space-between; padding:12px 16px; border-bottom:1px solid var(--border); }
    .preview-frame { width:100%; height:760px; border:none; display:block; background:var(--bg3); }
    .preview-empty { padding:40px; text-align:center; color:var(--muted); font-size:13px; }

    /* BAR */
    .bar { position:sticky; bottom:0; background:rgba(255,255,255,0.95); backdrop-filter:blur(10px); border:1px solid var(--border); border-radius:14px; padding:16px 18px; margin-top:18px; box-shadow:0 -2px 12px rgba(6,42,49,.05); }
    .blockers { background:rgba(224,138,30,.1); border:1px solid rgba(224,138,30,.28); color:#9a5a0e; padding:11px 14px; border-radius:10px; font-size:13px; margin-bottom:12px; }
    .blockers div { margin:2px 0; }
    .bar-actions { display:flex; gap:10px; align-items:center; flex-wrap:wrap; }
    .spacer { flex:1; }

    .ok-badge { background:rgba(46,158,99,.1); border:1px solid rgba(46,158,99,.28); color:#1c7a4a; padding:16px 20px; border-radius:12px; font-weight:600; }

    .dist-row { display:flex; align-items:center; gap:10px; margin-top:8px; font-size:13px; }
    .dist-row input[readonly] { flex:1; padding:8px 11px; border:1px solid var(--border2); border-radius:8px; font-family:var(--font-mono); font-size:12px; }
    label.contact { display:flex; align-items:center; gap:8px; padding:6px 0; font-size:13px; }
  `],
  template: `
    @if (loading()) { <div class="empty">Cargando…</div> }

    @else if (approved()) {
      <div class="page-head"><div><h2>Caso aprobado</h2><p>El documento final está firmado e inmutable.</p></div></div>
      <div class="ok-badge" data-testid="review-approved">✔ Caso APROBADO. Documento final firmado.</div>

      <div class="grid-3" style="margin-top:16px">
        <div class="card preview-card">
          <div class="preview-head">
            <span class="card-title">Documento final</span>
            <a class="btn btn-sm" [href]="rawPreview()" target="_blank" rel="noopener">Abrir en pestaña</a>
          </div>
          @if (previewSrc()) { <iframe class="preview-frame" [src]="previewSrc()" title="Documento"></iframe> }
          @else { <div class="preview-empty">Cargando documento…</div> }
        </div>
        <div class="card">
          <div class="card-title" style="margin-bottom:12px">Distribuir reporte</div>

          @if (patient()?.email) {
            <label class="contact" style="border-bottom:1px solid var(--border);padding-bottom:10px;margin-bottom:6px">
              <input type="checkbox" [checked]="sendToPatient()" (change)="setSendToPatient($event)" data-testid="distribute-patient-checkbox" />
              <span>👤 Paciente — {{ patient()!.email }}</span>
            </label>
          } @else {
            <p class="muted" style="font-size:12px;margin-bottom:8px">El paciente no registró correo.</p>
          }

          @for (c of contacts(); track c.id) {
            <label class="contact">
              <input type="checkbox" [value]="c.id" (change)="toggle(c.id, $event)" data-testid="distribute-contact-checkbox" />
              {{ c.label }} — {{ c.email }}
            </label>
          }

          <label class="contact" style="margin-top:8px">
            <input type="checkbox" [checked]="channel()==='email'" (change)="setChannel($event)" data-testid="distribute-email-toggle" />
            <span>Enviar por correo (además del enlace)</span>
          </label>

          <button class="btn btn-primary btn-sm" (click)="doDistribute()" data-testid="distribute-send-button" style="margin-top:10px">
            {{ channel()==='email' ? 'Enviar por correo' : 'Generar enlace' }}
          </button>
          @if (distError()) { <p class="v alerta" style="font-size:12px;margin-top:8px">{{ distError() }}</p> }
          @for (d of deliveries(); track d.token) {
            <div class="dist-row">
              <input readonly [value]="d.url" />
              <button class="btn btn-sm" (click)="copy(d.url)">Copiar</button>
            </div>
          }
        </div>
      </div>
    }

    @else {
      <div class="page-head">
        <div><h2>Revisión de valoración</h2><p>Verifica los datos antes de aprobar y firmar.</p></div>
        <button class="btn btn-sm" (click)="togglePreview()" data-testid="review-preview-button">
          {{ showPreview() ? 'Ocultar documento' : 'Previsualizar documento' }}
        </button>
      </div>

      @if (showPreview()) {
        <div class="card preview-card" style="margin-bottom:16px">
          <div class="preview-head">
            <span class="card-title">Vista previa del borrador</span>
            <a class="btn btn-sm" [href]="rawPreview()" target="_blank" rel="noopener">Abrir en pestaña</a>
          </div>
          @if (previewSrc()) { <iframe class="preview-frame" [src]="previewSrc()" title="Vista previa"></iframe> }
          @else { <div class="preview-empty">Generando vista previa…</div> }
        </div>
      }

      <div class="cols">
        <div class="card">
          <div class="card-title" style="margin-bottom:14px">Borrador de valoración</div>
          <p class="edit-hint">Haz clic en cualquier valor para editarlo. Los cambios se guardan al confirmar.</p>
          @for (sec of sections; track sec.key) {
            <div class="sec-block">
              <div class="section-label">{{ sec.label }}</div>
              @for (f of entries(sec.key); track f.k) {
                <div class="field" [class.derivado]="isDerived(f.v)">
                  <span class="k">{{ labelFor(f.k) }}</span>
                  @if (editingKey() === sec.key + '.' + f.k) {
                    <span class="v-edit">
                      <textarea class="edit-input" [ngModel]="editValue()" (ngModelChange)="editValue.set($event)" (keydown.enter)="$event.preventDefault(); saveEdit(sec.key, f.k)" rows="2" [attr.data-testid]="'edit-' + f.k"></textarea>
                      <span class="edit-actions">
                        <button class="btn btn-sm btn-primary" (click)="saveEdit(sec.key, f.k)" [disabled]="savingEdit()">Guardar</button>
                        <button class="btn btn-sm" (click)="cancelEdit()">Cancelar</button>
                      </span>
                    </span>
                  } @else {
                    <span class="v editable" [class.alerta]="f.v?.alerta" [class.pending]="f.v?.estado==='pendiente_examen'"
                      (click)="startEdit(sec.key, f.k, f.v)" [attr.data-testid]="'field-' + f.k" title="Clic para editar">
                      {{ f.v?.estado==='pendiente_examen' ? 'PENDIENTE DE EXAMEN' : (f.v?.valor ?? '—') }}
                      <span class="edit-pencil">✎</span>
                    </span>
                  }
                </div>
              }
            </div>
          }
        </div>
        <div class="card">
          <div class="card-title" style="margin-bottom:14px">Fuente · Laboratorios</div>
          @for (l of labs(); track l.analyte) {
            <div class="field">
              <span class="k">{{ l.analyte }}</span>
              <span class="v">
                <span [class.alerta]="l.flag!=='NORMAL'">{{ l.value }} {{ l.unit }}</span>
                <span class="lab-flag muted"> · {{ l.flag }}</span>
              </span>
            </div>
          }
          @if (!labs().length) { <div class="empty">Sin laboratorios cargados.</div> }
        </div>
      </div>

      <div class="bar">
        @if (!check()?.ok) {
          <div class="blockers" data-testid="review-blockers">
            @for (b of check()?.blockers ?? []; track b) { <div>⛔ {{ b }}</div> }
          </div>
        }
        @if (!check()?.ok) {
          <label class="contact" style="margin-bottom:10px;font-size:12.5px">
            <input type="checkbox" [checked]="examAttested()" (change)="setExamAttested($event)" data-testid="exam-attest-checkbox" />
            <span>Confirmo que examiné al paciente presencialmente y el examen físico es normal.</span>
          </label>
        }
        <div class="bar-actions">
          @if (!check()?.ok) {
            <button class="btn" [disabled]="!examAttested()" (click)="loadNormal()" data-testid="exam-load-normal-button">Marcar examen normal</button>
          }
          <span class="spacer"></span>
          <button class="btn" (click)="reject()" data-testid="review-reject-button">Rechazar</button>
          <button class="btn btn-primary" [disabled]="!check()?.ok" (click)="approve()" data-testid="review-approve-button">Aprobar y firmar</button>
        </div>
      </div>
    }
  `,
})
export class ReviewApprovalPage implements OnInit {
  private api = inject(ApiService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private sanitizer = inject(DomSanitizer);

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
  editingKey = signal<string | null>(null);
  editValue = signal('');
  savingEdit = signal(false);
  contacts = signal<any[]>([]);
  deliveries = signal<any[]>([]);
  patient = signal<{ fullName: string; email?: string | null } | null>(null);
  sendToPatient = signal(false);
  channel = signal<'email' | 'link'>('link');
  distError = signal('');
  examAttested = signal(false);
  showPreview = signal(false);
  previewSrc = signal<SafeResourceUrl | null>(null);
  rawPreview = signal('');
  private selectedContacts = new Set<string>();

  async ngOnInit() {
    this.caseId = this.route.snapshot.paramMap.get('id') ?? '';
    this.rawPreview.set(this.api.previewUrl(this.caseId));
    await this.reload();
    this.loading.set(false);
  }

  async reload() {
    const r = await this.api.getReview(this.caseId);
    this.fields.set(r.fields ?? {});
    this.labs.set(r.labs ?? []);
    this.check.set(r.canApprove);
    this.patient.set(r.patient ?? null);
    const isApproved = r.approved || r.status === 'APROBADO' || r.status === 'ENTREGADO';
    this.approved.set(isApproved);
    if (isApproved) {
      this.contacts.set((await this.api.listContacts()).contacts);
      this.sendToPatient.set(Boolean(r.patient?.email)); // por defecto, marcar al paciente si tiene correo
      this.loadPreview(); // muestra el documento final automáticamente
    }
  }

  /** Fija el src del iframe (bust cache para reflejar cambios recientes). */
  private loadPreview() {
    const url = `${this.api.previewUrl(this.caseId)}?t=${Date.now()}`;
    this.previewSrc.set(this.sanitizer.bypassSecurityTrustResourceUrl(url));
  }
  togglePreview() {
    const next = !this.showPreview();
    this.showPreview.set(next);
    if (next) this.loadPreview();
  }

  toggle(id: string, ev: Event) {
    const checked = (ev.target as HTMLInputElement).checked;
    if (checked) this.selectedContacts.add(id); else this.selectedContacts.delete(id);
  }
  setSendToPatient(ev: Event) { this.sendToPatient.set((ev.target as HTMLInputElement).checked); }
  setChannel(ev: Event) { this.channel.set((ev.target as HTMLInputElement).checked ? 'email' : 'link'); }

  async doDistribute() {
    this.distError.set('');
    if (this.selectedContacts.size === 0 && !this.sendToPatient()) {
      this.distError.set('Selecciona al menos un destinatario.');
      return;
    }
    try {
      const res = await this.api.distribute(this.caseId, [...this.selectedContacts], this.channel(), this.sendToPatient());
      this.deliveries.set(res.deliveries ?? []);
    } catch (err: unknown) {
      const body = (err as { error?: { error?: string } })?.error;
      this.distError.set(body?.error ?? 'No se pudo distribuir.');
    }
  }
  async copy(url: string) { await navigator.clipboard.writeText(url); }

  entries(section: string): { k: string; v: any }[] {
    const sec = this.fields()[section] ?? {};
    return Object.entries(sec).map(([k, v]) => ({ k, v }));
  }
  labelFor(k: string) { return SECTION_LABELS[k] ?? k; }
  isDerived(v: any) { return v?.fuente?.startsWith?.('derivado'); }

  // ── Edición en línea del borrador ──
  startEdit(section: string, key: string, v: any) {
    const cur = v?.estado === 'pendiente_examen' ? '' : (v?.valor ?? '');
    this.editValue.set(String(cur));
    this.editingKey.set(`${section}.${key}`);
  }
  cancelEdit() { this.editingKey.set(null); }
  async saveEdit(section: string, key: string) {
    this.savingEdit.set(true);
    try {
      await this.api.editField(this.caseId, section, key, this.editValue().trim());
      this.editingKey.set(null);
      await this.reload();
      if (this.showPreview()) this.loadPreview();
    } finally {
      this.savingEdit.set(false);
    }
  }

  setExamAttested(ev: Event) { this.examAttested.set((ev.target as HTMLInputElement).checked); }
  async loadNormal() {
    if (!this.examAttested()) return;
    await this.api.loadExamNormal(this.caseId);
    await this.reload();
    if (this.showPreview()) this.loadPreview();
  }
  async approve() {
    const res = await this.api.approve(this.caseId);
    if (res.ok) { await this.reload(); }
    else this.check.set({ ok: false, blockers: res.blockers ?? [] });
  }
  async reject() {
    const reason = prompt('Motivo del rechazo:') ?? '';
    await this.api.reject(this.caseId, reason);
    this.router.navigate(['/dashboard']);
  }
}
