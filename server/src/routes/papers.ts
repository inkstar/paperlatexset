import { Router } from 'express';
import { createRequire } from 'node:module';
import { UserRole } from '@prisma/client';
import { prisma } from '../db/prisma';
import { writeRecognitionEventLog } from '../middleware/requestLogger';
import { requireRole } from '../middleware/auth';
import {
  buildRecognitionPrecheck,
  executeRecognitionWithRetry,
  mapProviderError,
} from '../services/recognitionExecutionService';
import { getProvider, estimateCost, listProviders } from '../services/providerService';
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
    const requestId = (res.locals as any).requestId || null;
    const paperId = req.params.id;
    const providerName = (req.body.provider as string) || 'gemini';

    const paper = await prisma.paper.findUnique({
      where: { id: paperId },
      include: { files: true },
    });
    if (!paper) return fail(res, 404, 'Paper not found');
    if (paper.files.length === 0) return fail(res, 400, 'Paper has no files');
    for (const f of paper.files) {
      console.log(
        `[paper-recognize][request=${requestId}] received file filename=${f.fileName} size=${f.size} mime=${f.mimeType}`,
      );
    }

    let provider;
    try {
      provider = await getProvider(providerName);
    } catch (error: any) {
      const msg = error?.message || 'Provider is not available';
      return fail(res, 400, msg, 'PROVIDER_NOT_CONFIGURED');
    }

    const providerMeta = listProviders().find((p) => p.name === provider.name);
    const precheck = buildRecognitionPrecheck({
      providerName: provider.name,
      model: provider.model,
      providerConfigured: Boolean(providerMeta?.enabled),
    });
    if (!precheck.ok) {
      await writeRecognitionEventLog({
        requestId,
        operation: 'paper_recognize',
        paperId,
        provider: provider.name,
        model: provider.model,
        precheckIssues: precheck.issues,
        success: false,
      });
      return fail(
        res,
        400,
        `Provider precheck failed: ${precheck.issues.join(', ')}`,
        'PROVIDER_PRECHECK_FAILED',
        { issues: precheck.issues },
      );
    }

    let success = false;
    let questionsSaved = 0;
    try {
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

      console.log(
        `[paper-recognize][request=${requestId}] call provider provider=${provider.name} model=${provider.model} operation=paper_recognize`,
      );
      const execResult = await executeRecognitionWithRetry({
        provider,
        operation: 'paper_recognize',
        requestId,
        files: files.map((f, idx) => ({
          mimeType: f.mimeType,
          dataBase64: f.dataBase64,
          sizeBytes: paper.files[idx]?.size || 0,
        })),
      });
      const result = execResult.result;
      console.log(
        `[paper-recognize][request=${requestId}] provider returned status=200 preview=${JSON.stringify(result.raw || {}).slice(0, 200)}`,
      );
      console.log(
        `[paper-recognize][request=${requestId}] parsed questions count=${result.questions.length}`,
      );
      const cost = estimateCost(provider.name, result.usage.inputTokens, result.usage.outputTokens);

      await prisma.question.deleteMany({ where: { paperId } });
      for (const q of result.questions) {
        const numberText = String(q.number || '').trim() || String(questionsSaved + 1);
        const contentText = String(q.content || '').trim();
        const question = await prisma.question.create({
          data: {
            paperId,
            numberRaw: numberText,
            numberNormalized: numberText,
            stemText: contentText.replace(/\$[^$]*\$/g, '').trim(),
            stemLatex: contentText,
            questionType: String(q.type || '其他').trim() || '其他',
            sourceExam: paper.sourceExam,
            sourceYear: paper.sourceYear,
          },
        });

        const kpName = String(q.knowledgePoint || '未分类').trim() || '未分类';
        const existingKp = await prisma.knowledgePoint.findFirst({
          where: { name: kpName, parentId: null },
        });
        const kp =
          existingKp ||
          (await prisma.knowledgePoint.create({
            data: { name: kpName },
          }));

        await prisma.questionKnowledgePoint.create({
          data: {
            questionId: question.id,
            knowledgePointId: kp.id,
          },
        });
        questionsSaved += 1;
      }

      await prisma.recognitionLog.create({
        data: {
          paperId,
          provider: provider.name,
          model: provider.model,
          inputTokens: result.usage.inputTokens,
          outputTokens: result.usage.outputTokens,
          latencyMs: result.usage.latencyMs || execResult.telemetry.durationMs,
          estimatedCost: cost,
          success: true,
        },
      });

      success = true;
      await writeRecognitionEventLog({
        ...execResult.telemetry,
        paperId,
        questionsSaved,
      });
      return ok(res, { paperId, questionsSaved, provider: provider.name });
    } catch (error: any) {
      if (String(error?.message || '').includes('STORAGE_UNAVAILABLE')) {
        return fail(res, 503, 'storage is unavailable. please check MinIO/S3 config.', 'STORAGE_UNAVAILABLE');
      }
      const isProviderPhaseError = Boolean(error?.mapped);
      const mapped = isProviderPhaseError
        ? error.mapped
        : {
            status: 500,
            errorCode: 'RECOGNIZE_PERSIST_FAILED' as const,
            category: 'unknown' as const,
            upstreamStatus: null,
            message: 'Recognition succeeded but persistence failed.',
            retryable: false,
          };
      const telemetry = error?.telemetry || {
        requestId,
        operation: 'paper_recognize',
        provider: provider.name,
        model: provider.model,
        success: false,
        errorCode: mapped.errorCode,
        errorCategory: mapped.category,
        upstreamStatus: mapped.upstreamStatus,
      };
      console.error(
        `[paper-recognize][request=${requestId}] fail phase=${isProviderPhaseError ? 'provider' : 'persist'} raw=${
          String(error?.message || error).slice(0, 300)
        }`,
      );
      await prisma.recognitionLog.create({
        data: {
          paperId,
          provider: provider.name,
          model: provider.model,
          inputTokens: 0,
          outputTokens: 0,
          latencyMs: telemetry.durationMs || 0,
          estimatedCost: 0,
          success,
          errorCode: mapped.errorCode,
        },
      });
      await writeRecognitionEventLog({
        ...telemetry,
        paperId,
      });
      console.log(
        `[paper-recognize][request=${requestId}] provider failed errorCode=${mapped.errorCode} upstreamStatus=${mapped.upstreamStatus || 'n/a'} message=${mapped.message.slice(0, 200)}`,
      );
      return fail(res, mapped.status, mapped.message, mapped.errorCode, {
        upstreamStatus: mapped.upstreamStatus,
        category: mapped.category,
      });
    }
  }),
);
