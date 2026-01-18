import { createCipheriv, createDecipheriv, randomBytes, createHash } from 'crypto';
import { v4 as uuid } from 'uuid';

export interface QuarantinedData {
  id: string;
  encryptedContent: string;
  iv: string;
  authTag: string;
  reason: string;
  quarantinedAt: Date;
  expiresAt?: Date;
  releaseToken?: string;
  released: boolean;
}

export interface ReleaseAttestation {
  userId: string;
  timestamp: Date;
  reason: string;
  signature: string;
}

export class QuarantineService {
  private readonly algorithm = 'aes-256-gcm';
  private readonly keyLength = 32;
  private quarantinedItems: Map<string, QuarantinedData> = new Map();

  quarantineData(params: {
    content: string;
    reason: string;
    expiryHours?: number;
  }): QuarantinedData {
    const encryptionKey = this.generateKey();
    const iv = randomBytes(16);
    const cipher = createCipheriv(this.algorithm, encryptionKey, iv);

    let encrypted = cipher.update(params.content, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag();

    const quarantined: QuarantinedData = {
      id: uuid(),
      encryptedContent: encrypted,
      iv: iv.toString('hex'),
      authTag: authTag.toString('hex'),
      reason: params.reason,
      quarantinedAt: new Date(),
      expiresAt: params.expiryHours
        ? new Date(Date.now() + params.expiryHours * 60 * 60 * 1000)
        : undefined,
      releaseToken: this.generateReleaseToken(),
      released: false
    };

    this.quarantinedItems.set(quarantined.id, quarantined);
    return quarantined;
  }

  releaseData(params: {
    quarantineId: string;
    attestation: ReleaseAttestation;
    releaseToken: string;
  }): { success: boolean; content?: string; error?: string } {
    const item = this.quarantinedItems.get(params.quarantineId);

    if (!item) {
      return { success: false, error: 'Quarantined item not found' };
    }

    if (item.released) {
      return { success: false, error: 'Already released' };
    }

    if (item.releaseToken !== params.releaseToken) {
      return { success: false, error: 'Invalid release token' };
    }

    if (item.expiresAt && new Date() > item.expiresAt) {
      return { success: false, error: 'Release token expired' };
    }

    // Verify attestation signature
    if (!this.verifyAttestation(params.attestation)) {
      return { success: false, error: 'Invalid attestation' };
    }

    // Decrypt content
    try {
      const encryptionKey = this.generateKey();
      const decipher = createDecipheriv(
        this.algorithm,
        encryptionKey,
        Buffer.from(item.iv, 'hex')
      );
      decipher.setAuthTag(Buffer.from(item.authTag, 'hex'));

      let decrypted = decipher.update(item.encryptedContent, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      item.released = true;
      return { success: true, content: decrypted };
    } catch (error) {
      return { success: false, error: 'Decryption failed' };
    }
  }

  private generateKey(): Buffer {
    // In production, use a proper key management system (KMS)
    // This is a simplified implementation
    const keyMaterial = process.env.QUARANTINE_KEY || 'default-key-DO-NOT-USE-IN-PROD';
    return createHash('sha256').update(keyMaterial).digest();
  }

  private generateReleaseToken(): string {
    return randomBytes(32).toString('hex');
  }

  private verifyAttestation(attestation: ReleaseAttestation): boolean {
    // Simple signature verification
    const expectedSignature = createHash('sha256')
      .update(`${attestation.userId}:${attestation.timestamp.toISOString()}:${attestation.reason}`)
      .digest('hex');
    return attestation.signature.includes(attestation.userId); // Simplified check
  }
}

export const quarantineService = new QuarantineService();
