/**
 * Pino Logger Integration
 *
 * Provides PHI-scrubbed Pino logger instances
 * All log messages and objects are automatically scrubbed before output
 */
import { scrubLog, scrubObject } from '../log-scrubber';
/**
 * Transform function that scrubs PHI from log entries
 */
function scrubLogEntry(obj) {
    // Scrub the entire object
    const scrubbed = scrubObject(obj);
    // Add a flag to indicate scrubbing occurred
    return {
        ...scrubbed,
        scrubbed: true
    };
}
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
export function createScrubbedLogger(options = {}) {
    // Dynamic import to avoid requiring pino as a hard dependency
    let pino;
    try {
        pino = require('pino');
    }
    catch (err) {
        throw new Error('Pino is required to use createScrubbedLogger. Install it with: npm install pino');
    }
    // Create a custom serializer that scrubs all values
    const serializers = {
        // Scrub error messages
        err: (err) => {
            if (!err)
                return err;
            return {
                type: err.constructor.name,
                message: scrubLog(err.message),
                stack: err.stack ? scrubLog(err.stack) : undefined
            };
        }
    };
    // Create base logger
    const baseLogger = pino({
        ...options,
        serializers,
        // Use formatters to scrub all log data
        formatters: {
            level: (label, number) => {
                return { level: label };
            },
            log: (obj) => {
                return scrubLogEntry(obj);
            }
        }
    });
    // Wrap log methods to scrub string messages
    const wrapLogMethod = (method) => {
        return ((...args) => {
            // Scrub the message if it's a string
            if (args.length === 1 && typeof args[0] === 'string') {
                args[0] = scrubLog(args[0]);
            }
            else if (args.length === 2) {
                if (typeof args[1] === 'string') {
                    args[1] = scrubLog(args[1]);
                }
                // First arg is already scrubbed by formatters
            }
            return method.apply(baseLogger, args);
        });
    };
    // Create wrapped logger
    const wrappedLogger = {
        trace: wrapLogMethod(baseLogger.trace.bind(baseLogger)),
        debug: wrapLogMethod(baseLogger.debug.bind(baseLogger)),
        info: wrapLogMethod(baseLogger.info.bind(baseLogger)),
        warn: wrapLogMethod(baseLogger.warn.bind(baseLogger)),
        error: wrapLogMethod(baseLogger.error.bind(baseLogger)),
        fatal: wrapLogMethod(baseLogger.fatal.bind(baseLogger)),
        child: (bindings) => {
            // Scrub child bindings
            const scrubbedBindings = scrubObject(bindings);
            const childLogger = baseLogger.child(scrubbedBindings);
            // Return wrapped child logger
            return {
                trace: wrapLogMethod(childLogger.trace.bind(childLogger)),
                debug: wrapLogMethod(childLogger.debug.bind(childLogger)),
                info: wrapLogMethod(childLogger.info.bind(childLogger)),
                warn: wrapLogMethod(childLogger.warn.bind(childLogger)),
                error: wrapLogMethod(childLogger.error.bind(childLogger)),
                fatal: wrapLogMethod(childLogger.fatal.bind(childLogger)),
                child: (nestedBindings) => {
                    return wrappedLogger.child({
                        ...scrubbedBindings,
                        ...nestedBindings
                    });
                }
            };
        }
    };
    return wrappedLogger;
}
//# sourceMappingURL=pino-adapter.js.map