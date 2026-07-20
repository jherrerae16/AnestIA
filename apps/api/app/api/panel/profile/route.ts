import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { apiHandler } from '../../../../lib/errors';
import { requireSession } from '../../../../lib/auth/session-helper';
import { getProfile, updateProfile } from '../../../../lib/services/profile.service';

export const GET = apiHandler(async (req: NextRequest) => {
  const session = await requireSession(req);
  const profile = await getProfile(session.anesthesiologistId);
  return NextResponse.json({ profile });
});

const updateSchema = z.object({
  fullName: z.string().min(1).max(120).optional(),
  specialty: z.string().max(120).optional(),
  medicalRegistry: z.string().max(60).optional(),
  footerText: z.string().max(300).optional(),
  dailyReminderOptOut: z.boolean().optional(),
});

export const PATCH = apiHandler(async (req: NextRequest) => {
  const session = await requireSession(req);
  const data = updateSchema.parse(await req.json());
  const profile = await updateProfile(session.anesthesiologistId, data);
  return NextResponse.json({ profile });
});
