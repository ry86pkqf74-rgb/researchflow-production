/**
 * Video Conferencing Hooks Service (Task 86)
 * External video conferencing integration (Zoom, Google Meet)
 *
 * Security: No in-app A/V - external links only
 */

import { z } from 'zod';
import crypto from 'crypto';

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

export const VideoProviderSchema = z.enum([
  'ZOOM',
  'GOOGLE_MEET',
  'MICROSOFT_TEAMS',
  'CUSTOM',
]);
export type VideoProvider = z.infer<typeof VideoProviderSchema>;

export const MeetingStatusSchema = z.enum([
  'SCHEDULED',
  'STARTED',
  'ENDED',
  'CANCELLED',
]);
export type MeetingStatus = z.infer<typeof MeetingStatusSchema>;

export const MeetingTypeSchema = z.enum([
  'REVIEW_SESSION',
  'COLLABORATION',
  'PRESENTATION',
  'STAND_UP',
  'CUSTOM',
]);
export type MeetingType = z.infer<typeof MeetingTypeSchema>;

export const VideoMeetingSchema = z.object({
  id: z.string().uuid(),
  researchId: z.string().uuid(),
  title: z.string().max(200),
  description: z.string().max(2000).optional(),
  type: MeetingTypeSchema,
  provider: VideoProviderSchema,
  status: MeetingStatusSchema,

  // External meeting details
  externalMeetingId: z.string().optional(),
  joinUrl: z.string().url(),
  hostUrl: z.string().url().optional(),
  dialInInfo: z.string().optional(),
  password: z.string().optional(), // Only stored if user explicitly provides it

  // Scheduling
  scheduledStart: z.string().datetime(),
  scheduledEnd: z.string().datetime().optional(),
  duration: z.number().int().min(1).max(480).optional(), // Minutes
  timezone: z.string().default('UTC'),
  recurrence: z.object({
    type: z.enum(['NONE', 'DAILY', 'WEEKLY', 'MONTHLY']),
    interval: z.number().int().min(1).optional(),
    daysOfWeek: z.array(z.number().int().min(0).max(6)).optional(),
    endDate: z.string().datetime().optional(),
    occurrences: z.number().int().min(1).optional(),
  }).optional(),

  // Participants
  hostId: z.string().uuid(),
  inviteeIds: z.array(z.string().uuid()).default([]),
  attendeeLimit: z.number().int().min(1).optional(),

  // Related artifacts
  artifactIds: z.array(z.string().uuid()).default([]),
  agendaItems: z.array(z.string()).default([]),

  // Recording (external only)
  recordingEnabled: z.boolean().default(false),
  recordingUrl: z.string().url().optional(),

  // Timestamps
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  actualStart: z.string().datetime().optional(),
  actualEnd: z.string().datetime().optional(),
});
export type VideoMeeting = z.infer<typeof VideoMeetingSchema>;

export const CreateMeetingSchema = z.object({
  researchId: z.string().uuid(),
  title: z.string().max(200),
  description: z.string().max(2000).optional(),
  type: MeetingTypeSchema.default('COLLABORATION'),
  provider: VideoProviderSchema,

  // External URL (manual entry)
  joinUrl: z.string().url(),
  hostUrl: z.string().url().optional(),
  password: z.string().optional(),
  dialInInfo: z.string().optional(),

  // Scheduling
  scheduledStart: z.string().datetime(),
  scheduledEnd: z.string().datetime().optional(),
  duration: z.number().int().min(1).max(480).optional(),
  timezone: z.string().default('UTC'),

  // Participants
  inviteeIds: z.array(z.string().uuid()).optional(),

  // Related content
  artifactIds: z.array(z.string().uuid()).optional(),
  agendaItems: z.array(z.string()).optional(),
});
export type CreateMeetingInput = z.infer<typeof CreateMeetingSchema>;

export const MeetingInviteSchema = z.object({
  id: z.string().uuid(),
  meetingId: z.string().uuid(),
  userId: z.string().uuid(),
  status: z.enum(['PENDING', 'ACCEPTED', 'DECLINED', 'TENTATIVE']),
  respondedAt: z.string().datetime().optional(),
  notes: z.string().max(500).optional(),
});
export type MeetingInvite = z.infer<typeof MeetingInviteSchema>;

export const MeetingNoteSchema = z.object({
  id: z.string().uuid(),
  meetingId: z.string().uuid(),
  authorId: z.string().uuid(),
  content: z.string().max(10000),
  isShared: z.boolean().default(false),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type MeetingNote = z.infer<typeof MeetingNoteSchema>;

// ---------------------------------------------------------------------------
// In-Memory Storage (would be database in production)
// ---------------------------------------------------------------------------

const meetings = new Map<string, VideoMeeting>();
const invites = new Map<string, MeetingInvite>();
const notes = new Map<string, MeetingNote>();

// ---------------------------------------------------------------------------
// Meeting Operations
// ---------------------------------------------------------------------------

export function createMeeting(input: CreateMeetingInput, hostId: string): VideoMeeting {
  const validated = CreateMeetingSchema.parse(input);
  const now = new Date().toISOString();

  const meeting: VideoMeeting = {
    id: crypto.randomUUID(),
    researchId: validated.researchId,
    title: validated.title,
    description: validated.description,
    type: validated.type,
    provider: validated.provider,
    status: 'SCHEDULED',
    joinUrl: validated.joinUrl,
    hostUrl: validated.hostUrl,
    dialInInfo: validated.dialInInfo,
    password: validated.password,
    scheduledStart: validated.scheduledStart,
    scheduledEnd: validated.scheduledEnd,
    duration: validated.duration,
    timezone: validated.timezone,
    hostId,
    inviteeIds: validated.inviteeIds || [],
    artifactIds: validated.artifactIds || [],
    agendaItems: validated.agendaItems || [],
    recordingEnabled: false,
    createdAt: now,
    updatedAt: now,
  };

  meetings.set(meeting.id, meeting);

  // Create invites for all invitees
  for (const userId of meeting.inviteeIds) {
    createInvite(meeting.id, userId);
  }

  return meeting;
}

export function getMeeting(meetingId: string): VideoMeeting | undefined {
  return meetings.get(meetingId);
}

export function getMeetingsByResearch(researchId: string): VideoMeeting[] {
  return Array.from(meetings.values())
    .filter(m => m.researchId === researchId)
    .sort((a, b) => a.scheduledStart.localeCompare(b.scheduledStart));
}

export function getUpcomingMeetings(
  userId: string,
  limit: number = 10
): VideoMeeting[] {
  const now = new Date().toISOString();

  return Array.from(meetings.values())
    .filter(m =>
      m.scheduledStart > now &&
      m.status === 'SCHEDULED' &&
      (m.hostId === userId || m.inviteeIds.includes(userId))
    )
    .sort((a, b) => a.scheduledStart.localeCompare(b.scheduledStart))
    .slice(0, limit);
}

export function updateMeeting(
  meetingId: string,
  updates: Partial<Pick<VideoMeeting, 'title' | 'description' | 'joinUrl' | 'hostUrl' | 'scheduledStart' | 'scheduledEnd' | 'duration' | 'artifactIds' | 'agendaItems'>>,
  userId: string
): VideoMeeting | undefined {
  const meeting = meetings.get(meetingId);
  if (!meeting || meeting.hostId !== userId) return undefined;

  const updated: VideoMeeting = {
    ...meeting,
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  meetings.set(meetingId, updated);
  return updated;
}

export function startMeeting(meetingId: string, hostId: string): VideoMeeting | undefined {
  const meeting = meetings.get(meetingId);
  if (!meeting || meeting.hostId !== hostId) return undefined;

  meeting.status = 'STARTED';
  meeting.actualStart = new Date().toISOString();
  meeting.updatedAt = meeting.actualStart;

  meetings.set(meetingId, meeting);
  return meeting;
}

export function endMeeting(meetingId: string, hostId: string): VideoMeeting | undefined {
  const meeting = meetings.get(meetingId);
  if (!meeting || meeting.hostId !== hostId) return undefined;

  meeting.status = 'ENDED';
  meeting.actualEnd = new Date().toISOString();
  meeting.updatedAt = meeting.actualEnd;

  meetings.set(meetingId, meeting);
  return meeting;
}

export function cancelMeeting(meetingId: string, hostId: string): VideoMeeting | undefined {
  const meeting = meetings.get(meetingId);
  if (!meeting || meeting.hostId !== hostId) return undefined;
  if (meeting.status !== 'SCHEDULED') return undefined;

  meeting.status = 'CANCELLED';
  meeting.updatedAt = new Date().toISOString();

  meetings.set(meetingId, meeting);
  return meeting;
}

export function addInvitees(
  meetingId: string,
  userIds: string[],
  hostId: string
): VideoMeeting | undefined {
  const meeting = meetings.get(meetingId);
  if (!meeting || meeting.hostId !== hostId) return undefined;

  const newInvitees = userIds.filter(id => !meeting.inviteeIds.includes(id));
  meeting.inviteeIds.push(...newInvitees);
  meeting.updatedAt = new Date().toISOString();

  meetings.set(meetingId, meeting);

  // Create invites
  for (const userId of newInvitees) {
    createInvite(meetingId, userId);
  }

  return meeting;
}

export function removeInvitee(
  meetingId: string,
  userId: string,
  hostId: string
): VideoMeeting | undefined {
  const meeting = meetings.get(meetingId);
  if (!meeting || meeting.hostId !== hostId) return undefined;

  meeting.inviteeIds = meeting.inviteeIds.filter(id => id !== userId);
  meeting.updatedAt = new Date().toISOString();

  meetings.set(meetingId, meeting);

  // Remove invite
  for (const [id, invite] of invites.entries()) {
    if (invite.meetingId === meetingId && invite.userId === userId) {
      invites.delete(id);
      break;
    }
  }

  return meeting;
}

// ---------------------------------------------------------------------------
// Invite Operations
// ---------------------------------------------------------------------------

function createInvite(meetingId: string, userId: string): MeetingInvite {
  const invite: MeetingInvite = {
    id: crypto.randomUUID(),
    meetingId,
    userId,
    status: 'PENDING',
  };

  invites.set(invite.id, invite);
  return invite;
}

export function getInvite(meetingId: string, userId: string): MeetingInvite | undefined {
  for (const invite of invites.values()) {
    if (invite.meetingId === meetingId && invite.userId === userId) {
      return invite;
    }
  }
  return undefined;
}

export function getInvitesForMeeting(meetingId: string): MeetingInvite[] {
  return Array.from(invites.values()).filter(i => i.meetingId === meetingId);
}

export function getInvitesForUser(userId: string): MeetingInvite[] {
  return Array.from(invites.values()).filter(i => i.userId === userId);
}

export function respondToInvite(
  meetingId: string,
  userId: string,
  status: 'ACCEPTED' | 'DECLINED' | 'TENTATIVE',
  notes?: string
): MeetingInvite | undefined {
  const invite = getInvite(meetingId, userId);
  if (!invite) return undefined;

  invite.status = status;
  invite.respondedAt = new Date().toISOString();
  invite.notes = notes;

  invites.set(invite.id, invite);
  return invite;
}

// ---------------------------------------------------------------------------
// Meeting Notes Operations
// ---------------------------------------------------------------------------

export function createMeetingNote(
  meetingId: string,
  authorId: string,
  content: string,
  isShared: boolean = false
): MeetingNote {
  const now = new Date().toISOString();

  const note: MeetingNote = {
    id: crypto.randomUUID(),
    meetingId,
    authorId,
    content,
    isShared,
    createdAt: now,
    updatedAt: now,
  };

  notes.set(note.id, note);
  return note;
}

export function getMeetingNotes(meetingId: string, userId: string): MeetingNote[] {
  return Array.from(notes.values())
    .filter(n => n.meetingId === meetingId && (n.isShared || n.authorId === userId))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export function updateMeetingNote(
  noteId: string,
  authorId: string,
  content: string
): MeetingNote | undefined {
  const note = notes.get(noteId);
  if (!note || note.authorId !== authorId) return undefined;

  note.content = content;
  note.updatedAt = new Date().toISOString();

  notes.set(noteId, note);
  return note;
}

export function shareMeetingNote(noteId: string, authorId: string): MeetingNote | undefined {
  const note = notes.get(noteId);
  if (!note || note.authorId !== authorId) return undefined;

  note.isShared = true;
  note.updatedAt = new Date().toISOString();

  notes.set(noteId, note);
  return note;
}

// ---------------------------------------------------------------------------
// URL Generation Helpers
// ---------------------------------------------------------------------------

export function generateMeetingUrl(provider: VideoProvider): string {
  // These would be generated via OAuth API integration in production
  // For now, return placeholder patterns

  const id = crypto.randomBytes(8).toString('hex');

  switch (provider) {
    case 'ZOOM':
      return `https://zoom.us/j/${id}`;
    case 'GOOGLE_MEET':
      return `https://meet.google.com/${id.slice(0, 3)}-${id.slice(3, 7)}-${id.slice(7, 10)}`;
    case 'MICROSOFT_TEAMS':
      return `https://teams.microsoft.com/l/meetup-join/${id}`;
    case 'CUSTOM':
      return '';
  }
}

export function validateMeetingUrl(url: string, provider: VideoProvider): boolean {
  try {
    const parsed = new URL(url);

    switch (provider) {
      case 'ZOOM':
        return parsed.hostname.includes('zoom.us');
      case 'GOOGLE_MEET':
        return parsed.hostname === 'meet.google.com';
      case 'MICROSOFT_TEAMS':
        return parsed.hostname.includes('teams.microsoft.com');
      case 'CUSTOM':
        return true;
    }
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Calendar Integration Helpers
// ---------------------------------------------------------------------------

export interface CalendarEvent {
  title: string;
  description: string;
  start: string;
  end: string;
  location: string; // Join URL
  attendees: string[];
}

export function generateCalendarEvent(meeting: VideoMeeting): CalendarEvent {
  const endTime = meeting.scheduledEnd || (
    meeting.duration
      ? new Date(new Date(meeting.scheduledStart).getTime() + meeting.duration * 60000).toISOString()
      : new Date(new Date(meeting.scheduledStart).getTime() + 60 * 60000).toISOString() // Default 1 hour
  );

  return {
    title: meeting.title,
    description: [
      meeting.description || '',
      '',
      `Join: ${meeting.joinUrl}`,
      meeting.dialInInfo ? `Dial-in: ${meeting.dialInInfo}` : '',
      meeting.password ? `Password: ${meeting.password}` : '',
      '',
      meeting.agendaItems.length > 0
        ? `Agenda:\n${meeting.agendaItems.map((item, i) => `${i + 1}. ${item}`).join('\n')}`
        : '',
    ].filter(Boolean).join('\n'),
    start: meeting.scheduledStart,
    end: endTime,
    location: meeting.joinUrl,
    attendees: meeting.inviteeIds,
  };
}

export function generateICSContent(meeting: VideoMeeting): string {
  const event = generateCalendarEvent(meeting);
  const uid = `${meeting.id}@researchflow`;
  const now = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

  const formatDateTime = (iso: string): string => {
    return iso.replace(/[-:]/g, '').split('.')[0] + 'Z';
  };

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//ResearchFlow//Meeting//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:REQUEST',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${now}`,
    `DTSTART:${formatDateTime(event.start)}`,
    `DTEND:${formatDateTime(event.end)}`,
    `SUMMARY:${event.title}`,
    `DESCRIPTION:${event.description.replace(/\n/g, '\\n')}`,
    `LOCATION:${event.location}`,
    'STATUS:CONFIRMED',
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');
}

// ---------------------------------------------------------------------------
// Statistics
// ---------------------------------------------------------------------------

export interface MeetingStats {
  totalMeetings: number;
  byStatus: Record<MeetingStatus, number>;
  byType: Record<MeetingType, number>;
  byProvider: Record<VideoProvider, number>;
  averageDuration: number; // Minutes
  inviteResponseRate: number; // Percentage
  upcomingCount: number;
}

export function getMeetingStats(researchId?: string): MeetingStats {
  let filtered = Array.from(meetings.values());
  if (researchId) {
    filtered = filtered.filter(m => m.researchId === researchId);
  }

  const byStatus: Record<string, number> = {};
  const byType: Record<string, number> = {};
  const byProvider: Record<string, number> = {};
  const durations: number[] = [];

  const now = new Date().toISOString();
  let upcomingCount = 0;

  for (const meeting of filtered) {
    byStatus[meeting.status] = (byStatus[meeting.status] || 0) + 1;
    byType[meeting.type] = (byType[meeting.type] || 0) + 1;
    byProvider[meeting.provider] = (byProvider[meeting.provider] || 0) + 1;

    if (meeting.actualStart && meeting.actualEnd) {
      const duration = (new Date(meeting.actualEnd).getTime() - new Date(meeting.actualStart).getTime()) / 60000;
      durations.push(duration);
    } else if (meeting.duration) {
      durations.push(meeting.duration);
    }

    if (meeting.scheduledStart > now && meeting.status === 'SCHEDULED') {
      upcomingCount++;
    }
  }

  // Calculate invite response rate
  const allInvites = Array.from(invites.values())
    .filter(i => {
      const meeting = meetings.get(i.meetingId);
      return !researchId || meeting?.researchId === researchId;
    });

  const respondedInvites = allInvites.filter(i => i.status !== 'PENDING').length;
  const responseRate = allInvites.length > 0 ? (respondedInvites / allInvites.length) * 100 : 0;

  return {
    totalMeetings: filtered.length,
    byStatus: byStatus as Record<MeetingStatus, number>,
    byType: byType as Record<MeetingType, number>,
    byProvider: byProvider as Record<VideoProvider, number>,
    averageDuration: durations.length > 0
      ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
      : 0,
    inviteResponseRate: Math.round(responseRate * 10) / 10,
    upcomingCount,
  };
}
