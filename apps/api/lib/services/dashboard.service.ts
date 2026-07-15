import { prisma } from '../prisma';

/** Lista de casos por estado + indicadores para el dashboard. [US-6.4] */
export async function listCases(anesthesiologistId: string, status?: string) {
  const cases = await prisma.case.findMany({
    where: { anesthesiologistId, ...(status ? { status: status as never } : {}) },
    orderBy: { updatedAt: 'desc' },
    take: 100,
    include: {
      patient: { select: { fullName: true, documentId: true } },
      labResults: { where: { flag: { not: 'NORMAL' } }, select: { id: true } },
    },
  });

  const indicadores = {
    pendienteRevision: cases.filter((c) => c.status === 'PENDIENTE_REVISION').length,
    conAlertas: cases.filter((c) => c.labResults.length > 0).length,
    total: cases.length,
  };

  return {
    cases: cases.map((c) => ({
      id: c.id,
      status: c.status,
      procedure: c.procedure,
      procedureDate: c.procedureDate,
      patient: c.patient,
      alertas: c.labResults.length,
    })),
    indicadores,
  };
}
