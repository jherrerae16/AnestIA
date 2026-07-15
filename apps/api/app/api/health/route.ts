import { NextResponse } from 'next/server';
import { apiHandler } from '../../../lib/errors';
import { prisma } from '../../../lib/prisma';

/** Health check: verifica que la app y la BD respondan. */
export const GET = apiHandler(async () => {
  await prisma.$queryRaw`SELECT 1`;
  return NextResponse.json({ status: 'ok', service: 'anestia-api' });
});
