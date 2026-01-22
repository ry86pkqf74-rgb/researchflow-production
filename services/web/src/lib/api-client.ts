/**
 * API Client for ResearchFlow Canvas
 *
 * Lightweight fetch wrapper with error handling, authentication, and type safety.
 * Designed for basic CRUD operations with consistent error handling across the app.
 */

import {  parseAPIError, handleAPIError, createAPIError } from './error-handler';

/**
 * API client configuration
 */
interface APIClientConfig {
  baseURL: string;
  headers?: Record<string, string>;
  timeout?: number;
}

// Default configuration
const defaultConfig: APIClientConfig = {
  baseURL: typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3001',
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000, // 30 seconds
};

let config: APIClientConfig = { ...defaultConfig };

/**
 * Configure the API client
 */
export function configureAPI(newConfig: Partial<APIClientConfig>) {
  config = { ...config, ...newConfig };
}

/**
 * Get authentication token from storage
 */
function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null;

  // Prefer Zustand store state, fallback to localStorage
  try {
    const { useTokenStore } = require('@/hooks/use-auth');
    const storeToken = useTokenStore.getState().accessToken;
    if (storeToken) return storeToken;
  } catch (e) {
    // Fallback if import fails
  }

  // Fallback to localStorage
  const token = localStorage.getItem('auth_token');
  return token;
}

/**
 * Build full URL from endpoint
 */
function buildURL(endpoint: string): string {
  // Handle absolute URLs
  if (endpoint.startsWith('http://') || endpoint.startsWith('https://')) {
    return endpoint;
  }

  // Remove leading slash if present
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint.slice(1) : endpoint;

  // Combine base URL with endpoint
  const baseURL = config.baseURL.endsWith('/') ? config.baseURL.slice(0, -1) : config.baseURL;
  return `${baseURL}/${cleanEndpoint}`;
}

/**
 * Build request headers with auth token
 */
function buildHeaders(customHeaders?: Record<string, string>): Record<string, string> {
  const headers: Record<string, string> = {
    ...config.headers,
    ...customHeaders,
  };

  // Add auth token if available
  const token = getAuthToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  return headers;
}

/**
 * Core fetch wrapper with error handling
 */
async function fetchWithTimeout<T>(
  url: string,
  options: RequestInit
): Promise<T> {
  // Create abort controller for timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), config.timeout);

  try {
    // Make request
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    // Parse response body
    let body: any;
    const contentType = response.headers.get('content-type');

    if (contentType?.includes('application/json')) {
      body = await response.json();
    } else if (contentType?.includes('text/')) {
      body = await response.text();
    } else {
      // For binary data (blobs, files)
      body = await response.blob();
    }

    // Handle non-2xx responses
    if (!response.ok) {
      const apiError = parseAPIError(response, body);
      handleAPIError(apiError);
      throw new Error(apiError.message);
    }

    // Return successful response
    return body as T;
  } catch (error) {
    clearTimeout(timeoutId);

    // Handle abort/timeout
    if (error instanceof Error && error.name === 'AbortError') {
      const timeoutError = createAPIError(
        error,
        'Request timed out. Please check your connection and try again.'
      );
      timeoutError.code = 'TIMEOUT';
      handleAPIError(timeoutError);
      throw timeoutError;
    }

    // Handle network errors
    if (error instanceof TypeError) {
      const networkError = createAPIError(
        error,
        'Network error. Please check your connection and try again.'
      );
      networkError.code = 'NETWORK_ERROR';
      handleAPIError(networkError);
      throw networkError;
    }

    // Re-throw other errors (already handled by error handler above)
    throw error;
  }
}

/**
 * GET request
 */
export async function apiGet<T>(
  endpoint: string,
  options?: {
    headers?: Record<string, string>;
    params?: Record<string, string | number | boolean>;
  }
): Promise<T> {
  let url = buildURL(endpoint);

  // Add query parameters
  if (options?.params) {
    const params = new URLSearchParams();
    Object.entries(options.params).forEach(([key, value]) => {
      params.append(key, String(value));
    });
    url += `?${params.toString()}`;
  }

  return fetchWithTimeout<T>(url, {
    method: 'GET',
    headers: buildHeaders(options?.headers),
  });
}

/**
 * POST request
 */
export async function apiPost<T>(
  endpoint: string,
  data: unknown,
  options?: {
    headers?: Record<string, string>;
  }
): Promise<T> {
  const url = buildURL(endpoint);

  return fetchWithTimeout<T>(url, {
    method: 'POST',
    headers: buildHeaders(options?.headers),
    body: JSON.stringify(data),
  });
}

/**
 * PUT request
 */
export async function apiPut<T>(
  endpoint: string,
  data: unknown,
  options?: {
    headers?: Record<string, string>;
  }
): Promise<T> {
  const url = buildURL(endpoint);

  return fetchWithTimeout<T>(url, {
    method: 'PUT',
    headers: buildHeaders(options?.headers),
    body: JSON.stringify(data),
  });
}

/**
 * PATCH request
 */
export async function apiPatch<T>(
  endpoint: string,
  data: unknown,
  options?: {
    headers?: Record<string, string>;
  }
): Promise<T> {
  const url = buildURL(endpoint);

  return fetchWithTimeout<T>(url, {
    method: 'PATCH',
    headers: buildHeaders(options?.headers),
    body: JSON.stringify(data),
  });
}

/**
 * DELETE request
 */
export async function apiDelete<T>(
  endpoint: string,
  options?: {
    headers?: Record<string, string>;
  }
): Promise<T> {
  const url = buildURL(endpoint);

  return fetchWithTimeout<T>(url, {
    method: 'DELETE',
    headers: buildHeaders(options?.headers),
  });
}

/**
 * Upload file with multipart/form-data
 */
export async function apiUpload<T>(
  endpoint: string,
  file: File,
  additionalData?: Record<string, string>
): Promise<T> {
  const url = buildURL(endpoint);
  const formData = new FormData();

  formData.append('file', file);

  // Add additional fields
  if (additionalData) {
    Object.entries(additionalData).forEach(([key, value]) => {
      formData.append(key, value);
    });
  }

  // Note: Don't set Content-Type header for FormData - browser sets it automatically with boundary
  const headers = buildHeaders();
  delete headers['Content-Type'];

  return fetchWithTimeout<T>(url, {
    method: 'POST',
    headers,
    body: formData,
  });
}

/**
 * Download file as blob
 */
export async function apiDownload(
  endpoint: string,
  filename?: string
): Promise<Blob> {
  const url = buildURL(endpoint);

  const blob = await fetchWithTimeout<Blob>(url, {
    method: 'GET',
    headers: buildHeaders(),
  });

  // Trigger download if filename provided
  if (filename && typeof window !== 'undefined') {
    const downloadUrl = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(downloadUrl);
  }

  return blob;
}
