import jwt from 'jsonwebtoken';
import { UserRole } from '@prisma/client';
import { env } from '../config/env';

export function issueAccessToken(input: { userId: string; email: string; role: UserRole }) {
  return jwt.sign(
    {
      sub: input.userId,
      email: input.email,
      role: input.role,
      app_metadata: { role: input.role },
    },
    env.JWT_SECRET,
    { algorithm: 'HS256', expiresIn: '7d' },
  );
}
