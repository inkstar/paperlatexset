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

export function setAuthClientConfig(next: Partial<AuthClientConfig>) {
  currentConfig = {
    ...currentConfig,
    ...next,
  };
}

export function getAuthClientConfig(): AuthClientConfig {
  return currentConfig;
}

export function getAuthHeaders(): Record<string, string> {
  const token = currentConfig.bearerToken.trim();
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
