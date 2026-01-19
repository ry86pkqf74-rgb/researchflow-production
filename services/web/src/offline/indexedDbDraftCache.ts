/**
 * Offline Draft Cache using IndexedDB
 *
 * Stores manuscript drafts locally for offline editing
 * and syncs changes when connection is restored.
 */

const DB_NAME = 'researchflow-drafts';
const DB_VERSION = 1;
const STORE_NAME = 'drafts';

interface DraftEntry {
  key: string; // manuscriptId:sectionKey
  manuscriptId: string;
  sectionKey: string;
  contentMd: string;
  contentJson?: any;
  lastModified: number;
  synced: boolean;
  version: number;
}

let db: IDBDatabase | null = null;

/**
 * Initialize IndexedDB connection
 */
export async function initDraftCache(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB not supported'));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      reject(new Error('Failed to open draft cache database'));
    };

    request.onsuccess = () => {
      db = request.result;
      resolve();
    };

    request.onupgradeneeded = (event) => {
      const database = (event.target as IDBOpenDBRequest).result;

      // Create drafts object store
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        const store = database.createObjectStore(STORE_NAME, { keyPath: 'key' });
        store.createIndex('manuscriptId', 'manuscriptId', { unique: false });
        store.createIndex('synced', 'synced', { unique: false });
        store.createIndex('lastModified', 'lastModified', { unique: false });
      }
    };
  });
}

/**
 * Generate key for draft entry
 */
function getDraftKey(manuscriptId: string, sectionKey: string): string {
  return `${manuscriptId}:${sectionKey}`;
}

/**
 * Save a draft to local cache
 */
export async function saveDraft(
  manuscriptId: string,
  sectionKey: string,
  contentMd: string,
  contentJson?: any
): Promise<void> {
  if (!db) {
    await initDraftCache();
  }

  return new Promise((resolve, reject) => {
    if (!db) {
      reject(new Error('Database not initialized'));
      return;
    }

    const key = getDraftKey(manuscriptId, sectionKey);
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);

    // Get existing entry to preserve version
    const getRequest = store.get(key);

    getRequest.onsuccess = () => {
      const existing = getRequest.result as DraftEntry | undefined;
      const version = existing ? existing.version + 1 : 1;

      const entry: DraftEntry = {
        key,
        manuscriptId,
        sectionKey,
        contentMd,
        contentJson,
        lastModified: Date.now(),
        synced: false,
        version,
      };

      const putRequest = store.put(entry);

      putRequest.onsuccess = () => resolve();
      putRequest.onerror = () => reject(new Error('Failed to save draft'));
    };

    getRequest.onerror = () => reject(new Error('Failed to read existing draft'));
  });
}

/**
 * Get a draft from local cache
 */
export async function getDraft(
  manuscriptId: string,
  sectionKey: string
): Promise<DraftEntry | null> {
  if (!db) {
    await initDraftCache();
  }

  return new Promise((resolve, reject) => {
    if (!db) {
      reject(new Error('Database not initialized'));
      return;
    }

    const key = getDraftKey(manuscriptId, sectionKey);
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(key);

    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(new Error('Failed to get draft'));
  });
}

/**
 * Get all drafts for a manuscript
 */
export async function getDraftsForManuscript(manuscriptId: string): Promise<DraftEntry[]> {
  if (!db) {
    await initDraftCache();
  }

  return new Promise((resolve, reject) => {
    if (!db) {
      reject(new Error('Database not initialized'));
      return;
    }

    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const index = store.index('manuscriptId');
    const request = index.getAll(manuscriptId);

    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(new Error('Failed to get drafts'));
  });
}

/**
 * Get all unsynced drafts
 */
export async function getUnsyncedDrafts(): Promise<DraftEntry[]> {
  if (!db) {
    await initDraftCache();
  }

  return new Promise((resolve, reject) => {
    if (!db) {
      reject(new Error('Database not initialized'));
      return;
    }

    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const index = store.index('synced');
    const request = index.getAll(false);

    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(new Error('Failed to get unsynced drafts'));
  });
}

/**
 * Mark a draft as synced
 */
export async function markDraftSynced(
  manuscriptId: string,
  sectionKey: string
): Promise<void> {
  if (!db) {
    await initDraftCache();
  }

  return new Promise((resolve, reject) => {
    if (!db) {
      reject(new Error('Database not initialized'));
      return;
    }

    const key = getDraftKey(manuscriptId, sectionKey);
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const getRequest = store.get(key);

    getRequest.onsuccess = () => {
      const entry = getRequest.result as DraftEntry;
      if (entry) {
        entry.synced = true;
        const putRequest = store.put(entry);
        putRequest.onsuccess = () => resolve();
        putRequest.onerror = () => reject(new Error('Failed to mark draft synced'));
      } else {
        resolve();
      }
    };

    getRequest.onerror = () => reject(new Error('Failed to get draft for sync'));
  });
}

/**
 * Delete a draft
 */
export async function deleteDraft(manuscriptId: string, sectionKey: string): Promise<void> {
  if (!db) {
    await initDraftCache();
  }

  return new Promise((resolve, reject) => {
    if (!db) {
      reject(new Error('Database not initialized'));
      return;
    }

    const key = getDraftKey(manuscriptId, sectionKey);
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete(key);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(new Error('Failed to delete draft'));
  });
}

/**
 * Sync all unsynced drafts to the server
 */
export async function syncDrafts(
  syncFn: (draft: DraftEntry) => Promise<boolean>
): Promise<{ synced: number; failed: number }> {
  const unsynced = await getUnsyncedDrafts();
  let synced = 0;
  let failed = 0;

  for (const draft of unsynced) {
    try {
      const success = await syncFn(draft);
      if (success) {
        await markDraftSynced(draft.manuscriptId, draft.sectionKey);
        synced++;
      } else {
        failed++;
      }
    } catch (error) {
      console.error('Failed to sync draft:', draft.key, error);
      failed++;
    }
  }

  return { synced, failed };
}

/**
 * Setup online/offline sync listeners
 */
export function setupSyncListeners(
  syncFn: (draft: DraftEntry) => Promise<boolean>
): () => void {
  const handleOnline = async () => {
    console.log('[DraftCache] Online - syncing drafts...');
    const result = await syncDrafts(syncFn);
    console.log(`[DraftCache] Synced ${result.synced} drafts, ${result.failed} failed`);
  };

  window.addEventListener('online', handleOnline);

  // Return cleanup function
  return () => {
    window.removeEventListener('online', handleOnline);
  };
}

export default {
  initDraftCache,
  saveDraft,
  getDraft,
  getDraftsForManuscript,
  getUnsyncedDrafts,
  markDraftSynced,
  deleteDraft,
  syncDrafts,
  setupSyncListeners,
};
