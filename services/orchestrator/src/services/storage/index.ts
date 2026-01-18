export type { StorageInterface, StorageMetadata, StorageResult } from './storage-interface.js';
export { LocalStorage } from './local-storage.js';

import { LocalStorage } from './local-storage.js';
import type { StorageInterface } from './storage-interface.js';

export function createStorageService(storageDir?: string): StorageInterface {
  return new LocalStorage(storageDir);
}
