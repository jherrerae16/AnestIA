import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../core/auth.service';

@Component({
  selector: 'app-signin',
  standalone: true,
  imports: [FormsModule],
  styles: [`
    .wrap { min-height: 100vh; display: grid; place-items: center; padding: 1rem; }
    .card { background: #fff; padding: 2rem; border-radius: 12px; box-shadow: 0 4px 24px rgba(0,0,0,.08); width: 100%; max-width: 360px; }
    h1 { margin: 0 0 .25rem; color: var(--brand); font-size: 1.4rem; }
    p.sub { margin: 0 0 1.5rem; color: #5b6b73; font-size: .9rem; }
    label { display: block; font-size: .85rem; margin-bottom: .25rem; }
    input { width: 100%; padding: .6rem; border: 1px solid #cdd7da; border-radius: 8px; margin-bottom: 1rem; font-size: 1rem; }
    button { width: 100%; padding: .7rem; background: var(--brand); color: #fff; border: 0; border-radius: 8px; font-size: 1rem; cursor: pointer; }
    button:disabled { opacity: .6; }
    .error { color: var(--error); font-size: .85rem; margin-bottom: 1rem; }
  `],
  template: `
    <div class="wrap">
      <form class="card" (ngSubmit)="submit()">
        <h1>AnestIA</h1>
        <p class="sub">Valoración preanestésica</p>
        <label for="email">Correo</label>
        <input id="email" name="email" type="email" [(ngModel)]="email" data-testid="signin-email-input" autocomplete="username" />
        <label for="password">Contraseña</label>
        <input id="password" name="password" type="password" [(ngModel)]="password" data-testid="signin-password-input" autocomplete="current-password" />
        @if (error()) {
          <div class="error" data-testid="signin-error">{{ error() }}</div>
        }
        <button type="submit" [disabled]="loading()" data-testid="signin-submit-button">
          {{ loading() ? 'Entrando…' : 'Iniciar sesión' }}
        </button>
      </form>
    </div>
  `,
})
export class SignInPage {
  private auth = inject(AuthService);
  private router = inject(Router);
  email = '';
  password = '';
  loading = signal(false);
  error = signal<string | null>(null);

  async submit() {
    this.error.set(null);
    this.loading.set(true);
    try {
      await this.auth.login(this.email, this.password);
      this.router.navigate(['/dashboard']);
    } catch {
      this.error.set('Credenciales inválidas.');
    } finally {
      this.loading.set(false);
    }
  }
}
