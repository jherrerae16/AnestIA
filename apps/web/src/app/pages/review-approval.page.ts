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
    .side { display:flex; flex-direction:column; gap:16px; min-width:0; }
    .attach { display:flex; align-items:center; justify-content:space-between; gap:10px; padding:7px 0; border-bottom:1px solid var(--border, #e6edee); }
    .attach:last-of-type { border-bottom:none; }
    .a-name { font-size:12.5px; overflow-wrap:anywhere; }
    .a-actions { display:flex; gap:6px; flex-shrink:0; }
    .attach-frame { width:100%; height:520px; border:1px solid var(--border, #e6edee); border-radius:6px; margin:8px 0 12px; background:#fff; }
    .lab-date { font-size:11px; font-weight:500; margin-left:4px; }
    .lab-date.alerta { color:#b3261e; font-weight:700; }
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

    /* Panel del auditor independiente */
    .audit-card { margin-bottom:16px; border-left:3px solid var(--gold); }
    .audit-head { display:flex; align-items:center; justify-content:space-between; gap:12px; }
    .audit-count { font-family:var(--font-mono); font-size:11px; color:var(--muted); }
    .audit-intro { font-size:12.5px; color:var(--muted); margin:6px 0 14px; max-width:70ch; }
    .finding { display:flex; gap:10px; align-items:flex-start; padding:9px 0; border-top:1px solid var(--border); font-size:13px; }
    .f-level { font-family:var(--font-mono); font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:.04em;
      padding:2px 7px; border-radius:20px; flex-shrink:0; margin-top:1px; }
    .finding.bloqueante .f-level { background:rgba(179,38,30,.1); color:var(--red); border:1px solid rgba(179,38,30,.25); }
    .finding.advertencia .f-level { background:rgba(224,138,30,.12); color:var(--amber); border:1px solid rgba(224,138,30,.28); }
    .finding.informativo .f-level { background:var(--it-50); color:var(--muted); border:1px solid var(--border); }
    .f-msg { color:var(--text); line-height:1.5; }
    .composer { margin-top:14px; border:1px solid var(--border); border-radius:12px; padding:14px; background:var(--bg3); display:flex; flex-direction:column; gap:12px; animation:fadeIn .2s ease; }
    .comp-field { display:flex; flex-direction:column; gap:5px; }
    .comp-body { resize:vertical; min-height:120px; font-family:var(--font-body); line-height:1.5; }
    .comp-attach { display:flex; align-items:center; gap:10px; background:#fff; border:1px solid var(--border2); border-radius:9px; padding:9px 12px; }
    .pdf-ic { font-family:var(--font-mono); font-size:10px; font-weight:700; color:#fff; background:var(--red); padding:3px 6px; border-radius:4px; letter-spacing:.04em; }
    .pdf-name { font-size:13px; color:var(--text); font-weight:500; flex:1; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    .pdf-tag { font-size:11px; color:var(--muted); font-family:var(--font-mono); }
    .comp-hint { font-size:11.5px; color:var(--muted2); margin:0; }
  `],
  template: `
    @if (loading()) { <div class="empty">Cargando…</div> }

    @else if (approved()) {
      <div class="page-head">
        <div><h2>Caso aprobado</h2><p>El documento final está firmado. Puedes reabrirlo para corregir un error.</p></div>
        <button class="btn btn-sm" (click)="reopen()" [disabled]="reopening()" data-testid="review-reopen-button">
          {{ reopening() ? 'Reabriendo…' : '↺ Reabrir para corregir' }}
        </button>
      </div>
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

          <!-- Destinatarios -->
          <div class="section-label" style="margin:0 0 8px">Destinatarios</div>
          @if (patient()?.email) {
            <label class="contact">
              <input type="checkbox" [checked]="sendToPatient()" (change)="setSendToPatient($event)" data-testid="distribute-patient-checkbox" />
              <span>👤 Paciente — {{ patient()!.email }}</span>
            </label>
          } @else {
            <p class="muted" style="font-size:12px;margin-bottom:6px">El paciente no registró correo.</p>
          }
          @for (c of contacts(); track c.id) {
            <label class="contact">
              <input type="checkbox" [value]="c.id" (change)="toggle(c.id, $event)" data-testid="distribute-contact-checkbox" />
              {{ c.label }} — {{ c.email }}
            </label>
          }

          @if (!composerOpen()) {
            <div style="display:flex; gap:8px; margin-top:14px; flex-wrap:wrap">
              <button class="btn btn-primary btn-sm" (click)="openComposer()" data-testid="distribute-email-open">📧 Enviar por correo</button>
              <button class="btn btn-sm" (click)="generateLink()" data-testid="distribute-link-button">🔗 Generar enlace</button>
            </div>
          } @else {
            <!-- Compositor del correo -->
            <div class="composer" data-testid="email-composer">
              <div class="comp-field">
                <label class="ki-label">Asunto</label>
                <input class="ki-input" [ngModel]="emailSubject()" (ngModelChange)="emailSubject.set($event)" data-testid="email-subject" />
              </div>
              <div class="comp-attach">
                <span class="pdf-ic">PDF</span>
                <span class="pdf-name">{{ pdfName() }}</span>
                <span class="pdf-tag">adjunto</span>
              </div>
              <div class="comp-field">
                <label class="ki-label">Mensaje</label>
                <textarea class="ki-input comp-body" rows="8" [ngModel]="emailBody()" (ngModelChange)="emailBody.set($event)" data-testid="email-body"></textarea>
              </div>
              <p class="comp-hint">Se enviará a los destinatarios seleccionados con el PDF adjunto y un enlace de descarga.</p>
              <div style="display:flex; gap:8px">
                <button class="btn btn-primary btn-sm" (click)="sendEmail()" [disabled]="sending()" data-testid="email-send">
                  {{ sending() ? 'Enviando…' : 'Enviar correo' }}
                </button>
                <button class="btn btn-sm" (click)="composerOpen.set(false)">Cancelar</button>
              </div>
            </div>
          }

          @if (distError()) { <p class="v alerta" style="font-size:12px;margin-top:10px">{{ distError() }}</p> }
          @if (sentOk()) { <p style="font-size:12.5px;color:var(--green);margin-top:10px;font-weight:600">✔ Correo enviado.</p> }
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

      @if (auditFindings().length) {
        <div class="card audit-card" data-testid="audit-panel">
          <div class="audit-head">
            <span class="card-title">Revisión automática del borrador</span>
            <span class="audit-count">{{ auditFindings().length }} hallazgo{{ auditFindings().length === 1 ? '' : 's' }}</span>
          </div>
          <p class="audit-intro">Un auditor independiente revisó este borrador contra las respuestas del paciente. Estos puntos requieren tu criterio — el sistema no los corrige por su cuenta.</p>
          @for (f of auditFindings(); track $index) {
            <div class="finding" [class]="'finding ' + f.level" [attr.data-testid]="'finding-' + f.level">
              <span class="f-level">{{ levelLabel(f.level) }}</span>
              <span class="f-msg">{{ f.message }}</span>
            </div>
          }
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
        <div class="side">
          @if (patient(); as p) {
            <div class="card" data-testid="patient-card">
              <div class="card-title" style="margin-bottom:14px">Paciente</div>
              <div class="field"><span class="k">Nombre</span><span class="v">{{ p.fullName }}</span></div>
              <div class="field"><span class="k">Documento</span><span class="v">{{ p.documentId || '—' }}</span></div>
              <div class="field"><span class="k">Edad</span><span class="v">{{ p.edad != null ? p.edad + ' años' : '—' }}</span></div>
              <div class="field"><span class="k">Sexo</span><span class="v">{{ p.sex || '—' }}</span></div>
              <div class="field">
                <span class="k">Teléfono</span>
                <span class="v">@if (p.phone) { <a [href]="'tel:' + p.phone">{{ p.phone }}</a> } @else { — }</span>
              </div>
              <div class="field">
                <span class="k">Correo</span>
                <span class="v">@if (p.email) { <a [href]="'mailto:' + p.email">{{ p.email }}</a> } @else { — }</span>
              </div>
              <div class="field"><span class="k">Aseguradora</span><span class="v">{{ p.insurer || '—' }}</span></div>
              <div class="field"><span class="k">Grupo sanguíneo</span><span class="v">{{ p.bloodType || '—' }}</span></div>
            </div>
          }

          <div class="card" data-testid="attachments-card">
            <div class="card-title" style="margin-bottom:14px">Exámenes adjuntos del paciente</div>
            <p class="edit-hint">Los archivos originales tal como los subió el paciente. Revísalos: lo de abajo es lo que la IA leyó de ellos.</p>
            @for (a of attachments(); track a.id) {
              <div class="attach">
                <span class="a-name">{{ a.filename }}</span>
                <span class="a-actions">
                  @if (a.viewable) {
                    <button class="btn btn-sm" (click)="toggleAttachment(a.id)" [attr.data-testid]="'attach-view-' + a.id">
                      {{ openAttachment() === a.id ? 'Cerrar' : 'Ver' }}
                    </button>
                  }
                  <a class="btn btn-sm" [href]="a.url" target="_blank" rel="noopener">Abrir</a>
                </span>
              </div>
              @if (openAttachment() === a.id && attachmentSrc(); as src) {
                <iframe class="attach-frame" [src]="src" [title]="a.filename"></iframe>
              }
            }
            @if (!attachments().length) { <div class="empty">El paciente no adjuntó exámenes.</div> }
          </div>

          <div class="card">
            <div class="card-title" style="margin-bottom:14px">Fuente · Laboratorios</div>
            @for (g of labGroups(); track g.grupo) {
              <div class="sec-block">
                <div class="section-label">
                  {{ g.label }}
                  @if (g.fecha) {
                    <span class="lab-date" [class.alerta]="g.desactualizado"
                      [title]="g.desactualizado ? 'Examen de hace 3 meses o más — verificar vigencia' : ''">
                      · {{ g.fecha }}{{ g.desactualizado ? ' ⚠' : '' }}
                    </span>
                  } @else {
                    <span class="lab-date muted" title="El informe no traía fecha impresa">· sin fecha</span>
                  }
                </div>
                @for (l of g.labs; track l.analyte) {
                  <div class="field">
                    <span class="k">{{ l.analyte }}</span>
                    <span class="v">
                      <span [class.alerta]="l.flag!=='NORMAL'">{{ l.value }} {{ l.unit }}</span>
                      <span class="lab-flag muted"> · {{ l.flag }}</span>
                    </span>
                  </div>
                }
              </div>
            }
            @if (!labs().length) { <div class="empty">Sin laboratorios cargados.</div> }
          </div>
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
            <span>Confirmo que examiné al paciente presencialmente y los hallazgos son normales.
              Los signos vitales y el peso/talla los ingreso yo con los valores medidos.</span>
          </label>
        }
        <div class="bar-actions">
          @if (!check()?.ok) {
            <button class="btn" [disabled]="!examAttested()" (click)="loadNormal()" data-testid="exam-load-normal-button">Confirmar hallazgos normales</button>
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
  reopening = signal(false);
  /** Hallazgos del auditor independiente, ordenados por severidad. */
  auditFindings = signal<{ level: string; category: string; message: string; field?: string }[]>([]);
  contacts = signal<any[]>([]);
  deliveries = signal<any[]>([]);
  patient = signal<{
    fullName: string;
    documentId?: string | null;
    edad?: number | null;
    sex?: string | null;
    phone?: string | null;
    email?: string | null;
    insurer?: string | null;
    bloodType?: string | null;
  } | null>(null);
  attachments = signal<{ id: string; filename: string; url: string; viewable: boolean }[]>([]);
  /** Labs agrupados por estudio con fecha y vigencia — los resuelve el servidor. */
  labGroups = signal<
    { grupo: string; label: string; fecha: string | null; desactualizado: boolean; labs: any[] }[]
  >([]);
  openAttachment = signal<string | null>(null);
  attachmentSrc = signal<SafeResourceUrl | null>(null);
  sendToPatient = signal(false);
  distError = signal('');
  composerOpen = signal(false);
  emailSubject = signal('');
  emailBody = signal('');
  pdfName = signal('');
  sending = signal(false);
  sentOk = signal(false);
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
    this.labGroups.set(r.labGroups ?? []);
    this.attachments.set(r.attachments ?? []);
    this.check.set(r.canApprove);
    this.patient.set(r.patient ?? null);
    // Hallazgos del auditor: primero lo más severo.
    const order: Record<string, number> = { bloqueante: 0, advertencia: 1, informativo: 2 };
    const findings = (r.audit?.findings ?? []) as { level: string; category: string; message: string }[];
    this.auditFindings.set([...findings].sort((x, y) => (order[x.level] ?? 9) - (order[y.level] ?? 9)));
    const isApproved = r.approved || r.status === 'APROBADO' || r.status === 'ENTREGADO';
    this.approved.set(isApproved);
    if (isApproved) {
      this.contacts.set((await this.api.listContacts()).contacts);
      this.sendToPatient.set(Boolean(r.patient?.email)); // por defecto, marcar al paciente si tiene correo
      this.loadPreview(); // muestra el documento final automáticamente
    }
  }

  /** Abre/cierra el visor del examen original adjunto (PDF o imagen). */
  toggleAttachment(id: string) {
    if (this.openAttachment() === id) {
      this.openAttachment.set(null);
      this.attachmentSrc.set(null);
      return;
    }
    const a = this.attachments().find((x) => x.id === id);
    if (!a) return;
    this.openAttachment.set(id);
    this.attachmentSrc.set(this.sanitizer.bypassSecurityTrustResourceUrl(a.url));
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

  private hasRecipient(): boolean {
    return this.selectedContacts.size > 0 || this.sendToPatient();
  }

  /** Abre el compositor con asunto/cuerpo precargados desde el servidor. */
  async openComposer() {
    this.distError.set('');
    this.sentOk.set(false);
    if (!this.hasRecipient()) { this.distError.set('Selecciona al menos un destinatario.'); return; }
    if (!this.emailSubject()) {
      const d = await this.api.emailDraft(this.caseId);
      this.emailSubject.set(d.subject);
      this.emailBody.set(d.body);
      this.pdfName.set(d.pdfFilename);
    }
    this.composerOpen.set(true);
  }

  /** Envía el correo editado (con PDF adjunto) a los destinatarios seleccionados. */
  async sendEmail() {
    this.distError.set('');
    this.sending.set(true);
    try {
      const res = await this.api.distribute(this.caseId, {
        contactIds: [...this.selectedContacts], channel: 'email', sendToPatient: this.sendToPatient(),
        subject: this.emailSubject(), body: this.emailBody(),
      });
      this.deliveries.set(res.deliveries ?? []);
      this.composerOpen.set(false);
      this.sentOk.set(true);
    } catch (err: unknown) {
      const body = (err as { error?: { error?: string } })?.error;
      this.distError.set(body?.error ?? 'No se pudo enviar el correo.');
    } finally {
      this.sending.set(false);
    }
  }

  /** Solo genera el enlace de descarga (sin correo). */
  async generateLink() {
    this.distError.set('');
    this.sentOk.set(false);
    if (!this.hasRecipient()) { this.distError.set('Selecciona al menos un destinatario.'); return; }
    try {
      const res = await this.api.distribute(this.caseId, {
        contactIds: [...this.selectedContacts], channel: 'link', sendToPatient: this.sendToPatient(),
      });
      this.deliveries.set(res.deliveries ?? []);
    } catch (err: unknown) {
      const body = (err as { error?: { error?: string } })?.error;
      this.distError.set(body?.error ?? 'No se pudo generar el enlace.');
    }
  }
  async copy(url: string) { await navigator.clipboard.writeText(url); }

  entries(section: string): { k: string; v: any }[] {
    const sec = this.fields()[section] ?? {};
    return Object.entries(sec).map(([k, v]) => ({ k, v }));
  }
  labelFor(k: string) { return SECTION_LABELS[k] ?? k; }
  isDerived(v: any) { return v?.fuente?.startsWith?.('derivado'); }
  levelLabel(level: string) {
    return level === 'bloqueante' ? 'Bloqueante' : level === 'advertencia' ? 'Advertencia' : 'Informativo';
  }

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
  async reopen() {
    const reason = prompt('Motivo de la reapertura (queda registrado):') ?? '';
    if (reason === null) return;
    this.reopening.set(true);
    try {
      await this.api.reopen(this.caseId, reason);
      this.approved.set(false);
      this.editingKey.set(null);
      await this.reload();
    } finally {
      this.reopening.set(false);
    }
  }
}
