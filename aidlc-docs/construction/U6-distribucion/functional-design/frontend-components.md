# U6 — Frontend Components (Angular)

## DashboardPage (mejorada) [US-6.4]
- Lista de casos por estado + filtros; indicadores. data-testid: `dashboard-case-row`.

## DistributionPanel (en review o ruta propia) [US-6.1]
- Selección de contactos del directorio (multi) + alta rápida + botón enviar. Muestra enlace de descarga generado (copiar). data-testid: `distribute-send-button`, `distribute-contact-checkbox`.

## DirectoryPage [US-6.1]
- CRUD de contactos.

## PatientHistoryPage [US-6.3]
- Búsqueda + ficha con valoraciones + botón "crear caso" (precarga). data-testid: `patient-search-input`.

## API integration
- /api/panel/directory, /api/panel/cases/:id/distribute, /api/panel/patients, /api/panel/dashboard, /download/delivery/:token.
