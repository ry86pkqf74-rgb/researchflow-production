/**
 * Session Service
 *
 * Manages server-side session invalidation to prevent session hijacking
 * and unauthorized token reuse after logout.
 */

import crypto from 'crypto';
import { createLogger } from '../utils/logger';

const logger = createLogger('session-service');

interface SessionData {
  userId: string;
  accessToken: string;
  refreshToken: string;
  createdAt: Date;
  invalidatedAt?: Date;
  isValid: boolean;
}

const sessionStore = new Map<string, SessionData>();
const invalidatedTokens = new Set<string>();

export function createSession(userId: string, accessToken: string, refreshToken: string): string {
  const sessionId = crypto.randomUUID();
  sessionStore.set(sessionId, { userId, accessToken, refreshToken, createdAt: new Date(), isValid: true });
  logger.info('Session created', { sessionId, userId });
  return sessionId;
}

export function invalidateSession(sessionId: string): boolean {
  const session = sessionStore.get(sessionId);
  if (!session || !session.isValid) return false;
  session.isValid = false;
  session.invalidatedAt = new Date();
  invalidatedTokens.add(session.accessToken);
  invalidatedTokens.add(session.refreshToken);
  logger.info('Session invalidated', { sessionId, userId: session.userId });
  return true;
}

export function invalidateUserSessions(userId: string): number {
  let count = 0;
  for (const [, session] of sessionStore.entries()) {
    if (session.userId === userId && session.isValid) {
      session.isValid = false;
      session.invalidatedAt = new Date();
      invalidatedTokens.add(session.accessToken);
      invalidatedTokens.add(session.refreshToken);
      count++;
    }
  }
  logger.info('All user sessions invalidated', { userId, sessionCount: count });
  return count;
}

export function isTokenInvalidated(token: string): boolean {
  return invalidatedTokens.has(token);
}

export function getSession(sessionId: string): SessionData | null {
  const session = sessionStore.get(sessionId);
  return session?.isValid ? session : null;
}

export function verifyTokenValidity(token: string): boolean {
  return !invalidatedTokens.has(token);
}

export function cleanupExpiredSessions(): number {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  let count = 0;
  for (const [sessionId, session] of sessionStore.entries()) {
    if (session.createdAt < thirtyDaysAgo) {
      sessionStore.delete(sessionId);
      count++;
    }
  }
  if (count > 0) logger.info('Expired sessions cleaned up', { count });
  return count;
}

export function getSessionStats() {
  let activeSessions = 0, invalidatedSessions = 0;
  for (const session of sessionStore.values()) {
    if (session.isValid) activeSessions++;
    else invalidatedSessions++;
  }
  return { totalSessions: sessionStore.size, activeSessions, invalidatedSessions, invalidatedTokens: invalidatedTokens.size };
}

setInterval(() => cleanupExpiredSessions(), 60 * 60 * 1000);

export const sessionService = {
  createSession, invalidateSession, invalidateUserSessions, isTokenInvalidated,
  getSession, verifyTokenValidity, cleanupExpiredSessions, getSessionStats
};

export default sessionService;
