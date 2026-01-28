// ============================================
// ResearchFlow API Client
// ============================================
// Centralized API client with authentication, retry logic, and mode headers

import { retryableFetch, DEFAULT_RETRY_CONFIG, RetryConfig } from './retry';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';

export interface ApiResponse<T> {
  data?: T;
  error?: { message: string; code?: string };
  status: number;
}

export interface ApiError {
  message: string;
  code?: string;
}

export interface ClientConfig {
  baseURL?: string;
  retryConfig?: Partial<RetryConfig>;
  timeout?: number;
}

class ApiClient {
  private baseURL: string;
  private retryConfig: RetryConfig;
  private timeout: number;

  constructor(config: ClientConfig = {}) {
    this.baseURL = config.baseURL || API_BASE;
    this.retryConfig = { ...DEFAULT_RETRY_CONFIG, ...config.retryConfig };
    this.timeout = config.timeout || 30000;
  }

  private getHeaders(): HeadersInit {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-App-Mode': typeof window !== 'undefined'
        ? localStorage.getItem('appMode') || 'demo'
        : 'demo',
    };

    const token = typeof window !== 'undefined' ? localStorage.getItem('authToken') : null;
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    return headers;
  }

  private createAbortController(timeoutMs: number): AbortController {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    // Clear timeout when request completes
    const originalSignal = controller.signal;
    if ('addEventListener' in originalSignal) {
      originalSignal.addEventListener('abort', () => clearTimeout(timeoutId));
    }

    return controller;
  }

  async request<T>(endpoint: string, options: RequestInit = {}, retry = true): Promise<ApiResponse<T>> {
    try {
      const controller = this.createAbortController(this.timeout);
      const url = `${this.baseURL}${endpoint}`;

      const fetchFn = async () => {
        const response = await (retry
          ? retryableFetch(url, {
              ...options,
              headers: { ...this.getHeaders(), ...options.headers },
              credentials: 'include',
              signal: controller.signal,
            }, this.retryConfig)
          : fetch(url, {
              ...options,
              headers: { ...this.getHeaders(), ...options.headers },
              credentials: 'include',
              signal: controller.signal,
            })
        );

        return response;
      };

      const response = await fetchFn();
      const data = await response.json().catch((): null => null);

      if (!response.ok) {
        // Handle authentication errors
        if (response.status === 401) {
          if (typeof window !== 'undefined') {
            const mode = localStorage.getItem('appMode');
            if (mode === 'live') {
              window.location.href = `/login?redirect=${encodeURIComponent(window.location.pathname)}`;
            }
          }
        }
        return {
          error: { message: data?.error || data?.message || `HTTP ${response.status}` },
          status: response.status
        };
      }

      return { data, status: response.status };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Network error';
      return { error: { message }, status: 0 };
    }
  }

  get<T>(endpoint: string, params?: Record<string, string | number | boolean | undefined>) {
    let qs = '';
    if (params) {
      const filteredParams = Object.entries(params)
        .filter(([_, v]) => v !== undefined && v !== null)
        .map(([k, v]) => [k, String(v)]);
      if (filteredParams.length > 0) {
        qs = '?' + new URLSearchParams(filteredParams).toString();
      }
    }
    return this.request<T>(`${endpoint}${qs}`, { method: 'GET' });
  }

  post<T>(endpoint: string, body?: unknown) {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined
    });
  }

  put<T>(endpoint: string, body?: unknown) {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: body ? JSON.stringify(body) : undefined
    });
  }

  patch<T>(endpoint: string, body?: unknown) {
    return this.request<T>(endpoint, {
      method: 'PATCH',
      body: body ? JSON.stringify(body) : undefined
    });
  }

  delete<T>(endpoint: string) {
    return this.request<T>(endpoint, { method: 'DELETE' });
  }

  setBaseURL(baseURL: string): void {
    this.baseURL = baseURL;
  }

  getBaseURL(): string {
    return this.baseURL;
  }

  setRetryConfig(config: Partial<RetryConfig>): void {
    this.retryConfig = { ...this.retryConfig, ...config };
  }

  getRetryConfig(): RetryConfig {
    return { ...this.retryConfig };
  }
}

export const apiClient = new ApiClient();
