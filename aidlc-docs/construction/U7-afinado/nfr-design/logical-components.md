# U7 — Logical Components

| Component | Type | Role |
|---|---|---|
| rateLimit | lib util | ventana in-memory por key |
| middleware (ext) | HTTP | aplica rate-limit a rutas públicas |
| audit route | api | timeline por caso |
| queue config | pg-boss | retryLimit/backoff |
| compliance-report.md | doc | repaso Reviewer |

## Integration
- Transversal; no cambia el flujo, endurece los bordes.
