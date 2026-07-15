import { prisma } from '../prisma';

export function listContacts(ownerId: string) {
  return prisma.directoryContact.findMany({ where: { ownerId }, orderBy: { label: 'asc' } });
}

export function createContact(
  ownerId: string,
  data: { label: string; email: string; type: string; notes?: string },
) {
  return prisma.directoryContact.create({
    data: { ownerId, label: data.label, email: data.email, type: data.type as never, notes: data.notes ?? null },
  });
}
