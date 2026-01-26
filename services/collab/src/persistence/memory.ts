/**
 * In-Memory Persistence Adapter
 *
 * Simple Map-based storage for development and testing.
 * Data does not survive process restarts.
 */

import type { PersistenceAdapter } from "./index.js";

/**
 * In-memory persistence adapter using a Map
 */
export class MemoryPersistenceAdapter implements PersistenceAdapter {
  readonly name = "memory";

  private readonly store: Map<string, Uint8Array> = new Map();
  private closed = false;

  /**
   * Store document state in memory
   */
  async storeDocument(documentName: string, state: Uint8Array): Promise<void> {
    this.ensureNotClosed();
    // Store a copy to prevent external mutations
    this.store.set(documentName, new Uint8Array(state));
  }

  /**
   * Fetch document state from memory
   */
  async fetchDocument(documentName: string): Promise<Uint8Array | null> {
    this.ensureNotClosed();
    const state = this.store.get(documentName);
    // Return a copy to prevent external mutations
    return state ? new Uint8Array(state) : null;
  }

  /**
   * Delete document from memory
   */
  async deleteDocument(documentName: string): Promise<void> {
    this.ensureNotClosed();
    this.store.delete(documentName);
  }

  /**
   * Memory adapter is always healthy if not closed
   */
  async isHealthy(): Promise<boolean> {
    return !this.closed;
  }

  /**
   * Clear all data and mark as closed
   */
  async close(): Promise<void> {
    this.store.clear();
    this.closed = true;
  }

  /**
   * Get count of stored documents (for debugging/metrics)
   */
  getDocumentCount(): number {
    return this.store.size;
  }

  /**
   * Get list of stored document names (for debugging)
   */
  getDocumentNames(): string[] {
    return Array.from(this.store.keys());
  }

  /**
   * Get total memory usage estimate in bytes
   */
  getMemoryUsage(): number {
    let total = 0;
    for (const [key, value] of this.store) {
      total += key.length * 2; // Approximate UTF-16 string size
      total += value.byteLength;
    }
    return total;
  }

  /**
   * Ensure adapter hasn't been closed
   */
  private ensureNotClosed(): void {
    if (this.closed) {
      throw new Error("MemoryPersistenceAdapter has been closed");
    }
  }
}
