/**
 * API Client Base
 *
 * Core HTTP client with authentication, error handling,
 * and request/response interceptors.
 */

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';

export interface ApiError {
  error: string;
  code?: string;
  details?: any;
  status: number;
}

export interface ApiResponse<T> {
  data: T | null;
  error: ApiError | null;
}

/**
 * Get the auth token from storage
 */
function getAuthToken(): string | null {
  // Try localStorage first, then sessionStorage
  return localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token');
}

/**
 * Build request headers
 */
function buildHeaders(customHeaders?: Record<string, string>): Headers {
  const headers = new Headers({
    'Content-Type': 'application/json',
    ...customHeaders,
  });

  const token = getAuthToken();
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  return headers;
}

/**
 * Parse API response
 */
async function parseResponse<T>(response: Response): Promise<ApiResponse<T>> {
  let data: any = null;

  try {
    const text = await response.text();
    if (text) {
      data = JSON.parse(text);
    }
  } catch (e) {
    // Response is not JSON
  }

  if (!response.ok) {
    return {
      data: null,
      error: {
        error: data?.error || response.statusText || 'Request failed',
        code: data?.code,
        details: data?.details,
        status: response.status,
      },
    };
  }

  return { data, error: null };
}

/**
 * Core fetch wrapper with auth and error handling
 */
export async function apiFetch<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  const url = endpoint.startsWith('http')
    ? endpoint
    : `${API_BASE_URL}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;

  try {
    const response = await fetch(url, {
      ...options,
      headers: buildHeaders(options.headers as Record<string, string>),
    });

    return parseResponse<T>(response);
  } catch (error: any) {
    return {
      data: null,
      error: {
        error: error.message || 'Network error',
        code: 'NETWORK_ERROR',
        status: 0,
      },
    };
  }
}

/**
 * HTTP method helpers
 */
export const api = {
  get: <T>(endpoint: string, params?: Record<string, any>) => {
    const url = params
      ? `${endpoint}?${new URLSearchParams(params).toString()}`
      : endpoint;
    return apiFetch<T>(url, { method: 'GET' });
  },

  post: <T>(endpoint: string, body?: any) =>
    apiFetch<T>(endpoint, {
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    }),

  put: <T>(endpoint: string, body?: any) =>
    apiFetch<T>(endpoint, {
      method: 'PUT',
      body: body ? JSON.stringify(body) : undefined,
    }),

  patch: <T>(endpoint: string, body?: any) =>
    apiFetch<T>(endpoint, {
      method: 'PATCH',
      body: body ? JSON.stringify(body) : undefined,
    }),

  delete: <T>(endpoint: string) =>
    apiFetch<T>(endpoint, { method: 'DELETE' }),
};

export default api;
