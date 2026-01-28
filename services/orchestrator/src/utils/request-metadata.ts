/**
 * Request Metadata Utilities
 *
 * Helper functions to extract client IP address and user agent from requests
 * for audit logging purposes.
 *
 * @module utils/request-metadata
 */

import type { Request } from 'express';

/**
 * Extract client IP address from request
 *
 * Checks multiple headers for IP address to handle proxies and load balancers:
 * 1. x-forwarded-for (most common with proxies)
 * 2. x-real-ip (nginx)
 * 3. cf-connecting-ip (Cloudflare)
 * 4. socket.remoteAddress (direct connection)
 */
export function getClientIpAddress(req: Request): string | undefined {
  // Check X-Forwarded-For header (may contain multiple IPs)
  const xForwardedFor = req.headers['x-forwarded-for'];
  if (xForwardedFor) {
    // Take first IP if there are multiple (leftmost is original client)
    const ips = Array.isArray(xForwardedFor)
      ? xForwardedFor[0]
      : xForwardedFor.split(',')[0];
    return ips.trim();
  }

  // Check X-Real-IP header (nginx)
  const xRealIp = req.headers['x-real-ip'];
  if (xRealIp) {
    return Array.isArray(xRealIp) ? xRealIp[0] : xRealIp;
  }

  // Check CF-Connecting-IP header (Cloudflare)
  const cfConnectingIp = req.headers['cf-connecting-ip'];
  if (cfConnectingIp) {
    return Array.isArray(cfConnectingIp) ? cfConnectingIp[0] : cfConnectingIp;
  }

  // Fallback to socket remote address
  if (req.socket?.remoteAddress) {
    return req.socket.remoteAddress;
  }

  // Fallback to req.ip (Express helper)
  return req.ip;
}

/**
 * Extract user agent from request
 */
export function getUserAgent(req: Request): string | undefined {
  const userAgent = req.headers['user-agent'];
  return Array.isArray(userAgent) ? userAgent[0] : userAgent;
}

/**
 * Extract request metadata for audit logging
 */
export function getRequestMetadata(req: Request): {
  ipAddress?: string;
  userAgent?: string;
} {
  return {
    ipAddress: getClientIpAddress(req),
    userAgent: getUserAgent(req)
  };
}
