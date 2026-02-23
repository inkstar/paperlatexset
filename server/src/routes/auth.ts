import { Router } from 'express';
import { UserRole } from '@prisma/client';
import { prisma } from '../db/prisma';
import { asyncHandler, fail, ok } from '../utils/http';
import { hashPassword, verifyPassword } from '../services/passwordService';
import { issueAccessToken } from '../services/tokenService';
import { deliverLoginCode, LoginCodeDeliveryError } from '../services/loginCodeDeliveryService';
import { env } from '../config/env';

type LoginCodeRecord = {
  code: string;
  expiresAt: number;
  targetType: 'email' | 'phone';
  targetValue: string;
};

const loginCodes = new Map<string, LoginCodeRecord>();
const LOGIN_CODE_TTL_MS = 5 * 60 * 1000;

export const authRouter = Router();

authRouter.post(
  '/email/register',
  asyncHandler(async (req, res) => {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const password = String(req.body?.password || '');
    const name = String(req.body?.name || '').trim();
    if (!email || !password) return fail(res, 400, 'email and password are required', 'AUTH_INPUT_REQUIRED');
    if (password.length < 8) return fail(res, 400, 'password must be at least 8 characters', 'AUTH_WEAK_PASSWORD');

    try {
      const exists = await prisma.user.findUnique({ where: { email } });
      if (exists) return fail(res, 409, 'email already exists', 'AUTH_EMAIL_EXISTS');

      const user = await prisma.user.create({
        data: {
          email,
          name: name || email.split('@')[0],
          password: hashPassword(password),
          role: UserRole.teacher,
        },
      });

      const accessToken = issueAccessToken({ userId: user.id, email: user.email, role: user.role });
      return ok(res, {
        accessToken,
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
        },
      });
    } catch (error: any) {
      return handleAuthDbError(res, error);
    }
  }),
);

authRouter.post(
  '/email/login',
  asyncHandler(async (req, res) => {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const password = String(req.body?.password || '');
    if (!email || !password) return fail(res, 400, 'email and password are required', 'AUTH_INPUT_REQUIRED');

    try {
      const user = await prisma.user.findUnique({ where: { email } });
      if (!user || !user.password) return fail(res, 401, 'invalid email or password', 'AUTH_LOGIN_FAILED');
      if (!verifyPassword(password, user.password)) return fail(res, 401, 'invalid email or password', 'AUTH_LOGIN_FAILED');
      if (!user.isActive) return fail(res, 403, 'user is disabled', 'AUTH_USER_DISABLED');

      const accessToken = issueAccessToken({ userId: user.id, email: user.email, role: user.role });
      return ok(res, {
        accessToken,
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
        },
      });
    } catch (error: any) {
      return handleAuthDbError(res, error);
    }
  }),
);

authRouter.post(
  '/code/request',
  asyncHandler(async (req, res) => {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const phone = String(req.body?.phone || '').trim();
    if (!email && !phone) return fail(res, 400, 'email or phone is required', 'AUTH_INPUT_REQUIRED');

    const targetType: 'email' | 'phone' = phone ? 'phone' : 'email';
    const targetValue = phone || email;
    const key = `${targetType}:${targetValue}`;
    const code = String(Math.floor(100000 + Math.random() * 900000));
    loginCodes.set(key, {
      code,
      expiresAt: Date.now() + LOGIN_CODE_TTL_MS,
      targetType,
      targetValue,
    });

    try {
      const delivery = await deliverLoginCode({
        targetType,
        targetValue,
        code,
        expiresInSeconds: Math.floor(LOGIN_CODE_TTL_MS / 1000),
      });
      return ok(res, {
        sent: delivery.delivered,
        targetType,
        targetValue,
        debugCode: delivery.debugCode,
        expiresInSeconds: Math.floor(LOGIN_CODE_TTL_MS / 1000),
      });
    } catch (error) {
      loginCodes.delete(key);
      if (error instanceof LoginCodeDeliveryError) {
        return fail(res, 503, error.message, error.code);
      }
      throw error;
    }

  }),
);

authRouter.post(
  '/code/login',
  asyncHandler(async (req, res) => {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const phone = String(req.body?.phone || '').trim();
    const code = String(req.body?.code || '').trim();
    if ((!email && !phone) || !code) return fail(res, 400, 'target and code are required', 'AUTH_INPUT_REQUIRED');

    const targetType: 'email' | 'phone' = phone ? 'phone' : 'email';
    const targetValue = phone || email;
    const key = `${targetType}:${targetValue}`;
    const record = loginCodes.get(key);
    if (!record || record.code !== code) return fail(res, 401, 'invalid code', 'AUTH_CODE_INVALID');
    if (Date.now() > record.expiresAt) return fail(res, 401, 'code expired', 'AUTH_CODE_EXPIRED');

    loginCodes.delete(key);

    try {
      const canonicalEmail = targetType === 'email' ? email : `phone_${phone}@phone.local`;
      let user = await prisma.user.findUnique({ where: { email: canonicalEmail } });
      if (!user) {
        user = await prisma.user.create({
          data: {
            email: canonicalEmail,
            name: targetType === 'email' ? canonicalEmail.split('@')[0] : `phone-${phone}`,
            role: UserRole.teacher,
          },
        });
      }
      if (!user.isActive) return fail(res, 403, 'user is disabled', 'AUTH_USER_DISABLED');

      const accessToken = issueAccessToken({ userId: user.id, email: user.email, role: user.role });
      return ok(res, {
        accessToken,
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
        },
        loginType: targetType,
      });
    } catch (error: any) {
      return handleAuthDbError(res, error);
    }
  }),
);

authRouter.get('/wechat/url', (req, res) => {
  if (!env.WECHAT_APP_ID || !env.WECHAT_APP_SECRET || !env.WECHAT_REDIRECT_URI) {
    return fail(
      res,
      501,
      'wechat login is not configured yet. please set WECHAT_APP_ID/WECHAT_APP_SECRET and callback route.',
      'AUTH_WECHAT_NOT_CONFIGURED',
    );
  }

  const state = String(req.query?.state || '').trim() || randomState();
  const redirectUri = encodeURIComponent(env.WECHAT_REDIRECT_URI);
  const authorizeUrl =
    `https://open.weixin.qq.com/connect/qrconnect?appid=${encodeURIComponent(env.WECHAT_APP_ID)}` +
    `&redirect_uri=${redirectUri}` +
    '&response_type=code' +
    '&scope=snsapi_login' +
    `&state=${encodeURIComponent(state)}#wechat_redirect`;

  return ok(res, {
    authorizeUrl,
    state,
    redirectUri: env.WECHAT_REDIRECT_URI,
  });
});

authRouter.post('/wechat/login', (_req, res) => {
  return fail(
    res,
    501,
    'wechat login is not configured yet. please implement code exchange with WeChat OAuth.',
    'AUTH_WECHAT_NOT_CONFIGURED',
  );
});

function handleAuthDbError(res: Parameters<typeof fail>[0], error: any) {
  const message = String(error?.message || '');
  if (message.includes("Can't reach database server")) {
    return fail(res, 503, 'database is unavailable. start PostgreSQL and retry.', 'AUTH_DB_UNAVAILABLE');
  }
  throw error;
}

function randomState() {
  return Math.random().toString(36).slice(2, 12);
}
