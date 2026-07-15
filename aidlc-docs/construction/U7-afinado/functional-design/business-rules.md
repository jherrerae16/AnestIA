# U7 — Business Rules

- **BR-7.1** AuditLog es append-only; la aplicación sólo crea entradas, nunca las modifica ni borra. [SECURITY-14, CS7]
- **BR-7.2** Jobs del pipeline: reintentables (retryLimit) e idempotentes (no duplican artefactos). [SECURITY-15]
- **BR-7.3** Rutas públicas (form, download, login) con rate-limit para prevenir abuso. [SECURITY-11]
- **BR-7.4** Secretos (ANTHROPIC_API_KEY, SMTP_*, SESSION_SECRET, Google OAuth) sólo por env; nunca en código, logs ni repo. [SECURITY-12]
- **BR-7.5** Errores: fail-closed, mensajes genéricos al cliente, sin stack traces. [SECURITY-15]
- **BR-7.6** Cumplimiento verificado y documentado (CS1-CS8, Ley 1581, inmutabilidad, HITL) antes de cerrar el piloto.
- **BR-7.7** Dependencias: lockfile commiteado; `npm audit` documentado; sin `fix --force` que rompa la build verificada. [SECURITY-10]
