import { Router } from 'express';
import { createRequire } from 'node:module';
import { UserRole } from '@prisma/client';
import { prisma } from '../db/prisma';
import { requireRole } from '../middleware/auth';
import { getProvider, estimateCost } from '../services/providerService';
import { ensureUser } from '../services/userService';
import { ensureBucket, getObjectBuffer, uploadBuffer } from '../services/storageService';
import { asyncHandler, fail, ok } from '../utils/http';

const require = createRequire(import.meta.url);
const multer = require('multer') as typeof import('multer');
const upload = multer({ limits: { fileSize: 20 * 1024 * 1024 } });
export const papersRouter = Router();

papersRouter.post(
  '/upload',
  requireRole([UserRole.admin, UserRole.teacher]),
  upload.array('files', 50),
  asyncHandler(async (req, res) => {
    const files = (req.files || []) as Express.Multer.File[];
    if (files.length === 0) return fail(res, 400, 'No files uploaded');

    try {
      await ensureBucket();
    } catch (error) {
      return fail(res, 503, 'storage is unavailable. please check MinIO/S3 config.', 'STORAGE_UNAVAILABLE');
    }
    await ensureUser({ id: req.user!.id, email: req.user!.email, role: req.user!.role });

    const title = (req.body.title as string) || `试卷-${new Date().toISOString().slice(0, 10)}`;
    const sourceExam = (req.body.sourceExam as string) || null;
    const sourceYear = req.body.sourceYear ? Number(req.body.sourceYear) : null;

    const paper = await prisma.paper.create({
      data: {
        title,
        sourceExam,
        sourceYear,
        uploadedBy: req.user!.id,
      },
    });

    const fileRows = [];
    for (const file of files) {
      const objectKey = `papers/${paper.id}/${Date.now()}-${file.originalname}`;
      try {
        await uploadBuffer(objectKey, file.buffer, file.mimetype);
      } catch {
        return fail(res, 503, 'storage is unavailable. please check MinIO/S3 config.', 'STORAGE_UNAVAILABLE');
      }
      const row = await prisma.paperFile.create({
        data: {
          paperId: paper.id,
          objectKey,
          fileName: file.originalname,
          mimeType: file.mimetype,
          size: file.size,
        },
      });
      fileRows.push(row);
    }

    return ok(res, { paper, files: fileRows });
  }),
);

papersRouter.post(
  '/:id/recognize',
  requireRole([UserRole.admin, UserRole.teacher]),
  asyncHandler(async (req, res) => {
    const paperId = req.params.id;
    const providerName = (req.body.provider as string) || undefined;

    const paper = await prisma.paper.findUnique({
      where: { id: paperId },
      include: { files: true },
    });
    if (!paper) return fail(res, 404, 'Paper not found');
    if (paper.files.length === 0) return fail(res, 400, 'Paper has no files');

    let provider;
    try {
      provider = await getProvider(providerName);
    } catch (error: any) {
      const msg = error?.message || 'Provider is not available';
      return fail(res, 400, msg, 'PROVIDER_NOT_CONFIGURED');
    }
    const files = await Promise.all(
      paper.files.map(async (f) => {
        let buffer: Buffer;
        try {
          buffer = await getObjectBuffer(f.objectKey);
        } catch {
          throw new Error('STORAGE_UNAVAILABLE');
        }
        return {
          mimeType: f.mimeType,
          dataBase64: buffer.toString('base64'),
        };
      }),
    );

    let success = false;
    let errorCode: string | null = null;
    let questionsSaved = 0;
    const start = Date.now();
    try {
      const result = await provider.recognizeFromFiles(files);
      const cost = estimateCost(provider.name, result.usage.inputTokens, result.usage.outputTokens);

      await prisma.$transaction(async (tx) => {
        await tx.question.deleteMany({ where: { paperId } });
        for (const q of result.questions) {
          const question = await tx.question.create({
            data: {
              paperId,
              numberRaw: q.number,
              numberNormalized: q.number,
              stemText: q.content.replace(/\$[^$]*\$/g, '').trim(),
              stemLatex: q.content,
              questionType: q.type,
              sourceExam: paper.sourceExam,
              sourceYear: paper.sourceYear,
            },
          });

          const kpName = q.knowledgePoint || '未分类';
          const existingKp = await tx.knowledgePoint.findFirst({
            where: { name: kpName, parentId: null },
          });
          const kp =
            existingKp ||
            (await tx.knowledgePoint.create({
              data: { name: kpName },
            }));

          await tx.questionKnowledgePoint.create({
            data: {
              questionId: question.id,
              knowledgePointId: kp.id,
            },
          });
          questionsSaved += 1;
        }

        await tx.recognitionLog.create({
          data: {
            paperId,
            provider: provider.name,
            model: provider.model,
            inputTokens: result.usage.inputTokens,
            outputTokens: result.usage.outputTokens,
            latencyMs: result.usage.latencyMs || Date.now() - start,
            estimatedCost: cost,
            success: true,
          },
        });
      });

      success = true;
      return ok(res, { paperId, questionsSaved, provider: provider.name });
    } catch (error: any) {
      errorCode = error?.message || 'recognize_failed';
      if (errorCode === 'STORAGE_UNAVAILABLE') {
        return fail(res, 503, 'storage is unavailable. please check MinIO/S3 config.', 'STORAGE_UNAVAILABLE');
      }
      await prisma.recognitionLog.create({
        data: {
          paperId,
          provider: provider.name,
          model: provider.model,
          inputTokens: 0,
          outputTokens: 0,
          latencyMs: Date.now() - start,
          estimatedCost: 0,
          success,
          errorCode,
        },
      });
      return fail(res, 500, errorCode);
    }
  }),
);
