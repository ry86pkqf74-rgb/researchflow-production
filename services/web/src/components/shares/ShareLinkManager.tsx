/**
 * Share Link Manager Component
 *
 * Manages external reviewer share links for artifacts.
 * Supports creating, revoking, and extending share links.
 *
 * Features:
 * - Create share links with permissions (read/comment)
 * - Set expiration dates
 * - Revoke and extend shares
 * - Copy share URL to clipboard
 * - View share access history
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Input } from '../ui/input';
import { Alert, AlertDescription } from '../ui/alert';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import {
  Share2,
  Link2,
  Copy,
  Check,
  Clock,
  Eye,
  MessageSquare,
  Trash2,
  Plus,
  Loader2,
  AlertTriangle,
  RefreshCw,
  ExternalLink,
} from 'lucide-react';

interface ShareLink {
  id: string;
  artifactId: string;
  token?: string; // Only present on creation
  permission: 'read' | 'comment';
  expiresAt: string | null;
  revoked: boolean;
  revokedAt?: string;
  createdBy: string;
  createdAt: string;
  accessCount?: number;
  lastAccessedAt?: string;
}

interface ShareLinkManagerProps {
  artifactId: string;
  artifactName?: string;
  currentUserId: string;
  baseShareUrl?: string;
  onShareCreated?: (share: ShareLink) => void;
  className?: string;
}

export function ShareLinkManager({
  artifactId,
  artifactName = 'this artifact',
  currentUserId,
  baseShareUrl = `${window.location.origin}/shared`,
  onShareCreated,
  className = '',
}: ShareLinkManagerProps) {
  const [shares, setShares] = useState<ShareLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Create dialog state
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [permission, setPermission] = useState<'read' | 'comment'>('read');
  const [expiresInDays, setExpiresInDays] = useState<number>(30);
  const [creating, setCreating] = useState(false);
  const [newShareUrl, setNewShareUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Extend dialog state
  const [extendDialogOpen, setExtendDialogOpen] = useState(false);
  const [extendingShare, setExtendingShare] = useState<ShareLink | null>(null);
  const [additionalDays, setAdditionalDays] = useState<number>(30);
  const [extending, setExtending] = useState(false);

  // Fetch shares
  const fetchShares = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/ros/shares?artifactId=${artifactId}`);

      if (!response.ok) {
        throw new Error('Failed to fetch shares');
      }

      const data = await response.json();
      setShares(data.shares || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [artifactId]);

  useEffect(() => {
    fetchShares();
  }, [fetchShares]);

  // Create share
  const handleCreateShare = async () => {
    setCreating(true);
    setNewShareUrl(null);

    try {
      const response = await fetch('/api/ros/shares', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          artifactId,
          permission,
          expiresInDays,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create share');
      }

      const share = await response.json();

      // Construct share URL with token
      const shareUrl = `${baseShareUrl}/${share.token}`;
      setNewShareUrl(shareUrl);

      await fetchShares();
      onShareCreated?.(share);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create share');
      setCreateDialogOpen(false);
    } finally {
      setCreating(false);
    }
  };

  // Copy to clipboard
  const handleCopyUrl = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  // Revoke share
  const handleRevokeShare = async (shareId: string) => {
    if (!confirm('Are you sure you want to revoke this share link? It will no longer be accessible.')) {
      return;
    }

    try {
      const response = await fetch(`/api/ros/shares/${shareId}/revoke`, {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Failed to revoke share');
      }

      await fetchShares();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to revoke share');
    }
  };

  // Open extend dialog
  const openExtendDialog = (share: ShareLink) => {
    setExtendingShare(share);
    setExtendDialogOpen(true);
  };

  // Extend share
  const handleExtendShare = async () => {
    if (!extendingShare) return;

    setExtending(true);

    try {
      const response = await fetch(`/api/ros/shares/${extendingShare.id}/extend`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ additionalDays }),
      });

      if (!response.ok) {
        throw new Error('Failed to extend share');
      }

      setExtendDialogOpen(false);
      setExtendingShare(null);
      await fetchShares();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to extend share');
    } finally {
      setExtending(false);
    }
  };

  // Close create dialog and reset state
  const closeCreateDialog = () => {
    setCreateDialogOpen(false);
    setNewShareUrl(null);
    setPermission('read');
    setExpiresInDays(30);
  };

  // Format expiration
  const formatExpiration = (expiresAt: string | null) => {
    if (!expiresAt) return 'Never';

    const date = new Date(expiresAt);
    const now = new Date();
    const daysLeft = Math.ceil((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    if (daysLeft < 0) return 'Expired';
    if (daysLeft === 0) return 'Expires today';
    if (daysLeft === 1) return 'Expires tomorrow';
    return `Expires in ${daysLeft} days`;
  };

  // Active shares
  const activeShares = shares.filter((s) => !s.revoked);
  const revokedShares = shares.filter((s) => s.revoked);

  if (loading) {
    return (
      <Card className={`p-6 ${className}`}>
        <div className="flex items-center justify-center h-32">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </Card>
    );
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Header */}
      <Card className="p-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Share2 className="h-5 w-5" />
            Share Links ({activeShares.length} active)
          </h3>

          <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Create Share Link
              </Button>
            </DialogTrigger>
            <DialogContent>
              {!newShareUrl ? (
                <>
                  <DialogHeader>
                    <DialogTitle>Create Share Link</DialogTitle>
                    <DialogDescription>
                      Create a secure link to share {artifactName} with external reviewers.
                    </DialogDescription>
                  </DialogHeader>

                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Permission Level</label>
                      <Select
                        value={permission}
                        onValueChange={(v) => setPermission(v as 'read' | 'comment')}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="read">
                            <div className="flex items-center gap-2">
                              <Eye className="h-4 w-4" />
                              <span>Read Only</span>
                            </div>
                          </SelectItem>
                          <SelectItem value="comment">
                            <div className="flex items-center gap-2">
                              <MessageSquare className="h-4 w-4" />
                              <span>Read & Comment</span>
                            </div>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium">Expires In</label>
                      <Select
                        value={String(expiresInDays)}
                        onValueChange={(v) => setExpiresInDays(Number(v))}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="7">7 days</SelectItem>
                          <SelectItem value="14">14 days</SelectItem>
                          <SelectItem value="30">30 days</SelectItem>
                          <SelectItem value="60">60 days</SelectItem>
                          <SelectItem value="90">90 days</SelectItem>
                          <SelectItem value="365">1 year</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <DialogFooter>
                    <Button variant="outline" onClick={closeCreateDialog}>
                      Cancel
                    </Button>
                    <Button onClick={handleCreateShare} disabled={creating}>
                      {creating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                      Create Link
                    </Button>
                  </DialogFooter>
                </>
              ) : (
                <>
                  <DialogHeader>
                    <DialogTitle>Share Link Created</DialogTitle>
                    <DialogDescription>
                      Copy and send this link to your external reviewer.
                    </DialogDescription>
                  </DialogHeader>

                  <div className="py-4 space-y-4">
                    <Alert>
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription>
                        This token will only be shown once. Make sure to copy it now.
                      </AlertDescription>
                    </Alert>

                    <div className="flex gap-2">
                      <Input
                        value={newShareUrl}
                        readOnly
                        className="font-mono text-sm"
                      />
                      <Button
                        variant="outline"
                        onClick={() => handleCopyUrl(newShareUrl)}
                      >
                        {copied ? (
                          <Check className="h-4 w-4" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>

                  <DialogFooter>
                    <Button onClick={closeCreateDialog}>Done</Button>
                  </DialogFooter>
                </>
              )}
            </DialogContent>
          </Dialog>
        </div>
      </Card>

      {/* Error */}
      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Active shares */}
      <div className="space-y-3">
        <h4 className="font-medium">Active Shares</h4>

        {activeShares.length === 0 ? (
          <Card className="p-8 text-center text-muted-foreground">
            No active share links. Create one to share with external reviewers.
          </Card>
        ) : (
          activeShares.map((share) => (
            <Card key={share.id} className="p-4">
              <div className="flex items-start justify-between">
                <div className="space-y-2">
                  <div className="flex items-center gap-3">
                    <Link2 className="h-5 w-5 text-muted-foreground" />
                    <Badge variant="outline" className="flex items-center gap-1">
                      {share.permission === 'read' ? (
                        <>
                          <Eye className="h-3 w-3" />
                          Read Only
                        </>
                      ) : (
                        <>
                          <MessageSquare className="h-3 w-3" />
                          Read & Comment
                        </>
                      )}
                    </Badge>
                    <Badge
                      variant={
                        share.expiresAt &&
                        new Date(share.expiresAt) < new Date()
                          ? 'destructive'
                          : 'secondary'
                      }
                      className="flex items-center gap-1"
                    >
                      <Clock className="h-3 w-3" />
                      {formatExpiration(share.expiresAt)}
                    </Badge>
                  </div>

                  <div className="text-sm text-muted-foreground space-y-1">
                    <p>
                      Created by {share.createdBy} on{' '}
                      {new Date(share.createdAt).toLocaleDateString()}
                    </p>
                    {share.accessCount !== undefined && (
                      <p>
                        Accessed {share.accessCount} time{share.accessCount !== 1 ? 's' : ''}
                        {share.lastAccessedAt && (
                          <>, last on {new Date(share.lastAccessedAt).toLocaleDateString()}</>
                        )}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openExtendDialog(share)}
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Extend
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => handleRevokeShare(share.id)}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Revoke
                  </Button>
                </div>
              </div>
            </Card>
          ))
        )}
      </div>

      {/* Revoked shares */}
      {revokedShares.length > 0 && (
        <div className="space-y-3">
          <h4 className="font-medium text-muted-foreground">Revoked Shares</h4>

          {revokedShares.map((share) => (
            <Card key={share.id} className="p-4 opacity-60">
              <div className="flex items-center gap-3">
                <Link2 className="h-5 w-5 text-muted-foreground" />
                <Badge variant="outline" className="line-through">
                  {share.permission === 'read' ? 'Read Only' : 'Read & Comment'}
                </Badge>
                <span className="text-sm text-muted-foreground">
                  Revoked on {new Date(share.revokedAt!).toLocaleDateString()}
                </span>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Extend dialog */}
      <Dialog open={extendDialogOpen} onOpenChange={setExtendDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Extend Share Expiration</DialogTitle>
            <DialogDescription>
              Add more time to this share link's expiration date.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4 space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Add Days</label>
              <Select
                value={String(additionalDays)}
                onValueChange={(v) => setAdditionalDays(Number(v))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7">7 days</SelectItem>
                  <SelectItem value="14">14 days</SelectItem>
                  <SelectItem value="30">30 days</SelectItem>
                  <SelectItem value="60">60 days</SelectItem>
                  <SelectItem value="90">90 days</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {extendingShare?.expiresAt && (
              <p className="text-sm text-muted-foreground">
                Current expiration: {new Date(extendingShare.expiresAt).toLocaleDateString()}
              </p>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setExtendDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleExtendShare} disabled={extending}>
              {extending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Extend
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
