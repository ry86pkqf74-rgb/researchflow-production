/**
 * Hocuspocus Collaboration Server
 *
 * Provides real-time collaboration for manuscript editing using Yjs.
 * Supports multiple users editing the same document simultaneously.
 */

import { Server } from '@hocuspocus/server';
import { Logger } from '@hocuspocus/extension-logger';
import { Database } from '@hocuspocus/extension-database';
import * as Y from 'yjs';

// Configuration
const PORT = parseInt(process.env.PORT || '1234', 10);
const REDIS_URL = process.env.REDIS_URL;

// In-memory document storage (replace with Redis/PostgreSQL in production)
const documentStore = new Map<string, Uint8Array>();

/**
 * Parse document name to extract manuscript ID and section
 * Format: manuscriptId:sectionKey
 */
function parseDocumentName(name: string): { manuscriptId: string; sectionKey: string } {
  const [manuscriptId, sectionKey] = name.split(':');
  return { manuscriptId, sectionKey: sectionKey || 'FULL' };
}

/**
 * Create and configure the Hocuspocus server
 */
const server = Server.configure({
  port: PORT,
  name: 'researchflow-collab',

  // Extensions
  extensions: [
    new Logger({
      log: (message) => {
        console.log(`[Collab] ${message}`);
      },
    }),

    new Database({
      /**
       * Fetch document state from storage
       */
      fetch: async ({ documentName }) => {
        const stored = documentStore.get(documentName);
        if (stored) {
          console.log(`[Collab] Loaded document: ${documentName}`);
          return stored;
        }
        console.log(`[Collab] New document: ${documentName}`);
        return null;
      },

      /**
       * Store document state
       * Note: In production, integrate with PostgreSQL or Redis
       */
      store: async ({ documentName, state }) => {
        documentStore.set(documentName, state);
        console.log(`[Collab] Stored document: ${documentName} (${state.length} bytes)`);

        // TODO: In production, persist to database
        // const { manuscriptId, sectionKey } = parseDocumentName(documentName);
        // await db.update(manuscript_section_revisions)...
      },
    }),
  ],

  /**
   * Called when a new connection is established
   */
  async onConnect({ documentName, connection }) {
    const { manuscriptId, sectionKey } = parseDocumentName(documentName);
    console.log(`[Collab] User connected to ${manuscriptId}:${sectionKey}`);

    // TODO: Validate user access to this manuscript
    // const hasAccess = await checkUserAccess(connection.userId, manuscriptId);
    // if (!hasAccess) {
    //   throw new Error('Access denied');
    // }
  },

  /**
   * Called when a connection is closed
   */
  async onDisconnect({ documentName }) {
    const { manuscriptId, sectionKey } = parseDocumentName(documentName);
    console.log(`[Collab] User disconnected from ${manuscriptId}:${sectionKey}`);
  },

  /**
   * Called when document changes
   * Can be used for PHI scanning of collaborative edits
   */
  async onChange({ documentName, document }) {
    // PHI scanning could be performed here on document changes
    // For now, just log the change
    const { manuscriptId, sectionKey } = parseDocumentName(documentName);
    console.log(`[Collab] Document changed: ${manuscriptId}:${sectionKey}`);

    // TODO: Periodic PHI scan of document content
    // const ydoc = document;
    // const content = ydoc.getText('content').toString();
    // scanForPhi(content);
  },

  /**
   * Authentication hook
   */
  async onAuthenticate({ token, documentName }) {
    // TODO: Validate JWT token and extract user info
    // const decoded = verifyToken(token);
    // return { user: decoded };

    // For development, allow all connections
    console.log(`[Collab] Auth request for ${documentName}`);
    return {};
  },
});

// Start the server
server.listen(() => {
  console.log(`[Collab] Hocuspocus server running on port ${PORT}`);
  console.log(`[Collab] WebSocket URL: ws://localhost:${PORT}`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('[Collab] Shutting down...');
  await server.destroy();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('[Collab] Shutting down...');
  await server.destroy();
  process.exit(0);
});

export { server };
