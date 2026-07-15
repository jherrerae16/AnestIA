import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { apiHandler } from '../../../../lib/errors';
import { requireSession } from '../../../../lib/auth/session-helper';
import { listContacts, createContact } from '../../../../lib/services/directory.service';

export const GET = apiHandler(async (req: NextRequest) => {
  const session = await requireSession(req);
  return NextResponse.json({ contacts: await listContacts(session.anesthesiologistId) });
});

const contactSchema = z.object({
  label: z.string().min(1).max(120),
  email: z.string().email().max(254),
  type: z.enum(['MEDICO', 'CLINICA', 'ASEGURADORA', 'PACIENTE', 'OTRO']),
  notes: z.string().max(500).optional(),
});

export const POST = apiHandler(async (req: NextRequest) => {
  const session = await requireSession(req);
  const data = contactSchema.parse(await req.json());
  const contact = await createContact(session.anesthesiologistId, data);
  return NextResponse.json({ contact }, { status: 201 });
});
