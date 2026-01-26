import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';
import type { StorageInterface, StorageMetadata, StorageResult } from './storage-interface.js';

const STORAGE_DIR = './storage/datasets';
const METADATA_SUFFIX = '.meta.json';
const ENCRYPTION_ALGORITHM = 'aes-256-gcm';
const ENCRYPTION_KEY_ENV = 'STORAGE_ENCRYPTION_KEY';
const GCM_IV_LENGTH = 12;

interface StoredMetadata extends StorageMetadata {
  iv?: string;
  authTag?: string;
}

export class LocalStorage implements StorageInterface {
  private storageDir: string;
  private encryptionKey: Buffer | null = null;

  constructor(storageDir: string = STORAGE_DIR) {
    this.storageDir = storageDir;
  }

  private async ensureDir(dir: string): Promise<void> {
    await fs.mkdir(dir, { recursive: true });
  }

  private getFilePath(key: string): string {
    return path.join(this.storageDir, key);
  }

  private getMetadataPath(key: string): string {
    return path.join(this.storageDir, key + METADATA_SUFFIX);
  }

  private computeHash(data: Buffer): string {
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  private getEncryptionKey(): Buffer {
    if (this.encryptionKey) {
      return this.encryptionKey;
    }

    const keyEnv = process.env[ENCRYPTION_KEY_ENV];
    if (!keyEnv) {
      throw new Error('STORAGE_ENCRYPTION_KEY environment variable is required for encrypted storage');
    }
    this.encryptionKey = crypto.scryptSync(keyEnv, 'salt', 32);
    return this.encryptionKey;
  }

  private encrypt(data: Buffer): { encrypted: Buffer; iv: string; authTag: string } {
    const iv = crypto.randomBytes(GCM_IV_LENGTH);
    const key = this.getEncryptionKey();
    const cipher = crypto.createCipheriv(ENCRYPTION_ALGORITHM, key, iv);
    const encrypted = Buffer.concat([cipher.update(data), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return { 
      encrypted, 
      iv: iv.toString('hex'), 
      authTag: authTag.toString('hex') 
    };
  }

  private decrypt(data: Buffer, ivHex: string, authTagHex: string): Buffer {
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const key = this.getEncryptionKey();
    const decipher = crypto.createDecipheriv(ENCRYPTION_ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    return Buffer.concat([decipher.update(data), decipher.final()]);
  }

  async save(key: string, data: Buffer, metadata: StorageMetadata): Promise<StorageResult> {
    const filePath = this.getFilePath(key);
    const metadataPath = this.getMetadataPath(key);
    
    await this.ensureDir(path.dirname(filePath));

    const contentHash = this.computeHash(data);
    let dataToStore = data;
    const storedMetadata: StoredMetadata = { ...metadata };

    if (metadata.encrypted) {
      const { encrypted, iv, authTag } = this.encrypt(data);
      dataToStore = encrypted;
      storedMetadata.iv = iv;
      storedMetadata.authTag = authTag;
    }

    await fs.writeFile(filePath, dataToStore);
    await fs.writeFile(metadataPath, JSON.stringify(storedMetadata, null, 2));

    const stats = await fs.stat(filePath);

    return {
      key,
      backend: 'local',
      sizeBytes: stats.size,
      contentHash
    };
  }

  async get(key: string): Promise<Buffer> {
    const filePath = this.getFilePath(key);
    const metadataPath = this.getMetadataPath(key);

    try {
      const data = await fs.readFile(filePath);
      
      try {
        const metadataContent = await fs.readFile(metadataPath, 'utf-8');
        const metadata: StoredMetadata = JSON.parse(metadataContent);
        
        if (metadata.encrypted && metadata.iv && metadata.authTag) {
          return this.decrypt(data, metadata.iv, metadata.authTag);
        }
      } catch {
      }

      return data;
    } catch (error) {
      const err = error as NodeJS.ErrnoException;
      if (err.code === 'ENOENT') {
        throw new Error(`File not found: ${key}`);
      }
      throw error;
    }
  }

  async delete(key: string): Promise<void> {
    const filePath = this.getFilePath(key);
    const metadataPath = this.getMetadataPath(key);

    try {
      await fs.unlink(filePath);
    } catch (error) {
      const err = error as NodeJS.ErrnoException;
      if (err.code !== 'ENOENT') {
        throw error;
      }
    }

    try {
      await fs.unlink(metadataPath);
    } catch (error) {
      const err = error as NodeJS.ErrnoException;
      if (err.code !== 'ENOENT') {
        throw error;
      }
    }
  }

  async list(prefix: string): Promise<Array<{ key: string; size: number }>> {
    const prefixDir = path.join(this.storageDir, path.dirname(prefix));
    const prefixBase = path.basename(prefix);

    try {
      await this.ensureDir(this.storageDir);
      
      const results: Array<{ key: string; size: number }> = [];
      
      await this.walkDir(this.storageDir, prefix, results);
      
      return results;
    } catch (error) {
      const err = error as NodeJS.ErrnoException;
      if (err.code === 'ENOENT') {
        return [];
      }
      throw error;
    }
  }

  private async walkDir(
    dir: string, 
    prefix: string, 
    results: Array<{ key: string; size: number }>
  ): Promise<void> {
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        const relativePath = path.relative(this.storageDir, fullPath);
        
        if (entry.isDirectory()) {
          await this.walkDir(fullPath, prefix, results);
        } else if (entry.isFile() && !entry.name.endsWith(METADATA_SUFFIX)) {
          if (relativePath.startsWith(prefix)) {
            const stats = await fs.stat(fullPath);
            results.push({
              key: relativePath,
              size: stats.size
            });
          }
        }
      }
    } catch (error) {
      const err = error as NodeJS.ErrnoException;
      if (err.code !== 'ENOENT') {
        throw error;
      }
    }
  }
}
