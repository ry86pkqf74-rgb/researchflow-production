/**
 * Fail-Closed Wrapper Utility
 * 
 * Wraps external API calls with safe fallbacks to ensure the system
 * fails gracefully without crashing. All external operations must
 * use this wrapper to maintain system stability.
 */

export interface FailClosedOptions {
  operationName: string;
  timeout?: number;
  retries?: number;
  retryDelay?: number;
  logError?: boolean;
}

export interface FailClosedResult<T> {
  success: boolean;
  data: T;
  error?: Error;
  retriesUsed?: number;
}

/**
 * Wraps an async operation with fail-closed behavior.
 * Returns fallback value on failure instead of throwing.
 * 
 * @param operation - The async operation to execute
 * @param fallback - The fallback value to return on failure
 * @param options - Configuration options
 * @returns The operation result or fallback value
 */
export async function failClosedWrapper<T>(
  operation: () => Promise<T>,
  fallback: T,
  options: FailClosedOptions
): Promise<T> {
  const { operationName, timeout = 30000, retries = 0, retryDelay = 1000, logError = true } = options;
  
  let lastError: Error | undefined;
  let attempts = 0;
  
  while (attempts <= retries) {
    try {
      const result = await Promise.race([
        operation(),
        new Promise<never>((_, reject) => 
          setTimeout(() => reject(new Error(`Operation timed out after ${timeout}ms`)), timeout)
        )
      ]);
      
      return result;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      attempts++;
      
      if (logError) {
        console.error(
          `[FAIL-CLOSED] ${operationName} failed (attempt ${attempts}/${retries + 1}):`,
          lastError.message
        );
      }
      
      if (attempts <= retries) {
        await new Promise(resolve => setTimeout(resolve, retryDelay));
      }
    }
  }
  
  if (logError) {
    console.error(`[FAIL-CLOSED] ${operationName} exhausted all retries, returning fallback`);
  }
  
  return fallback;
}

/**
 * Wraps an async operation with fail-closed behavior and returns detailed result.
 * Use this when you need to know whether the operation succeeded or failed.
 * 
 * @param operation - The async operation to execute
 * @param fallback - The fallback value to return on failure
 * @param options - Configuration options
 * @returns Object with success status, data, and error info
 */
export async function failClosedWrapperWithStatus<T>(
  operation: () => Promise<T>,
  fallback: T,
  options: FailClosedOptions
): Promise<FailClosedResult<T>> {
  const { operationName, timeout = 30000, retries = 0, retryDelay = 1000, logError = true } = options;
  
  let lastError: Error | undefined;
  let attempts = 0;
  
  while (attempts <= retries) {
    try {
      const result = await Promise.race([
        operation(),
        new Promise<never>((_, reject) => 
          setTimeout(() => reject(new Error(`Operation timed out after ${timeout}ms`)), timeout)
        )
      ]);
      
      return {
        success: true,
        data: result,
        retriesUsed: attempts
      };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      attempts++;
      
      if (logError) {
        console.error(
          `[FAIL-CLOSED] ${operationName} failed (attempt ${attempts}/${retries + 1}):`,
          lastError.message
        );
      }
      
      if (attempts <= retries) {
        await new Promise(resolve => setTimeout(resolve, retryDelay));
      }
    }
  }
  
  if (logError) {
    console.error(`[FAIL-CLOSED] ${operationName} exhausted all retries, returning fallback`);
  }
  
  return {
    success: false,
    data: fallback,
    error: lastError,
    retriesUsed: attempts
  };
}

/**
 * Wraps a synchronous operation with fail-closed behavior.
 * Returns fallback value on failure instead of throwing.
 */
export function failClosedSync<T>(
  operation: () => T,
  fallback: T,
  operationName: string,
  logError: boolean = true
): T {
  try {
    return operation();
  } catch (error) {
    if (logError) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`[FAIL-CLOSED] ${operationName} failed:`, errorMessage);
    }
    return fallback;
  }
}

/**
 * Creates a fail-closed wrapper for a specific operation type.
 * Use this to create reusable wrappers for common operations.
 */
export function createFailClosedWrapper<T>(
  fallback: T,
  defaultOptions: Partial<FailClosedOptions>
) {
  return async (
    operation: () => Promise<T>,
    operationName: string,
    overrideOptions?: Partial<FailClosedOptions>
  ): Promise<T> => {
    return failClosedWrapper(operation, fallback, {
      ...defaultOptions,
      ...overrideOptions,
      operationName
    });
  };
}
