/**
 * Formatting utilities for safe number display
 */

/**
 * Safely format a number with toFixed, handling undefined/null values
 * @param value - The number to format (can be undefined or null)
 * @param decimals - Number of decimal places (default: 2)
 * @returns Formatted string with specified decimal places
 */
export function safeFixed(value: number | undefined | null, decimals: number = 2): string {
  return (value ?? 0).toFixed(decimals);
}

/**
 * Safely format a number with locale string, handling undefined/null values
 * @param value - The number to format (can be undefined or null)
 * @param options - Intl.NumberFormatOptions (optional)
 * @returns Formatted locale string
 */
export function safeLocaleString(value: number | undefined | null, options?: Intl.NumberFormatOptions): string {
  return (value ?? 0).toLocaleString(undefined, options);
}

/**
 * Format bytes to human-readable size
 * @param bytes - Size in bytes
 * @param decimals - Number of decimal places (default: 1)
 * @returns Formatted size string (e.g., "1.5 MB")
 */
export function formatBytes(bytes: number | undefined | null, decimals: number = 1): string {
  const b = bytes ?? 0;
  if (b === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(b) / Math.log(k));
  
  return `${parseFloat((b / Math.pow(k, i)).toFixed(decimals))} ${sizes[i]}`;
}
