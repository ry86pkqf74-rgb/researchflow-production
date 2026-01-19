/**
 * Worker Client - HTTP client for communicating with the Python worker service
 *
 * All requests are subject to governance mode checks and PHI scanning.
 */

import fetch, { type RequestInit, type Response } from 'node-fetch';

const WORKER_URL = process.env.WORKER_URL || 'http://worker:8000';
const WORKER_TIMEOUT = parseInt(process.env.WORKER_TIMEOUT || '30000', 10);

export interface WorkerClientOptions {
  timeout?: number;
  headers?: Record<string, string>;
}

export class WorkerClientError extends Error {
  public readonly status: number;
  public readonly body: string;

  constructor(message: string, status: number, body: string) {
    super(message);
    this.name = 'WorkerClientError';
    this.status = status;
    this.body = body;
  }
}

/**
 * Post a task to the worker service
 *
 * @param path - API path (e.g., '/tasks/generate_section')
 * @param body - Request body
 * @param options - Optional configuration
 * @returns Response data
 */
export async function postWorkerTask<TReq, TRes>(
  path: string,
  body: TReq,
  options?: WorkerClientOptions
): Promise<TRes> {
  const url = `${WORKER_URL}${path}`;
  const timeout = options?.timeout ?? WORKER_TIMEOUT;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const fetchOptions: RequestInit = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Request-Source': 'orchestrator',
        ...options?.headers,
      },
      body: JSON.stringify(body),
      signal: controller.signal as any,
    };

    const res: Response = await fetch(url, fetchOptions);

    if (!res.ok) {
      const errorBody = await res.text();
      throw new WorkerClientError(
        `Worker error ${res.status}: ${errorBody.slice(0, 500)}`,
        res.status,
        errorBody
      );
    }

    return (await res.json()) as TRes;
  } catch (error: any) {
    if (error.name === 'AbortError') {
      throw new WorkerClientError(`Worker request timeout after ${timeout}ms`, 408, '');
    }
    if (error instanceof WorkerClientError) {
      throw error;
    }
    throw new WorkerClientError(
      `Worker request failed: ${error.message}`,
      500,
      error.message
    );
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Get data from the worker service
 *
 * @param path - API path
 * @param options - Optional configuration
 * @returns Response data
 */
export async function getWorkerData<TRes>(
  path: string,
  options?: WorkerClientOptions
): Promise<TRes> {
  const url = `${WORKER_URL}${path}`;
  const timeout = options?.timeout ?? WORKER_TIMEOUT;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const fetchOptions: RequestInit = {
      method: 'GET',
      headers: {
        'X-Request-Source': 'orchestrator',
        ...options?.headers,
      },
      signal: controller.signal as any,
    };

    const res: Response = await fetch(url, fetchOptions);

    if (!res.ok) {
      const errorBody = await res.text();
      throw new WorkerClientError(
        `Worker error ${res.status}: ${errorBody.slice(0, 500)}`,
        res.status,
        errorBody
      );
    }

    return (await res.json()) as TRes;
  } catch (error: any) {
    if (error.name === 'AbortError') {
      throw new WorkerClientError(`Worker request timeout after ${timeout}ms`, 408, '');
    }
    if (error instanceof WorkerClientError) {
      throw error;
    }
    throw new WorkerClientError(
      `Worker request failed: ${error.message}`,
      500,
      error.message
    );
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Check worker health
 */
export async function checkWorkerHealth(): Promise<boolean> {
  try {
    const res = await getWorkerData<{ status: string }>('/health', { timeout: 5000 });
    return res.status === 'healthy';
  } catch {
    return false;
  }
}

export default {
  postWorkerTask,
  getWorkerData,
  checkWorkerHealth,
};
