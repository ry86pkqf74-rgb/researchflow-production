/**
 * Submission Tracker Component
 *
 * Tracks conference/journal submissions with reviewer feedback and rebuttals.
 * Supports the full submission lifecycle from draft to acceptance.
 *
 * Features:
 * - Submission status tracking
 * - Reviewer point management
 * - Rebuttal response drafting
 * - Decision timeline
 * - Package export status
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import {
  Send,
  FileText,
  MessageSquare,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  Plus,
  Loader2,
  Edit,
  Archive,
  ExternalLink,
  Package,
} from 'lucide-react';

interface Submission {
  id: string;
  researchId: string;
  targetId: string;
  targetName: string;
  targetType: 'conference' | 'journal';
  status: 'draft' | 'submitted' | 'under_review' | 'revision_requested' | 'accepted' | 'rejected' | 'withdrawn';
  submittedAt?: string;
  decisionAt?: string;
  createdBy: string;
  createdAt: string;
  submissionUrl?: string;
  confirmationNumber?: string;
}

interface ReviewerPoint {
  id: string;
  submissionId: string;
  reviewerId: string;
  pointNumber: number;
  body: string;
  category: 'major' | 'minor' | 'comment' | 'praise';
  addressed: boolean;
  createdAt: string;
}

interface RebuttalResponse {
  id: string;
  pointId: string;
  body: string;
  version: number;
  status: 'draft' | 'final';
  createdBy: string;
  createdAt: string;
}

interface SubmissionTrackerProps {
  researchId: string;
  currentUserId: string;
  onSubmissionCreated?: (submission: Submission) => void;
  className?: string;
}

export function SubmissionTracker({
  researchId,
  currentUserId,
  onSubmissionCreated,
  className = '',
}: SubmissionTrackerProps) {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Selected submission details
  const [selectedSubmission, setSelectedSubmission] = useState<Submission | null>(null);
  const [reviewerPoints, setReviewerPoints] = useState<ReviewerPoint[]>([]);
  const [rebuttals, setRebuttals] = useState<RebuttalResponse[]>([]);
  const [loadingDetails, setLoadingDetails] = useState(false);

  // Create submission dialog
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newTargetName, setNewTargetName] = useState('');
  const [newTargetType, setNewTargetType] = useState<'conference' | 'journal'>('conference');
  const [creating, setCreating] = useState(false);

  // Add reviewer point dialog
  const [addPointDialogOpen, setAddPointDialogOpen] = useState(false);
  const [pointBody, setPointBody] = useState('');
  const [pointCategory, setPointCategory] = useState<ReviewerPoint['category']>('major');
  const [pointReviewerId, setPointReviewerId] = useState('Reviewer 1');
  const [addingPoint, setAddingPoint] = useState(false);

  // Rebuttal dialog
  const [rebuttalDialogOpen, setRebuttalDialogOpen] = useState(false);
  const [selectedPoint, setSelectedPoint] = useState<ReviewerPoint | null>(null);
  const [rebuttalBody, setRebuttalBody] = useState('');
  const [savingRebuttal, setSavingRebuttal] = useState(false);

  // Fetch submissions
  const fetchSubmissions = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/ros/submissions?researchId=${researchId}`);

      if (!response.ok) {
        throw new Error('Failed to fetch submissions');
      }

      const data = await response.json();
      setSubmissions(data.submissions || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [researchId]);

  useEffect(() => {
    fetchSubmissions();
  }, [fetchSubmissions]);

  // Fetch submission details
  const fetchSubmissionDetails = useCallback(async (submissionId: string) => {
    setLoadingDetails(true);

    try {
      const [pointsRes, rebuttalsRes] = await Promise.all([
        fetch(`/api/ros/submissions/${submissionId}/points`),
        fetch(`/api/ros/submissions/${submissionId}/rebuttals`),
      ]);

      if (pointsRes.ok) {
        const pointsData = await pointsRes.json();
        setReviewerPoints(pointsData.points || []);
      }

      if (rebuttalsRes.ok) {
        const rebuttalsData = await rebuttalsRes.json();
        setRebuttals(rebuttalsData.rebuttals || []);
      }
    } catch (err) {
      console.error('Error fetching details:', err);
    } finally {
      setLoadingDetails(false);
    }
  }, []);

  // Select submission
  const handleSelectSubmission = (submission: Submission) => {
    setSelectedSubmission(submission);
    fetchSubmissionDetails(submission.id);
  };

  // Create submission
  const handleCreateSubmission = async () => {
    if (!newTargetName.trim()) return;

    setCreating(true);

    try {
      const response = await fetch('/api/ros/submissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          researchId,
          targetName: newTargetName,
          targetType: newTargetType,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create submission');
      }

      const submission = await response.json();
      setNewTargetName('');
      setCreateDialogOpen(false);
      await fetchSubmissions();
      onSubmissionCreated?.(submission);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create submission');
    } finally {
      setCreating(false);
    }
  };

  // Update submission status
  const handleUpdateStatus = async (submissionId: string, newStatus: Submission['status']) => {
    try {
      const response = await fetch(`/api/ros/submissions/${submissionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!response.ok) {
        throw new Error('Failed to update status');
      }

      await fetchSubmissions();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update submission');
    }
  };

  // Add reviewer point
  const handleAddPoint = async () => {
    if (!selectedSubmission || !pointBody.trim()) return;

    setAddingPoint(true);

    try {
      const response = await fetch(`/api/ros/submissions/${selectedSubmission.id}/points`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reviewerId: pointReviewerId,
          body: pointBody,
          category: pointCategory,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to add point');
      }

      setPointBody('');
      setAddPointDialogOpen(false);
      await fetchSubmissionDetails(selectedSubmission.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add reviewer point');
    } finally {
      setAddingPoint(false);
    }
  };

  // Open rebuttal dialog
  const openRebuttalDialog = (point: ReviewerPoint) => {
    setSelectedPoint(point);
    // Find existing rebuttal
    const existingRebuttal = rebuttals.find((r) => r.pointId === point.id);
    setRebuttalBody(existingRebuttal?.body || '');
    setRebuttalDialogOpen(true);
  };

  // Save rebuttal
  const handleSaveRebuttal = async (status: 'draft' | 'final') => {
    if (!selectedPoint || !rebuttalBody.trim()) return;

    setSavingRebuttal(true);

    try {
      const response = await fetch(`/api/ros/points/${selectedPoint.id}/rebuttal`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          body: rebuttalBody,
          status,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save rebuttal');
      }

      setRebuttalDialogOpen(false);
      setSelectedPoint(null);
      setRebuttalBody('');
      await fetchSubmissionDetails(selectedSubmission!.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save rebuttal');
    } finally {
      setSavingRebuttal(false);
    }
  };

  // Mark point as addressed
  const handleMarkAddressed = async (pointId: string, addressed: boolean) => {
    try {
      const response = await fetch(`/api/ros/points/${pointId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ addressed }),
      });

      if (!response.ok) {
        throw new Error('Failed to update point');
      }

      await fetchSubmissionDetails(selectedSubmission!.id);
    } catch (err) {
      console.error('Error updating point:', err);
    }
  };

  // Status badge
  const getStatusBadge = (status: Submission['status']) => {
    const badges: Record<Submission['status'], { icon: React.ReactNode; color: string; label: string }> = {
      draft: { icon: <FileText className="h-3 w-3" />, color: 'bg-gray-500', label: 'Draft' },
      submitted: { icon: <Send className="h-3 w-3" />, color: 'bg-blue-500', label: 'Submitted' },
      under_review: { icon: <Clock className="h-3 w-3" />, color: 'bg-yellow-500', label: 'Under Review' },
      revision_requested: { icon: <Edit className="h-3 w-3" />, color: 'bg-orange-500', label: 'Revision Requested' },
      accepted: { icon: <CheckCircle className="h-3 w-3" />, color: 'bg-green-500', label: 'Accepted' },
      rejected: { icon: <XCircle className="h-3 w-3" />, color: 'bg-red-500', label: 'Rejected' },
      withdrawn: { icon: <Archive className="h-3 w-3" />, color: 'bg-gray-500', label: 'Withdrawn' },
    };

    const badge = badges[status];
    return (
      <Badge className={`${badge.color} flex items-center gap-1`}>
        {badge.icon}
        {badge.label}
      </Badge>
    );
  };

  // Category badge
  const getCategoryBadge = (category: ReviewerPoint['category']) => {
    const colors: Record<ReviewerPoint['category'], string> = {
      major: 'bg-red-500',
      minor: 'bg-yellow-500',
      comment: 'bg-blue-500',
      praise: 'bg-green-500',
    };
    return <Badge className={`${colors[category]} capitalize`}>{category}</Badge>;
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
            <Send className="h-5 w-5" />
            Submissions ({submissions.length})
          </h3>

          <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-2" />
                New Submission
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Submission</DialogTitle>
                <DialogDescription>
                  Track a new submission to a conference or journal.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Target Name</label>
                  <Input
                    value={newTargetName}
                    onChange={(e) => setNewTargetName(e.target.value)}
                    placeholder="e.g., ICML 2025, Nature Medicine"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Type</label>
                  <Select
                    value={newTargetType}
                    onValueChange={(v) => setNewTargetType(v as 'conference' | 'journal')}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="conference">Conference</SelectItem>
                      <SelectItem value="journal">Journal</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleCreateSubmission} disabled={creating || !newTargetName.trim()}>
                  {creating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Create
                </Button>
              </DialogFooter>
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

      {/* Submissions grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Submissions list */}
        <div className="space-y-3">
          <h4 className="font-medium">All Submissions</h4>

          {submissions.length === 0 ? (
            <Card className="p-8 text-center text-muted-foreground">
              No submissions yet
            </Card>
          ) : (
            submissions.map((submission) => (
              <Card
                key={submission.id}
                className={`p-4 cursor-pointer hover:bg-muted/50 ${
                  selectedSubmission?.id === submission.id ? 'ring-2 ring-primary' : ''
                }`}
                onClick={() => handleSelectSubmission(submission)}
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{submission.targetName}</span>
                    {getStatusBadge(submission.status)}
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Badge variant="outline" className="capitalize">
                      {submission.targetType}
                    </Badge>
                    <span>{new Date(submission.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>
              </Card>
            ))
          )}
        </div>

        {/* Submission details */}
        <div className="lg:col-span-2 space-y-4">
          {!selectedSubmission ? (
            <Card className="p-8 text-center text-muted-foreground">
              Select a submission to view details
            </Card>
          ) : (
            <>
              {/* Submission info */}
              <Card className="p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold text-lg">{selectedSubmission.targetName}</h4>
                  {getStatusBadge(selectedSubmission.status)}
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Type: </span>
                    <span className="capitalize">{selectedSubmission.targetType}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Created: </span>
                    <span>{new Date(selectedSubmission.createdAt).toLocaleDateString()}</span>
                  </div>
                  {selectedSubmission.submittedAt && (
                    <div>
                      <span className="text-muted-foreground">Submitted: </span>
                      <span>{new Date(selectedSubmission.submittedAt).toLocaleDateString()}</span>
                    </div>
                  )}
                  {selectedSubmission.confirmationNumber && (
                    <div>
                      <span className="text-muted-foreground">Confirmation: </span>
                      <span>{selectedSubmission.confirmationNumber}</span>
                    </div>
                  )}
                </div>

                {/* Status update */}
                <div className="pt-4 border-t">
                  <label className="text-sm font-medium mb-2 block">Update Status</label>
                  <Select
                    value={selectedSubmission.status}
                    onValueChange={(v) => handleUpdateStatus(selectedSubmission.id, v as Submission['status'])}
                  >
                    <SelectTrigger className="w-48">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="draft">Draft</SelectItem>
                      <SelectItem value="submitted">Submitted</SelectItem>
                      <SelectItem value="under_review">Under Review</SelectItem>
                      <SelectItem value="revision_requested">Revision Requested</SelectItem>
                      <SelectItem value="accepted">Accepted</SelectItem>
                      <SelectItem value="rejected">Rejected</SelectItem>
                      <SelectItem value="withdrawn">Withdrawn</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </Card>

              {/* Reviewer points and rebuttals */}
              <Tabs defaultValue="points">
                <TabsList>
                  <TabsTrigger value="points">
                    Reviewer Points ({reviewerPoints.length})
                  </TabsTrigger>
                  <TabsTrigger value="rebuttals">
                    Rebuttals ({rebuttals.length})
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="points" className="space-y-3">
                  <div className="flex justify-end">
                    <Dialog open={addPointDialogOpen} onOpenChange={setAddPointDialogOpen}>
                      <DialogTrigger asChild>
                        <Button size="sm">
                          <Plus className="h-4 w-4 mr-2" />
                          Add Point
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Add Reviewer Point</DialogTitle>
                          <DialogDescription>
                            Record a point from reviewer feedback.
                          </DialogDescription>
                        </DialogHeader>

                        <div className="space-y-4 py-4">
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <label className="text-sm font-medium">Reviewer</label>
                              <Input
                                value={pointReviewerId}
                                onChange={(e) => setPointReviewerId(e.target.value)}
                                placeholder="e.g., Reviewer 1"
                              />
                            </div>
                            <div className="space-y-2">
                              <label className="text-sm font-medium">Category</label>
                              <Select
                                value={pointCategory}
                                onValueChange={(v) => setPointCategory(v as ReviewerPoint['category'])}
                              >
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="major">Major</SelectItem>
                                  <SelectItem value="minor">Minor</SelectItem>
                                  <SelectItem value="comment">Comment</SelectItem>
                                  <SelectItem value="praise">Praise</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>

                          <div className="space-y-2">
                            <label className="text-sm font-medium">Point</label>
                            <Textarea
                              value={pointBody}
                              onChange={(e) => setPointBody(e.target.value)}
                              placeholder="Enter the reviewer's point..."
                              rows={4}
                            />
                          </div>
                        </div>

                        <DialogFooter>
                          <Button variant="outline" onClick={() => setAddPointDialogOpen(false)}>
                            Cancel
                          </Button>
                          <Button onClick={handleAddPoint} disabled={addingPoint || !pointBody.trim()}>
                            {addingPoint && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                            Add Point
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  </div>

                  {loadingDetails ? (
                    <Card className="p-8">
                      <div className="flex items-center justify-center">
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                      </div>
                    </Card>
                  ) : reviewerPoints.length === 0 ? (
                    <Card className="p-8 text-center text-muted-foreground">
                      No reviewer points recorded
                    </Card>
                  ) : (
                    reviewerPoints.map((point) => (
                      <Card key={point.id} className="p-4">
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Badge variant="outline">{point.reviewerId}</Badge>
                              {getCategoryBadge(point.category)}
                              <span className="text-sm text-muted-foreground">
                                Point #{point.pointNumber}
                              </span>
                            </div>
                            <Button
                              variant={point.addressed ? 'default' : 'outline'}
                              size="sm"
                              onClick={() => handleMarkAddressed(point.id, !point.addressed)}
                            >
                              {point.addressed ? (
                                <>
                                  <CheckCircle className="h-4 w-4 mr-2" />
                                  Addressed
                                </>
                              ) : (
                                'Mark Addressed'
                              )}
                            </Button>
                          </div>

                          <p className="text-sm">{point.body}</p>

                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openRebuttalDialog(point)}
                          >
                            <MessageSquare className="h-4 w-4 mr-2" />
                            {rebuttals.some((r) => r.pointId === point.id)
                              ? 'Edit Rebuttal'
                              : 'Write Rebuttal'}
                          </Button>
                        </div>
                      </Card>
                    ))
                  )}
                </TabsContent>

                <TabsContent value="rebuttals" className="space-y-3">
                  {rebuttals.length === 0 ? (
                    <Card className="p-8 text-center text-muted-foreground">
                      No rebuttals written yet
                    </Card>
                  ) : (
                    rebuttals.map((rebuttal) => {
                      const point = reviewerPoints.find((p) => p.id === rebuttal.pointId);
                      return (
                        <Card key={rebuttal.id} className="p-4">
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-sm text-muted-foreground">
                                Response to {point?.reviewerId || 'Unknown'} Point #{point?.pointNumber || '?'}
                              </span>
                              <Badge variant={rebuttal.status === 'final' ? 'default' : 'outline'}>
                                {rebuttal.status === 'final' ? 'Final' : 'Draft'}
                              </Badge>
                            </div>
                            <p className="text-sm">{rebuttal.body}</p>
                            <p className="text-xs text-muted-foreground">
                              v{rebuttal.version} by {rebuttal.createdBy} on{' '}
                              {new Date(rebuttal.createdAt).toLocaleDateString()}
                            </p>
                          </div>
                        </Card>
                      );
                    })
                  )}
                </TabsContent>
              </Tabs>
            </>
          )}
        </div>
      </div>

      {/* Rebuttal dialog */}
      <Dialog open={rebuttalDialogOpen} onOpenChange={setRebuttalDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Write Rebuttal</DialogTitle>
            <DialogDescription>
              Respond to the reviewer's point.
            </DialogDescription>
          </DialogHeader>

          {selectedPoint && (
            <div className="py-4 space-y-4">
              <Card className="p-3 bg-muted">
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant="outline">{selectedPoint.reviewerId}</Badge>
                  {getCategoryBadge(selectedPoint.category)}
                </div>
                <p className="text-sm">{selectedPoint.body}</p>
              </Card>

              <div className="space-y-2">
                <label className="text-sm font-medium">Your Response</label>
                <Textarea
                  value={rebuttalBody}
                  onChange={(e) => setRebuttalBody(e.target.value)}
                  placeholder="Write your response to this point..."
                  rows={8}
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setRebuttalDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="outline"
              onClick={() => handleSaveRebuttal('draft')}
              disabled={savingRebuttal || !rebuttalBody.trim()}
            >
              Save Draft
            </Button>
            <Button
              onClick={() => handleSaveRebuttal('final')}
              disabled={savingRebuttal || !rebuttalBody.trim()}
            >
              {savingRebuttal && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save as Final
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
