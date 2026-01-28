import helmet from 'helmet';
import { Request, Response } from 'express';
import { createLogger } from '../utils/logger';

const logger = createLogger('securityHeaders');

/**
 * Configure comprehensive security headers using helmet
 * This middleware sets various HTTP headers to protect against common web vulnerabilities
 */
export function configureSecurityHeaders() {
  const isDevelopment = process.env.NODE_ENV === 'development';
  const cspReportUri = process.env.CSP_REPORT_URI || '/api/csp-violations';

  // Initialize helmet with comprehensive security settings
  const helmetMiddleware = helmet({
    // Content Security Policy
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: [
          "'self'",
          // Allow inline scripts only in development
          ...(isDevelopment ? ["'unsafe-inline'"] : []),
        ],
        styleSrc: [
          "'self'",
          // Allow inline styles for Tailwind CSS and styled-components
          "'unsafe-inline'",
          'https://fonts.googleapis.com',
        ],
        imgSrc: ["'self'", 'data:', 'https:', 'blob:'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'],
        connectSrc: [
          "'self'",
          'https://api.anthropic.com',
          process.env.API_ENDPOINT || 'http://localhost:3001',
          'https://fonts.googleapis.com',
          'https://fonts.gstatic.com',
        ],
        frameSrc: ["'none'"],
        frameAncestors: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        upgradeInsecureRequests: isDevelopment ? [] : [],
        reportUri: [cspReportUri],
      },
      reportOnly: isDevelopment, // Log violations in development without blocking
    },

    // Click-jacking protection
    frameguard: {
      action: 'deny',
    },

    // MIME type sniffing prevention
    noSniff: true,

    // Cross-site scripting (XSS) protection
    xssFilter: true,

    // Strict Transport Security
    hsts: {
      maxAge: 31536000, // 1 year
      includeSubDomains: true,
      preload: !isDevelopment, // Add to HSTS preload list in production
    },

    // Referrer Policy
    referrerPolicy: {
      policy: 'strict-origin-when-cross-origin',
    },

    // Permissions Policy (formerly Feature Policy)
    permissionsPolicy: {
      camera: [],
      microphone: [],
      geolocation: [],
      payment: [],
      magnetometer: [],
      gyroscope: [],
      accelerometer: [],
      usb: [],
    },

    // Cross-Origin policies
    crossOriginEmbedderPolicy: !isDevelopment,
    crossOriginOpenerPolicy: {
      policy: 'same-origin',
    },
    crossOriginResourcePolicy: {
      policy: 'cross-origin',
    },

    // DNS prefetch control
    dnsPrefetchControl: {
      allow: false,
    },

    // IE specific settings
    ieNoOpen: true,
  });

  return helmetMiddleware;
}

/**
 * Custom CSP violation reporter middleware
 * Logs Content Security Policy violations to monitoring system
 */
export function cspViolationReporter() {
  return (req: Request, res: Response) => {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    const violation = req.body;

    if (violation && violation['csp-report']) {
      const cspReport = violation['csp-report'];
      logger.warn('CSP Violation detected', {
        violationType: cspReport['violation-type'],
        documentUri: cspReport['document-uri'],
        violatedDirective: cspReport['violated-directive'],
        originalPolicy: cspReport['original-policy'],
        blockedUri: cspReport['blocked-uri'],
        sourceFile: cspReport['source-file'],
        lineNumber: cspReport['line-number'],
        columnNumber: cspReport['column-number'],
      });

      // In production, you could send this to a monitoring service
      if (process.env.NODE_ENV === 'production') {
        // Example: Send to monitoring service
        // await monitoringService.recordCspViolation(cspReport);
      }
    }

    res.status(204).send();
  };
}

/**
 * Security headers middleware for API responses
 * Ensures additional protections for API endpoints
 */
export function apiSecurityHeaders() {
  return (req: Request, res: Response, next: () => void) => {
    // Prevent caching of sensitive data
    if (req.path.startsWith('/api/')) {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    }

    // Additional security headers
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');

    next();
  };
}

/**
 * Security headers middleware factory
 * Combines all security header configurations
 */
export function createSecurityHeadersMiddleware() {
  const middlewares = [
    configureSecurityHeaders(),
    apiSecurityHeaders(),
  ];

  return (req: Request, res: Response, next: () => void) => {
    middlewares.forEach((middleware) => {
      middleware(req, res, () => {
        // Continue to next middleware
      });
    });
    next();
  };
}

/**
 * Initialize security headers logging
 */
export function initializeSecurityHeadersLogging() {
  logger.info('Security headers middleware initialized', {
    nodeEnv: process.env.NODE_ENV,
    cspReportUri: process.env.CSP_REPORT_URI || '/api/csp-violations',
  });
}
