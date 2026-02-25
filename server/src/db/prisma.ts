import { PrismaClient } from '@prisma/client';

let client: PrismaClient | null = null;

function getClient() {
  if (!client) {
    client = new PrismaClient();
  }
  return client;
}

// Lazy proxy to avoid blocking server bootstrap on Prisma engine load.
export const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop, receiver) {
    const value = Reflect.get(getClient() as unknown as object, prop, receiver);
    if (typeof value === 'function') {
      return value.bind(getClient());
    }
    return value;
  },
});
