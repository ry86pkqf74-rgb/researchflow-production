/**
 * ART-007: Download Bundle Button Component
 * Select multiple artifacts, download as ZIP
 * Show bundle size estimate
 */

import React, { useState, useMemo } from 'react';
import {
  Download,
  Package,
  CheckCircle2,
  Circle,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

export interface BundleArtifact {
  id: string;
  name: string;
  size: number;
  path: string;
  mimeType: string;
}

interface DownloadBundleProps {
  artifacts: BundleArtifact[];
  bundleName?: string;
  maxBundleSize?: number; // in bytes, default 500MB
  onDownloadStart?: () => void;
  onDownloadComplete?: () => void;
  className?: string;
}

export function DownloadBundle({
  artifacts,
  bundleName = 'artifacts',
  maxBundleSize = 500 * 1024 * 1024, // 500MB
  onDownloadStart,
  onDownloadComplete,
  className,
}: DownloadBundleProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    new Set(artifacts.map((a) => a.id))
  );
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const selectedArtifacts = useMemo(
    () => artifacts.filter((a) => selectedIds.has(a.id)),
    [artifacts, selectedIds]
  );

  const totalSize = useMemo(
    () => selectedArtifacts.reduce((sum, a) => sum + a.size, 0),
    [selectedArtifacts]
  );

  const exceedsLimit = totalSize > maxBundleSize;

  const toggleArtifact = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const selectAll = () => {
    if (selectedIds.size === artifacts.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(artifacts.map((a) => a.id)));
    }
  };

  const handleDownload = async () => {
    if (selectedArtifacts.length === 0) {
      setError('Please select at least one artifact');
      return;
    }

    if (exceedsLimit) {
      setError(
        `Bundle size exceeds limit. Maximum: ${formatBytes(maxBundleSize)}`
      );
      return;
    }

    try {
      setIsDownloading(true);
      setError(null);
      setDownloadProgress(0);
      onDownloadStart?.();

      // Create a simple implementation using JSZip (if available)
      // For production, this would be a server endpoint that creates the ZIP
      const response = await fetch('/api/artifacts/bundle', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          artifactIds: Array.from(selectedIds),
          bundleName,
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'Download failed');
      }

      // Handle progress streaming
      if (response.body) {
        const reader = response.body.getReader();
        const chunks: Uint8Array[] = [];
        let receivedBytes = 0;

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            chunks.push(value);
            receivedBytes += value.length;
            setDownloadProgress(
              Math.min(
                99,
                Math.round((receivedBytes / totalSize) * 100)
              )
            );
          }
        } finally {
          reader.releaseLock();
        }

        // Combine chunks
        const blob = new Blob(chunks, { type: 'application/zip' });

        // Download
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${bundleName}.zip`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      } else {
        // Fallback for non-streaming response
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${bundleName}.zip`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }

      setDownloadProgress(100);
      setIsOpen(false);
      onDownloadComplete?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Download failed');
    } finally {
      setIsDownloading(false);
      setTimeout(() => setDownloadProgress(0), 1000);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className={className}>
          <Package className="h-4 w-4 mr-2" />
          Download Bundle
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Download Bundle
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">
              {selectedIds.size} selected
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={selectAll}
              className="text-xs"
            >
              {selectedIds.size === artifacts.length ? 'Deselect All' : 'Select All'}
            </Button>
          </div>

          <ScrollArea className="h-64 border rounded-md">
            <div className="space-y-2 p-3">
              {artifacts.map((artifact) => (
                <div
                  key={artifact.id}
                  className="flex items-center gap-2 p-2 rounded hover:bg-accent"
                >
                  <button
                    onClick={() => toggleArtifact(artifact.id)}
                    className="flex-shrink-0"
                  >
                    {selectedIds.has(artifact.id) ? (
                      <CheckCircle2 className="h-5 w-5 text-primary" />
                    ) : (
                      <Circle className="h-5 w-5 text-muted-foreground" />
                    )}
                  </button>

                  <div className="flex-1 min-w-0">
                    <p className="text-sm truncate font-medium">
                      {artifact.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatBytes(artifact.size)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>

          <div className="bg-muted p-3 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Bundle Size</span>
              <Badge
                variant={exceedsLimit ? 'destructive' : 'outline'}
              >
                {formatBytes(totalSize)}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              Max: {formatBytes(maxBundleSize)}
            </p>
          </div>

          {isDownloading && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Downloading...</span>
                <span className="text-sm text-muted-foreground">
                  {downloadProgress}%
                </span>
              </div>
              <Progress value={downloadProgress} />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setIsOpen(false)}
            disabled={isDownloading}
          >
            Cancel
          </Button>
          <Button
            onClick={handleDownload}
            disabled={selectedArtifacts.length === 0 || exceedsLimit || isDownloading}
          >
            {isDownloading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Downloading...
              </>
            ) : (
              <>
                <Download className="h-4 w-4 mr-2" />
                Download
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

export default DownloadBundle;
