#!/usr/bin/env bash
#
# Restaura un respaldo cifrado hecho por `respaldo.sh`.
#
#   ./scripts/restaurar.sh .secrets/backups/anestia-20260831-1420.dump.enc
#
# Restaurar SOBREESCRIBE la base de datos actual. Por eso pide confirmación escrita y nombra la
# base que va a pisar: un restore por error en la base equivocada no se deshace.

set -euo pipefail

ARCHIVO="${1:-}"
[ -n "$ARCHIVO" ] || { echo "Uso: ./scripts/restaurar.sh <archivo.dump.enc>" >&2; exit 1; }
[ -f "$ARCHIVO" ] || { echo "✖ No existe: $ARCHIVO" >&2; exit 1; }

RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
if [ -f "$RAIZ/.env" ]; then
  URL="$(grep -m1 '^DATABASE_URL=' "$RAIZ/.env" | cut -d= -f2- | tr -d '"' | tr -d "'")"
fi
URL="${URL:-${DATABASE_URL:-}}"
[ -n "$URL" ] || { echo "✖ No hay DATABASE_URL." >&2; exit 1; }

# Nombre de la base, para que la confirmación diga qué se va a pisar.
BASE="$(printf '%s' "$URL" | sed 's|.*/||; s|?.*||')"

echo "⚠ Esto SOBREESCRIBE la base '$BASE' con el contenido de:"
echo "  $ARCHIVO"
read -r -p "Escribe el nombre de la base para confirmar: " CONFIRMA
[ "$CONFIRMA" = "$BASE" ] || { echo "✖ No coincide. No se restauró nada."; exit 1; }

if [ -n "${BACKUP_PASSPHRASE:-}" ]; then
  CLAVE="$BACKUP_PASSPHRASE"
else
  read -r -s -p "Clave del respaldo: " CLAVE; echo
fi
export CLAVE_RESPALDO="$CLAVE"

openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 -pass env:CLAVE_RESPALDO -in "$ARCHIVO" \
  | psql "$URL" -v ON_ERROR_STOP=1 -q
unset CLAVE_RESPALDO

echo "✔ Restaurado sobre '$BASE'."
echo "  Corre \`npx prisma migrate deploy\` si el respaldo es de un esquema anterior."
