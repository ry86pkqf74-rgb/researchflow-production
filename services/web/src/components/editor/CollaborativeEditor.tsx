/**
 * Collaborative Editor Component
 *
 * Real-time collaborative rich text editor using ProseMirror and Yjs CRDT.
 * Supports multiple simultaneous editors with conflict-free merging.
 *
 * Features:
 * - Real-time collaboration with WebSocket sync
 * - User presence indicators (cursors and selections)
 * - Version snapshotting
 * - Offline support with sync on reconnect
 * - Comment anchoring integration
 */

import React, { useEffect, useRef, useState } from 'react';
import { EditorState } from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';
import { Schema, DOMParser as ProseMirrorDOMParser } from 'prosemirror-model';
import { schema as basicSchema } from 'prosemirror-schema-basic';
import { addListNodes } from 'prosemirror-schema-list';
import { exampleSetup } from 'prosemirror-example-setup';
import * as Y from 'yjs';
import { ySyncPlugin, yCursorPlugin, yUndoPlugin, undo, redo } from 'y-prosemirror';
import { WebsocketProvider } from 'y-websocket';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Alert, AlertDescription } from '../ui/alert';
import {
  Save,
  Users,
  Wifi,
  WifiOff,
  RotateCcw,
  RotateCw,
  Loader2,
  AlertTriangle,
} from 'lucide-react';
import 'prosemirror-view/style/prosemirror.css';

interface User {
  id: string;
  name: string;
  color: string;
}

interface CollaborativeEditorProps {
  artifactId: string;
  documentName: string;
  currentUser: User;
  onSave?: (content: any) => void;
  className?: string;
}

// Extended ProseMirror schema with list support
const mySchema = new Schema({
  nodes: addListNodes(basicSchema.spec.nodes, 'paragraph block*', 'block'),
  marks: basicSchema.spec.marks,
});

// User colors for presence
const USER_COLORS = [
  '#FF6B6B',
  '#4ECDC4',
  '#45B7D1',
  '#FFA07A',
  '#98D8C8',
  '#F7DC6F',
  '#BB8FCE',
  '#85C1E2',
];

export function CollaborativeEditor({
  artifactId,
  documentName,
  currentUser,
  onSave,
  className = '',
}: CollaborativeEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const [editorView, setEditorView] = useState<EditorView | null>(null);
  const [ydoc] = useState(() => new Y.Doc());
  const [provider, setProvider] = useState<WebsocketProvider | null>(null);
  const [connected, setConnected] = useState(false);
  const [synced, setSynced] = useState(false);
  const [activeUsers, setActiveUsers] = useState<User[]>([currentUser]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Initialize Yjs and WebSocket provider
  useEffect(() => {
    // Determine WebSocket URL based on environment
    // In production, use wss:// for secure connections
    // In Docker, connect to collab service on port 1234
    const isDev = import.meta.env.DEV;
    const isHttps = window.location.protocol === 'https:';
    const wsProtocol = isHttps ? 'wss:' : 'ws:';

    // Use environment variable if provided, otherwise construct from current host
    // IMPORTANT: Production uses nginx proxy at /collab path
    let wsUrl = import.meta.env.VITE_WS_URL || import.meta.env.VITE_COLLAB_URL;
    if (!wsUrl) {
      if (isDev) {
        // Development: connect directly to collab service on port 1234
        wsUrl = 'ws://localhost:1234';
      } else {
        // Production: use current host with /collab path for nginx proxy
        const wsHost = window.location.host;
        wsUrl = `${wsProtocol}//${wsHost}/collab`;
      }
    }

    const roomName = `artifact-${artifactId}`;

    const wsProvider = new WebsocketProvider(wsUrl, roomName, ydoc, {
      connect: true,
    });

    wsProvider.on('status', ({ status }: { status: string }) => {
      setConnected(status === 'connected');
    });

    wsProvider.on('sync', (isSynced: boolean) => {
      setSynced(isSynced);
    });

    setProvider(wsProvider);

    return () => {
      wsProvider.destroy();
    };
  }, [artifactId, ydoc]);

  // Initialize ProseMirror editor
  useEffect(() => {
    if (!editorRef.current || !provider) return;

    const yXmlFragment = ydoc.getXmlFragment('prosemirror');

    // Awareness for cursor/presence
    const awareness = provider.awareness;
    awareness.setLocalStateField('user', {
      id: currentUser.id,
      name: currentUser.name,
      color: currentUser.color || USER_COLORS[0],
    });

    // Listen to awareness changes for active users
    awareness.on('change', () => {
      const states = awareness.getStates();
      const users: User[] = [];
      states.forEach((state, clientId) => {
        if (state.user && clientId !== awareness.clientID) {
          users.push(state.user);
        }
      });
      setActiveUsers([currentUser, ...users]);
    });

    // Create editor state
    const state = EditorState.create({
      schema: mySchema,
      plugins: [
        ySyncPlugin(yXmlFragment),
        yCursorPlugin(awareness),
        yUndoPlugin(),
        ...exampleSetup({ schema: mySchema }),
      ],
    });

    // Create editor view
    const view = new EditorView(editorRef.current, {
      state,
    });

    setEditorView(view);

    return () => {
      view.destroy();
    };
  }, [provider, ydoc, currentUser]);

  // Save version snapshot
  const handleSave = async () => {
    if (!editorView) return;

    setSaving(true);
    setError(null);

    try {
      // Get current content
      const doc = editorView.state.doc;
      const content = doc.toJSON();

      // Get Yjs snapshot
      const yjsSnapshot = Y.encodeStateAsUpdate(ydoc);

      // Call backend to save version
      const response = await fetch(`/api/v2/artifacts/${artifactId}/versions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contentJson: content,
          yjsSnapshot: Array.from(yjsSnapshot), // Convert Uint8Array to array
          changeDescription: 'Manual save',
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to save version');
      }

      onSave?.(content);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  // Undo/redo
  const handleUndo = () => {
    if (editorView) {
      undo(editorView.state, editorView.dispatch);
    }
  };

  const handleRedo = () => {
    if (editorView) {
      redo(editorView.state, editorView.dispatch);
    }
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Toolbar */}
      <Card className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h3 className="font-semibold">{documentName}</h3>

            {/* Connection status */}
            <div className="flex items-center gap-2">
              {connected ? (
                <>
                  <Wifi className="h-4 w-4 text-green-600" />
                  <span className="text-sm text-green-600">
                    {synced ? 'Synced' : 'Syncing...'}
                  </span>
                </>
              ) : (
                <>
                  <WifiOff className="h-4 w-4 text-red-600" />
                  <span className="text-sm text-red-600">Disconnected</span>
                </>
              )}
            </div>

            {/* Active users */}
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <div className="flex -space-x-2">
                {activeUsers.map((user) => (
                  <div
                    key={user.id}
                    className="h-8 w-8 rounded-full border-2 border-background flex items-center justify-center text-xs font-semibold text-white"
                    style={{ backgroundColor: user.color }}
                    title={user.name}
                  >
                    {user.name.charAt(0).toUpperCase()}
                  </div>
                ))}
              </div>
              <span className="text-sm text-muted-foreground">
                {activeUsers.length} {activeUsers.length === 1 ? 'user' : 'users'}
              </span>
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleUndo}
              title="Undo (Ctrl+Z)"
            >
              <RotateCcw className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRedo}
              title="Redo (Ctrl+Y)"
            >
              <RotateCw className="h-4 w-4" />
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving || !connected}
              size="sm"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Save Version
            </Button>
          </div>
        </div>

        {error && (
          <Alert variant="destructive" className="mt-4">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
      </Card>

      {/* Editor */}
      <Card className="p-6">
        <div
          ref={editorRef}
          className="prose prose-sm max-w-none focus:outline-none min-h-[600px]"
          style={{
            '--user-color': currentUser.color,
          } as React.CSSProperties}
        />
      </Card>

      {/* Helper text */}
      <div className="text-sm text-muted-foreground">
        <p>
          This is a collaborative editor. Changes are automatically synced with other users.
          Click "Save Version" to create a permanent snapshot.
        </p>
      </div>

      {/* Custom styles for collaborative cursors */}
      <style>{`
        .ProseMirror-yjs-cursor {
          position: absolute;
          border-left: 2px solid;
          border-color: var(--cursor-color);
          margin-left: -1px;
          margin-right: -1px;
          pointer-events: none;
        }

        .ProseMirror-yjs-cursor > .ProseMirror-yjs-cursor-label {
          position: absolute;
          top: -1.5em;
          left: -1px;
          font-size: 12px;
          font-weight: 500;
          padding: 2px 6px;
          border-radius: 4px;
          color: white;
          background-color: var(--cursor-color);
          white-space: nowrap;
          box-shadow: 0 1px 3px rgba(0,0,0,0.2);
        }

        .ProseMirror-yjs-selection {
          background-color: var(--cursor-color);
          opacity: 0.3;
        }

        .ProseMirror {
          padding: 1rem;
          border: 1px solid hsl(var(--border));
          border-radius: 8px;
          min-height: 600px;
        }

        .ProseMirror:focus {
          outline: 2px solid hsl(var(--ring));
          outline-offset: 2px;
        }
      `}</style>
    </div>
  );
}
