import crypto from 'node:crypto';

const ITERATIONS = 120000;
const KEY_LENGTH = 32;
const DIGEST = 'sha256';

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, ITERATIONS, KEY_LENGTH, DIGEST).toString('hex');
  return `pbkdf2$${ITERATIONS}$${salt}$${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [algo, iter, salt, expected] = stored.split('$');
  if (algo !== 'pbkdf2' || !iter || !salt || !expected) return false;
  const hash = crypto.pbkdf2Sync(password, salt, Number(iter), KEY_LENGTH, DIGEST).toString('hex');
  const left = Buffer.from(hash, 'hex');
  const right = Buffer.from(expected, 'hex');
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}
