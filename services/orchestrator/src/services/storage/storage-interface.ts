export interface StorageMetadata {
  contentType: string;
  encrypted: boolean;
  encryptionKeyId?: string;
  iv?: string;
  authTag?: string;
  uploadedBy: string;
  classification: 'SYNTHETIC' | 'DEIDENTIFIED' | 'IDENTIFIED' | 'UNKNOWN';
}

export interface StorageResult {
  key: string;
  backend: 'local' | 's3';
  sizeBytes: number;
  contentHash: string;
}

export interface StorageInterface {
  save(key: string, data: Buffer, metadata: StorageMetadata): Promise<StorageResult>;
  get(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
  list(prefix: string): Promise<Array<{ key: string; size: number }>>;
}
