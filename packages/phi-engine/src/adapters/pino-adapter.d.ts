/**
 * Pino Logger Integration
 *
 * Provides PHI-scrubbed Pino logger instances
 * All log messages and objects are automatically scrubbed before output
 */
type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';
interface PinoOptions {
    level?: LogLevel;
    name?: string;
    [key: string]: unknown;
}
interface Logger {
    trace: LogFn;
    debug: LogFn;
    info: LogFn;
    warn: LogFn;
    error: LogFn;
    fatal: LogFn;
    child: (bindings: Record<string, unknown>) => Logger;
}
type LogFn = {
    (msg: string): void;
    (obj: Record<string, unknown>, msg?: string): void;
    (err: Error, msg?: string): void;
};
/**
 * Create a Pino logger with automatic PHI scrubbing
 *
 * This function requires pino to be installed as a peer dependency.
 *
 * @param options - Pino configuration options
 * @returns Logger instance with PHI scrubbing
 *
 * @example
 * const logger = createScrubbedLogger({ level: 'info' });
 * logger.info({ patientSSN: '123-45-6789' }, 'Processing patient');
 * // Output: { patientSSN: '[REDACTED:SSN]', scrubbed: true } Processing patient
 */
export declare function createScrubbedLogger(options?: PinoOptions): Logger;
export {};
