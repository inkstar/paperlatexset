import { Router } from 'express';
import { UserRole } from '@prisma/client';
import { requireRole } from '../middleware/auth';
import { getDefaultProviderName, listProviders, setDefaultProviderName } from '../services/providerService';
import { fail, ok } from '../utils/http';

export const providersRouter = Router();

providersRouter.get('/', requireRole([UserRole.admin, UserRole.teacher]), (_req, res) => {
  return ok(res, { providers: listProviders(), defaultProvider: getDefaultProviderName() });
});

providersRouter.patch('/', requireRole([UserRole.admin]), (req, res) => {
  const next = req.body?.provider;
  if (next !== 'gemini' && next !== 'glm') {
    return fail(res, 400, 'provider must be gemini or glm');
  }
  setDefaultProviderName(next);
  return ok(res, { defaultProvider: getDefaultProviderName() });
});
