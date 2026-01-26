/**
 * Comment Panel Component
 *
 * Displays inline comments and threads for artifacts.
 * Supports comments anchored to text selections, tables, figures, and slides.
 *
 * Features:
 * - Threaded discussions
 * - Comment resolution
 * - User mentions
 * - Timestamps and edit history
 * - Anchor preview
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Avatar, AvatarFallback } from '../ui/avatar';
import { Textarea } from '../ui/textarea';
import { Alert, AlertDescription } from '../ui/alert';
import {
  MessageSquare,
  Send,
  Check,
  MoreVertical,
  Trash2,
  Edit,
  Reply,
  Loader2,
  X,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';

interface Comment {
  id: string;
  artifactId: string;
  content: string;
  userId: string;
  userName: string;
  createdAt: string;
  updatedAt: string;
  resolved: boolean;
  parentCommentId?: string;

  // Anchor information
  anchorType: 'text' | 'table' | 'figure' | 'slide';
  anchorData: {
    selectionText?: string;
    startOffset?: number;
    endOffset?: number;
    sectionId?: string;
    tableId?: string;
    figureId?: string;
    slideNumber?: number;
  };
}

interface CommentThread {
  rootComment: Comment;
  replies: Comment[];
}

interface CommentPanelProps {
  artifactId: string;
  currentUserId: string;
  currentUserName: string;
  onCommentAdded?: () => void;
  className?: string;
}

export function CommentPanel({
  artifactId,
  currentUserId,
  currentUserName,
  onCommentAdded,
  className = '',
}: CommentPanelProps) {
  const [threads, setThreads] = useState<CommentThread[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [filterResolved, setFilterResolved] = useState(false);

  // Fetch comments
  const fetchComments = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/v2/artifacts/${artifactId}/comments`);

      if (!response.ok) {
        throw new Error('Failed to fetch comments');
      }

      const comments: Comment[] = await response.json();

      // Group into threads
      const rootComments = comments.filter((c) => !c.parentCommentId);
      const threadList: CommentThread[] = rootComments.map((root) => ({
        rootComment: root,
        replies: comments.filter((c) => c.parentCommentId === root.id),
      }));

      setThreads(threadList);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [artifactId]);

  useEffect(() => {
    fetchComments();
  }, [fetchComments]);

  // Submit reply
  const handleSubmitReply = async (parentCommentId: string) => {
    if (!replyContent.trim()) return;

    setSubmitting(true);

    try {
      const response = await fetch(`/api/v2/artifacts/${artifactId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: replyContent,
          parentCommentId,
          anchorType: 'text', // Replies inherit anchor from parent
          anchorData: {},
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to submit reply');
      }

      setReplyContent('');
      setReplyingTo(null);
      await fetchComments();
      onCommentAdded?.();
    } catch (err) {
      console.error('Failed to submit reply:', err);
    } finally {
      setSubmitting(false);
    }
  };

  // Resolve comment
  const handleResolveComment = async (commentId: string) => {
    try {
      const response = await fetch(`/api/v2/comments/${commentId}/resolve`, {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Failed to resolve comment');
      }

      await fetchComments();
    } catch (err) {
      console.error('Failed to resolve comment:', err);
    }
  };

  // Delete comment
  const handleDeleteComment = async (commentId: string) => {
    if (!confirm('Are you sure you want to delete this comment?')) {
      return;
    }

    try {
      const response = await fetch(`/api/v2/comments/${commentId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete comment');
      }

      await fetchComments();
    } catch (err) {
      console.error('Failed to delete comment:', err);
    }
  };

  // Render comment anchor preview
  const renderAnchorPreview = (comment: Comment) => {
    const { anchorType, anchorData } = comment;

    switch (anchorType) {
      case 'text':
        return (
          <div className="text-sm bg-muted p-2 rounded border-l-2 border-primary">
            <span className="italic text-muted-foreground">
              "{anchorData.selectionText || 'Text selection'}"
            </span>
          </div>
        );
      case 'table':
        return (
          <div className="text-sm bg-muted p-2 rounded flex items-center gap-2">
            <Badge variant="outline">Table</Badge>
            <span className="text-muted-foreground">
              {anchorData.tableId || 'Unknown table'}
            </span>
          </div>
        );
      case 'figure':
        return (
          <div className="text-sm bg-muted p-2 rounded flex items-center gap-2">
            <Badge variant="outline">Figure</Badge>
            <span className="text-muted-foreground">
              {anchorData.figureId || 'Unknown figure'}
            </span>
          </div>
        );
      case 'slide':
        return (
          <div className="text-sm bg-muted p-2 rounded flex items-center gap-2">
            <Badge variant="outline">Slide</Badge>
            <span className="text-muted-foreground">
              Slide {anchorData.slideNumber || '?'}
            </span>
          </div>
        );
      default:
        return null;
    }
  };

  // Render single comment
  const renderComment = (comment: Comment, isReply = false) => {
    const isOwnComment = comment.userId === currentUserId;
    const isReplying = replyingTo === comment.id;

    return (
      <div
        key={comment.id}
        className={`${isReply ? 'ml-8 mt-2' : ''} space-y-2`}
      >
        <div className="flex items-start gap-3">
          <Avatar className="h-8 w-8">
            <AvatarFallback>
              {comment.userName.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>

          <div className="flex-1 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="font-medium text-sm">{comment.userName}</span>
                <span className="text-xs text-muted-foreground">
                  {new Date(comment.createdAt).toLocaleString()}
                </span>
                {comment.resolved && (
                  <Badge variant="outline" className="text-xs">
                    <Check className="h-3 w-3 mr-1" />
                    Resolved
                  </Badge>
                )}
              </div>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {!comment.resolved && !isReply && (
                    <DropdownMenuItem
                      onClick={() => handleResolveComment(comment.id)}
                    >
                      <Check className="h-4 w-4 mr-2" />
                      Resolve
                    </DropdownMenuItem>
                  )}
                  {isOwnComment && (
                    <DropdownMenuItem
                      onClick={() => handleDeleteComment(comment.id)}
                      className="text-destructive"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {!isReply && renderAnchorPreview(comment)}

            <p className="text-sm">{comment.content}</p>

            {!isReply && !comment.resolved && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setReplyingTo(comment.id)}
                className="h-8"
              >
                <Reply className="h-4 w-4 mr-2" />
                Reply
              </Button>
            )}

            {isReplying && (
              <div className="space-y-2 mt-2">
                <Textarea
                  value={replyContent}
                  onChange={(e) => setReplyContent(e.target.value)}
                  placeholder="Write a reply..."
                  className="min-h-[80px]"
                />
                <div className="flex gap-2">
                  <Button
                    onClick={() => handleSubmitReply(comment.id)}
                    disabled={submitting || !replyContent.trim()}
                    size="sm"
                  >
                    {submitting ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4 mr-2" />
                    )}
                    Send
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setReplyingTo(null);
                      setReplyContent('');
                    }}
                  >
                    <X className="h-4 w-4 mr-2" />
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  // Render thread
  const renderThread = (thread: CommentThread) => {
    // Filter by resolved status
    if (filterResolved && !thread.rootComment.resolved) {
      return null;
    }

    return (
      <Card key={thread.rootComment.id} className="p-4 space-y-3">
        {renderComment(thread.rootComment)}
        {thread.replies.map((reply) => renderComment(reply, true))}
      </Card>
    );
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

  if (error) {
    return (
      <Card className={`p-6 ${className}`}>
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </Card>
    );
  }

  const filteredThreads = filterResolved
    ? threads.filter((t) => t.rootComment.resolved)
    : threads.filter((t) => !t.rootComment.resolved);

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <MessageSquare className="h-5 w-5" />
          Comments ({threads.length})
        </h3>

        <div className="flex gap-2">
          <Button
            variant={filterResolved ? 'outline' : 'default'}
            size="sm"
            onClick={() => setFilterResolved(false)}
          >
            Active
          </Button>
          <Button
            variant={filterResolved ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilterResolved(true)}
          >
            Resolved
          </Button>
        </div>
      </div>

      {/* Threads */}
      <div className="space-y-3">
        {filteredThreads.length === 0 ? (
          <Card className="p-8 text-center text-muted-foreground">
            {filterResolved
              ? 'No resolved comments'
              : 'No active comments. Select text to add a comment.'}
          </Card>
        ) : (
          filteredThreads.map(renderThread)
        )}
      </div>
    </div>
  );
}
