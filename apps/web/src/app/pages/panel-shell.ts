import { Component, inject } from '@angular/core';
import { RouterOutlet, Router, RouterLink } from '@angular/router';
import { AuthService } from '../core/auth.service';

@Component({
  selector: 'app-panel-shell',
  standalone: true,
  imports: [RouterOutlet, RouterLink],
  styles: [`
    header { background: var(--brand); color: #fff; padding: .8rem 1.2rem; display: flex; justify-content: space-between; align-items: center; }
    .brand { font-weight: 600; }
    nav { display:flex; gap:1rem; }
    nav a { color:#fff; text-decoration:none; opacity:.9; font-size:.9rem; }
    nav a:hover { opacity:1; text-decoration:underline; }
    button { background: transparent; border: 1px solid rgba(255,255,255,.6); color: #fff; padding: .4rem .8rem; border-radius: 6px; cursor: pointer; }
    main { padding: 1.5rem; }
  `],
  template: `
    <header>
      <span class="brand">AnestIA · {{ auth.profile()?.fullName ?? '' }}</span>
      <nav>
        <a routerLink="/dashboard">Casos</a>
        <a routerLink="/cases/new" data-testid="nav-new-case">Nuevo caso</a>
        <a routerLink="/patients">Pacientes</a>
        <a routerLink="/directory">Directorio</a>
        <a routerLink="/presets">Cuestionarios</a>
      </nav>
      <button (click)="logout()" data-testid="panel-logout-button">Salir</button>
    </header>
    <main><router-outlet /></main>
  `,
})
export class PanelShell {
  auth = inject(AuthService);
  private router = inject(Router);
  async logout() {
    await this.auth.logout();
    this.router.navigate(['/signin']);
  }
}
