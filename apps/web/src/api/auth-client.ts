export type UserRole = 'user' | 'admin';

export interface CurrentUser {
  id: string;
  email: string;
  role: UserRole;
  createdAt?: string;
}

export interface AccessSession {
  accessToken: string;
  tokenType: 'Bearer';
  expiresIn: number;
}

export interface LoginSession extends AccessSession {
  user: CurrentUser;
}

interface ErrorEnvelope {
  error?: {
    code?: unknown;
    message?: unknown;
  };
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    readonly retryAfterSeconds?: number,
  ) {
    super(code);
    this.name = 'ApiError';
  }
}

export const authClient = {
  register(email: string, password: string): Promise<CurrentUser> {
    return apiRequest<CurrentUser>('/api/v1/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  },

  login(email: string, password: string): Promise<LoginSession> {
    return apiRequest<LoginSession>('/api/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  },

  refresh(): Promise<AccessSession> {
    return apiRequest<AccessSession>('/api/v1/auth/refresh', { method: 'POST' });
  },

  me(accessToken: string): Promise<CurrentUser> {
    return apiRequest<CurrentUser>('/api/v1/auth/me', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
  },

  logout(): Promise<void> {
    return apiRequest<void>('/api/v1/auth/logout', { method: 'POST' });
  },
};

export async function apiRequest<T>(
  path: string,
  init: RequestInit,
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, {
      ...init,
      credentials: 'include',
      headers: {
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
        ...init.headers,
      },
    });
  } catch {
    throw new ApiError(0, 'NETWORK_UNAVAILABLE');
  }

  if (!response.ok) {
    throw await toApiError(response);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  try {
    return (await response.json()) as T;
  } catch {
    throw new ApiError(response.status, 'INVALID_RESPONSE');
  }
}

async function toApiError(response: Response): Promise<ApiError> {
  let envelope: ErrorEnvelope = {};
  try {
    envelope = (await response.json()) as ErrorEnvelope;
  } catch {
    // The UI intentionally ignores non-contract dependency details.
  }

  const code =
    typeof envelope.error?.code === 'string'
      ? envelope.error.code
      : 'REQUEST_FAILED';
  const retryAfter = response.headers.get('Retry-After');
  const parsedRetryAfter = retryAfter ? Number.parseInt(retryAfter, 10) : NaN;

  return new ApiError(
    response.status,
    code,
    Number.isFinite(parsedRetryAfter) && parsedRetryAfter > 0
      ? parsedRetryAfter
      : undefined,
  );
}
