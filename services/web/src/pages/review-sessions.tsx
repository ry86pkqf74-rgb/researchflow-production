/**
 * Review Sessions Page (Task 87)
 *
 * Displays Zoom review sessions linked to research projects.
 * Shows meeting history, participants, and session details.
 */

import { useState, useEffect } from 'react';
import {
  Video,
  Users,
  Clock,
  Calendar,
  Link2,
  CheckCircle,
  PlayCircle,
  Loader2,
  ExternalLink,
  Filter,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface Participant {
  id: string;
  name: string;
  email?: string;
  joinTime: string;
  leaveTime?: string;
}

interface ReviewSession {
  id: string;
  orgId?: string;
  researchId?: string;
  zoomMeetingId: string;
  zoomMeetingUuid: string;
  topic: string;
  hostUserId: string;
  startTime: string;
  endTime?: string;
  durationMinutes?: number;
  participants?: Participant[];
  status: 'SCHEDULED' | 'STARTED' | 'ENDED' | 'CANCELLED';
  metadata?: Record<string, any>;
  createdAt: string;
}

interface Organization {
  id: string;
  name: string;
  slug: string;
}

const STATUS_COLORS = {
  SCHEDULED: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
  STARTED: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
  ENDED: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300',
  CANCELLED: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
};

const STATUS_ICONS = {
  SCHEDULED: Calendar,
  STARTED: PlayCircle,
  ENDED: CheckCircle,
  CANCELLED: Clock,
};

export function ReviewSessions() {
  const [sessions, setSessions] = useState<ReviewSession[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [selectedOrgId, setSelectedOrgId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedSession, setSelectedSession] = useState<ReviewSession | null>(null);

  useEffect(() => {
    fetchOrganizations();
  }, []);

  useEffect(() => {
    fetchSessions();
  }, [selectedOrgId]);

  const fetchOrganizations = async () => {
    try {
      const response = await fetch('/api/org', { credentials: 'include' });
      if (response.ok) {
        const data = await response.json();
        setOrganizations(data.organizations || []);
        if (data.organizations?.length > 0) {
          setSelectedOrgId(data.organizations[0].id);
        }
      }
    } catch (err) {
      console.error('Failed to fetch organizations:', err);
    }
  };

  const fetchSessions = async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (selectedOrgId) params.append('orgId', selectedOrgId);

      const response = await fetch(`/api/webhooks/zoom/sessions?${params}`, {
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        setSessions(data.sessions || []);
      } else {
        setError('Failed to load review sessions');
      }
    } catch (err) {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatDuration = (minutes?: number) => {
    if (!minutes) return 'N/A';
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  };

  if (loading && sessions.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mx-auto" />
          <p className="mt-4 text-muted-foreground">Loading review sessions...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-6xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Video className="h-6 w-6" />
              Review Sessions
            </h1>
            <p className="text-muted-foreground">
              Zoom meetings linked to your research projects
            </p>
          </div>

          {organizations.length > 1 && (
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <Select value={selectedOrgId} onValueChange={setSelectedOrgId}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Select organization" />
                </SelectTrigger>
                <SelectContent>
                  {organizations.map((org) => (
                    <SelectItem key={org.id} value={org.id}>
                      {org.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Sessions List */}
        {sessions.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Video className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium">No review sessions yet</h3>
              <p className="text-muted-foreground mt-2">
                Zoom meetings will appear here once they are linked to your organization.
              </p>
              <p className="text-sm text-muted-foreground mt-4">
                Configure your Zoom webhook to automatically track meetings.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {sessions.map((session) => {
              const StatusIcon = STATUS_ICONS[session.status];
              return (
                <Card key={session.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-4">
                        <div className="p-3 rounded-lg bg-primary/10">
                          <Video className="h-6 w-6 text-primary" />
                        </div>
                        <div>
                          <h3 className="font-medium">{session.topic}</h3>
                          <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Calendar className="h-4 w-4" />
                              {formatDate(session.startTime)}
                            </span>
                            {session.durationMinutes && (
                              <span className="flex items-center gap-1">
                                <Clock className="h-4 w-4" />
                                {formatDuration(session.durationMinutes)}
                              </span>
                            )}
                            {session.participants && (
                              <span className="flex items-center gap-1">
                                <Users className="h-4 w-4" />
                                {session.participants.length} participants
                              </span>
                            )}
                          </div>
                          {!session.researchId && (
                            <Badge variant="outline" className="mt-2 text-yellow-600">
                              <Link2 className="h-3 w-3 mr-1" />
                              Not linked to research
                            </Badge>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <Badge className={STATUS_COLORS[session.status]}>
                          <StatusIcon className="h-3 w-3 mr-1" />
                          {session.status}
                        </Badge>

                        <Dialog>
                          <DialogTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setSelectedSession(session)}
                            >
                              View Details
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-lg">
                            <DialogHeader>
                              <DialogTitle>{session.topic}</DialogTitle>
                              <DialogDescription>
                                Meeting ID: {session.zoomMeetingId}
                              </DialogDescription>
                            </DialogHeader>
                            <div className="space-y-4 mt-4">
                              <div className="grid grid-cols-2 gap-4 text-sm">
                                <div>
                                  <span className="text-muted-foreground">Start Time</span>
                                  <p className="font-medium">{formatDate(session.startTime)}</p>
                                </div>
                                {session.endTime && (
                                  <div>
                                    <span className="text-muted-foreground">End Time</span>
                                    <p className="font-medium">{formatDate(session.endTime)}</p>
                                  </div>
                                )}
                                <div>
                                  <span className="text-muted-foreground">Duration</span>
                                  <p className="font-medium">
                                    {formatDuration(session.durationMinutes)}
                                  </p>
                                </div>
                                <div>
                                  <span className="text-muted-foreground">Status</span>
                                  <p>
                                    <Badge className={STATUS_COLORS[session.status]}>
                                      {session.status}
                                    </Badge>
                                  </p>
                                </div>
                              </div>

                              {session.participants && session.participants.length > 0 && (
                                <div>
                                  <h4 className="font-medium mb-2 flex items-center gap-2">
                                    <Users className="h-4 w-4" />
                                    Participants ({session.participants.length})
                                  </h4>
                                  <div className="space-y-2 max-h-48 overflow-y-auto">
                                    {session.participants.map((p, idx) => (
                                      <div
                                        key={idx}
                                        className="flex items-center justify-between p-2 bg-muted/50 rounded"
                                      >
                                        <div>
                                          <p className="font-medium text-sm">{p.name}</p>
                                          {p.email && (
                                            <p className="text-xs text-muted-foreground">
                                              {p.email}
                                            </p>
                                          )}
                                        </div>
                                        {p.leaveTime && (
                                          <Badge variant="outline" className="text-xs">
                                            Left
                                          </Badge>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          </DialogContent>
                        </Dialog>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Info Card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">About Review Sessions</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <p>
              Review sessions are automatically tracked when your Zoom meetings are linked to
              ResearchFlow. This helps you maintain a record of team discussions and research
              reviews.
            </p>
            <p>
              To set up Zoom integration, configure the webhook URL in your Zoom app settings to
              point to your ResearchFlow instance.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default ReviewSessions;
