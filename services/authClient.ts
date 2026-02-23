export type DevAuthRole = 'admin' | 'teacher' | 'viewer';

export type AuthClientConfig = {
  role: DevAuthRole;
  bearerToken: string;
};

export const AUTH_ROLE_STORAGE_KEY = 'dev_auth_role_v1';
export const AUTH_BEARER_STORAGE_KEY = 'dev_auth_bearer_v1';

let currentConfig: AuthClientConfig = {
  role: 'teacher',
  bearerToken: '',
};

function sanitizeBearerToken(token: string) {
  const normalized = String(token || '').replace(/^Bearer\s+/i, '').trim();
  if (!normalized) return '';
  // Keep only visible ASCII token chars to avoid fetch header validation errors.
  if (!/^[A-Za-z0-9\-._~+/=]+$/.test(normalized)) return '';
  return normalized;
}

export function setAuthClientConfig(next: Partial<AuthClientConfig>) {
  currentConfig = {
    ...currentConfig,
    ...next,
    bearerToken: next.bearerToken !== undefined ? sanitizeBearerToken(next.bearerToken) : currentConfig.bearerToken,
  };
}

export function getAuthClientConfig(): AuthClientConfig {
  return currentConfig;
}

export function getAuthHeaders(): Record<string, string> {
  const token = sanitizeBearerToken(currentConfig.bearerToken);
  if (token) {
    return {
      Authorization: `Bearer ${token}`,
    };
  }

  return {
    'x-role': currentConfig.role,
    'x-user-id': `web-${currentConfig.role}`,
    'x-user-email': `web-${currentConfig.role}@example.com`,
  };
}
