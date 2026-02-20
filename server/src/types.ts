import { UserRole } from '@prisma/client';

export type AuthUser = {
  id: string;
  role: UserRole;
  email?: string;
};

export type ApiEnvelope<T> = {
  data: T;
  meta?: Record<string, unknown>;
  error?: string | null;
};

export type QuestionNormalized = {
  number: string;
  content: string;
  knowledgePoint: string;
  type: string;
};
