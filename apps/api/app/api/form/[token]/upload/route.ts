import { NextRequest, NextResponse } from 'next/server';
import { apiHandler } from '../../../../../lib/errors';
import { verifyCaseToken } from '../../../../../lib/auth/token';
import { prisma } from '../../../../../lib/prisma';
import { getStorageProvider } from '../../../../../lib/storage';
import { ALLOWED_MIME, MAX_FILE_BYTES, MAX_FILES_PER_CASE } from '@anestia/shared';

/**
 * POST /api/form/[token]/upload — carga de adjunto (multipart). Valida tipo/tamaño/cantidad
 * (SECURITY-05/09), guarda vía StorageProvider (local) y crea Attachment con hash.
 */
export const POST = apiHandler(async (req: NextRequest, ctx: { params: Promise<{ token: string }> }) => {
  const { token } = await ctx.params;
  const kase = await verifyCaseToken(token);
  if (!kase) return NextResponse.json({ error: 'Enlace inválido o expirado.' }, { status: 410 });

  const count = await prisma.attachment.count({ where: { caseId: kase.id } });
  if (count >= MAX_FILES_PER_CASE) {
    return NextResponse.json({ error: `Máximo ${MAX_FILES_PER_CASE} archivos por caso.` }, { status: 422 });
  }

  const formData = await req.formData();
  const file = formData.get('file');
  const typeField = String(formData.get('type') ?? 'OTRO');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'Falta el archivo.' }, { status: 400 });
  }
  if (file.size > MAX_FILE_BYTES) {
    return NextResponse.json({ error: 'Archivo demasiado grande (máx 15 MB).' }, { status: 422 });
  }
  if (!ALLOWED_MIME.includes(file.type as (typeof ALLOWED_MIME)[number])) {
    return NextResponse.json({ error: 'Tipo de archivo no permitido.' }, { status: 422 });
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const storage = getStorageProvider();
  const { key, hash } = await storage.put(bytes, { caseId: kase.id, type: typeField, filename: file.name });

  const attachmentType = ['HEMOGRAMA', 'COAGULACION', 'ECG', 'ECOCARDIOGRAMA', 'OTRO'].includes(typeField)
    ? typeField
    : 'OTRO';

  const attachment = await prisma.attachment.create({
    // Nombre, tipo y tamaño estaban a mano y se descartaban. Sin el nombre, la procedencia de
    // un laboratorio apunta a una clave de almacenamiento que no le dice nada al médico.
    data: {
      caseId: kase.id,
      type: attachmentType as never,
      url: key,
      fileHash: hash,
      filename: file.name || null,
      mimeType: file.type || null,
      sizeBytes: Number.isFinite(file.size) ? file.size : null,
    },
  });

  return NextResponse.json({ id: attachment.id, type: attachment.type }, { status: 201 });
});
