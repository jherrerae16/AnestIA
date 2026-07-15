import { Component } from '@angular/core';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  template: `
    <div data-testid="dashboard-root">
      <h2>Casos</h2>
      <p>No hay casos aún. (El listado llega en la Fase 6.)</p>
    </div>
  `,
})
export class DashboardPage {}
