import { Router } from 'express';
import { createRequire } from 'node:module';
import { UserRole } from '@prisma/client';
import { writeRecognitionEventLog } from '../middleware/requestLogger';
import {
  buildRecognitionPrecheck,
  executeRecognitionWithRetry,
  mapProviderError,
} from '../services/recognitionExecutionService';
import { getProvider, listProviders } from '../services/providerService';
import { asyncHandler, fail, ok } from '../utils/http';
import { requireRole } from '../middleware/auth';

const require = createRequire(import.meta.url);
const multer = require('multer') as typeof import('multer');
const upload = multer({ limits: { fileSize: 20 * 1024 * 1024 } });
export const recognitionRouter = Router();

recognitionRouter.post(
  '/analyze',
  requireRole([UserRole.admin, UserRole.teacher]),
  upload.array('files', 50),
  asyncHandler(async (req, res) => {
    const requestId = (res.locals as any).requestId || null;
    const files = (req.files || []) as Express.Multer.File[];
    if (files.length === 0) return fail(res, 400, 'No files uploaded', 'NO_FILES');
    for (const file of files) {
      console.log(
        `[recognition][request=${requestId}] received file filename=${file.originalname} size=${file.size} mime=${file.mimetype}`,
      );
    }

    const selectedProvider = ((req.body.provider as string) || 'gemini') as 'gemini' | 'glm';
    let provider;
    try {
      provider = await getProvider(selectedProvider);
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
        operation: 'analyze',
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

    try {
      console.log(
        `[recognition][request=${requestId}] call provider provider=${provider.name} model=${provider.model} operation=analyze`,
      );
      const execResult = await executeRecognitionWithRetry({
        provider,
        operation: 'analyze',
        requestId,
        files: files.map((f) => ({
          mimeType: f.mimetype,
          dataBase64: f.buffer.toString('base64'),
          sizeBytes: f.size,
        })),
      });
      const result = execResult.result;
      console.log(
        `[recognition][request=${requestId}] provider returned status=200 preview=${JSON.stringify(result.raw || {}).slice(0, 200)}`,
      );
      console.log(
        `[recognition][request=${requestId}] parsed questions count=${result.questions.length}`,
      );
      await writeRecognitionEventLog(execResult.telemetry);

      return ok(res, { questions: result.questions, provider: provider.name, usage: result.usage });
    } catch (error: any) {
      const mapped = error?.mapped || mapProviderError(error);
      const telemetry = error?.telemetry || {
        requestId,
        operation: 'analyze',
        provider: provider.name,
        model: provider.model,
        success: false,
        errorCode: mapped.errorCode,
        errorCategory: mapped.category,
        upstreamStatus: mapped.upstreamStatus,
      };
      await writeRecognitionEventLog(telemetry);
      console.log(
        `[recognition][request=${requestId}] provider failed errorCode=${mapped.errorCode} upstreamStatus=${mapped.upstreamStatus || 'n/a'} message=${mapped.message.slice(0, 200)}`,
      );
      return fail(res, mapped.status, mapped.message, mapped.errorCode, {
        upstreamStatus: mapped.upstreamStatus,
        category: mapped.category,
      });
    }
  }),
);

recognitionRouter.post(
  '/parse-latex',
  requireRole([UserRole.admin, UserRole.teacher]),
  asyncHandler(async (req, res) => {
    const requestId = (res.locals as any).requestId || null;
    const latexCode = String(req.body.latexCode || '');
    if (!latexCode.trim()) return fail(res, 400, 'latexCode is required', 'LATEX_REQUIRED');

    const selectedProvider = ((req.body.provider as string) || 'gemini') as 'gemini' | 'glm';
    let provider;
    try {
      provider = await getProvider(selectedProvider);
    } catch (error: any) {
      const msg = error?.message || 'Provider is not available';
      return fail(res, 400, msg, 'PROVIDER_NOT_CONFIGURED');
    }

    try {
      const result = await provider.parseLatex(latexCode);
      return ok(res, { questions: result.questions, provider: provider.name, usage: result.usage });
    } catch (error: any) {
      const mapped = mapProviderError(error);
      await writeRecognitionEventLog({
        requestId,
        operation: 'parse_latex',
        provider: provider.name,
        model: provider.model,
        success: false,
        errorCode: mapped.errorCode,
        errorCategory: mapped.category,
        upstreamStatus: mapped.upstreamStatus,
      });
      return fail(res, mapped.status, mapped.message, mapped.errorCode, {
        upstreamStatus: mapped.upstreamStatus,
        category: mapped.category,
      });
    }
  }),
);
