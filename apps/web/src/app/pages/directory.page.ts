import { Component, inject, signal, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../core/api.service';

@Component({
  selector: 'app-directory',
  standalone: true,
  imports: [FormsModule],
  styles: [`
    :host { display:block; max-width:660px; }
    .page-head { margin-bottom:20px; }
    .page-title { font-family:var(--font-display); font-size:22px; font-weight:600; letter-spacing:-0.5px; color:var(--text); }
    .add-row { display:grid; grid-template-columns:1.2fr 1.4fr auto auto; gap:10px; align-items:end; }
    .add-row .field { min-width:0; }
    @media (max-width:560px) { .add-row { grid-template-columns:1fr 1fr; } }
    .contact { display:flex; align-items:center; gap:12px; padding:12px 0; border-bottom:1px solid var(--border); }
    .contact:last-child { border-bottom:none; }
    .contact-body { min-width:0; }
    .contact-name { font-size:13px; font-weight:600; color:var(--text); }
    .contact-email { font-size:12px; color:var(--muted); margin-top:2px; }
    .contact .card-badge { margin-left:auto; flex-shrink:0; }
    .add-err { font-size:12px; color:var(--red-text); margin:8px 0 0; }
  `],
  template: `
    <div class="page-head">
      <div class="page-title">Directorio de contactos</div>
    </div>

    <div class="card">
      <div class="section-label">Agregar contacto</div>
      <div class="add-row">
        <div class="field">
          <label class="ki-label" for="ct-label">Nombre / etiqueta</label>
          <input id="ct-label" class="ki-input" placeholder="Nombre/etiqueta" [(ngModel)]="label" data-testid="contact-label-input" />
        </div>
        <div class="field">
          <label class="ki-label" for="ct-email">Correo</label>
          <input id="ct-email" class="ki-input" type="email" inputmode="email" placeholder="nombre@correo.com" [(ngModel)]="email" data-testid="contact-email-input" />
        </div>
        <div class="field">
          <label class="ki-label" for="ct-type">Tipo</label>
          <select id="ct-type" class="ki-select" [(ngModel)]="type">
            <option value="MEDICO">Médico</option>
            <option value="CLINICA">Clínica</option>
            <option value="ASEGURADORA">Aseguradora</option>
            <option value="OTRO">Otro</option>
          </select>
        </div>
        <button class="btn btn-primary" (click)="add()" data-testid="contact-add-button">Agregar</button>
      </div>
      @if (addError()) { <p class="add-err" role="alert">{{ addError() }}</p> }

      <div class="section-label">Contactos</div>
      @for (c of contacts(); track c.id) {
        <div class="contact">
          <div class="contact-body">
            <div class="contact-name">{{ c.label }}</div>
            <div class="contact-email">{{ c.email }}</div>
          </div>
          <span class="card-badge badge-blue">{{ typeLabel(c.type) }}</span>
        </div>
      } @empty {
        <div class="empty">Sin contactos todavía.</div>
      }
    </div>
  `,
})
export class DirectoryPage implements OnInit {
  private api = inject(ApiService);
  contacts = signal<any[]>([]);
  addError = signal('');
  label = ''; email = ''; type = 'MEDICO';
  private static readonly TYPE_LABEL: Record<string, string> = {
    MEDICO: 'Médico', CLINICA: 'Clínica', ASEGURADORA: 'Aseguradora', OTRO: 'Otro',
  };
  typeLabel(t: string) { return DirectoryPage.TYPE_LABEL[t] ?? t; }

  async ngOnInit() { await this.reload(); }
  async reload() { this.contacts.set((await this.api.listContacts()).contacts); }
  async add() {
    const label = this.label.trim();
    const email = this.email.trim();
    if (!label || !email) { this.addError.set('Ingresa nombre y correo.'); return; }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { this.addError.set('El correo no es válido.'); return; }
    this.addError.set('');
    await this.api.addContact({ label, email, type: this.type });
    this.label = ''; this.email = '';
    await this.reload();
  }
}
