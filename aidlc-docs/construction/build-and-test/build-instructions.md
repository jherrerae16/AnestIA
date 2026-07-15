# Build Instructions — AnestIA

## Prerequisites
- **Node.js** ≥ 20 (probado con v24). **npm** 11.
- **PostgreSQL 16** + extensión `pgvector` (instalación LTS local, sin contenedores).
- **Playwright Chromium** (se instala con `npx playwright install chromium`).
- **Env**: `.env` en la raíz (ver `.env.example`): `DATABASE_URL`, `SESSION_SECRET` (obligatorios); `AI_PROVIDER`/`STORAGE_PROVIDER`/`MAILER_PROVIDER`/`SHEETS_PROVIDER` (por defecto stub/local/stub/noop).

## Build Steps

### 1. Instalar dependencias
```bash
npm install
npx playwright install chromium
```

### 2. Configurar entorno
```bash
cp .env.example .env
# rellenar SESSION_SECRET:  openssl rand -base64 32
# crear BD + pgvector:
createdb anestia
psql -d anestia -c "CREATE EXTENSION IF NOT EXISTS vector;"
```

### 3. Migrar + sembrar
```bash
npx prisma migrate deploy      # aplica migraciones (init, delivery_token)
npx prisma generate
npm run seed                   # Luquetta + preset base (22 preguntas)
```

### 4. Build de todas las unidades
```bash
npx tsc -p packages/shared/tsconfig.json --noEmit   # shared (typecheck)
npm run build --workspace apps/api                   # Next.js (type-check estricto + build)
npm run build --workspace apps/web                   # Angular
```

### Verificación de build exitoso
- shared: `shared typecheck OK` (sin errores tsc).
- api: `✓ Compiled successfully` + `Generating static pages (11/11)`.
- web: `Application bundle generation complete`.

## Troubleshooting
- **`next build` falla con type error**: `next dev` es más laxo; el build de producción type-checkea estricto. Corregir el tipo señalado (ruta:línea en la salida).
- **Prisma migrate interactivo bloqueado**: en entornos no interactivos usar `prisma migrate deploy` (no `migrate dev`).
- **Playwright falla al renderizar**: correr `npx playwright install chromium`.
