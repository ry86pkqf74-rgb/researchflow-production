// ============================================
// ResearchFlow API Client
// ============================================
// Centralized API client with authentication and mode headers

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

class ApiClient {
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

  async request<T>(endpoint: string, options: RequestInit = {}): Promise<ApiResponse<T>> {
    try {
      const response = await fetch(`${API_BASE}${endpoint}`, {
        ...options,
        headers: { ...this.getHeaders(), ...options.headers },
        credentials: 'include',
      });

      const data = await response.json().catch(() => null);

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

  delete<T>(endpoint: string) {
    return this.request<T>(endpoint, { method: 'DELETE' });
  }
}

export const apiClient = new ApiClient();
