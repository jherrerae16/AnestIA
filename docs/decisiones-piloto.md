# Decisiones del piloto

Decisiones de producto tomadas el **2026-08-30**. Cada una dice qué se hace, por qué, y qué la
volvería a abrir. Lo que sigue en el aire es únicamente el **Manual Clínico**, que depende de la
firma del Dr. Luquetta (`manual-clinico-decisiones.md`).

## 1 · Hosting — sigue local hasta que el Dr. valide

Postgres, la key en `.env`, los adjuntos en `storage/` y los respaldos en `.secrets/` viven en la
máquina de desarrollo. No se despliega nada hasta que el Manual Clínico esté firmado y el Dr.
haya usado el piloto con pacientes reales.

El motivo es de secuencia, no de pereza: mientras los puntos de corte de las ocho escalas puedan
cambiar, desplegar es mover un blanco. Y el despliegue no es un `deploy` — obliga a decidir dónde
vive la key, dónde viven los adjuntos de pacientes, cómo se respalda y cuánto se retiene.

**Qué cambia el día que se despliegue** (checklist, no tareas de ahora):

- La key sale de `.env` al gestor de secretos del proveedor; una clave por entorno.
- `storage/` sale del disco local a almacenamiento de objetos, fuera del repositorio.
- Los respaldos ya se hacen cifrados (`./scripts/respaldo.sh`, `./scripts/restaurar.sh`); en el
  despliegue hay que decidir además dónde se guardan y cuánto tiempo.
- Copias, retención y borrado: qué se guarda, cuánto tiempo, quién puede leerlo.
- Rotar la `ANTHROPIC_API_KEY` (procedimiento en `secretos.md`). Hoy no urge: se auditó y nunca
  salió del disco local.

**Reabre esta decisión:** que el Dr. quiera usarlo desde la clínica, o que entre un segundo
anestesiólogo que no trabaje en esta máquina.

## 2 · Firma del PDF — visual ahora, certificada antes de producción

Hoy el PDF lleva una imagen PNG de la firma del perfil. Para el piloto basta y ya funciona.

**No basta para producción.** Una imagen pegada no prueba quién firmó ni que el PDF no se alteró
después, y una valoración preanestésica firmada es un documento medicolegal. Queda como
**requisito de salida**: certificado digital del Dr. + firma PAdES, antes de que el documento se
use como respaldo legal frente a un tercero.

Mientras tanto, el respaldo es la firma manuscrita del Dr. sobre el impreso.

## 3 · Envío al paciente — manual, por el WhatsApp del Dr.

La plataforma genera el enlace tokenizado con botón de copiar; el Dr. lo manda por su propio
WhatsApp. Cero integración, cero costo, y el paciente recibe el mensaje de un número que
reconoce — que en esta población importa más que la automatización.

Descartado por ahora: la API de WhatsApp Business (cuenta de Meta, verificación del negocio,
plantillas aprobadas y costo por conversación: es un proyecto aparte) y el envío por correo
(el mailer ya existe, pero depende de que el paciente dé correo y lo revise).

**Reabre esta decisión:** que el volumen crezca hasta que copiar y pegar enlaces sea el cuello de
botella.

## 4 · Usuarios — alta manual, sin registro público

Quién puede firmar una valoración preanestésica es una decisión profesional, no un formulario.
No hay registro abierto: los perfiles los crea el dueño de la instalación.

```bash
npm run anestesiologo -- --email ana@clinica.co --nombre "Dra. Ana Restrepo"
```

Opcionales: `--especialidad`, `--registro` (registro médico del bloque de firma), `--password`
(si no se da, se genera y se imprime una vez).

El comando crea el perfil **y su propio cuestionario** con los 134 ítems de la Especificación. Un
perfil sin preset no puede crear casos, y esa falla aparecería mucho después, al intentar usarlo.
No pisa un perfil existente: cambiar la contraseña de alguien por escribir mal un correo es un
accidente caro y silencioso.

El aislamiento por perfil ya se respeta en cada consulta del panel, así que añadir médicos no
obliga a reescribir nada.

**Contraseñas** (resuelto el 2026-08-31, al abrir el alta manual):

- **Cambio desde el perfil**, exigiendo la actual. Sin eso, una sesión robada o un equipo
  desbloqueado bastan para quedarse con la cuenta.
- **Recuperación por correo**: enlace de un solo uso, válido una hora. De la base sólo se puede
  leer el **hash** del token, así que quien la lea no puede restablecer la contraseña de nadie.
- La respuesta es **la misma exista o no el correo**: decir "ese correo no está registrado"
  convertiría el formulario en un detector de qué anestesiólogos usan el sistema.
- **Cambiar la contraseña cierra las sesiones anteriores.** Sin esto, restablecer la contraseña
  de una cuenta comprometida no echaba a quien ya estaba dentro hasta que su cookie caducara
  sola, ocho horas después.

**Reabre esta decisión:** que el Dr. quiera invitar colegas sin pasar por él, o que esto deje de
ser un piloto de una clínica.
