/**
 * TipTap Extension: Artifact Embed Node
 *
 * Allows embedding figures, tables, and other artifacts in the editor.
 * Renders as a placeholder block that can be clicked to edit.
 */

import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer } from '@tiptap/react';

export interface ArtifactEmbedAttributes {
  kind: 'figure' | 'table' | 'supplement' | 'data';
  ref: string;
  caption: string;
  alt?: string;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    artifactEmbed: {
      /**
       * Insert an artifact embed
       */
      insertArtifactEmbed: (attrs: ArtifactEmbedAttributes) => ReturnType;
    };
  }
}

export const ArtifactEmbedNode = Node.create({
  name: 'artifactEmbed',

  group: 'block',

  atom: true,

  draggable: true,

  addAttributes() {
    return {
      kind: {
        default: 'figure',
        parseHTML: (element) => element.getAttribute('data-kind'),
        renderHTML: (attributes) => ({
          'data-kind': attributes.kind,
        }),
      },
      ref: {
        default: '',
        parseHTML: (element) => element.getAttribute('data-ref'),
        renderHTML: (attributes) => ({
          'data-ref': attributes.ref,
        }),
      },
      caption: {
        default: '',
        parseHTML: (element) => element.getAttribute('data-caption'),
        renderHTML: (attributes) => ({
          'data-caption': attributes.caption,
        }),
      },
      alt: {
        default: '',
        parseHTML: (element) => element.getAttribute('alt'),
        renderHTML: (attributes) => ({
          alt: attributes.alt,
        }),
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'artifact-embed',
      },
      {
        tag: 'div[data-artifact-embed]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    const kind = HTMLAttributes['data-kind'] || 'figure';
    const ref = HTMLAttributes['data-ref'] || '';
    const caption = HTMLAttributes['data-caption'] || '';

    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        'data-artifact-embed': 'true',
        class: `artifact-embed artifact-${kind} p-4 my-4 border-2 border-dashed border-gray-300 rounded-lg bg-gray-50 text-center`,
      }),
      [
        'div',
        { class: 'artifact-content' },
        [
          'div',
          { class: 'artifact-icon text-4xl mb-2' },
          kind === 'figure' ? '📊' : kind === 'table' ? '📋' : '📎',
        ],
        ['div', { class: 'artifact-kind text-sm text-gray-500 uppercase' }, kind],
        ['div', { class: 'artifact-ref text-xs text-gray-400' }, `ref: ${ref}`],
        caption ? ['div', { class: 'artifact-caption text-sm mt-2 italic' }, caption] : '',
      ],
    ];
  },

  addCommands() {
    return {
      insertArtifactEmbed:
        (attrs: ArtifactEmbedAttributes) =>
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
            attrs,
          });
        },
    };
  },

  // Optional: Add React node view for more interactive rendering
  // addNodeView() {
  //   return ReactNodeViewRenderer(ArtifactEmbedComponent);
  // },
});

export default ArtifactEmbedNode;
