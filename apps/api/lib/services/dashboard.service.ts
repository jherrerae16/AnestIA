import { prisma } from '../prisma';

/**
 * Lista de casos por estado + indicadores para el dashboard. [US-6.4]
 *
 * Cada "crear enlace" nace como un Case sin paciente, así que la tabla se llenaba de filas
 * en blanco por cada enlace que nadie abrió, y los contadores las sumaban. Los enlaces
 * pendientes se cuentan aparte (`enlacesPendientes`) en vez de mezclarse con los casos
 * reales; `includePendingLinks` los trae para la vista que los gestiona.
 */
export async function listCases(
  anesthesiologistId: string,
  status?: string,
  opts: { includePendingLinks?: boolean } = {},
) {
  const cases = await prisma.case.findMany({
    where: { anesthesiologistId, ...(status ? { status: status as never } : {}) },
    orderBy: { updatedAt: 'desc' },
    take: 100,
    include: {
      patient: { select: { fullName: true, documentId: true } },
      labResults: { where: { flag: { not: 'NORMAL' } }, select: { id: true } },
    },
  });

  // Un caso es "real" cuando el paciente ya respondió (hay paciente vinculado).
  const reales = cases.filter((c) => c.patientId != null);
  const pendientes = cases.filter((c) => c.patientId == null);

  const indicadores = {
    pendienteRevision: reales.filter((c) => c.status === 'PENDIENTE_REVISION').length,
    conAlertas: reales.filter((c) => c.labResults.length > 0).length,
    total: reales.length,
    enlacesPendientes: pendientes.length,
  };

  const visibles = opts.includePendingLinks ? cases : reales;

  return {
    cases: visibles.map((c) => ({
      id: c.id,
      status: c.status,
      procedure: c.procedure,
      procedureDate: c.procedureDate,
      patient: c.patient,
      alertas: c.labResults.length,
      esperandoPaciente: c.patientId == null,
      linkExpiresAt: c.linkExpiresAt,
    })),
    indicadores,
  };
}
