import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { UserRole } from '@prisma/client';
import { env } from '../config/env';
import { AuthContext, AuthUser } from '../types';

declare module 'express-serve-static-core' {
  interface Request {
    user?: AuthUser;
    authContext?: AuthContext;
  }
}

export function authMiddleware(req: Request, _res: Response, next: NextFunction) {
  if (isPublicRoute(req.path)) {
    req.authContext = { mode: 'bearer', reason: 'public_route' };
    _res.setHeader('x-auth-mode', 'public');
    return next();
  }

  const token = req.headers.authorization?.replace('Bearer ', '');
  if (token) {
    try {
      if (env.SUPABASE_JWT_SECRET) {
        const payload = jwt.verify(token, env.SUPABASE_JWT_SECRET, {
          algorithms: ['HS256'],
          issuer: env.SUPABASE_JWT_ISSUER || undefined,
          audience: env.SUPABASE_JWT_AUDIENCE || undefined,
        }) as jwt.JwtPayload;
        req.user = mapJwtPayload(payload);
        req.authContext = { mode: 'bearer', reason: 'supabase_jwt' };
        _res.setHeader('x-auth-mode', 'bearer');
        return next();
      }

      const payload = jwt.verify(token, env.JWT_SECRET) as jwt.JwtPayload;
      req.user = mapJwtPayload(payload);
      req.authContext = { mode: 'bearer', reason: 'legacy_jwt' };
      _res.setHeader('x-auth-mode', 'bearer');
      return next();
    } catch (error: any) {
      if (!env.AUTH_DEV_FALLBACK) {
        req.authContext = { mode: 'bearer', reason: 'invalid_token' };
        _res.setHeader('x-auth-mode', 'bearer');
        return _res.status(401).json({
          data: null,
          error: 'Invalid bearer token',
          errorCode: 'AUTH_INVALID_TOKEN',
          details: error?.message ? { message: error.message } : null,
        });
      }
    }
  }

  if (!env.AUTH_DEV_FALLBACK) {
    req.authContext = { mode: 'bearer', reason: 'missing_token' };
    _res.setHeader('x-auth-mode', 'bearer');
    return _res.status(401).json({
      data: null,
      error: 'Missing bearer token',
      errorCode: 'AUTH_REQUIRED',
      details: null,
    });
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
  req.authContext = {
    mode: 'dev_fallback',
    reason: token ? 'fallback_after_invalid_token' : 'x_headers',
  };
  _res.setHeader('x-auth-mode', 'dev_fallback');
  next();
}

function isPublicRoute(path: string) {
  return (
    path === '/api/health' ||
    path === '/api/v1/health' ||
    path.startsWith('/api/auth/') ||
    path.startsWith('/api/v1/auth/')
  );
}

function mapJwtPayload(payload: jwt.JwtPayload): AuthUser {
  const roleByPath = getByPath(payload, env.SUPABASE_ROLE_CLAIM_PATH);
  const role =
    payload.role ||
    roleByPath ||
    (payload.app_metadata as Record<string, unknown> | undefined)?.role ||
    (payload.user_metadata as Record<string, unknown> | undefined)?.role ||
    UserRole.teacher;

  return {
    id: String(payload.sub || 'unknown-user'),
    role: normalizeRole(role),
    email: payload.email ? String(payload.email) : undefined,
  };
}

function normalizeRole(value: unknown): UserRole {
  if (value === UserRole.admin || value === UserRole.teacher || value === UserRole.viewer) {
    return value;
  }
  if (value === 'admin') return UserRole.admin;
  if (value === 'viewer') return UserRole.viewer;
  return UserRole.teacher;
}

export function requireRole(allowed: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user || !allowed.includes(req.user.role)) {
      return res.status(403).json({ data: null, error: 'Forbidden', errorCode: 'AUTH_FORBIDDEN' });
    }
    next();
  };
}

function getByPath(source: unknown, path: string): unknown {
  if (!source || typeof source !== 'object') return undefined;
  if (!path.trim()) return undefined;

  let current: any = source;
  for (const segment of path.split('.')) {
    if (!segment) continue;
    if (!current || typeof current !== 'object' || !(segment in current)) {
      return undefined;
    }
    current = current[segment];
  }
  return current;
}
