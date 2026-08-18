export const API_BASE_URL = (process.env.NEXT_PUBLIC_API_BASE_URL ?? '').replace(/\/+$/, '');

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

interface ApiErrorBody {
  detail?: string | { msg?: string }[];
  message?: string;
}

export async function apiFetch<T = unknown>(
  endpoint: string,
  options: RequestInit = {},
  token?: string
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> | undefined),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const response = await fetch(`${API_BASE_URL}${cleanEndpoint}`, { ...options, headers });

  if (!response.ok) {
    const err: ApiErrorBody = await response.json().catch(() => ({ detail: 'An error occurred' }));
    let msg = 'API request failed';
    if (typeof err.detail === 'string') {
      msg = err.detail;
    } else if (Array.isArray(err.detail) && err.detail.length > 0) {
      msg = err.detail.map((e) => e.msg || JSON.stringify(e)).join(', ');
    } else if (err.message) {
      msg = err.message;
    }
    throw new ApiError(msg, response.status);
  }

  return response.json();
}
