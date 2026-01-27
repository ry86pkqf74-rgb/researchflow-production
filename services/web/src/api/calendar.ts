/**
 * Calendar API Client
 *
 * Unified calendar view for tasks, milestones, goals, and custom events.
 */

import { api } from './client';

// Types
export type CalendarEventType = 'task_due' | 'milestone' | 'goal' | 'meeting' | 'deadline' | 'custom';

export interface CalendarEvent {
  id: string;
  project_id: string;
  title: string;
  description?: string;
  event_type: CalendarEventType;
  source_type?: string;
  source_id?: string;
  start_time: string;
  end_time?: string;
  all_day: boolean;
  color?: string;
  metadata?: Record<string, any>;
  created_at: string;
  updated_at: string;
  created_by: string;
}

export interface CalendarSummary {
  task_count: number;
  milestone_count: number;
  goal_count: number;
  meeting_count: number;
  deadline_count: number;
  custom_count: number;
  past_count: number;
  this_week_count: number;
  this_month_count: number;
  total_count: number;
}

export interface CreateCalendarEventInput {
  projectId: string;
  title: string;
  description?: string;
  eventType: CalendarEventType;
  startTime: string;
  endTime?: string;
  allDay?: boolean;
  color?: string;
  metadata?: Record<string, any>;
}

export interface UpdateCalendarEventInput {
  title?: string;
  description?: string;
  startTime?: string;
  endTime?: string | null;
  allDay?: boolean;
  color?: string | null;
  metadata?: Record<string, any>;
}

export interface CalendarQueryParams {
  projectId: string;
  startDate: string;
  endDate: string;
  eventTypes?: string; // comma-separated
}

// API Functions
export const calendarApi = {
  /**
   * Get calendar events for a date range
   */
  getEvents: (params: CalendarQueryParams) =>
    api.get<{
      events: CalendarEvent[];
      eventsByDate: Record<string, CalendarEvent[]>;
      total: number;
    }>('/api/hub/calendar', params),

  /**
   * Get upcoming events
   */
  getUpcoming: (projectId: string, days?: number, limit?: number) =>
    api.get<{ events: CalendarEvent[]; total: number }>('/api/hub/calendar/upcoming', {
      projectId,
      days: days || 30,
      limit: limit || 20,
    }),

  /**
   * Get calendar summary stats
   */
  getSummary: (projectId: string) =>
    api.get<{ summary: CalendarSummary }>('/api/hub/calendar/summary', { projectId }),

  /**
   * Get a specific calendar event
   */
  get: (eventId: string) =>
    api.get<{ event: CalendarEvent }>(`/api/hub/calendar/${eventId}`),

  /**
   * Create a custom calendar event
   */
  create: (data: CreateCalendarEventInput) =>
    api.post<{ event: CalendarEvent }>('/api/hub/calendar', data),

  /**
   * Update a calendar event (only custom events)
   */
  update: (eventId: string, data: UpdateCalendarEventInput) =>
    api.patch<{ event: CalendarEvent }>(`/api/hub/calendar/${eventId}`, data),

  /**
   * Delete a calendar event (only custom events)
   */
  delete: (eventId: string) =>
    api.delete<{ success: boolean; deletedId: string }>(`/api/hub/calendar/${eventId}`),

  /**
   * Get events for a specific month
   */
  getMonth: (projectId: string, year: number, month: number) => {
    const startDate = new Date(year, month - 1, 1).toISOString();
    const endDate = new Date(year, month, 0, 23, 59, 59).toISOString();
    return calendarApi.getEvents({ projectId, startDate, endDate });
  },

  /**
   * Get events for a specific week
   */
  getWeek: (projectId: string, date: Date) => {
    const startOfWeek = new Date(date);
    startOfWeek.setDate(date.getDate() - date.getDay());
    startOfWeek.setHours(0, 0, 0, 0);

    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);

    return calendarApi.getEvents({
      projectId,
      startDate: startOfWeek.toISOString(),
      endDate: endOfWeek.toISOString(),
    });
  },
};

export default calendarApi;
