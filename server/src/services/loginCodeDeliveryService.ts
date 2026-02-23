import { env } from '../config/env';

export type LoginCodeTargetType = 'email' | 'phone';

type DeliveryInput = {
  targetType: LoginCodeTargetType;
  targetValue: string;
  code: string;
  expiresInSeconds: number;
};

type DeliveryResult = {
  delivered: boolean;
  debugCode?: string;
};

export class LoginCodeDeliveryError extends Error {
  code: string;

  constructor(message: string, code: string) {
    super(message);
    this.name = 'LoginCodeDeliveryError';
    this.code = code;
  }
}

export async function deliverLoginCode(input: DeliveryInput): Promise<DeliveryResult> {
  const { targetType } = input;
  if (targetType === 'email' && !env.AUTH_CODE_EMAIL_ENABLED && !env.AUTH_CODE_DEBUG) {
    throw new LoginCodeDeliveryError('email code channel is not configured', 'AUTH_EMAIL_NOT_CONFIGURED');
  }
  if (targetType === 'phone' && !env.AUTH_CODE_PHONE_ENABLED && !env.AUTH_CODE_DEBUG) {
    throw new LoginCodeDeliveryError('sms code channel is not configured', 'AUTH_SMS_NOT_CONFIGURED');
  }

  if (env.AUTH_CODE_WEBHOOK_URL) {
    try {
      const resp = await fetch(env.AUTH_CODE_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event: 'auth_code',
          targetType: input.targetType,
          targetValue: input.targetValue,
          code: input.code,
          expiresInSeconds: input.expiresInSeconds,
        }),
      });
      if (!resp.ok) {
        throw new LoginCodeDeliveryError('code webhook delivery failed', 'AUTH_CODE_DELIVERY_FAILED');
      }
    } catch {
      throw new LoginCodeDeliveryError('code webhook delivery failed', 'AUTH_CODE_DELIVERY_FAILED');
    }
  }

  return {
    delivered: true,
    debugCode: env.AUTH_CODE_DEBUG ? input.code : undefined,
  };
}
