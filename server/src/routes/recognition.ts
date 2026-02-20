import { Router } from 'express';
import multer from 'multer';
import { UserRole } from '@prisma/client';
import { getProvider } from '../services/providerService';
import { asyncHandler, fail, ok } from '../utils/http';
import { requireRole } from '../middleware/auth';

const upload = multer({ limits: { fileSize: 20 * 1024 * 1024 } });
export const recognitionRouter = Router();

recognitionRouter.post(
  '/analyze',
  requireRole([UserRole.admin, UserRole.teacher]),
  upload.array('files', 50),
  asyncHandler(async (req, res) => {
    const files = (req.files || []) as Express.Multer.File[];
    if (files.length === 0) return fail(res, 400, 'No files uploaded');
    const provider = getProvider((req.body.provider as string) || undefined);

    const result = await provider.recognizeFromFiles(
      files.map((f) => ({
        mimeType: f.mimetype,
        dataBase64: f.buffer.toString('base64'),
      })),
    );

    return ok(res, { questions: result.questions, provider: provider.name, usage: result.usage });
  }),
);

recognitionRouter.post(
  '/parse-latex',
  requireRole([UserRole.admin, UserRole.teacher]),
  asyncHandler(async (req, res) => {
    const latexCode = String(req.body.latexCode || '');
    if (!latexCode.trim()) return fail(res, 400, 'latexCode is required');
    const provider = getProvider((req.body.provider as string) || undefined);
    const result = await provider.parseLatex(latexCode);
    return ok(res, { questions: result.questions, provider: provider.name, usage: result.usage });
  }),
);
