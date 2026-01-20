/**
 * Stripe Webhook Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import crypto from 'crypto';
import { verifyStripeSignature } from '../stripe.js';

describe('Stripe Webhook', () => {
  const testSecret = 'whsec_test_secret_key_12345';

  describe('verifyStripeSignature', () => {
    it('should verify a valid signature', () => {
      const payload = JSON.stringify({ type: 'checkout.session.completed' });
      const timestamp = Math.floor(Date.now() / 1000);
      const signaturePayload = `${timestamp}.${payload}`;
      const signature = crypto
        .createHmac('sha256', testSecret)
        .update(signaturePayload)
        .digest('hex');

      const header = `t=${timestamp},v1=${signature}`;

      const result = verifyStripeSignature(payload, header, testSecret);
      expect(result).toBe(true);
    });

    it('should reject an invalid signature', () => {
      const payload = JSON.stringify({ type: 'checkout.session.completed' });
      const timestamp = Math.floor(Date.now() / 1000);

      const header = `t=${timestamp},v1=invalid_signature`;

      const result = verifyStripeSignature(payload, header, testSecret);
      expect(result).toBe(false);
    });

    it('should reject expired timestamp', () => {
      const payload = JSON.stringify({ type: 'checkout.session.completed' });
      // 10 minutes ago (beyond 5 minute tolerance)
      const timestamp = Math.floor(Date.now() / 1000) - 600;
      const signaturePayload = `${timestamp}.${payload}`;
      const signature = crypto
        .createHmac('sha256', testSecret)
        .update(signaturePayload)
        .digest('hex');

      const header = `t=${timestamp},v1=${signature}`;

      const result = verifyStripeSignature(payload, header, testSecret);
      expect(result).toBe(false);
    });

    it('should reject malformed header', () => {
      const payload = JSON.stringify({ type: 'checkout.session.completed' });

      // Missing timestamp
      expect(verifyStripeSignature(payload, 'v1=abc123', testSecret)).toBe(false);

      // Missing signature
      expect(verifyStripeSignature(payload, 't=12345', testSecret)).toBe(false);

      // Empty string
      expect(verifyStripeSignature(payload, '', testSecret)).toBe(false);
    });

    it('should handle Buffer input', () => {
      const payload = Buffer.from(JSON.stringify({ type: 'invoice.paid' }));
      const timestamp = Math.floor(Date.now() / 1000);
      const signaturePayload = `${timestamp}.${payload.toString()}`;
      const signature = crypto
        .createHmac('sha256', testSecret)
        .update(signaturePayload)
        .digest('hex');

      const header = `t=${timestamp},v1=${signature}`;

      const result = verifyStripeSignature(payload, header, testSecret);
      expect(result).toBe(true);
    });

    it('should support multiple v1 signatures', () => {
      const payload = JSON.stringify({ type: 'payment_intent.succeeded' });
      const timestamp = Math.floor(Date.now() / 1000);
      const signaturePayload = `${timestamp}.${payload}`;
      const validSignature = crypto
        .createHmac('sha256', testSecret)
        .update(signaturePayload)
        .digest('hex');

      // Stripe may send multiple signatures during key rotation
      const header = `t=${timestamp},v1=old_signature,v1=${validSignature}`;

      const result = verifyStripeSignature(payload, header, testSecret);
      expect(result).toBe(true);
    });
  });
});
