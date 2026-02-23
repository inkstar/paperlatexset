import { ApiError } from './geminiService';
import { getAuthHeaders } from './authClient';

type LoginUser = {
  id: string;
  email: string;
  role: 'admin' | 'teacher' | 'viewer';
};

type LoginResult = {
  accessToken: string;
  user: LoginUser;
};

async function parseJson(res: Response) {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

async function post<T>(url: string, body: unknown, withAuth = false): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (withAuth) Object.assign(headers, getAuthHeaders());

  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });
  } catch {
    throw new ApiError('无法连接后端服务，请确认后端已启动（默认 3100 端口）。', { code: 'BACKEND_UNREACHABLE' });
  }

  const json = await parseJson(res);
  if (!res.ok || json?.error) {
    throw new ApiError(json?.error || 'Request failed', {
      code: json?.errorCode || `HTTP_${res.status}`,
      status: res.status,
      details: json?.details || null,
    });
  }
  return json.data as T;
}

export async function registerWithEmail(email: string, password: string, name?: string): Promise<LoginResult> {
  return post<LoginResult>('/api/auth/email/register', { email, password, name });
}

export async function loginWithEmail(email: string, password: string): Promise<LoginResult> {
  return post<LoginResult>('/api/auth/email/login', { email, password });
}

export async function requestLoginCode(input: { email?: string; phone?: string }): Promise<{
  sent: boolean;
  targetType: 'email' | 'phone';
  targetValue: string;
  debugCode?: string;
  expiresInSeconds: number;
}> {
  return post('/api/auth/code/request', input);
}

export async function loginWithCode(input: { email?: string; phone?: string; code: string }): Promise<LoginResult> {
  return post<LoginResult>('/api/auth/code/login', input);
}

export async function fetchWechatAuthorizeUrl(state?: string): Promise<{
  authorizeUrl: string;
  state: string;
  redirectUri: string;
}> {
  const qs = state ? `?state=${encodeURIComponent(state)}` : '';
  let res: Response;
  try {
    res = await fetch(`/api/auth/wechat/url${qs}`);
  } catch {
    throw new ApiError('无法连接后端服务，请确认后端已启动（默认 3100 端口）。', { code: 'BACKEND_UNREACHABLE' });
  }
  const json = await parseJson(res);
  if (!res.ok || json?.error) {
    throw new ApiError(json?.error || 'Request failed', {
      code: json?.errorCode || `HTTP_${res.status}`,
      status: res.status,
      details: json?.details || null,
    });
  }
  return json.data;
}

export async function fetchCurrentUser(): Promise<{ user: LoginUser; auth: { mode: string; reason: string } }> {
  let res: Response;
  try {
    res = await fetch('/api/v1/me', {
      headers: getAuthHeaders(),
    });
  } catch {
    throw new ApiError('无法连接后端服务，请确认后端已启动（默认 3100 端口）。', { code: 'BACKEND_UNREACHABLE' });
  }
  const json = await parseJson(res);
  if (!res.ok || json?.error) {
    throw new ApiError(json?.error || 'Request failed', {
      code: json?.errorCode || `HTTP_${res.status}`,
      status: res.status,
      details: json?.details || null,
    });
  }
  return json.data;
}

export type AuthCapabilities = {
  auth: { devFallbackEnabled: boolean };
  codeLogin: {
    debugEnabled: boolean;
    emailEnabled: boolean;
    phoneEnabled: boolean;
    webhookConfigured: boolean;
  };
  wechat: { configured: boolean };
  storage: { mode: 'minio' | 'local'; fallbackLocalEnabled: boolean; fallbackDir: string };
};

export async function fetchAuthCapabilities(): Promise<AuthCapabilities> {
  let res: Response;
  try {
    res = await fetch('/api/auth/capabilities');
  } catch {
    throw new ApiError('无法连接后端服务，请确认后端已启动（默认 3100 端口）。', { code: 'BACKEND_UNREACHABLE' });
  }
  const json = await parseJson(res);
  if (!res.ok || json?.error) {
    throw new ApiError(json?.error || 'Request failed', {
      code: json?.errorCode || `HTTP_${res.status}`,
      status: res.status,
      details: json?.details || null,
    });
  }
  return json.data;
}
