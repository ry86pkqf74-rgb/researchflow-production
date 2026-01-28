/**
 * Live Artifacts Panel (Phase 4C - RUN-005)
 *
 * Auto-updating list of artifacts created during a run.
 * Displays artifacts as they're created in real-time.
 * Click to preview or download artifacts.
 *
 * Features:
 * - Real-time artifact updates
 * - Auto-expanding as new artifacts arrive
 * - Click to preview functionality
 * - File size and type display
 * - Download links
 * - Created by information
 */

import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import {
  FileText,
  Download,
  Eye,
  Clock,
  User,
  Zap,
  FileJson,
  FileSpreadsheet,
  Image,
  File,
} from 'lucide-react';

export interface Artifact {
  id: string;
  name: string;
  type: string; // e.g., 'json', 'csv', 'pdf', 'png'
  size: number; // bytes
  createdAt: string;
  createdBy: string;
  stageId: number;
  url?: string;
  previewUrl?: string;
}

interface LiveArtifactsProps {
  artifacts: Artifact[];
  onPreview?: (artifact: Artifact) => void;
  onDownload?: (artifact: Artifact) => void;
  isLoading?: boolean;
  className?: string;
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

function getFileIcon(type: string): React.ReactNode {
  const typeMap: Record<string, React.ReactNode> = {
    json: <FileJson className="h-5 w-5" />,
    csv: <FileSpreadsheet className="h-5 w-5" />,
    xlsx: <FileSpreadsheet className="h-5 w-5" />,
    xls: <FileSpreadsheet className="h-5 w-5" />,
    pdf: <FileText className="h-5 w-5" />,
    txt: <FileText className="h-5 w-5" />,
    png: <Image className="h-5 w-5" />,
    jpg: <Image className="h-5 w-5" />,
    jpeg: <Image className="h-5 w-5" />,
    gif: <Image className="h-5 w-5" />,
  };
  return typeMap[type.toLowerCase()] || <File className="h-5 w-5" />;
}

export function LiveArtifacts({
  artifacts,
  onPreview,
  onDownload,
  isLoading,
  className,
}: LiveArtifactsProps) {
  const [expandedArtifactId, setExpandedArtifactId] = useState<string | undefined>();

  // Sort artifacts by created time (newest first)
  const sortedArtifacts = useMemo(
    () =>
      [...artifacts].sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      ),
    [artifacts]
  );

  // Group artifacts by stage
  const artifactsByStage = useMemo(() => {
    const grouped: Record<number, Artifact[]> = {};
    sortedArtifacts.forEach((artifact) => {
      if (!grouped[artifact.stageId]) {
        grouped[artifact.stageId] = [];
      }
      grouped[artifact.stageId].push(artifact);
    });
    return grouped;
  }, [sortedArtifacts]);

  const handlePreview = (artifact: Artifact) => {
    setExpandedArtifactId(
      expandedArtifactId === artifact.id ? undefined : artifact.id
    );
    onPreview?.(artifact);
  };

  const handleDownload = (artifact: Artifact) => {
    if (artifact.url) {
      const link = document.createElement('a');
      link.href = artifact.url;
      link.download = artifact.name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
    onDownload?.(artifact);
  };

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Artifacts</CardTitle>
          <Badge variant="outline" className="text-xs">
            {artifacts.length} file{artifacts.length !== 1 ? 's' : ''}
          </Badge>
        </div>
      </CardHeader>

      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center p-8">
            <div className="text-center">
              <div className="animate-spin h-8 w-8 border-4 border-gray-300 border-t-blue-600 rounded-full mx-auto mb-2" />
              <p className="text-sm text-gray-600">Loading artifacts...</p>
            </div>
          </div>
        ) : artifacts.length === 0 ? (
          <div className="flex items-center justify-center p-8">
            <p className="text-sm text-gray-600">No artifacts generated yet</p>
          </div>
        ) : (
          <ScrollArea className="h-[400px]">
            <div className="space-y-3 pr-4">
              {Object.entries(artifactsByStage).map(([stageId, stageArtifacts]) => (
                <div key={stageId} className="space-y-2">
                  {/* Stage Header */}
                  <div className="flex items-center gap-2 px-3 py-2 bg-gray-100 rounded-lg">
                    <Zap className="h-4 w-4 text-gray-600" />
                    <p className="text-sm font-semibold text-gray-700">
                      Stage {stageId}
                    </p>
                    <Badge variant="secondary" className="text-xs">
                      {stageArtifacts.length}
                    </Badge>
                  </div>

                  {/* Artifacts in Stage */}
                  <div className="space-y-2 ml-2">
                    {stageArtifacts.map((artifact) => {
                      const isExpanded = expandedArtifactId === artifact.id;

                      return (
                        <div
                          key={artifact.id}
                          className="border rounded-lg overflow-hidden bg-white hover:shadow-sm transition-shadow"
                        >
                          {/* Artifact Item */}
                          <div
                            className="flex items-center gap-3 p-3 cursor-pointer hover:bg-gray-50 transition-colors"
                            onClick={() => handlePreview(artifact)}
                          >
                            <div className="flex-shrink-0 text-gray-600">
                              {getFileIcon(artifact.type)}
                            </div>

                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">
                                {artifact.name}
                              </p>
                              <div className="flex items-center gap-2 mt-1">
                                <Badge variant="outline" className="text-xs">
                                  {artifact.type.toUpperCase()}
                                </Badge>
                                <span className="text-xs text-gray-600">
                                  {formatFileSize(artifact.size)}
                                </span>
                              </div>
                            </div>

                            {/* Action Buttons */}
                            <div className="flex items-center gap-1 flex-shrink-0">
                              {artifact.previewUrl && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 w-7 p-0"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handlePreview(artifact);
                                  }}
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                              )}
                              {artifact.url && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 w-7 p-0"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDownload(artifact);
                                  }}
                                >
                                  <Download className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          </div>

                          {/* Expanded Details */}
                          {isExpanded && (
                            <div className="border-t bg-gray-50 p-3 space-y-2">
                              <div className="flex items-center gap-2 text-xs text-gray-600">
                                <Clock className="h-3.5 w-3.5" />
                                <span>
                                  {new Date(artifact.createdAt).toLocaleString()}
                                </span>
                              </div>
                              <div className="flex items-center gap-2 text-xs text-gray-600">
                                <User className="h-3.5 w-3.5" />
                                <span>{artifact.createdBy}</span>
                              </div>

                              {artifact.previewUrl && (
                                <div className="mt-3">
                                  <p className="text-xs font-medium mb-2 text-gray-700">
                                    Preview
                                  </p>
                                  {artifact.type.match(/^(png|jpg|jpeg|gif)$/) ? (
                                    <img
                                      src={artifact.previewUrl}
                                      alt={artifact.name}
                                      className="max-w-full h-auto rounded border"
                                    />
                                  ) : (
                                    <pre className="bg-white p-2 rounded border text-xs overflow-x-auto max-h-40">
                                      {artifact.previewUrl}
                                    </pre>
                                  )}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}

export default LiveArtifacts;
