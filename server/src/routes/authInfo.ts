import { Router } from 'express';
import { UserRole } from '@prisma/client';
import { requireRole } from '../middleware/auth';
import { asyncHandler, ok } from '../utils/http';

export const authInfoRouter = Router();

authInfoRouter.get(
  '/me',
  requireRole([UserRole.admin, UserRole.teacher, UserRole.viewer]),
  asyncHandler(async (req, res) => {
    return ok(res, { user: req.user || null, auth: req.authContext || null });
  }),
);
