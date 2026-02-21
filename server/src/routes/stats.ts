import { Router } from 'express';
import { UserRole } from '@prisma/client';
import { prisma } from '../db/prisma';
import { requireRole } from '../middleware/auth';
import { asyncHandler, ok } from '../utils/http';

export const statsRouter = Router();

statsRouter.get(
  '/',
  requireRole([UserRole.admin, UserRole.teacher, UserRole.viewer]),
  asyncHandler(async (_req, res) => {
    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const [totalPapers, totalQuestions, totalRecognitions24h, successRecognitions24h] = await prisma.$transaction([
      prisma.paper.count(),
      prisma.question.count(),
      prisma.recognitionLog.count({ where: { createdAt: { gte: dayAgo } } }),
      prisma.recognitionLog.count({
        where: {
          createdAt: { gte: dayAgo },
          success: true,
        },
      }),
    ]);

    return ok(res, {
      totalPapers,
      totalQuestions,
      recognition24h: {
        total: totalRecognitions24h,
        success: successRecognitions24h,
        failed: totalRecognitions24h - successRecognitions24h,
        successRate: totalRecognitions24h === 0 ? 0 : Number((successRecognitions24h / totalRecognitions24h).toFixed(4)),
      },
    });
  }),
);
