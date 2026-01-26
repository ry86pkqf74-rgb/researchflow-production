import { EventEmitter } from 'events';

export type SyncEventType = 'data_updated' | 'data_deleted' | 'citation_added' | 'version_created';
export type SyncSeverity = 'critical' | 'warning' | 'info';

export interface SyncEvent {
  type: SyncEventType;
  manuscriptId: string;
  datasetId?: string;
  affectedSections: string[];
  severity: SyncSeverity;
  message: string;
  timestamp: Date;
  userId: string;
}

export class DataSyncService extends EventEmitter {
  private subscriptions: Map<string, Set<string>> = new Map();

  subscribeToManuscript(manuscriptId: string, listenerId: string): void {
    if (!this.subscriptions.has(manuscriptId)) {
      this.subscriptions.set(manuscriptId, new Set());
    }
    this.subscriptions.get(manuscriptId)!.add(listenerId);
  }

  unsubscribeFromManuscript(manuscriptId: string, listenerId: string): void {
    const listeners = this.subscriptions.get(manuscriptId);
    if (listeners) {
      listeners.delete(listenerId);
      if (listeners.size === 0) {
        this.subscriptions.delete(manuscriptId);
      }
    }
  }

  notifyDataUpdate(event: Omit<SyncEvent, 'timestamp'>): void {
    const fullEvent: SyncEvent = {
      ...event,
      timestamp: new Date()
    };

    // Emit to EventEmitter subscribers
    this.emit('sync_event', fullEvent);
    this.emit(`sync:${event.manuscriptId}`, fullEvent);

    // Log for audit trail
    console.log(`[DATA_SYNC] ${event.type}`, {
      manuscriptId: event.manuscriptId,
      affectedSections: event.affectedSections,
      severity: event.severity
    });
  }

  trackAffectedSections(params: {
    manuscriptId: string;
    datasetId: string;
  }): string[] {
    // This would query which sections use this dataset
    // For now, return placeholder
    return ['results', 'methods', 'abstract'];
  }

  determineSeverity(params: {
    eventType: SyncEventType;
    sectionCount: number;
  }): SyncSeverity {
    if (params.eventType === 'data_deleted') {
      return 'critical';
    }
    if (params.sectionCount > 3) {
      return 'warning';
    }
    return 'info';
  }
}

export const dataSyncService = new DataSyncService();
