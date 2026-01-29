/**
 * Insights API Client
 * TanStack Query hooks for ResearchFlow Insights & Observability
 * 
 * Generated for Phase 6 Insights implementation
 */

import { useQuery, useMutation, useQueryClient, UseQueryOptions } from '@tanstack/react-query';
import { apiClient } from './client';

// ============================================================================
// Types
// ============================================================================

export type InsightCategory = 'trace' | 'metric' | 'alert' | 'audit';
export type InsightSource = 'orchestrator' | 'worker' | 'web' | 'collab' | 'guideline-engine';
export type InsightSeverity = 'info' | 'warning' | 'error' | 'critical';
export type AlertOperator = 'gt' | 'gte' | 'lt' | 'lte' | 'eq' | 'neq';
export type AlertActionType = 'webhook' | 'email' | 'slack' | 'pagerduty';

export interface InsightEvent {
  id: string;
  category: InsightCategory;
  eventType: string;
  source: InsightSource;
  severity: InsightSeverity;
  timestamp: string;
  researchId?: string;
  orgId?: string;
  userId?: string;
  traceId?: string;
  spanId?: string;
  parentSpanId?: string;
  payload?: Record<string, unknown>;
  tags?: Record<string, string>;
  expiresAt?: string;
}

export interface EventFilters {
  category?: InsightCategory;
  source?: InsightSource;
  severity?: InsightSeverity;
  eventType?: string;
  researchId?: string;
  traceId?: string;
  from?: string;
  to?: string;
  limit?: number;
  cursor?: string;
}

export interface EventsResponse {
  events: InsightEvent[];
  cursor?: string;
  hasMore: boolean;
  total: number;
}

export interface SubscriptionFilters {
  categories?: InsightCategory[];
  sources?: InsightSource[];
  severities?: InsightSeverity[];
  eventTypes?: string[];
  researchId?: string;
}

export interface InsightSubscription {
  id: string;
  channelId: string;
  filters?: SubscriptionFilters;
  createdAt: string;
}

export interface AlertCondition {
  metric: string;
  operator: AlertOperator;
  threshold: number;
  windowMinutes: number;
}

export interface AlertAction {
  type: AlertActionType;
  config: Record<string, unknown>;
}

export interface InsightAlert {
  id: string;
  name: string;
  description?: string;
  enabled: boolean;
  condition: AlertCondition;
  actions: AlertAction[];
  cooldownMinutes: number;
  lastTriggeredAt?: string;
  triggerCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface AlertHistoryEntry {
  id: string;
  alertId: string;
  triggeredAt: string;
  resolvedAt?: string;
  metricValue: number;
  eventId?: string;
}

export interface CreateEventRequest {
  category: InsightCategory;
  eventType: string;
  source: string;
  severity: InsightSeverity;
  researchId?: string;
  traceId?: string;
  spanId?: string;
  parentSpanId?: string;
  payload?: Record<string, unknown>;
  tags?: Record<string, string>;
  retentionDays?: number;
}

export interface CreateSubscriptionRequest {
  channelId: string;
  filters?: SubscriptionFilters;
}

export interface CreateAlertRequest {
  name: string;
  description?: string;
  condition: AlertCondition;
  actions: AlertAction[];
  cooldownMinutes?: number;
}

export interface UpdateAlertRequest {
  name?: string;
  description?: string;
  enabled?: boolean;
  condition?: AlertCondition;
  actions?: AlertAction[];
  cooldownMinutes?: number;
}


// ============================================================================
// Query Keys
// ============================================================================

export const insightKeys = {
  all: ['insights'] as const,
  events: (filters?: EventFilters) => [...insightKeys.all, 'events', filters] as const,
  event: (id: string) => [...insightKeys.all, 'events', id] as const,
  subscriptions: () => [...insightKeys.all, 'subscriptions'] as const,
  subscription: (id: string) => [...insightKeys.all, 'subscriptions', id] as const,
  alerts: () => [...insightKeys.all, 'alerts'] as const,
  alert: (id: string) => [...insightKeys.all, 'alerts', id] as const,
  alertHistory: (alertId: string) => [...insightKeys.all, 'alerts', alertId, 'history'] as const,
};

// ============================================================================
// API Functions
// ============================================================================

const INSIGHTS_BASE = '/api/v1/insights';

async function fetchEvents(filters?: EventFilters): Promise<EventsResponse> {
  const params = new URLSearchParams();
  if (filters) {
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined) params.append(key, String(value));
    });
  }
  const url = `${INSIGHTS_BASE}/events${params.toString() ? `?${params}` : ''}`;
  return apiClient.get<EventsResponse>(url);
}

async function fetchEvent(id: string): Promise<InsightEvent> {
  return apiClient.get<InsightEvent>(`${INSIGHTS_BASE}/events/${id}`);
}

async function createEvent(data: CreateEventRequest): Promise<InsightEvent> {
  return apiClient.post<InsightEvent>(`${INSIGHTS_BASE}/events`, data);
}

async function fetchSubscriptions(): Promise<InsightSubscription[]> {
  return apiClient.get<InsightSubscription[]>(`${INSIGHTS_BASE}/subscriptions`);
}

async function createSubscription(data: CreateSubscriptionRequest): Promise<InsightSubscription> {
  return apiClient.post<InsightSubscription>(`${INSIGHTS_BASE}/subscriptions`, data);
}

async function deleteSubscription(id: string): Promise<void> {
  return apiClient.delete(`${INSIGHTS_BASE}/subscriptions/${id}`);
}

async function fetchAlerts(): Promise<InsightAlert[]> {
  return apiClient.get<InsightAlert[]>(`${INSIGHTS_BASE}/alerts`);
}

async function fetchAlert(id: string): Promise<InsightAlert> {
  return apiClient.get<InsightAlert>(`${INSIGHTS_BASE}/alerts/${id}`);
}

async function createAlert(data: CreateAlertRequest): Promise<InsightAlert> {
  return apiClient.post<InsightAlert>(`${INSIGHTS_BASE}/alerts`, data);
}

async function updateAlert(id: string, data: UpdateAlertRequest): Promise<InsightAlert> {
  return apiClient.patch<InsightAlert>(`${INSIGHTS_BASE}/alerts/${id}`, data);
}

async function deleteAlert(id: string): Promise<void> {
  return apiClient.delete(`${INSIGHTS_BASE}/alerts/${id}`);
}

async function fetchAlertHistory(alertId: string, limit = 50): Promise<AlertHistoryEntry[]> {
  return apiClient.get<AlertHistoryEntry[]>(
    `${INSIGHTS_BASE}/alerts/${alertId}/history?limit=${limit}`
  );
}


// ============================================================================
// Query Hooks
// ============================================================================

/**
 * Fetch insight events with filtering and pagination
 */
export function useInsightEvents(
  filters?: EventFilters,
  options?: Omit<UseQueryOptions<EventsResponse>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: insightKeys.events(filters),
    queryFn: () => fetchEvents(filters),
    ...options,
  });
}

/**
 * Fetch single insight event by ID
 */
export function useInsightEvent(
  id: string,
  options?: Omit<UseQueryOptions<InsightEvent>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: insightKeys.event(id),
    queryFn: () => fetchEvent(id),
    enabled: !!id,
    ...options,
  });
}

/**
 * Create new insight event
 */
export function useCreateInsightEvent() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: createEvent,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: insightKeys.events() });
    },
  });
}

/**
 * Fetch all WebSocket subscriptions
 */
export function useInsightSubscriptions(
  options?: Omit<UseQueryOptions<InsightSubscription[]>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: insightKeys.subscriptions(),
    queryFn: fetchSubscriptions,
    ...options,
  });
}

/**
 * Create new subscription
 */
export function useCreateSubscription() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: createSubscription,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: insightKeys.subscriptions() });
    },
  });
}

/**
 * Delete subscription
 */
export function useDeleteSubscription() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: deleteSubscription,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: insightKeys.subscriptions() });
    },
  });
}


/**
 * Fetch all alert configurations
 */
export function useInsightAlerts(
  options?: Omit<UseQueryOptions<InsightAlert[]>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: insightKeys.alerts(),
    queryFn: fetchAlerts,
    ...options,
  });
}

/**
 * Fetch single alert by ID
 */
export function useInsightAlert(
  id: string,
  options?: Omit<UseQueryOptions<InsightAlert>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: insightKeys.alert(id),
    queryFn: () => fetchAlert(id),
    enabled: !!id,
    ...options,
  });
}

/**
 * Create new alert
 */
export function useCreateAlert() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: createAlert,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: insightKeys.alerts() });
    },
  });
}

/**
 * Update existing alert
 */
export function useUpdateAlert() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateAlertRequest }) => 
      updateAlert(id, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: insightKeys.alert(id) });
      queryClient.invalidateQueries({ queryKey: insightKeys.alerts() });
    },
  });
}

/**
 * Delete alert
 */
export function useDeleteAlert() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: deleteAlert,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: insightKeys.alerts() });
    },
  });
}

/**
 * Fetch alert trigger history
 */
export function useAlertHistory(
  alertId: string,
  options?: Omit<UseQueryOptions<AlertHistoryEntry[]>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: insightKeys.alertHistory(alertId),
    queryFn: () => fetchAlertHistory(alertId),
    enabled: !!alertId,
    ...options,
  });
}

// ============================================================================
// Real-time Polling Hook
// ============================================================================

/**
 * Hook for real-time event streaming with polling
 * Automatically refetches at specified interval
 */
export function useInsightEventsRealtime(
  filters?: EventFilters,
  pollInterval = 5000
) {
  return useInsightEvents(filters, {
    refetchInterval: pollInterval,
    refetchIntervalInBackground: false,
  });
}
