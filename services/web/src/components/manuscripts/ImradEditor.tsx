/**
 * IMRaD Manuscript Editor
 *
 * Rich text editor with TipTap, real-time collaboration via Yjs,
 * and support for artifact embeds (figures, tables).
 */

import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { EditorContent, useEditor, Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import CharacterCount from '@tiptap/extension-character-count';
import Collaboration from '@tiptap/extension-collaboration';
import CollaborationCursor from '@tiptap/extension-collaboration-cursor';
import * as Y from 'yjs';
import { HocuspocusProvider } from '@hocuspocus/provider';
import { ArtifactEmbedNode } from './extensions/ArtifactEmbedNode';
import { ArtifactPicker } from './ArtifactPicker';
import { EditorToolbar } from './EditorToolbar';
import type { ManuscriptSectionKey } from '../../../../shared/contracts/manuscripts';

interface ImradEditorProps {
  manuscriptId: string;
  sectionKey: ManuscriptSectionKey;
  user: {
    id: string;
    name: string;
    color: string;
  };
  onSave?: (content: { md: string; json: any }) => void;
  readOnly?: boolean;
  wordLimit?: number;
  placeholder?: string;
}

const COLLAB_URL = import.meta.env.VITE_COLLAB_URL || 'ws://localhost:1234';

const SECTION_PLACEHOLDERS: Record<ManuscriptSectionKey, string> = {
  TITLE: 'Enter manuscript title...',
  ABSTRACT: 'Write your abstract (background, methods, results, conclusions)...',
  INTRODUCTION: 'Write your introduction (background, gap, objective)...',
  METHODS: 'Describe your study design, participants, and analysis...',
  RESULTS: 'Present your findings with statistics...',
  DISCUSSION: 'Interpret your results and compare with literature...',
  REFERENCES: 'Add your references here...',
  FIGURES: 'Figure descriptions and captions...',
  TABLES: 'Table descriptions and captions...',
  SUPPLEMENT: 'Supplementary materials...',
  ACKNOWLEDGEMENTS: 'Acknowledge contributors...',
  CONFLICTS: 'Declare conflicts of interest...',
};

export function ImradEditor({
  manuscriptId,
  sectionKey,
  user,
  onSave,
  readOnly = false,
  wordLimit,
  placeholder,
}: ImradEditorProps) {
  const [showArtifactPicker, setShowArtifactPicker] = useState(false);
  const [isSynced, setIsSynced] = useState(false);
  const [connectedUsers, setConnectedUsers] = useState<number>(0);

  // Create Yjs document and provider for collaboration
  const { ydoc, provider } = useMemo(() => {
    const ydoc = new Y.Doc();
    const provider = new HocuspocusProvider({
      url: COLLAB_URL,
      name: `${manuscriptId}:${sectionKey}`,
      document: ydoc,
      onSynced: () => setIsSynced(true),
      onAwarenessUpdate: ({ states }) => {
        setConnectedUsers(states.length);
      },
    });

    return { ydoc, provider };
  }, [manuscriptId, sectionKey]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      provider.destroy();
      ydoc.destroy();
    };
  }, [provider, ydoc]);

  // Initialize TipTap editor with extensions
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        history: false, // Yjs handles history
      }),
      Placeholder.configure({
        placeholder: placeholder || SECTION_PLACEHOLDERS[sectionKey] || 'Start writing...',
      }),
      CharacterCount.configure({
        limit: wordLimit ? wordLimit * 6 : undefined, // Approximate characters
      }),
      Collaboration.configure({
        document: ydoc,
      }),
      CollaborationCursor.configure({
        provider,
        user: {
          name: user.name,
          color: user.color,
        },
      }),
      ArtifactEmbedNode,
    ],
    editable: !readOnly,
    autofocus: true,
    onUpdate: ({ editor }) => {
      // Auto-save on update (debounced in parent)
      if (onSave) {
        onSave({
          md: exportToMarkdown(editor),
          json: editor.getJSON(),
        });
      }
    },
  });

  // Handle artifact insertion
  const handleInsertArtifact = useCallback(
    (artifact: { id: string; kind: string; caption?: string }) => {
      if (!editor) return;

      editor
        .chain()
        .focus()
        .insertContent({
          type: 'artifactEmbed',
          attrs: {
            kind: artifact.kind,
            ref: artifact.id,
            caption: artifact.caption || '',
          },
        })
        .run();

      setShowArtifactPicker(false);
    },
    [editor]
  );

  // Export editor content to markdown
  const exportToMarkdown = (editor: Editor): string => {
    const json = editor.getJSON();
    return jsonToMarkdown(json);
  };

  // Simple JSON to Markdown converter
  const jsonToMarkdown = (json: any): string => {
    if (!json.content) return '';

    return json.content
      .map((node: any) => {
        switch (node.type) {
          case 'paragraph':
            return nodeContentToText(node) + '\n\n';
          case 'heading':
            return '#'.repeat(node.attrs?.level || 1) + ' ' + nodeContentToText(node) + '\n\n';
          case 'bulletList':
            return node.content?.map((li: any) => '- ' + nodeContentToText(li)).join('\n') + '\n\n';
          case 'orderedList':
            return (
              node.content?.map((li: any, i: number) => `${i + 1}. ` + nodeContentToText(li)).join('\n') + '\n\n'
            );
          case 'artifactEmbed':
            return `![${node.attrs?.caption || node.attrs?.kind}](artifact:${node.attrs?.ref})\n\n`;
          default:
            return nodeContentToText(node) + '\n\n';
        }
      })
      .join('')
      .trim();
  };

  const nodeContentToText = (node: any): string => {
    if (node.text) return node.text;
    if (node.content) {
      return node.content.map((n: any) => nodeContentToText(n)).join('');
    }
    return '';
  };

  const wordCount = editor?.storage.characterCount?.words() || 0;
  const isOverLimit = wordLimit && wordCount > wordLimit;

  return (
    <div className="imrad-editor flex flex-col h-full">
      {/* Toolbar */}
      <div className="editor-toolbar border-b p-2 flex items-center justify-between bg-gray-50">
        <EditorToolbar
          editor={editor}
          onInsertArtifact={() => setShowArtifactPicker(true)}
        />

        {/* Status indicators */}
        <div className="flex items-center gap-4 text-sm text-gray-500">
          <span className={isSynced ? 'text-green-600' : 'text-yellow-600'}>
            {isSynced ? '● Synced' : '○ Syncing...'}
          </span>
          {connectedUsers > 1 && (
            <span className="text-blue-600">{connectedUsers} users</span>
          )}
          <span className={isOverLimit ? 'text-red-600 font-bold' : ''}>
            {wordCount} {wordLimit ? `/ ${wordLimit}` : ''} words
          </span>
        </div>
      </div>

      {/* Editor content */}
      <div className="editor-content flex-1 overflow-auto p-4">
        <EditorContent
          editor={editor}
          className="prose max-w-none min-h-[400px] focus:outline-none"
        />
      </div>

      {/* Artifact picker modal */}
      {showArtifactPicker && (
        <ArtifactPicker
          manuscriptId={manuscriptId}
          onSelect={handleInsertArtifact}
          onClose={() => setShowArtifactPicker(false)}
        />
      )}
    </div>
  );
}

export default ImradEditor;
