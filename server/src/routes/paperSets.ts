import { Router } from 'express';
import { execFile } from 'node:child_process';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { UserRole } from '@prisma/client';
import { prisma } from '../db/prisma';
import { requireRole } from '../middleware/auth';
import { buildLatex, buildWord } from '../services/exportService';
import type { ExportLatexOptions } from '../services/exportService';
import { ensureUser } from '../services/userService';
import { uploadBuffer } from '../services/storageService';
import { asyncHandler, fail, ok } from '../utils/http';

export const paperSetsRouter = Router();
const execFileAsync = promisify(execFile);

function toAttachmentHeader(filename: string): string {
  const fallback = filename.replace(/[^\x20-\x7E]+/g, '_').replace(/["\\]/g, '_');
  const encoded = encodeURIComponent(filename);
  return `attachment; filename="${fallback}"; filename*=UTF-8''${encoded}`;
}

function parseExportLatexOptions(input: any): ExportLatexOptions {
  const out: ExportLatexOptions = {};
  const isGap = (v: string) => /^(\d+(\.\d+)?)(cm|mm|pt|in)$/.test(v);

  if (typeof input?.headerTitle === 'string' && input.headerTitle.trim()) {
    out.headerTitle = input.headerTitle.trim();
  }
  if (typeof input?.choiceGap === 'string' && isGap(input.choiceGap.trim())) {
    out.choiceGap = input.choiceGap.trim();
  }
  if (typeof input?.solutionGap === 'string' && isGap(input.solutionGap.trim())) {
    out.solutionGap = input.solutionGap.trim();
  }
  if (typeof input?.lineSpacing === 'number' && input.lineSpacing >= 0.8 && input.lineSpacing <= 3) {
    out.lineSpacing = Number(input.lineSpacing);
  }

  return out;
}

async function tryArchiveExport(paperSetId: string, type: 'pdf' | 'latex' | 'word', payload: Buffer | string, mimeType: string) {
  try {
    const buffer = Buffer.isBuffer(payload) ? payload : Buffer.from(payload, 'utf-8');
    const ext = type === 'latex' ? 'tex' : type === 'word' ? 'docx' : 'pdf';
    const objectKey = `exports/${paperSetId}/${Date.now()}-paper.${ext}`;
    await uploadBuffer(objectKey, buffer, mimeType);
    await prisma.exportJob.create({
      data: {
        paperSetId,
        type,
        status: 'success',
        objectKey,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await prisma.exportJob.create({
      data: {
        paperSetId,
        type,
        status: 'failed',
        message: `archive skipped: ${message}`,
      },
    });
  }
}

paperSetsRouter.post(
  '/',
  requireRole([UserRole.admin, UserRole.teacher]),
  asyncHandler(async (req, res) => {
    const name = (req.body.name as string) || `组卷-${new Date().toISOString().slice(0, 10)}`;
    await ensureUser({ id: req.user!.id, email: req.user!.email, role: req.user!.role });
    const created = await prisma.paperSet.create({
      data: { name, createdBy: req.user!.id },
    });
    return ok(res, created);
  }),
);

paperSetsRouter.post(
  '/:id/items/batch-select',
  requireRole([UserRole.admin, UserRole.teacher]),
  asyncHandler(async (req, res) => {
    const paperSetId = req.params.id;
    const ids: string[] = Array.isArray(req.body.questionIds) ? req.body.questionIds : [];
    if (ids.length === 0) return fail(res, 400, 'questionIds is required');

    const existing = await prisma.paperSet.findUnique({ where: { id: paperSetId } });
    if (!existing) return fail(res, 404, 'Paper set not found');

    const questions = await prisma.question.findMany({
      where: { id: { in: ids } },
      include: { knowledgePoints: { include: { knowledgePoint: true } } },
    });

    const existingItems = await prisma.paperSetItem.findMany({ where: { paperSetId } });
    const startOrder = existingItems.length;

    const created = await prisma.$transaction(
      questions.map((q, idx) =>
        prisma.paperSetItem.upsert({
          where: {
            paperSetId_questionId: {
              paperSetId,
              questionId: q.id,
            },
          },
          create: {
            paperSetId,
            questionId: q.id,
            sortOrder: startOrder + idx,
            snapshot: {
              number: q.numberNormalized,
              content: q.stemLatex,
              type: q.questionType,
              source: q.sourceExam,
              knowledgePoints: q.knowledgePoints.map((k) => k.knowledgePoint.name),
            },
          },
          update: {},
        }),
      ),
    );

    return ok(res, created, { selected: created.length });
  }),
);

paperSetsRouter.post(
  '/:id/export-pdf',
  requireRole([UserRole.admin, UserRole.teacher, UserRole.viewer]),
  asyncHandler(async (req, res) => {
    const paperSetId = req.params.id;
    const paperSet = await prisma.paperSet.findUnique({
      where: { id: paperSetId },
      include: { items: { orderBy: { sortOrder: 'asc' } } },
    });
    if (!paperSet) return fail(res, 404, 'Paper set not found');

    const questions = paperSet.items.map((x: any) => x.snapshot as any);
    const latexOptions = parseExportLatexOptions(req.body || {});
    const latex = buildLatex(paperSet.name, questions, latexOptions);
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'paper-export-'));
    const texPath = path.join(tempDir, 'paper.tex');
    const outPath = path.join(tempDir, 'paper.pdf');
    await fs.writeFile(texPath, latex, 'utf-8');

    try {
      await execFileAsync('tectonic', ['paper.tex', '--outdir', tempDir], { cwd: tempDir });
    } catch {
      return fail(res, 501, 'PDF compiler is not available. Install tectonic on server.');
    }

    const pdfBuffer = await fs.readFile(outPath);
    await tryArchiveExport(paperSetId, 'pdf', pdfBuffer, 'application/pdf');

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', toAttachmentHeader(`${paperSet.name}.pdf`));
    return res.send(pdfBuffer);
  }),
);

paperSetsRouter.post(
  '/:id/export-latex',
  requireRole([UserRole.admin, UserRole.teacher, UserRole.viewer]),
  asyncHandler(async (req, res) => {
    const paperSetId = req.params.id;
    const paperSet = await prisma.paperSet.findUnique({
      where: { id: paperSetId },
      include: {
        items: { orderBy: { sortOrder: 'asc' } },
      },
    });
    if (!paperSet) return fail(res, 404, 'Paper set not found');

    const questions = paperSet.items.map((x: any) => x.snapshot as any);
    const latex = buildLatex(paperSet.name, questions);
    await tryArchiveExport(paperSetId, 'latex', latex, 'text/plain');

    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Content-Disposition', toAttachmentHeader(`${paperSet.name}.tex`));
    return res.send(latex);
  }),
);

paperSetsRouter.post(
  '/:id/export-word',
  requireRole([UserRole.admin, UserRole.teacher, UserRole.viewer]),
  asyncHandler(async (req, res) => {
    const paperSetId = req.params.id;
    const paperSet = await prisma.paperSet.findUnique({
      where: { id: paperSetId },
      include: {
        items: { orderBy: { sortOrder: 'asc' } },
      },
    });
    if (!paperSet) return fail(res, 404, 'Paper set not found');

    const questions = paperSet.items.map((x: any) => x.snapshot as any);
    const docBuffer = await buildWord(paperSet.name, questions);
    await tryArchiveExport(
      paperSetId,
      'word',
      docBuffer,
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    );

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', toAttachmentHeader(`${paperSet.name}.docx`));
    return res.send(docBuffer);
  }),
);
