import { UserRole } from '@prisma/client';
import { prisma } from '../db/prisma';

export async function ensureUser(params: { id: string; email?: string; role?: UserRole }) {
  const id = params.id;
  const email = params.email || `${id}@local.dev`;
  const role = params.role || UserRole.teacher;

  return prisma.user.upsert({
    where: { email },
    create: { id, email, name: email.split('@')[0], role },
    update: { role },
  });
}
