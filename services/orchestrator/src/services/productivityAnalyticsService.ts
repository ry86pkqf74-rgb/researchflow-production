/**
 * Productivity Analytics Service (Task 90)
 * Tracks collaboration metrics: edits, reviewer latency, comment resolution time
 *
 * Security: Only aggregates, no PHI in analytics
 */

import { z } from 'zod';

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

export const TimeRangeSchema = z.enum([
  'TODAY',
  'THIS_WEEK',
  'THIS_MONTH',
  'THIS_QUARTER',
  'THIS_YEAR',
  'LAST_7_DAYS',
  'LAST_30_DAYS',
  'LAST_90_DAYS',
  'ALL_TIME',
  'CUSTOM',
]);
export type TimeRange = z.infer<typeof TimeRangeSchema>;

export const MetricTypeSchema = z.enum([
  'EDITS',
  'COMMENTS',
  'REVIEWS',
  'TASKS',
  'SUBMISSIONS',
  'CLAIMS',
]);
export type MetricType = z.infer<typeof MetricTypeSchema>;

export interface TimeSeriesPoint {
  timestamp: string; // ISO date
  value: number;
  label?: string;
}

export interface MetricSummary {
  current: number;
  previous: number;
  change: number; // Percentage change
  trend: 'UP' | 'DOWN' | 'STABLE';
}

export interface EditMetrics {
  totalEdits: MetricSummary;
  averageEditsPerDay: number;
  mostActiveUsers: Array<{ userId: string; editCount: number }>;
  editsByArtifactType: Record<string, number>;
  editTimeline: TimeSeriesPoint[];
  peakHours: Array<{ hour: number; editCount: number }>;
}

export interface CommentMetrics {
  totalComments: MetricSummary;
  totalThreads: MetricSummary;
  resolvedThreads: MetricSummary;
  averageResolutionTime: number; // In hours
  resolutionTimeDistribution: Array<{ bucket: string; count: number }>;
  commentsByUser: Array<{ userId: string; commentCount: number; resolvedCount: number }>;
  commentTimeline: TimeSeriesPoint[];
}

export interface ReviewMetrics {
  totalReviews: MetricSummary;
  completedReviews: MetricSummary;
  averageReviewTime: number; // In days
  reviewTimeDistribution: Array<{ bucket: string; count: number }>;
  reviewerPerformance: Array<{
    reviewerId: string;
    completedCount: number;
    averageTime: number;
    averageScore: number | null;
  }>;
  reviewTimeline: TimeSeriesPoint[];
  recommendationDistribution: Record<string, number>;
}

export interface TaskMetrics {
  totalTasks: MetricSummary;
  completedTasks: MetricSummary;
  overdueRate: number; // Percentage
  averageCompletionTime: number; // In hours
  tasksByStatus: Record<string, number>;
  tasksByPriority: Record<string, number>;
  assigneeWorkload: Array<{ userId: string; assigned: number; completed: number }>;
  taskTimeline: TimeSeriesPoint[];
  velocityTrend: TimeSeriesPoint[]; // Tasks completed per time period
}

export interface SubmissionMetrics {
  totalSubmissions: MetricSummary;
  acceptanceRate: number; // Percentage
  averageTimeToDecision: number; // In days
  submissionsByStatus: Record<string, number>;
  submissionsByTarget: Record<string, number>;
  submissionTimeline: TimeSeriesPoint[];
}

export interface CollaborationMetrics {
  activeUsers: MetricSummary;
  uniqueContributors: number;
  collaborationScore: number; // 0-100 composite score
  engagementTrend: TimeSeriesPoint[];
  topCollaborators: Array<{ userId: string; score: number }>;
}

export interface ProductivityDashboard {
  timeRange: TimeRange;
  startDate: string;
  endDate: string;
  edits: EditMetrics;
  comments: CommentMetrics;
  reviews: ReviewMetrics;
  tasks: TaskMetrics;
  submissions: SubmissionMetrics;
  collaboration: CollaborationMetrics;
  generatedAt: string;
}

// ---------------------------------------------------------------------------
// Analytics Events Storage (In-memory, would be time-series DB in production)
// ---------------------------------------------------------------------------

interface AnalyticsEvent {
  id: string;
  researchId: string;
  type: MetricType;
  subtype?: string;
  userId: string;
  artifactId?: string;
  timestamp: string;
  duration?: number; // In milliseconds
  metadata?: Record<string, unknown>;
}

const events: AnalyticsEvent[] = [];

// ---------------------------------------------------------------------------
// Event Recording
// ---------------------------------------------------------------------------

export function recordEvent(event: Omit<AnalyticsEvent, 'id'>): void {
  events.push({
    ...event,
    id: crypto.randomUUID(),
  });
}

export function recordEdit(
  researchId: string,
  userId: string,
  artifactId: string,
  artifactType: string
): void {
  recordEvent({
    researchId,
    type: 'EDITS',
    subtype: artifactType,
    userId,
    artifactId,
    timestamp: new Date().toISOString(),
  });
}

export function recordComment(
  researchId: string,
  userId: string,
  artifactId: string,
  threadId?: string
): void {
  recordEvent({
    researchId,
    type: 'COMMENTS',
    subtype: threadId ? 'reply' : 'new',
    userId,
    artifactId,
    timestamp: new Date().toISOString(),
    metadata: { threadId },
  });
}

export function recordThreadResolution(
  researchId: string,
  userId: string,
  threadId: string,
  resolutionTime: number // In milliseconds
): void {
  recordEvent({
    researchId,
    type: 'COMMENTS',
    subtype: 'resolution',
    userId,
    timestamp: new Date().toISOString(),
    duration: resolutionTime,
    metadata: { threadId },
  });
}

export function recordReviewCompletion(
  researchId: string,
  reviewerId: string,
  submissionId: string,
  reviewTime: number, // In milliseconds
  averageScore?: number
): void {
  recordEvent({
    researchId,
    type: 'REVIEWS',
    subtype: 'completion',
    userId: reviewerId,
    timestamp: new Date().toISOString(),
    duration: reviewTime,
    metadata: { submissionId, averageScore },
  });
}

export function recordTaskCompletion(
  researchId: string,
  userId: string,
  taskId: string,
  completionTime: number, // In milliseconds
  wasOverdue: boolean
): void {
  recordEvent({
    researchId,
    type: 'TASKS',
    subtype: 'completion',
    userId,
    timestamp: new Date().toISOString(),
    duration: completionTime,
    metadata: { taskId, wasOverdue },
  });
}

// ---------------------------------------------------------------------------
// Time Range Helpers
// ---------------------------------------------------------------------------

function getDateRange(range: TimeRange, customStart?: string, customEnd?: string): { start: Date; end: Date } {
  const now = new Date();
  const end = new Date(now);
  let start: Date;

  switch (range) {
    case 'TODAY':
      start = new Date(now);
      start.setHours(0, 0, 0, 0);
      break;

    case 'THIS_WEEK':
      start = new Date(now);
      start.setDate(now.getDate() - now.getDay());
      start.setHours(0, 0, 0, 0);
      break;

    case 'THIS_MONTH':
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      break;

    case 'THIS_QUARTER':
      const quarter = Math.floor(now.getMonth() / 3);
      start = new Date(now.getFullYear(), quarter * 3, 1);
      break;

    case 'THIS_YEAR':
      start = new Date(now.getFullYear(), 0, 1);
      break;

    case 'LAST_7_DAYS':
      start = new Date(now);
      start.setDate(now.getDate() - 7);
      break;

    case 'LAST_30_DAYS':
      start = new Date(now);
      start.setDate(now.getDate() - 30);
      break;

    case 'LAST_90_DAYS':
      start = new Date(now);
      start.setDate(now.getDate() - 90);
      break;

    case 'ALL_TIME':
      start = new Date(0);
      break;

    case 'CUSTOM':
      start = customStart ? new Date(customStart) : new Date(0);
      if (customEnd) {
        end.setTime(new Date(customEnd).getTime());
      }
      break;

    default:
      start = new Date(now);
      start.setDate(now.getDate() - 30);
  }

  return { start, end };
}

function getPreviousRange(start: Date, end: Date): { start: Date; end: Date } {
  const duration = end.getTime() - start.getTime();
  return {
    start: new Date(start.getTime() - duration),
    end: new Date(start.getTime()),
  };
}

function filterEvents(
  researchId: string,
  type: MetricType,
  start: Date,
  end: Date
): AnalyticsEvent[] {
  return events.filter(e =>
    e.researchId === researchId &&
    e.type === type &&
    new Date(e.timestamp) >= start &&
    new Date(e.timestamp) <= end
  );
}

function calculateSummary(current: number, previous: number): MetricSummary {
  const change = previous === 0 ? (current > 0 ? 100 : 0) : ((current - previous) / previous) * 100;
  return {
    current,
    previous,
    change: Math.round(change * 10) / 10,
    trend: change > 5 ? 'UP' : change < -5 ? 'DOWN' : 'STABLE',
  };
}

function createTimeline(
  events: AnalyticsEvent[],
  start: Date,
  end: Date,
  bucketSize: 'hour' | 'day' | 'week' | 'month'
): TimeSeriesPoint[] {
  const buckets = new Map<string, number>();

  // Initialize buckets
  const current = new Date(start);
  while (current <= end) {
    let key: string;
    switch (bucketSize) {
      case 'hour':
        key = current.toISOString().slice(0, 13);
        current.setHours(current.getHours() + 1);
        break;
      case 'day':
        key = current.toISOString().slice(0, 10);
        current.setDate(current.getDate() + 1);
        break;
      case 'week':
        key = `${current.getFullYear()}-W${Math.ceil((current.getDate() + 6 - current.getDay()) / 7)}`;
        current.setDate(current.getDate() + 7);
        break;
      case 'month':
        key = current.toISOString().slice(0, 7);
        current.setMonth(current.getMonth() + 1);
        break;
    }
    buckets.set(key, 0);
  }

  // Fill buckets
  for (const event of events) {
    const eventDate = new Date(event.timestamp);
    let key: string;
    switch (bucketSize) {
      case 'hour':
        key = eventDate.toISOString().slice(0, 13);
        break;
      case 'day':
        key = eventDate.toISOString().slice(0, 10);
        break;
      case 'week':
        key = `${eventDate.getFullYear()}-W${Math.ceil((eventDate.getDate() + 6 - eventDate.getDay()) / 7)}`;
        break;
      case 'month':
        key = eventDate.toISOString().slice(0, 7);
        break;
    }
    if (buckets.has(key)) {
      buckets.set(key, (buckets.get(key) || 0) + 1);
    }
  }

  return Array.from(buckets.entries()).map(([timestamp, value]) => ({
    timestamp,
    value,
  }));
}

// ---------------------------------------------------------------------------
// Metric Calculation
// ---------------------------------------------------------------------------

function calculateEditMetrics(
  researchId: string,
  start: Date,
  end: Date,
  prevStart: Date,
  prevEnd: Date
): EditMetrics {
  const currentEvents = filterEvents(researchId, 'EDITS', start, end);
  const previousEvents = filterEvents(researchId, 'EDITS', prevStart, prevEnd);

  // User edit counts
  const userCounts = new Map<string, number>();
  const typeCounts = new Map<string, number>();
  const hourCounts = new Map<number, number>();

  for (const event of currentEvents) {
    userCounts.set(event.userId, (userCounts.get(event.userId) || 0) + 1);
    if (event.subtype) {
      typeCounts.set(event.subtype, (typeCounts.get(event.subtype) || 0) + 1);
    }
    const hour = new Date(event.timestamp).getHours();
    hourCounts.set(hour, (hourCounts.get(hour) || 0) + 1);
  }

  const days = Math.max(1, (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));

  return {
    totalEdits: calculateSummary(currentEvents.length, previousEvents.length),
    averageEditsPerDay: Math.round((currentEvents.length / days) * 10) / 10,
    mostActiveUsers: Array.from(userCounts.entries())
      .map(([userId, editCount]) => ({ userId, editCount }))
      .sort((a, b) => b.editCount - a.editCount)
      .slice(0, 10),
    editsByArtifactType: Object.fromEntries(typeCounts),
    editTimeline: createTimeline(currentEvents, start, end, 'day'),
    peakHours: Array.from(hourCounts.entries())
      .map(([hour, editCount]) => ({ hour, editCount }))
      .sort((a, b) => b.editCount - a.editCount)
      .slice(0, 5),
  };
}

function calculateCommentMetrics(
  researchId: string,
  start: Date,
  end: Date,
  prevStart: Date,
  prevEnd: Date
): CommentMetrics {
  const currentEvents = filterEvents(researchId, 'COMMENTS', start, end);
  const previousEvents = filterEvents(researchId, 'COMMENTS', prevStart, prevEnd);

  const newComments = currentEvents.filter(e => e.subtype !== 'resolution');
  const newThreads = currentEvents.filter(e => e.subtype === 'new');
  const resolutions = currentEvents.filter(e => e.subtype === 'resolution');

  const prevNewComments = previousEvents.filter(e => e.subtype !== 'resolution');
  const prevNewThreads = previousEvents.filter(e => e.subtype === 'new');
  const prevResolutions = previousEvents.filter(e => e.subtype === 'resolution');

  // Resolution time distribution
  const resolutionTimes = resolutions.map(e => e.duration || 0).filter(d => d > 0);
  const avgResolutionHours = resolutionTimes.length > 0
    ? resolutionTimes.reduce((a, b) => a + b, 0) / resolutionTimes.length / (1000 * 60 * 60)
    : 0;

  const resolutionBuckets = [
    { bucket: '< 1 hour', count: 0 },
    { bucket: '1-4 hours', count: 0 },
    { bucket: '4-24 hours', count: 0 },
    { bucket: '1-3 days', count: 0 },
    { bucket: '> 3 days', count: 0 },
  ];

  for (const time of resolutionTimes) {
    const hours = time / (1000 * 60 * 60);
    if (hours < 1) resolutionBuckets[0].count++;
    else if (hours < 4) resolutionBuckets[1].count++;
    else if (hours < 24) resolutionBuckets[2].count++;
    else if (hours < 72) resolutionBuckets[3].count++;
    else resolutionBuckets[4].count++;
  }

  // User stats
  const userStats = new Map<string, { comments: number; resolved: number }>();
  for (const event of currentEvents) {
    const stats = userStats.get(event.userId) || { comments: 0, resolved: 0 };
    if (event.subtype === 'resolution') {
      stats.resolved++;
    } else {
      stats.comments++;
    }
    userStats.set(event.userId, stats);
  }

  return {
    totalComments: calculateSummary(newComments.length, prevNewComments.length),
    totalThreads: calculateSummary(newThreads.length, prevNewThreads.length),
    resolvedThreads: calculateSummary(resolutions.length, prevResolutions.length),
    averageResolutionTime: Math.round(avgResolutionHours * 10) / 10,
    resolutionTimeDistribution: resolutionBuckets,
    commentsByUser: Array.from(userStats.entries())
      .map(([userId, stats]) => ({ userId, commentCount: stats.comments, resolvedCount: stats.resolved }))
      .sort((a, b) => b.commentCount - a.commentCount)
      .slice(0, 10),
    commentTimeline: createTimeline(newComments, start, end, 'day'),
  };
}

function calculateReviewMetrics(
  researchId: string,
  start: Date,
  end: Date,
  prevStart: Date,
  prevEnd: Date
): ReviewMetrics {
  const currentEvents = filterEvents(researchId, 'REVIEWS', start, end);
  const previousEvents = filterEvents(researchId, 'REVIEWS', prevStart, prevEnd);

  const completions = currentEvents.filter(e => e.subtype === 'completion');
  const prevCompletions = previousEvents.filter(e => e.subtype === 'completion');

  // Review time calculation
  const reviewTimes = completions.map(e => e.duration || 0).filter(d => d > 0);
  const avgReviewDays = reviewTimes.length > 0
    ? reviewTimes.reduce((a, b) => a + b, 0) / reviewTimes.length / (1000 * 60 * 60 * 24)
    : 0;

  const reviewTimeBuckets = [
    { bucket: '< 1 day', count: 0 },
    { bucket: '1-3 days', count: 0 },
    { bucket: '3-7 days', count: 0 },
    { bucket: '1-2 weeks', count: 0 },
    { bucket: '> 2 weeks', count: 0 },
  ];

  for (const time of reviewTimes) {
    const days = time / (1000 * 60 * 60 * 24);
    if (days < 1) reviewTimeBuckets[0].count++;
    else if (days < 3) reviewTimeBuckets[1].count++;
    else if (days < 7) reviewTimeBuckets[2].count++;
    else if (days < 14) reviewTimeBuckets[3].count++;
    else reviewTimeBuckets[4].count++;
  }

  // Reviewer performance
  const reviewerStats = new Map<string, { count: number; totalTime: number; totalScore: number; scoreCount: number }>();
  for (const event of completions) {
    const stats = reviewerStats.get(event.userId) || { count: 0, totalTime: 0, totalScore: 0, scoreCount: 0 };
    stats.count++;
    if (event.duration) stats.totalTime += event.duration;
    const score = event.metadata?.averageScore as number | undefined;
    if (score !== undefined) {
      stats.totalScore += score;
      stats.scoreCount++;
    }
    reviewerStats.set(event.userId, stats);
  }

  return {
    totalReviews: calculateSummary(currentEvents.length, previousEvents.length),
    completedReviews: calculateSummary(completions.length, prevCompletions.length),
    averageReviewTime: Math.round(avgReviewDays * 10) / 10,
    reviewTimeDistribution: reviewTimeBuckets,
    reviewerPerformance: Array.from(reviewerStats.entries())
      .map(([reviewerId, stats]) => ({
        reviewerId,
        completedCount: stats.count,
        averageTime: Math.round((stats.totalTime / stats.count / (1000 * 60 * 60 * 24)) * 10) / 10,
        averageScore: stats.scoreCount > 0 ? Math.round((stats.totalScore / stats.scoreCount) * 10) / 10 : null,
      }))
      .sort((a, b) => b.completedCount - a.completedCount)
      .slice(0, 10),
    reviewTimeline: createTimeline(completions, start, end, 'day'),
    recommendationDistribution: {}, // Would be populated from actual review data
  };
}

function calculateTaskMetrics(
  researchId: string,
  start: Date,
  end: Date,
  prevStart: Date,
  prevEnd: Date
): TaskMetrics {
  const currentEvents = filterEvents(researchId, 'TASKS', start, end);
  const previousEvents = filterEvents(researchId, 'TASKS', prevStart, prevEnd);

  const completions = currentEvents.filter(e => e.subtype === 'completion');
  const prevCompletions = previousEvents.filter(e => e.subtype === 'completion');

  // Completion time and overdue rate
  const completionTimes = completions.map(e => e.duration || 0).filter(d => d > 0);
  const avgCompletionHours = completionTimes.length > 0
    ? completionTimes.reduce((a, b) => a + b, 0) / completionTimes.length / (1000 * 60 * 60)
    : 0;

  const overdueCount = completions.filter(e => e.metadata?.wasOverdue).length;
  const overdueRate = completions.length > 0 ? (overdueCount / completions.length) * 100 : 0;

  // Assignee workload
  const assigneeStats = new Map<string, { assigned: number; completed: number }>();
  for (const event of completions) {
    const stats = assigneeStats.get(event.userId) || { assigned: 0, completed: 0 };
    stats.completed++;
    assigneeStats.set(event.userId, stats);
  }

  return {
    totalTasks: calculateSummary(currentEvents.length, previousEvents.length),
    completedTasks: calculateSummary(completions.length, prevCompletions.length),
    overdueRate: Math.round(overdueRate * 10) / 10,
    averageCompletionTime: Math.round(avgCompletionHours * 10) / 10,
    tasksByStatus: {}, // Would be populated from task service
    tasksByPriority: {}, // Would be populated from task service
    assigneeWorkload: Array.from(assigneeStats.entries())
      .map(([userId, stats]) => ({ userId, ...stats }))
      .sort((a, b) => b.completed - a.completed)
      .slice(0, 10),
    taskTimeline: createTimeline(completions, start, end, 'day'),
    velocityTrend: createTimeline(completions, start, end, 'week'),
  };
}

function calculateCollaborationMetrics(
  researchId: string,
  start: Date,
  end: Date,
  prevStart: Date,
  prevEnd: Date
): CollaborationMetrics {
  const allCurrentEvents = events.filter(e =>
    e.researchId === researchId &&
    new Date(e.timestamp) >= start &&
    new Date(e.timestamp) <= end
  );

  const allPreviousEvents = events.filter(e =>
    e.researchId === researchId &&
    new Date(e.timestamp) >= prevStart &&
    new Date(e.timestamp) <= prevEnd
  );

  const currentUsers = new Set(allCurrentEvents.map(e => e.userId));
  const previousUsers = new Set(allPreviousEvents.map(e => e.userId));

  // Calculate collaboration score (composite of various factors)
  const editCount = allCurrentEvents.filter(e => e.type === 'EDITS').length;
  const commentCount = allCurrentEvents.filter(e => e.type === 'COMMENTS').length;
  const reviewCount = allCurrentEvents.filter(e => e.type === 'REVIEWS').length;
  const taskCount = allCurrentEvents.filter(e => e.type === 'TASKS').length;

  // Simple scoring: normalize each metric and combine
  const maxExpected = { edits: 100, comments: 50, reviews: 10, tasks: 50 };
  const scores = {
    edits: Math.min(100, (editCount / maxExpected.edits) * 100),
    comments: Math.min(100, (commentCount / maxExpected.comments) * 100),
    reviews: Math.min(100, (reviewCount / maxExpected.reviews) * 100),
    tasks: Math.min(100, (taskCount / maxExpected.tasks) * 100),
  };
  const collaborationScore = Math.round(
    (scores.edits * 0.3 + scores.comments * 0.25 + scores.reviews * 0.25 + scores.tasks * 0.2)
  );

  // Top collaborators
  const userActivity = new Map<string, number>();
  for (const event of allCurrentEvents) {
    userActivity.set(event.userId, (userActivity.get(event.userId) || 0) + 1);
  }

  return {
    activeUsers: calculateSummary(currentUsers.size, previousUsers.size),
    uniqueContributors: currentUsers.size,
    collaborationScore,
    engagementTrend: createTimeline(allCurrentEvents, start, end, 'day'),
    topCollaborators: Array.from(userActivity.entries())
      .map(([userId, score]) => ({ userId, score }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 10),
  };
}

// ---------------------------------------------------------------------------
// Main Dashboard Generator
// ---------------------------------------------------------------------------

export function getProductivityDashboard(
  researchId: string,
  range: TimeRange = 'LAST_30_DAYS',
  customStart?: string,
  customEnd?: string
): ProductivityDashboard {
  const { start, end } = getDateRange(range, customStart, customEnd);
  const { start: prevStart, end: prevEnd } = getPreviousRange(start, end);

  return {
    timeRange: range,
    startDate: start.toISOString(),
    endDate: end.toISOString(),
    edits: calculateEditMetrics(researchId, start, end, prevStart, prevEnd),
    comments: calculateCommentMetrics(researchId, start, end, prevStart, prevEnd),
    reviews: calculateReviewMetrics(researchId, start, end, prevStart, prevEnd),
    tasks: calculateTaskMetrics(researchId, start, end, prevStart, prevEnd),
    submissions: {
      totalSubmissions: calculateSummary(0, 0),
      acceptanceRate: 0,
      averageTimeToDecision: 0,
      submissionsByStatus: {},
      submissionsByTarget: {},
      submissionTimeline: [],
    },
    collaboration: calculateCollaborationMetrics(researchId, start, end, prevStart, prevEnd),
    generatedAt: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Export for Reporting
// ---------------------------------------------------------------------------

export function exportAnalyticsReport(
  researchId: string,
  range: TimeRange,
  format: 'json' | 'csv'
): string {
  const dashboard = getProductivityDashboard(researchId, range);

  if (format === 'json') {
    return JSON.stringify(dashboard, null, 2);
  }

  // CSV export (simplified)
  const lines: string[] = [];
  lines.push('Metric,Current,Previous,Change,Trend');
  lines.push(`Total Edits,${dashboard.edits.totalEdits.current},${dashboard.edits.totalEdits.previous},${dashboard.edits.totalEdits.change}%,${dashboard.edits.totalEdits.trend}`);
  lines.push(`Total Comments,${dashboard.comments.totalComments.current},${dashboard.comments.totalComments.previous},${dashboard.comments.totalComments.change}%,${dashboard.comments.totalComments.trend}`);
  lines.push(`Completed Reviews,${dashboard.reviews.completedReviews.current},${dashboard.reviews.completedReviews.previous},${dashboard.reviews.completedReviews.change}%,${dashboard.reviews.completedReviews.trend}`);
  lines.push(`Completed Tasks,${dashboard.tasks.completedTasks.current},${dashboard.tasks.completedTasks.previous},${dashboard.tasks.completedTasks.change}%,${dashboard.tasks.completedTasks.trend}`);
  lines.push(`Active Users,${dashboard.collaboration.activeUsers.current},${dashboard.collaboration.activeUsers.previous},${dashboard.collaboration.activeUsers.change}%,${dashboard.collaboration.activeUsers.trend}`);

  return lines.join('\n');
}
