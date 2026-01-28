/**
 * ART-004: Text/JSON Syntax Highlight Component
 * Syntax highlighting for JSON, Markdown, plain text
 * Line numbers, copy button
 */

import React, { useState, useCallback } from 'react';
import { Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

interface TextPreviewProps {
  content: string;
  language?: 'json' | 'markdown' | 'text' | 'javascript' | 'typescript' | 'python' | 'sql';
  showLineNumbers?: boolean;
  maxHeight?: string;
  className?: string;
  onCopy?: () => void;
}

// Simple syntax highlighting for JSON
function highlightJson(text: string): React.ReactNode[] {
  const lines = text.split('\n');
  return lines.map((line, lineIdx) => {
    // Simple regex-based syntax highlighting
    let highlighted = line
      .replace(/"([^"]*)"\s*:/g, (match) => {
        return `<span class="text-blue-500">"${match.slice(1, -2)}"</span>:`;
      })
      .replace(/:\s*"([^"]*)"/g, (match) => {
        return `: <span class="text-green-500">"${match.slice(2)}"</span>`;
      })
      .replace(/:\s*(\d+|true|false|null)/g, (match) => {
        return `: <span class="text-orange-500">${match.slice(2)}</span>`;
      })
      .replace(/\[/g, '<span class="text-yellow-500">[</span>')
      .replace(/\]/g, '<span class="text-yellow-500">]</span>')
      .replace(/\{/g, '<span class="text-yellow-500">{</span>')
      .replace(/\}/g, '<span class="text-yellow-500">}</span>');

    return (
      <div key={lineIdx} className="flex">
        <span className="select-none w-8 text-right pr-3 text-muted-foreground text-xs">
          {lineIdx + 1}
        </span>
        <div dangerouslySetInnerHTML={{ __html: highlighted }} />
      </div>
    );
  });
}

// Simple syntax highlighting for markdown
function highlightMarkdown(text: string): React.ReactNode[] {
  const lines = text.split('\n');
  return lines.map((line, lineIdx) => {
    let className = '';
    let content = line;

    if (line.startsWith('#')) {
      className = 'font-bold text-blue-600';
      if (line.startsWith('##')) {
        className = 'font-semibold text-blue-600';
      }
    } else if (line.startsWith('-') || line.startsWith('*')) {
      className = 'text-gray-600';
    }

    return (
      <div key={lineIdx} className="flex">
        <span className="select-none w-8 text-right pr-3 text-muted-foreground text-xs">
          {lineIdx + 1}
        </span>
        <span className={className}>{content}</span>
      </div>
    );
  });
}

// Highlight plain text with line numbers
function highlightPlainText(text: string): React.ReactNode[] {
  const lines = text.split('\n');
  return lines.map((line, lineIdx) => (
    <div key={lineIdx} className="flex">
      <span className="select-none w-8 text-right pr-3 text-muted-foreground text-xs">
        {lineIdx + 1}
      </span>
      <span className="font-mono text-sm">{line || '\u00A0'}</span>
    </div>
  ));
}

function highlightCode(text: string, language: string): React.ReactNode[] {
  // For now, use plain highlighting with language-specific keywords
  const lines = text.split('\n');
  const keywords = {
    python: ['def', 'class', 'import', 'from', 'if', 'else', 'for', 'while', 'return'],
    javascript: ['function', 'const', 'let', 'var', 'if', 'else', 'for', 'while', 'return', 'import', 'export'],
    typescript: ['function', 'const', 'let', 'var', 'if', 'else', 'for', 'while', 'return', 'import', 'export', 'interface', 'type'],
    sql: ['SELECT', 'FROM', 'WHERE', 'JOIN', 'LEFT', 'RIGHT', 'INNER', 'ORDER', 'BY'],
  };

  const langKeywords = keywords[language as keyof typeof keywords] || [];

  return lines.map((line, lineIdx) => {
    let highlighted = line;

    // Highlight keywords
    langKeywords.forEach((keyword) => {
      const regex = new RegExp(`\\b${keyword}\\b`, 'g');
      highlighted = highlighted.replace(
        regex,
        `<span class="text-yellow-600 font-semibold">${keyword}</span>`
      );
    });

    // Highlight strings
    highlighted = highlighted.replace(/"([^"]*)"/g, '<span class="text-green-600">"$1"</span>');
    highlighted = highlighted.replace(/'([^']*)'/g, "<span class=\"text-green-600\">'$1'</span>");

    // Highlight comments
    highlighted = highlighted.replace(/(\/\/.*)/g, '<span class="text-gray-500">$1</span>');
    highlighted = highlighted.replace(/(#.*)/g, '<span class="text-gray-500">$1</span>');

    return (
      <div key={lineIdx} className="flex">
        <span className="select-none w-8 text-right pr-3 text-muted-foreground text-xs">
          {lineIdx + 1}
        </span>
        <div dangerouslySetInnerHTML={{ __html: highlighted }} />
      </div>
    );
  });
}

export function TextPreview({
  content,
  language = 'text',
  showLineNumbers = true,
  maxHeight = 'max-h-96',
  className,
  onCopy,
}: TextPreviewProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      onCopy?.();
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  }, [content, onCopy]);

  const getHighlightedContent = () => {
    switch (language) {
      case 'json':
        return highlightJson(content);
      case 'markdown':
        return highlightMarkdown(content);
      case 'text':
        return highlightPlainText(content);
      default:
        return highlightCode(content, language);
    }
  };

  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex items-center justify-between">
        <Badge variant="secondary">{language}</Badge>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleCopy}
          className="h-7"
        >
          {copied ? (
            <>
              <Check className="h-3 w-3 mr-1" />
              Copied
            </>
          ) : (
            <>
              <Copy className="h-3 w-3 mr-1" />
              Copy
            </>
          )}
        </Button>
      </div>

      <ScrollArea className={cn(maxHeight, 'border rounded-md bg-muted p-3')}>
        <pre className="font-mono text-sm leading-relaxed">
          {getHighlightedContent()}
        </pre>
      </ScrollArea>
    </div>
  );
}

export default TextPreview;
