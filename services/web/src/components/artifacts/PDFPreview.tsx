/**
 * ART-002: PDF Preview Component
 * Display PDF with basic controls (open in new tab fallback)
 * Future: integrate react-pdf or pdf.js for embedded viewer
 */

import React, { useState } from 'react';
import {
  Download,
  ExternalLink,
  FileText,
  AlertCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { cn } from '@/lib/utils';

interface PDFPreviewProps {
  src: string;
  filename?: string;
  maxHeight?: string;
  className?: string;
  onDownload?: () => void;
}

/**
 * PDFPreview Component
 *
 * Note: Full PDF.js integration would require adding react-pdf or pdfjs-dist
 * This implementation provides a graceful fallback with link to open in viewer
 *
 * To implement full PDF viewer:
 * 1. Install: npm install react-pdf pdf.js
 * 2. Set up worker: import { pdfjs } from 'react-pdf';
 * 3. Replace with <Document> and <Page> components
 */
export function PDFPreview({
  src,
  filename = 'document.pdf',
  maxHeight = 'max-h-96',
  className,
  onDownload,
}: PDFPreviewProps) {
  const [error, setError] = useState<string | null>(null);

  const handleOpen = () => {
    try {
      window.open(src, '_blank', 'noopener,noreferrer');
    } catch (err) {
      setError('Failed to open PDF');
    }
  };

  const handleDownload = async () => {
    try {
      const response = await fetch(src, { credentials: 'include' });
      if (!response.ok) throw new Error('Download failed');

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      onDownload?.();
    } catch (err) {
      setError('Failed to download PDF');
    }
  };

  return (
    <div className={cn('space-y-3', className)}>
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className={cn(
        'border rounded-lg bg-muted p-8 flex flex-col items-center justify-center',
        maxHeight
      )}>
        <FileText className="h-16 w-16 text-muted-foreground mb-4 opacity-50" />

        <h3 className="font-semibold text-lg mb-2">{filename}</h3>

        <p className="text-sm text-muted-foreground text-center mb-4 max-w-xs">
          PDF preview requires opening in your default PDF viewer. Click below to open or download.
        </p>

        <div className="flex gap-2 flex-wrap justify-center">
          <Button onClick={handleOpen} variant="outline">
            <ExternalLink className="h-4 w-4 mr-2" />
            Open in Viewer
          </Button>

          <Button onClick={handleDownload} variant="default">
            <Download className="h-4 w-4 mr-2" />
            Download
          </Button>
        </div>
      </div>

      <p className="text-xs text-muted-foreground text-center">
        For embedded PDF viewing with page navigation, a PDF.js integration can be added.
      </p>
    </div>
  );
}

export default PDFPreview;
