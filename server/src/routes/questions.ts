import { Router } from 'express';
import { UserRole } from '@prisma/client';
import { prisma } from '../db/prisma';
import { requireRole } from '../middleware/auth';
import { ensureUser } from '../services/userService';
import { asyncHandler, fail, ok } from '../utils/http';

export const questionsRouter = Router();

questionsRouter.get(
  '/',
  requireRole([UserRole.admin, UserRole.teacher, UserRole.viewer]),
  asyncHandler(async (req, res) => {
    const page = Number(req.query.page || 1);
    const pageSize = Math.min(Number(req.query.pageSize || 20), 5000);
    const skip = (page - 1) * pageSize;

    const knowledgePoint = (req.query.knowledgePoint as string) || undefined;
    const questionType = (req.query.type as string) || undefined;
    const sourceExam = (req.query.sourceExam as string) || undefined;
    const sourceYear = req.query.sourceYear ? Number(req.query.sourceYear) : undefined;

    const where: any = {
      ...(questionType ? { questionType } : {}),
      ...(sourceExam ? { sourceExam: { contains: sourceExam } } : {}),
      ...(sourceYear ? { sourceYear } : {}),
      ...(knowledgePoint
        ? {
            knowledgePoints: {
              some: {
                knowledgePoint: {
                  name: { contains: knowledgePoint },
                },
              },
            },
          }
        : {}),
    };

    const [items, total] = await prisma.$transaction([
      prisma.question.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: [{ sourceYear: 'desc' }, { numberNormalized: 'asc' }],
        include: {
          knowledgePoints: { include: { knowledgePoint: true } },
          paper: true,
        },
      }),
      prisma.question.count({ where }),
    ]);

    return ok(
      res,
      items.map((q) => ({
        id: q.id,
        number: q.numberNormalized,
        numberRaw: q.numberRaw,
        content: q.stemLatex,
        stemText: q.stemText,
        knowledgePoints: q.knowledgePoints.map((kp) => kp.knowledgePoint.name),
        source: q.sourceExam || q.paper.title,
        type: q.questionType,
        reviewStatus: q.reviewStatus,
      })),
      {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    );
  }),
);

questionsRouter.patch(
  '/:id',
  requireRole([UserRole.admin, UserRole.teacher]),
  asyncHandler(async (req, res) => {
    const questionId = req.params.id;
    const payload = req.body || {};

    const existing = await prisma.question.findUnique({
      where: { id: questionId },
      include: { knowledgePoints: { include: { knowledgePoint: true } } },
    });
    if (!existing) return fail(res, 404, 'Question not found');

    await ensureUser({ id: req.user!.id, email: req.user!.email, role: req.user!.role });

    const nextKnowledgePoints: string[] = Array.isArray(payload.knowledgePoints)
      ? payload.knowledgePoints.filter(Boolean)
      : existing.knowledgePoints.map((k) => k.knowledgePoint.name);

    const updated = await prisma.$transaction(async (tx) => {
      const question = await tx.question.update({
        where: { id: questionId },
        data: {
          numberNormalized: payload.number ?? existing.numberNormalized,
          stemLatex: payload.content ?? existing.stemLatex,
          stemText:
            payload.stemText ??
            (payload.content ? String(payload.content).replace(/\$[^$]*\$/g, '').trim() : existing.stemText),
          questionType: payload.type ?? existing.questionType,
          sourceExam: payload.source ?? existing.sourceExam,
          reviewStatus: payload.reviewStatus ?? existing.reviewStatus,
        },
      });

      await tx.questionKnowledgePoint.deleteMany({ where: { questionId } });
      for (const point of nextKnowledgePoints) {
        const kp = await tx.knowledgePoint.upsert({
          where: { name_parentId: { name: point, parentId: null } },
          create: { name: point },
          update: {},
        });
        await tx.questionKnowledgePoint.create({
          data: { questionId, knowledgePointId: kp.id },
        });
      }

      await tx.qualityLog.create({
        data: {
          questionId,
          editedBy: req.user!.id,
          changedFields: {
            number: payload.number !== undefined,
            content: payload.content !== undefined,
            type: payload.type !== undefined,
            source: payload.source !== undefined,
            knowledgePoints: payload.knowledgePoints !== undefined,
          },
          beforeData: {
            number: existing.numberNormalized,
            content: existing.stemLatex,
            type: existing.questionType,
            source: existing.sourceExam,
            knowledgePoints: existing.knowledgePoints.map((k) => k.knowledgePoint.name),
          },
          afterData: {
            number: question.numberNormalized,
            content: question.stemLatex,
            type: question.questionType,
            source: question.sourceExam,
            knowledgePoints: nextKnowledgePoints,
          },
        },
      });

      return question;
    });

    return ok(res, updated);
  }),
);
