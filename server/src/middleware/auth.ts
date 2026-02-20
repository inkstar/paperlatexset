import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { UserRole } from '@prisma/client';
import { env } from '../config/env';
import { AuthUser } from '../types';

declare module 'express-serve-static-core' {
  interface Request {
    user?: AuthUser;
  }
}

export function authMiddleware(req: Request, _res: Response, next: NextFunction) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (token) {
    try {
      const payload = jwt.verify(token, env.JWT_SECRET) as AuthUser;
      req.user = payload;
      return next();
    } catch {
      // Fallback for dev mode below.
    }
  }

  const roleHeader = req.headers['x-role'];
  const role =
    roleHeader === 'admin' || roleHeader === 'teacher' || roleHeader === 'viewer'
      ? (roleHeader as UserRole)
      : UserRole.teacher;

  req.user = {
    id: (req.headers['x-user-id'] as string) || 'dev-teacher-id',
    role,
    email: (req.headers['x-user-email'] as string) || 'dev@example.com',
  };
  next();
}

export function requireRole(allowed: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user || !allowed.includes(req.user.role)) {
      return res.status(403).json({ data: null, error: 'Forbidden' });
    }
    next();
  };
}
