# Secretos y credenciales

Estado auditado el **2026-08-30**, en respuesta al hallazgo C-5 de
`aidlc-docs/auditoria/reporte-auditoria-2026-07-20.md` ("`ANTHROPIC_API_KEY` en claro en `.env`").

## Qué se comprobó

| Comprobación | Resultado |
|---|---|
| ¿`.env` está versionado? | **No.** `git ls-files` no lo lista. |
| ¿Estuvo alguna vez en el historial? | **No.** `git log --all --diff-filter=A -- .env` no devuelve nada. |
| ¿Alguna clave con forma `sk-ant-` en algún objeto de git? | **No.** Barrido sobre `git rev-list --all`. |
| ¿`.secrets/` versionado? | **No**, cubierto por `.gitignore`. |

La clave nunca salió del disco local. El hallazgo era real pero su radio siempre fue local, y
esto ahora lo vigila un test (`apps/api/lib/secretos.guard.test.ts`) en vez de una revisión
manual: falla si alguien trackea un `.env`, versiona `.secrets/`, afloja `.gitignore` o deja una
clave con forma de secreto dentro de un archivo del repo.

## Qué se corrigió

- **Permisos.** `.env` estaba en `644` — legible por cualquier usuario de la máquina. Ahora `600`.
  `.secrets/` pasó a `700` y los respaldos de base de datos que contiene, a `600`: ese `.dump`
  tiene **datos de pacientes**, y era el archivo más sensible del directorio.
- **Redacción en logs.** El logger ya redactaba contraseñas, tokens y cookies; se añadieron
  `apiKey`, `x-api-key` y `headers.authorization`. La key no se loguea a propósito, pero un
  objeto de error del SDK puede arrastrar la cabecera de la petición.
- **Respaldos cifrados** (2026-08-31). `pg_dump` produce texto plano con el contenido de todas
  las tablas, incluida `Patient` con nombres y documentos; guardarlo así dentro de la carpeta del
  proyecto significa que cualquier copia de esa carpeta se lleva la historia clínica. Ahora
  `./scripts/respaldo.sh` cifra con AES-256 y clave por teclado, y `./scripts/restaurar.sh`
  descifra pidiendo confirmación del nombre de la base. Se borró el volcado del 29-ago, que
  además era anterior a la migración del diccionario y ya no se podía restaurar.
- **Google Sheets eliminado** (decisión del 2026-08-30). Con él se borró
  `.secrets/google-sheets-sa.json`, una credencial de service account que seguía viva en disco
  para una función que nunca se configuró.

## Rotar la `ANTHROPIC_API_KEY`

La rotación **la hace una persona**, no el sistema: requiere entrar a la consola con la cuenta
del titular. Pasos:

1. En <https://console.anthropic.com> → *API keys*, crear una clave nueva.
2. Reemplazar el valor en `.env` local (y en el gestor de secretos del entorno donde se
   despliegue; ver más abajo).
3. Reiniciar API y worker: `npm run dev` y `npm run worker`.
4. Verificar que el motor real responde antes de revocar la anterior — un caso de prueba
   completo, no sólo que arranque.
5. Revocar la clave vieja en la consola.

Conviene rotarla cuando: se comparta la máquina, se sospeche de una fuga, o al pasar de
desarrollo local a un entorno desplegado.

## Cuando esto salga de la máquina local

Hoy todo corre en local y `.env` es un mecanismo aceptable. En el momento en que haya un
despliegue:

- La key **no** viaja en un archivo del repositorio ni en la imagen: va en el gestor de secretos
  del proveedor (variables de entorno cifradas, Secret Manager, o equivalente).
- Los adjuntos de pacientes (`storage/`) y los respaldos dejan de vivir junto al código.
- Conviene una clave por entorno, para poder revocar una sin tumbar las demás.
