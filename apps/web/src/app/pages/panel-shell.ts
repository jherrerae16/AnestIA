import { Component, inject } from '@angular/core';
import { RouterOutlet, Router, RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../core/auth.service';

@Component({
  selector: 'app-panel-shell',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  styles: [`
    .nav {
      position: sticky; top: 0; z-index: 100;
      background: rgba(255,255,255,0.94); backdrop-filter: blur(12px);
      border-bottom: 1px solid var(--border);
      padding: 0 32px; height: 68px;
      display: flex; align-items: center; justify-content: space-between; gap: 24px;
    }
    .brand { display: flex; align-items: center; gap: 11px; min-width: 0; }
    .brand-icon {
      width: 42px; height: 42px; border-radius: 10px; flex-shrink: 0;
      display: flex; align-items: center; justify-content: center;
      background: linear-gradient(135deg, var(--primary), var(--blue));
      color: #fff; font-weight: 700; font-size: 16px; overflow: hidden;
      font-family: var(--font-display);
    }
    /* Con logo: fondo blanco + contain para no recortar la marca. */
    .brand-icon.has-logo { background: #fff; border: 1px solid var(--border); padding: 3px; }
    .brand-icon img { width: 100%; height: 100%; object-fit: contain; }
    .brand-text { display: flex; flex-direction: column; min-width: 0; line-height: 1.15; }
    .brand-name { font-family: var(--font-display); font-weight: 700; font-size: 15px; color: var(--text); letter-spacing: -0.3px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .brand-sub { font-size: 11px; color: var(--muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

    /* pill nav estilo KI */
    .nav-pill { background: var(--it-950); border-radius: 100px; padding: 5px; display: flex; gap: 2px; }
    .nav-pill a {
      padding: 7px 16px; font-size: 13px; font-weight: 500;
      color: rgba(255,255,255,0.62); border-radius: 100px; text-decoration: none;
      transition: all .2s; white-space: nowrap;
    }
    .nav-pill a:hover { background: rgba(255,255,255,0.12); color: #fff; }
    .nav-pill a.on { background: var(--primary); color: #fff; }

    .nav-right { display: flex; align-items: center; gap: 14px; flex-shrink: 0; }
    .who { font-size: 12px; color: var(--muted); white-space: nowrap; }
    main { padding: 28px 32px 48px; max-width: 1280px; margin: 0 auto; position: relative; z-index: 1; }

    @media (max-width: 920px) {
      .nav { flex-wrap: wrap; height: auto; padding: 12px 20px; }
      .nav-pill { order: 3; width: 100%; overflow-x: auto; justify-content: flex-start; }
      .who { display: none; }
    }
  `],
  template: `
    <header class="nav">
      <a class="brand" routerLink="/dashboard" style="text-decoration:none">
        <span class="brand-icon" [class.has-logo]="!!auth.profile()?.clinicLogoUrl">
          @if (auth.profile()?.clinicLogoUrl) {
            <img [src]="auth.profile()!.clinicLogoUrl" alt="" />
          } @else { A }
        </span>
        <span class="brand-text">
          <span class="brand-name">{{ auth.profile()?.fullName ?? 'AnestIA' }}</span>
          <span class="brand-sub">{{ auth.profile()?.footerText ?? 'Valoración preanestésica' }}</span>
        </span>
      </a>

      <nav class="nav-pill">
        <a routerLink="/dashboard" routerLinkActive="on">Casos</a>
        <a routerLink="/calendar" routerLinkActive="on" data-testid="nav-calendar">Calendario</a>
        <a routerLink="/cases/new" routerLinkActive="on" data-testid="nav-new-case">Nuevo caso</a>
        <a routerLink="/patients" routerLinkActive="on">Pacientes</a>
        <a routerLink="/directory" routerLinkActive="on">Directorio</a>
        <a routerLink="/presets" routerLinkActive="on">Cuestionarios</a>
        <a routerLink="/profile" routerLinkActive="on" data-testid="nav-profile">Perfil</a>
      </nav>

      <div class="nav-right">
        <span class="who">{{ auth.profile()?.specialty ?? '' }}</span>
        <button class="btn btn-sm" (click)="logout()" data-testid="panel-logout-button">Salir</button>
      </div>
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
