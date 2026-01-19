/**
 * Editor Toolbar Component
 *
 * Provides formatting controls and actions for the manuscript editor.
 */

import React from 'react';
import type { Editor } from '@tiptap/react';

interface EditorToolbarProps {
  editor: Editor | null;
  onInsertArtifact?: () => void;
}

export function EditorToolbar({ editor, onInsertArtifact }: EditorToolbarProps) {
  if (!editor) {
    return null;
  }

  const ToolButton = ({
    onClick,
    active,
    disabled,
    children,
    title,
  }: {
    onClick: () => void;
    active?: boolean;
    disabled?: boolean;
    children: React.ReactNode;
    title?: string;
  }) => (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`p-2 rounded hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed ${
        active ? 'bg-gray-200 text-blue-600' : ''
      }`}
    >
      {children}
    </button>
  );

  return (
    <div className="flex items-center gap-1 flex-wrap">
      {/* Text formatting */}
      <ToolButton
        onClick={() => editor.chain().focus().toggleBold().run()}
        active={editor.isActive('bold')}
        title="Bold (Ctrl+B)"
      >
        <strong>B</strong>
      </ToolButton>

      <ToolButton
        onClick={() => editor.chain().focus().toggleItalic().run()}
        active={editor.isActive('italic')}
        title="Italic (Ctrl+I)"
      >
        <em>I</em>
      </ToolButton>

      <ToolButton
        onClick={() => editor.chain().focus().toggleStrike().run()}
        active={editor.isActive('strike')}
        title="Strikethrough"
      >
        <s>S</s>
      </ToolButton>

      <div className="w-px h-6 bg-gray-300 mx-1" />

      {/* Headings */}
      <ToolButton
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        active={editor.isActive('heading', { level: 2 })}
        title="Heading 2"
      >
        H2
      </ToolButton>

      <ToolButton
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        active={editor.isActive('heading', { level: 3 })}
        title="Heading 3"
      >
        H3
      </ToolButton>

      <div className="w-px h-6 bg-gray-300 mx-1" />

      {/* Lists */}
      <ToolButton
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        active={editor.isActive('bulletList')}
        title="Bullet List"
      >
        •
      </ToolButton>

      <ToolButton
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        active={editor.isActive('orderedList')}
        title="Numbered List"
      >
        1.
      </ToolButton>

      <div className="w-px h-6 bg-gray-300 mx-1" />

      {/* Block formatting */}
      <ToolButton
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
        active={editor.isActive('blockquote')}
        title="Quote"
      >
        "
      </ToolButton>

      <ToolButton
        onClick={() => editor.chain().focus().toggleCodeBlock().run()}
        active={editor.isActive('codeBlock')}
        title="Code Block"
      >
        {'</>'}
      </ToolButton>

      <div className="w-px h-6 bg-gray-300 mx-1" />

      {/* Insert artifact */}
      {onInsertArtifact && (
        <ToolButton onClick={onInsertArtifact} title="Insert Figure/Table">
          📊
        </ToolButton>
      )}

      <div className="w-px h-6 bg-gray-300 mx-1" />

      {/* Undo/Redo */}
      <ToolButton
        onClick={() => editor.chain().focus().undo().run()}
        disabled={!editor.can().undo()}
        title="Undo (Ctrl+Z)"
      >
        ↩
      </ToolButton>

      <ToolButton
        onClick={() => editor.chain().focus().redo().run()}
        disabled={!editor.can().redo()}
        title="Redo (Ctrl+Y)"
      >
        ↪
      </ToolButton>
    </div>
  );
}

export default EditorToolbar;
