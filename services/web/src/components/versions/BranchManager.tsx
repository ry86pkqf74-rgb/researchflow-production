/**
 * Branch Manager Component
 *
 * Manages artifact branching with visual branch tree.
 * Supports creating, merging, and comparing branches.
 *
 * Features:
 * - Create branch from any version
 * - Branch tree visualization
 * - Merge branch with conflict detection
 * - Delete/archive branches
 * - Branch comparison
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Input } from '../ui/input';
import { Alert, AlertDescription } from '../ui/alert';
import { Textarea } from '../ui/textarea';
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
  GitBranch,
  GitMerge,
  Plus,
  Trash2,
  Loader2,
  AlertTriangle,
  GitCompare,
  Archive,
  MoreVertical,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';

interface Branch {
  id: string;
  artifactId: string;
  name: string;
  sourceVersionId: string;
  sourceVersionNumber: number;
  headVersionId: string;
  headVersionNumber: number;
  status: 'active' | 'merged' | 'archived';
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  mergedAt?: string;
  mergedBy?: string;
  mergedIntoVersionId?: string;
}

interface BranchManagerProps {
  artifactId: string;
  currentUserId: string;
  onBranchCreated?: (branch: Branch) => void;
  onBranchMerged?: (branch: Branch) => void;
  onBranchCompare?: (branchId: string) => void;
  className?: string;
}

export function BranchManager({
  artifactId,
  currentUserId,
  onBranchCreated,
  onBranchMerged,
  onBranchCompare,
  className = '',
}: BranchManagerProps) {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Create branch dialog state
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newBranchName, setNewBranchName] = useState('');
  const [sourceVersionId, setSourceVersionId] = useState<string>('');
  const [creating, setCreating] = useState(false);

  // Merge dialog state
  const [mergeDialogOpen, setMergeDialogOpen] = useState(false);
  const [mergingBranch, setMergingBranch] = useState<Branch | null>(null);
  const [mergeStrategy, setMergeStrategy] = useState<'squash' | 'rebase'>('squash');
  const [mergeMessage, setMergeMessage] = useState('');
  const [merging, setMerging] = useState(false);
  const [conflictInfo, setConflictInfo] = useState<string | null>(null);

  // Filter state
  const [statusFilter, setStatusFilter] = useState<'active' | 'merged' | 'archived' | 'all'>('active');

  // Fetch branches
  const fetchBranches = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/ros/artifacts/${artifactId}/branches`);

      if (!response.ok) {
        throw new Error('Failed to fetch branches');
      }

      const data = await response.json();
      setBranches(data.branches || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [artifactId]);

  useEffect(() => {
    fetchBranches();
  }, [fetchBranches]);

  // Create branch
  const handleCreateBranch = async () => {
    if (!newBranchName.trim() || !sourceVersionId) return;

    setCreating(true);

    try {
      const response = await fetch(`/api/ros/artifacts/${artifactId}/branches`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newBranchName.trim(),
          sourceVersionId,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create branch');
      }

      const branch = await response.json();
      setNewBranchName('');
      setSourceVersionId('');
      setCreateDialogOpen(false);
      await fetchBranches();
      onBranchCreated?.(branch);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create branch');
    } finally {
      setCreating(false);
    }
  };

  // Check for merge conflicts
  const checkMergeConflicts = async (branchId: string) => {
    try {
      const response = await fetch(
        `/api/ros/branches/${branchId}/merge-preview`
      );

      if (!response.ok) return null;

      const data = await response.json();
      return data.hasConflicts ? data.conflictDetails : null;
    } catch {
      return null;
    }
  };

  // Open merge dialog
  const openMergeDialog = async (branch: Branch) => {
    setMergingBranch(branch);
    setMergeMessage(`Merge branch '${branch.name}'`);
    setMergeDialogOpen(true);

    const conflicts = await checkMergeConflicts(branch.id);
    setConflictInfo(conflicts);
  };

  // Merge branch
  const handleMergeBranch = async () => {
    if (!mergingBranch) return;

    setMerging(true);

    try {
      const response = await fetch(
        `/api/ros/branches/${mergingBranch.id}/merge`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            strategy: mergeStrategy,
            message: mergeMessage,
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to merge branch');
      }

      const result = await response.json();
      setMergeDialogOpen(false);
      setMergingBranch(null);
      setMergeMessage('');
      setConflictInfo(null);
      await fetchBranches();
      onBranchMerged?.(result.branch);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to merge branch');
    } finally {
      setMerging(false);
    }
  };

  // Archive branch
  const handleArchiveBranch = async (branchId: string) => {
    if (!confirm('Are you sure you want to archive this branch?')) return;

    try {
      const response = await fetch(`/api/ros/branches/${branchId}/archive`, {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Failed to archive branch');
      }

      await fetchBranches();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to archive branch');
    }
  };

  // Delete branch
  const handleDeleteBranch = async (branchId: string) => {
    if (!confirm('Are you sure you want to delete this branch? This cannot be undone.')) {
      return;
    }

    try {
      const response = await fetch(`/api/ros/branches/${branchId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete branch');
      }

      await fetchBranches();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete branch');
    }
  };

  // Filter branches
  const filteredBranches = branches.filter((b) => {
    if (statusFilter === 'all') return true;
    return b.status === statusFilter;
  });

  // Status badge color
  const getStatusBadge = (status: Branch['status']) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-green-500">Active</Badge>;
      case 'merged':
        return <Badge className="bg-blue-500">Merged</Badge>;
      case 'archived':
        return <Badge variant="secondary">Archived</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

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
            <GitBranch className="h-5 w-5" />
            Branches ({branches.filter((b) => b.status === 'active').length} active)
          </h3>

          <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-2" />
                New Branch
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New Branch</DialogTitle>
                <DialogDescription>
                  Create a new branch from an existing version to work on changes independently.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Branch Name</label>
                  <Input
                    value={newBranchName}
                    onChange={(e) => setNewBranchName(e.target.value)}
                    placeholder="e.g., reviewer-feedback, experiments"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Source Version</label>
                  <Select value={sourceVersionId} onValueChange={setSourceVersionId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select version to branch from" />
                    </SelectTrigger>
                    <SelectContent>
                      {/* Version options would be populated here */}
                      <SelectItem value="latest">Latest Version</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={handleCreateBranch}
                  disabled={creating || !newBranchName.trim()}
                >
                  {creating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Create Branch
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {/* Status filter */}
        <div className="flex gap-2 mt-4">
          {(['active', 'merged', 'archived', 'all'] as const).map((status) => (
            <Button
              key={status}
              variant={statusFilter === status ? 'default' : 'outline'}
              size="sm"
              onClick={() => setStatusFilter(status)}
              className="capitalize"
            >
              {status}
            </Button>
          ))}
        </div>
      </Card>

      {/* Error */}
      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Branch list */}
      <div className="space-y-3">
        {filteredBranches.length === 0 ? (
          <Card className="p-8 text-center text-muted-foreground">
            {statusFilter === 'all'
              ? 'No branches yet. Create one to start working on changes independently.'
              : `No ${statusFilter} branches`}
          </Card>
        ) : (
          filteredBranches.map((branch) => (
            <Card key={branch.id} className="p-4">
              <div className="flex items-start justify-between">
                <div className="space-y-2">
                  <div className="flex items-center gap-3">
                    <GitBranch className="h-5 w-5 text-muted-foreground" />
                    <span className="font-semibold">{branch.name}</span>
                    {getStatusBadge(branch.status)}
                  </div>

                  <div className="text-sm text-muted-foreground space-y-1">
                    <p>
                      Created from v{branch.sourceVersionNumber} on{' '}
                      {new Date(branch.createdAt).toLocaleDateString()} by {branch.createdBy}
                    </p>
                    <p>
                      Head: v{branch.headVersionNumber} (last updated{' '}
                      {new Date(branch.updatedAt).toLocaleDateString()})
                    </p>
                    {branch.mergedAt && (
                      <p>
                        Merged on {new Date(branch.mergedAt).toLocaleDateString()} by{' '}
                        {branch.mergedBy}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {branch.status === 'active' && (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onBranchCompare?.(branch.id)}
                      >
                        <GitCompare className="h-4 w-4 mr-2" />
                        Compare
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => openMergeDialog(branch)}
                      >
                        <GitMerge className="h-4 w-4 mr-2" />
                        Merge
                      </Button>
                    </>
                  )}

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {branch.status === 'active' && (
                        <DropdownMenuItem onClick={() => handleArchiveBranch(branch.id)}>
                          <Archive className="h-4 w-4 mr-2" />
                          Archive
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem
                        onClick={() => handleDeleteBranch(branch.id)}
                        className="text-destructive"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            </Card>
          ))
        )}
      </div>

      {/* Merge dialog */}
      <Dialog open={mergeDialogOpen} onOpenChange={setMergeDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Merge Branch: {mergingBranch?.name}</DialogTitle>
            <DialogDescription>
              Merge this branch back into the main artifact version.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {conflictInfo && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  Conflicts detected: {conflictInfo}
                </AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <label className="text-sm font-medium">Merge Strategy</label>
              <Select
                value={mergeStrategy}
                onValueChange={(v) => setMergeStrategy(v as 'squash' | 'rebase')}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="squash">Squash Merge (combine all changes)</SelectItem>
                  <SelectItem value="rebase">Rebase (preserve commit history)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Merge Message</label>
              <Textarea
                value={mergeMessage}
                onChange={(e) => setMergeMessage(e.target.value)}
                placeholder="Describe the changes being merged..."
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setMergeDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleMergeBranch}
              disabled={merging}
            >
              {merging && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Merge Branch
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
