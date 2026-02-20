import { Router } from 'express';
import { UserRole } from '@prisma/client';
import { prisma } from '../db/prisma';
import { requireRole } from '../middleware/auth';
import { runDailyMetrics } from '../jobs/dailyMetricsJob';
import { asyncHandler, ok } from '../utils/http';

export const reportsRouter = Router();

reportsRouter.get(
  '/daily',
  requireRole([UserRole.admin, UserRole.teacher]),
  asyncHandler(async (req, res) => {
    const days = Number(req.query.days || 7);
    const start = new Date();
    start.setDate(start.getDate() - days);
    const rows = await prisma.dailyMetric.findMany({
      where: { date: { gte: start } },
      orderBy: [{ date: 'desc' }, { provider: 'asc' }, { model: 'asc' }],
    });
    return ok(res, rows);
  }),
);

reportsRouter.post(
  '/daily/rebuild',
  requireRole([UserRole.admin]),
  asyncHandler(async (_req, res) => {
    await runDailyMetrics();
    return ok(res, { rebuilt: true });
  }),
);
