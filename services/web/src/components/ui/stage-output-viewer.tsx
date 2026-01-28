/**
 * Stage Output Viewer Component
 *
 * Type-aware output renderer with source badges for workflow stage results.
 * Supports text, table, list, json, and chart output types with proper
 * dark mode support and readable contrast.
 */

import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FileText, Table, List, FileCode, BarChart3, Sparkles, Calculator, FileQuestion } from 'lucide-react';

interface StageOutput {
  id?: string;
  title: string;
  type: 'text' | 'table' | 'list' | 'document' | 'chart' | 'json';
  content: string;
  metadata?: Record<string, unknown>;
  source?: 'ai' | 'computed' | 'template';
}

interface StageOutputViewerProps extends React.HTMLAttributes<HTMLDivElement> {
  output: StageOutput;
  className?: string;
}

const TYPE_ICONS: Record<string, React.ElementType> = {
  text: FileText,
  table: Table,
  list: List,
  document: FileCode,
  chart: BarChart3,
  json: FileCode,
};

const SOURCE_CONFIG: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline'; icon: React.ElementType }> = {
  ai: { label: 'AI Generated', variant: 'default', icon: Sparkles },
  computed: { label: 'Computed from Data', variant: 'secondary', icon: Calculator },
  template: { label: 'Template', variant: 'outline', icon: FileQuestion },
};

export function StageOutputViewer({ output, className, ...props }: StageOutputViewerProps) {
  const TypeIcon = TYPE_ICONS[output.type] || FileText;
  const sourceConfig = SOURCE_CONFIG[output.source || 'template'];
  const SourceIcon = sourceConfig.icon;

  const renderContent = () => {
    switch (output.type) {
      case 'table':
        return renderTable(output.content);
      case 'list':
        return renderList(output.content);
      case 'json':
        return renderJson(output.content);
      case 'chart':
        return renderChart(output.content);
      default:
        return renderText(output.content);
    }
  };

  return (
    <Card className={`overflow-hidden ${className || ''}`} {...props}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 border-b bg-muted/30">
        <div className="flex items-center gap-2">
          <TypeIcon className="h-4 w-4 text-muted-foreground" />
          <CardTitle className="text-sm font-medium">{output.title}</CardTitle>
        </div>
        <Badge variant={sourceConfig.variant} className="gap-1">
          <SourceIcon className="h-3 w-3" />
          {sourceConfig.label}
        </Badge>
      </CardHeader>
      <CardContent className="p-4">
        {renderContent()}
      </CardContent>
    </Card>
  );
}

function renderText(content: string) {
  // Check if content looks like it has structure
  const lines = content.split('\n');

  return (
    <div className="prose prose-sm dark:prose-invert max-w-none">
      {lines.map((line, i) => {
        // Handle headers (lines starting with # or ending with :)
        if (line.startsWith('#') || (line.endsWith(':') && line.length < 50)) {
          return <h4 key={i} className="font-semibold mt-3 mb-1 text-foreground">{line.replace(/^#+\s*/, '')}</h4>;
        }
        // Handle bullet points
        if (line.trim().startsWith('•') || line.trim().startsWith('-') || line.trim().startsWith('✓') || line.trim().startsWith('⚠')) {
          return <p key={i} className="ml-4 my-0.5 text-foreground">{line}</p>;
        }
        // Handle empty lines
        if (!line.trim()) {
          return <br key={i} />;
        }
        // Regular paragraph
        return <p key={i} className="my-1 text-foreground">{line}</p>;
      })}
    </div>
  );
}

function renderTable(content: string) {
  // Parse markdown table or TSV/CSV
  const lines = content.trim().split('\n').filter(l => l.trim());

  if (lines.length === 0) {
    return <p className="text-muted-foreground">No data</p>;
  }

  // Check if it's a markdown table
  const isMarkdownTable = lines[0].includes('|');

  if (isMarkdownTable) {
    const rows = lines
      .filter(line => !line.match(/^\|[-:| ]+\|$/)) // Skip separator rows
      .map(line =>
        line.split('|')
          .map(cell => cell.trim())
          .filter(cell => cell)
      );

    if (rows.length === 0) return <p className="text-muted-foreground">No data</p>;

    const headers = rows[0];
    const dataRows = rows.slice(1);

    return (
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              {headers.map((header, i) => (
                <th key={i} className="px-3 py-2 text-left font-medium text-foreground">
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {dataRows.map((row, i) => (
              <tr key={i} className="border-b last:border-0 hover:bg-muted/30">
                {row.map((cell, j) => (
                  <td key={j} className="px-3 py-2 text-foreground">
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  // Fallback to monospace for non-markdown tables
  return (
    <pre className="text-sm font-mono bg-muted/30 p-3 rounded overflow-x-auto text-foreground">
      {content}
    </pre>
  );
}

function renderList(content: string) {
  const items = content.split('\n').filter(line => line.trim());

  return (
    <ul className="space-y-1">
      {items.map((item, i) => (
        <li key={i} className="flex items-start gap-2 text-foreground">
          <span className="text-muted-foreground mt-1.5">•</span>
          <span>{item.replace(/^[-•*]\s*/, '')}</span>
        </li>
      ))}
    </ul>
  );
}

function renderJson(content: string) {
  try {
    const parsed = JSON.parse(content);
    const formatted = JSON.stringify(parsed, null, 2);
    return (
      <pre className="text-sm font-mono bg-muted/30 p-3 rounded overflow-x-auto text-foreground">
        {formatted}
      </pre>
    );
  } catch {
    return (
      <pre className="text-sm font-mono bg-muted/30 p-3 rounded overflow-x-auto text-foreground">
        {content}
      </pre>
    );
  }
}

function renderChart(content: string) {
  // Placeholder for chart rendering
  return (
    <div className="flex items-center justify-center h-48 bg-muted/30 rounded">
      <div className="text-center text-muted-foreground">
        <BarChart3 className="h-8 w-8 mx-auto mb-2" />
        <p>Chart visualization coming soon</p>
        <p className="text-xs mt-1">Data: {content.substring(0, 50)}...</p>
      </div>
    </div>
  );
}

export default StageOutputViewer;
