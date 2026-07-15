# U0 — Frontend Components (Angular 19, standalone/signals)

## C-WEB-0.1 SignInPage (public)
- **Purpose**: Email + password login.
- **State**: signals `email`, `password`, `error`, `loading`.
- **Interactions**: submit → POST `/api/panel/auth/login` → on success route to `/dashboard`; on failure show generic error.
- **Validation**: email format, password non-empty (Zod-shared).
- **data-testid**: `signin-email-input`, `signin-password-input`, `signin-submit-button`, `signin-error`.

## C-WEB-0.2 PanelShell (guarded)
- **Purpose**: Authenticated layout (nav placeholder + logout).
- **Guard**: functional route guard → checks session (GET `/api/panel/auth/me`); if 401 → redirect to sign-in.
- **data-testid**: `panel-logout-button`.

## C-WEB-0.3 DashboardPage (guarded, empty in U0)
- **Purpose**: Landing after login; empty placeholder ("No hay casos aún") until U1/U6.
- **data-testid**: `dashboard-root`.

## Routing
- `/signin` (public) · `/dashboard` (guarded) · default redirect → `/dashboard` (→ guard bounces to `/signin` if unauth).

## API integration
- `httpResource`/`resource` for `/api/panel/auth/me`; plain POST for login/logout.
