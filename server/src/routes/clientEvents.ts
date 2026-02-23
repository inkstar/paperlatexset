import { Router } from 'express';
import { UserRole } from '@prisma/client';
import { requireRole } from '../middleware/auth';
import { writeClientEventLog } from '../middleware/requestLogger';
import { asyncHandler, ok } from '../utils/http';

export const clientEventsRouter = Router();

clientEventsRouter.post(
  '/open',
  requireRole([UserRole.admin, UserRole.teacher, UserRole.viewer]),
  asyncHandler(async (req, res) => {
    const payload = req.body && typeof req.body === 'object' ? req.body : {};

    await writeClientEventLog('page_open', {
      eventType: 'client_page_open',
      requestId: (res.locals as any).requestId || null,
      userId: req.user?.id || null,
      role: req.user?.role || null,
      userEmail: req.user?.email || null,
      authMode: req.authContext?.mode || null,
      authReason: req.authContext?.reason || null,
      ...payload,
    });

    return ok(res, { logged: true });
  }),
);
