#!/usr/bin/env bash
#
# Respaldo CIFRADO de la base de datos.
#
# Un `pg_dump` es texto plano con el contenido de todas las tablas — incluida `Patient`, con
# nombres y documentos. Guardarlo sin cifrar dentro de la carpeta del proyecto significa que
# cualquier copia de esa carpeta (Time Machine, un zip, una carpeta sincronizada) se lleva la
# historia clínica. El camino fácil tiene que ser el seguro, o el día que haya prisa nadie se
# acuerda de cifrar.
#
#   ./scripts/respaldo.sh                 → .secrets/backups/anestia-AAAAMMDD-HHMM.dump.enc
#   ./scripts/restaurar.sh <archivo.enc>  → restaura ese respaldo
#
# La clave se pide por teclado (nunca por argumento: quedaría en el historial del shell) o se
# toma de BACKUP_PASSPHRASE si está definida.

set -euo pipefail

RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DESTINO="$RAIZ/.secrets/backups"

# La URL de conexión sale de .env, no se escribe aquí.
if [ -f "$RAIZ/.env" ]; then
  URL="$(grep -m1 '^DATABASE_URL=' "$RAIZ/.env" | cut -d= -f2- | tr -d '"' | tr -d "'")"
fi
URL="${URL:-${DATABASE_URL:-}}"
if [ -z "$URL" ]; then
  echo "✖ No hay DATABASE_URL (ni en .env ni en el entorno)." >&2
  exit 1
fi

if [ -n "${BACKUP_PASSPHRASE:-}" ]; then
  CLAVE="$BACKUP_PASSPHRASE"
else
  read -r -s -p "Clave para cifrar el respaldo: " CLAVE; echo
  read -r -s -p "Repítela: " CLAVE2; echo
  [ "$CLAVE" = "$CLAVE2" ] || { echo "✖ Las claves no coinciden." >&2; exit 1; }
fi
[ -n "$CLAVE" ] || { echo "✖ La clave no puede estar vacía." >&2; exit 1; }

mkdir -p "$DESTINO"
chmod 700 "$DESTINO"
ARCHIVO="$DESTINO/anestia-$(date +%Y%m%d-%H%M).dump.enc"

# La clave viaja por entorno, no por argumento: los argumentos son visibles en `ps` para
# cualquier proceso de la máquina mientras el comando corre.
export CLAVE_RESPALDO="$CLAVE"

# `pipefail` está activo: si pg_dump falla, no queda un .enc con basura dentro haciéndose pasar
# por un respaldo.
pg_dump "$URL" \
  | openssl enc -aes-256-cbc -pbkdf2 -iter 200000 -salt -pass env:CLAVE_RESPALDO \
  > "$ARCHIVO.parcial"
unset CLAVE_RESPALDO

# Se renombra al final: un archivo a medias no debe parecer un respaldo válido.
mv "$ARCHIVO.parcial" "$ARCHIVO"
chmod 600 "$ARCHIVO"

echo "✔ Respaldo cifrado: $ARCHIVO ($(du -h "$ARCHIVO" | cut -f1))"
echo "  Sin la clave no se puede restaurar. Guárdala donde guardas las demás."
