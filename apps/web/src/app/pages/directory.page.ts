import { Component, inject, signal, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../core/api.service';

@Component({
  selector: 'app-directory',
  standalone: true,
  imports: [FormsModule],
  styles: [`
    .card { background:#fff; padding:1.2rem; border-radius:10px; max-width:640px; box-shadow:0 1px 6px rgba(0,0,0,.05); }
    .row { display:flex; gap:.5rem; margin-bottom:.5rem; }
    input, select { padding:.5rem; border:1px solid #cdd7da; border-radius:8px; }
    button { padding:.5rem 1rem; background:var(--brand); color:#fff; border:0; border-radius:8px; cursor:pointer; }
    .contact { padding:.5rem 0; border-bottom:1px solid #eef2f3; font-size:.9rem; }
    .type { color:#5b6b73; font-size:.8rem; }
  `],
  template: `
    <div class="card">
      <h2>Directorio de contactos</h2>
      <div class="row">
        <input placeholder="Nombre/etiqueta" [(ngModel)]="label" data-testid="contact-label-input" />
        <input placeholder="Correo" [(ngModel)]="email" data-testid="contact-email-input" />
        <select [(ngModel)]="type"><option>MEDICO</option><option>CLINICA</option><option>ASEGURADORA</option><option>OTRO</option></select>
        <button (click)="add()" data-testid="contact-add-button">Agregar</button>
      </div>
      @for (c of contacts(); track c.id) {
        <div class="contact"><strong>{{ c.label }}</strong> — {{ c.email }} <span class="type">({{ c.type }})</span></div>
      }
    </div>
  `,
})
export class DirectoryPage implements OnInit {
  private api = inject(ApiService);
  contacts = signal<any[]>([]);
  label = ''; email = ''; type = 'MEDICO';
  async ngOnInit() { await this.reload(); }
  async reload() { this.contacts.set((await this.api.listContacts()).contacts); }
  async add() {
    if (!this.label || !this.email) return;
    await this.api.addContact({ label: this.label, email: this.email, type: this.type });
    this.label = ''; this.email = '';
    await this.reload();
  }
}
