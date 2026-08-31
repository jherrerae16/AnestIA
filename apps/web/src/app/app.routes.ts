import { Routes } from '@angular/router';
import { authGuard } from './core/auth.guard';

export const routes: Routes = [
  {
    path: 'signin',
    loadComponent: () => import('./pages/signin.page').then((m) => m.SignInPage),
  },
  {
    // Restablecer contraseña — pública por necesidad: quien llega aquí no tiene sesión,
    // justamente porque perdió el acceso. El token viaja en la query.
    path: 'restablecer',
    loadComponent: () => import('./pages/restablecer.page').then((m) => m.RestablecerPage),
  },
  {
    // Formulario del paciente — público, por token (sin guard).
    path: 'form/:token',
    loadComponent: () => import('./pages/patient-form.page').then((m) => m.PatientFormPage),
  },
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/panel-shell').then((m) => m.PanelShell),
    children: [
      {
        path: 'dashboard',
        loadComponent: () => import('./pages/dashboard.page').then((m) => m.DashboardPage),
      },
      {
        path: 'calendar',
        loadComponent: () => import('./pages/calendar.page').then((m) => m.CalendarPage),
      },
      {
        path: 'cases/new',
        loadComponent: () => import('./pages/case-creator.page').then((m) => m.CaseCreatorPage),
      },
      {
        path: 'presets',
        loadComponent: () => import('./pages/preset-list.page').then((m) => m.PresetListPage),
      },
      {
        path: 'presets/:id/preguntas',
        loadComponent: () => import('./pages/preset-editor.page').then((m) => m.PresetEditorPage),
      },
      {
        path: 'cases/:id/review',
        loadComponent: () => import('./pages/review-approval.page').then((m) => m.ReviewApprovalPage),
      },
      {
        path: 'directory',
        loadComponent: () => import('./pages/directory.page').then((m) => m.DirectoryPage),
      },
      {
        path: 'patients',
        loadComponent: () => import('./pages/patient-history.page').then((m) => m.PatientHistoryPage),
      },
      {
        path: 'profile',
        loadComponent: () => import('./pages/profile.page').then((m) => m.ProfilePage),
      },
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
    ],
  },
  { path: '**', redirectTo: '' },
];
