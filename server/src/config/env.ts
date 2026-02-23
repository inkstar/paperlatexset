import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  PORT: z.coerce.number().default(3100),
  JWT_SECRET: z.string().default('dev-secret'),
  AUTH_DEV_FALLBACK: z.string().default('true').transform((v) => v === 'true'),
  SUPABASE_JWT_SECRET: z.string().optional(),
  SUPABASE_JWT_ISSUER: z.string().optional(),
  SUPABASE_JWT_AUDIENCE: z.string().optional(),
  SUPABASE_ROLE_CLAIM_PATH: z.string().default('app_metadata.role'),
  WECHAT_APP_ID: z.string().optional(),
  WECHAT_APP_SECRET: z.string().optional(),
  WECHAT_REDIRECT_URI: z.string().optional(),
  AUTH_CODE_DEBUG: z.string().default('true').transform((v) => v === 'true'),
  AUTH_CODE_WEBHOOK_URL: z.string().optional(),
  AUTH_CODE_EMAIL_ENABLED: z.string().default('false').transform((v) => v === 'true'),
  AUTH_CODE_PHONE_ENABLED: z.string().default('false').transform((v) => v === 'true'),
  DATABASE_URL: z.string().min(1),
  MINIO_ENDPOINT: z.string().default('127.0.0.1'),
  MINIO_PORT: z.coerce.number().default(9000),
  MINIO_USE_SSL: z.string().default('false').transform((v) => v === 'true'),
  MINIO_ACCESS_KEY: z.string().min(1),
  MINIO_SECRET_KEY: z.string().min(1),
  MINIO_BUCKET: z.string().default('paper-assets'),
  DEFAULT_PROVIDER: z.enum(['gemini', 'glm']).default('gemini'),
  GEMINI_API_KEY: z.string().optional(),
  GLM_API_KEY: z.string().optional(),
  GLM_BASE_URL: z.string().default('https://open.bigmodel.cn/api/paas/v4'),
  GEMINI_INPUT_PRICE: z.coerce.number().default(2.16),
  GEMINI_OUTPUT_PRICE: z.coerce.number().default(18),
  GLM_INPUT_PRICE: z.coerce.number().default(4),
  GLM_OUTPUT_PRICE: z.coerce.number().default(18),
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  console.error(parsed.error.flatten().fieldErrors);
  throw new Error('Invalid server environment variables');
}

export const env = parsed.data;
