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
    /* Escritorio muestra la tabla; móvil, tarjetas. 5 columnas no se navegan en el celular. */
    .pt-cards { display: none; }
    @media (max-width: 640px) {
      .results-table { display: none; }
      .pt-cards { display: flex; flex-direction: column; }
      .pt-card { padding: 13px 14px; border-bottom: 1px solid var(--border); cursor: pointer; display: flex; flex-direction: column; gap: 5px; }
      .pt-card:last-child { border-bottom: none; }
      .pt-card:active { background: var(--it-50); }
      .ptc-name { font-weight: 600; color: var(--text); font-size: 14px; }
      .ptc-meta { display: flex; gap: 12px; flex-wrap: wrap; font-size: 12.5px; color: var(--muted); }
    }
    .results-table thead th { background: var(--bg3); font-size: 10px; font-weight: 600; text-transform: uppercase;
      letter-spacing: 0.07em; color: var(--muted); text-align: left; padding: 9px 14px; border-bottom: 1px solid var(--border); }
    .results-table tbody td { padding: 11px 14px; border-bottom: 1px solid var(--border); font-size: 13px; color: var(--text); }
    .results-table tbody tr { cursor: pointer; transition: background 140ms ease; }
    .results-table tbody tr:hover { background: var(--it-50); }
    .results-table tbody tr:last-child td { border-bottom: none; }
    .patient-name { font-weight: 600; }
    .doc { font-family: var(--font-mono); font-size: 12px; color: var(--muted2); }
    .detail-title { font-family: var(--font-display); font-size: 15px; font-weight: 600; color: var(--text); margin-bottom: 12px; }
    .pt-grid { display:grid; grid-template-columns:repeat(auto-fit, minmax(190px, 1fr)); gap:1px; background:var(--border); border:1px solid var(--border); border-radius:6px; margin-bottom:18px; }
    .pt-cell { background:var(--bg2); padding:8px 11px; min-width:0; }
    .pt-k { display:block; font-size:10px; text-transform:uppercase; letter-spacing:.4px; color:var(--muted); font-weight:600; margin-bottom:2px; }
    .pt-v { display:block; font-size:13px; overflow-wrap:anywhere; }
    .case-row { display: flex; align-items: center; gap: 10px; padding: 10px 0; border-bottom: 1px solid var(--border); }
    .case-row:last-child { border-bottom: none; }
    .case-proc { font-size: 13px; color: var(--text); flex: 1; }
    .case-status { font-size: 12px; color: var(--muted); }

    /* Notas privadas del médico. Fondo distinto para que se lean como "libreta aparte". */
    .notes-block { margin-top: 18px; background: #fffbeb; border: 1px solid #fde68a; border-radius: 10px; padding: 14px 16px; }
    .notes-head { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
    .notes-title { font-size: 13px; font-weight: 600; color: var(--text); }
    .notes-badge { font-size: 11px; font-weight: 600; color: #92400e; background: #fef3c7; border: 1px solid #fde68a; border-radius: 100px; padding: 2px 9px; }
    .notes-hint { font-size: 11.5px; color: #92400e; margin: 0 0 8px; }
    .notes-ta { width: 100%; min-height: 90px; padding: 9px 11px; border: 1px solid #fcd34d; border-radius: 8px; font-family: var(--font-body); font-size: 13px; color: var(--text); resize: vertical; outline: none; background: #fff; }
    .notes-ta:focus { border-color: var(--primary); box-shadow: 0 0 0 3px rgba(11,92,107,.12); }
    .notes-actions { display: flex; align-items: center; gap: 10px; margin-top: 8px; }
    .notes-saved { font-size: 12px; color: var(--green); font-weight: 600; }
    .notes-add-btn { font-size: 12px; color: var(--primary); background: none; border: none; cursor: pointer; padding: 0; }
    .notes-add-btn:hover { text-decoration: underline; }
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
          <!-- Escritorio: tabla. Móvil: tarjetas (misma data, ver .pt-cards). -->
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

          <!-- Móvil: una tarjeta por paciente. -->
          <div class="pt-cards">
            @for (p of results(); track p.id) {
              <div class="pt-card" (click)="open(p.id)">
                <div class="ptc-name">{{ p.fullName }}</div>
                <div class="ptc-meta">
                  <span>{{ p.documentId }}</span>
                  <span>{{ edadSexo(p) }}</span>
                </div>
                <div class="ptc-meta">
                  @if (p.phone) { <span>{{ p.phone }}</span> }
                  @if (p.insurer) { <span>{{ p.insurer }}</span> }
                </div>
              </div>
            }
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

          <!-- Notas privadas: la sección sólo existe cuando hay contenido o el médico abre a escribir. -->
          @if (noteVisible()) {
            <div class="notes-block" data-testid="patient-notes">
              <div class="notes-head">
                <span class="notes-title">Notas privadas</span>
                <span class="notes-badge">🔒 solo tú ves esto</span>
              </div>
              <p class="notes-hint">Tu libreta personal. No entra al documento, ni se comparte, ni la ve el paciente.</p>
              <textarea class="notes-ta" [(ngModel)]="noteContent"
                placeholder="Ej: vía difícil — usar videolaringoscopio; prefiere menos midazolam…"
                data-testid="patient-notes-input"></textarea>
              <div class="notes-actions">
                <button class="btn btn-primary btn-sm" (click)="saveNote()" [disabled]="savingNote()" data-testid="patient-notes-save">
                  {{ savingNote() ? 'Guardando…' : 'Guardar nota' }}
                </button>
                @if (noteSavedMsg()) { <span class="notes-saved">{{ noteSavedMsg() }}</span> }
              </div>
            </div>
          } @else {
            <button class="notes-add-btn" (click)="startNote()" data-testid="patient-notes-add">+ Añadir nota privada</button>
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

  // Notas privadas
  noteContent = '';
  private hasNote = signal(false);   // hay nota guardada
  private editingNote = signal(false); // el médico abrió a escribir aunque no hubiera nota
  savingNote = signal(false);
  noteSavedMsg = signal('');
  /** La sección de nota sólo aparece si hay nota o si el médico la abrió. */
  noteVisible = () => this.hasNote() || this.editingNote();

  async search() {
    if (this.q.length < 2) { this.results.set([]); return; }
    this.results.set((await this.api.searchPatients(this.q)).patients);
  }

  async open(id: string) {
    this.selected.set((await this.api.getPatient(id)).patient);
    // Reset y carga de la nota del paciente seleccionado.
    this.noteContent = '';
    this.hasNote.set(false);
    this.editingNote.set(false);
    this.noteSavedMsg.set('');
    const { note } = await this.api.getPatientNote(id);
    if (note) {
      this.noteContent = note.content;
      this.hasNote.set(true);
    }
  }

  /** Abre el editor de nota cuando aún no hay ninguna. */
  startNote() {
    this.editingNote.set(true);
  }

  async saveNote() {
    const patientId = this.selected()?.id;
    if (!patientId) return;
    const content = this.noteContent.trim();

    // Vaciar una nota existente = borrarla: confirmar antes (no borrado silencioso).
    if (content.length === 0) {
      if (this.hasNote()) {
        const ok = confirm('¿Borrar la nota privada de este paciente? No se puede deshacer.');
        if (!ok) return;
      } else {
        // Nada que guardar ni borrar: sólo cerrar el editor.
        this.editingNote.set(false);
        return;
      }
    }

    this.savingNote.set(true);
    try {
      const { note } = await this.api.savePatientNote(patientId, content);
      this.hasNote.set(!!note);
      this.editingNote.set(false);
      this.noteContent = note?.content ?? '';
      this.noteSavedMsg.set(note ? '✔ Nota guardada' : '✔ Nota eliminada');
      setTimeout(() => this.noteSavedMsg.set(''), 2000);
    } finally {
      this.savingNote.set(false);
    }
  }

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
