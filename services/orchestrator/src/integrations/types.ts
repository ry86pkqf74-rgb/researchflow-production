/**
 * Integration Types
 * Task 165-167: Common types for integration providers
 */

export interface IntegrationConfig {
  id?: string;
  name: string;
  enabled: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface SyncResult {
  success: boolean;
  itemsSynced: number;
  errors: string[];
  lastSyncAt?: Date;
}

export interface IntegrationProvider {
  authenticate(): Promise<boolean>;
  sync(): Promise<SyncResult>;
  disconnect(): Promise<void>;
}

export interface WebhookEvent {
  id: string;
  type: string;
  payload: Record<string, unknown>;
  timestamp: Date;
  signature?: string;
}

export interface WebhookConfig {
  id: string;
  url: string;
  events: string[];
  secret?: string;
  enabled: boolean;
  createdAt: Date;
  lastTriggeredAt?: Date;
}

export type IntegrationType = 'notion' | 'slack' | 'github' | 'zoom' | 'salesforce' | 'powerbi';

export interface IntegrationStatus {
  type: IntegrationType;
  connected: boolean;
  lastSync?: Date;
  error?: string;
}
