/**
 * Zoom Webhook Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import crypto from 'crypto';
import { verifyZoomSignature } from '../zoom.js';

describe('Zoom Webhook', () => {
  const testSecret = 'zoom_test_secret_token_12345';

  describe('verifyZoomSignature', () => {
    it('should verify a valid signature', () => {
      const message = JSON.stringify({
        event: 'meeting.started',
        payload: { account_id: 'abc123' },
      });
      const timestamp = String(Date.now());
      const payload = `v0:${timestamp}:${message}`;
      const signature = 'v0=' + crypto
        .createHmac('sha256', testSecret)
        .update(payload)
        .digest('hex');

      const result = verifyZoomSignature(message, signature, timestamp, testSecret);
      expect(result).toBe(true);
    });

    it('should reject an invalid signature', () => {
      const message = JSON.stringify({
        event: 'meeting.started',
        payload: { account_id: 'abc123' },
      });
      const timestamp = String(Date.now());

      const result = verifyZoomSignature(
        message,
        'v0=invalid_signature_hash',
        timestamp,
        testSecret
      );
      expect(result).toBe(false);
    });

    it('should reject tampered message', () => {
      const originalMessage = JSON.stringify({
        event: 'meeting.started',
        payload: { account_id: 'abc123' },
      });
      const tamperedMessage = JSON.stringify({
        event: 'meeting.started',
        payload: { account_id: 'xyz789' }, // Changed
      });
      const timestamp = String(Date.now());

      // Sign the original
      const payload = `v0:${timestamp}:${originalMessage}`;
      const signature = 'v0=' + crypto
        .createHmac('sha256', testSecret)
        .update(payload)
        .digest('hex');

      // Verify with tampered message
      const result = verifyZoomSignature(tamperedMessage, signature, timestamp, testSecret);
      expect(result).toBe(false);
    });

    it('should reject wrong secret', () => {
      const message = JSON.stringify({
        event: 'recording.completed',
        payload: { account_id: 'def456' },
      });
      const timestamp = String(Date.now());
      const payload = `v0:${timestamp}:${message}`;

      // Sign with different secret
      const signature = 'v0=' + crypto
        .createHmac('sha256', 'wrong_secret')
        .update(payload)
        .digest('hex');

      const result = verifyZoomSignature(message, signature, timestamp, testSecret);
      expect(result).toBe(false);
    });

    it('should handle various event types', () => {
      const eventTypes = [
        'meeting.started',
        'meeting.ended',
        'recording.completed',
        'recording.transcript_completed',
        'meeting.participant_joined',
      ];

      for (const eventType of eventTypes) {
        const message = JSON.stringify({
          event: eventType,
          payload: { account_id: 'test123', object: { id: 'meeting_id' } },
        });
        const timestamp = String(Date.now());
        const payload = `v0:${timestamp}:${message}`;
        const signature = 'v0=' + crypto
          .createHmac('sha256', testSecret)
          .update(payload)
          .digest('hex');

        const result = verifyZoomSignature(message, signature, timestamp, testSecret);
        expect(result).toBe(true);
      }
    });

    it('should handle empty message body', () => {
      const message = '';
      const timestamp = String(Date.now());
      const payload = `v0:${timestamp}:${message}`;
      const signature = 'v0=' + crypto
        .createHmac('sha256', testSecret)
        .update(payload)
        .digest('hex');

      const result = verifyZoomSignature(message, signature, timestamp, testSecret);
      expect(result).toBe(true);
    });
  });
});
