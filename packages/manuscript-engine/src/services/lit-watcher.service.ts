/**
 * Literature Watcher Service
 * Task T31: Background monitoring for new publications matching saved searches
 */

import { EventEmitter } from 'events';

export interface LitWatchConfig {
  id: string;
  manuscriptId: string;
  searchQuery: string;
  databases: Array<'pubmed' | 'semantic_scholar' | 'arxiv'>;
  keywords: string[];
  checkFrequency: 'daily' | 'weekly' | 'monthly';
  notifyEmail?: string;
  autoAddToCitations: boolean;
  minRelevanceScore: number; // 0-1
  createdAt: Date;
  lastChecked?: Date;
}

export interface NewPublicationAlert {
  watchId: string;
  publication: {
    id: string;
    title: string;
    authors: string[];
    abstract: string;
    source: 'pubmed' | 'semantic_scholar' | 'arxiv';
    publishedDate: Date;
    doi?: string;
    url: string;
  };
  relevanceScore: number; // 0-1
  matchedKeywords: string[];
  alertedAt: Date;
  status: 'new' | 'reviewed' | 'added' | 'dismissed';
}

export interface LitWatchSummary {
  watchId: string;
  totalAlerts: number;
  newAlerts: number;
  lastCheck: Date;
  nextCheck: Date;
  isActive: boolean;
}

/**
 * Literature Watcher Service for monitoring new publications
 * Uses background polling with configurable frequency
 */
export class LitWatcherService extends EventEmitter {
  private watches: Map<string, LitWatchConfig> = new Map();
  private alerts: Map<string, NewPublicationAlert[]> = new Map();
  private intervals: Map<string, NodeJS.Timeout> = new Map();

  /**
   * Create a new literature watch
   */
  createWatch(config: Omit<LitWatchConfig, 'id' | 'createdAt'>): LitWatchConfig {
    const watch: LitWatchConfig = {
      ...config,
      id: this.generateWatchId(),
      createdAt: new Date(),
    };

    this.watches.set(watch.id, watch);
    this.scheduleCheck(watch);

    this.emit('watch:created', watch);

    return watch;
  }

  /**
   * Start monitoring for a watch (schedules background checks)
   */
  startWatch(watchId: string): void {
    const watch = this.watches.get(watchId);
    if (!watch) {
      throw new Error(`Watch ${watchId} not found`);
    }

    this.scheduleCheck(watch);
    this.emit('watch:started', watchId);
  }

  /**
   * Stop monitoring for a watch
   */
  stopWatch(watchId: string): void {
    const interval = this.intervals.get(watchId);
    if (interval) {
      clearInterval(interval);
      this.intervals.delete(watchId);
    }

    this.emit('watch:stopped', watchId);
  }

  /**
   * Manually trigger a check for new publications
   */
  async checkNow(watchId: string): Promise<NewPublicationAlert[]> {
    const watch = this.watches.get(watchId);
    if (!watch) {
      throw new Error(`Watch ${watchId} not found`);
    }

    return this.performCheck(watch);
  }

  /**
   * Get all alerts for a watch
   */
  getAlerts(watchId: string, status?: NewPublicationAlert['status']): NewPublicationAlert[] {
    const allAlerts = this.alerts.get(watchId) || [];

    if (status) {
      return allAlerts.filter(a => a.status === status);
    }

    return allAlerts;
  }

  /**
   * Mark an alert as reviewed/added/dismissed
   */
  updateAlertStatus(watchId: string, alertIndex: number, status: NewPublicationAlert['status']): void {
    const alerts = this.alerts.get(watchId);
    if (!alerts || !alerts[alertIndex]) {
      throw new Error('Alert not found');
    }

    alerts[alertIndex].status = status;
    this.emit('alert:updated', { watchId, alertIndex, status });
  }

  /**
   * Get summary of all watches
   */
  getSummaries(): LitWatchSummary[] {
    const summaries: LitWatchSummary[] = [];

    for (const [watchId, watch] of this.watches) {
      const alerts = this.alerts.get(watchId) || [];
      const newAlerts = alerts.filter(a => a.status === 'new').length;

      summaries.push({
        watchId,
        totalAlerts: alerts.length,
        newAlerts,
        lastCheck: watch.lastChecked || watch.createdAt,
        nextCheck: this.calculateNextCheck(watch),
        isActive: this.intervals.has(watchId),
      });
    }

    return summaries;
  }

  /**
   * Delete a watch and stop monitoring
   */
  deleteWatch(watchId: string): void {
    this.stopWatch(watchId);
    this.watches.delete(watchId);
    this.alerts.delete(watchId);

    this.emit('watch:deleted', watchId);
  }

  // ========== Private Methods ==========

  /**
   * Schedule periodic checks based on frequency
   */
  private scheduleCheck(watch: LitWatchConfig): void {
    // Clear existing interval if any
    this.stopWatch(watch.id);

    const intervalMs = this.getIntervalMs(watch.checkFrequency);

    const interval = setInterval(async () => {
      await this.performCheck(watch);
    }, intervalMs);

    this.intervals.set(watch.id, interval);
  }

  /**
   * Perform the actual literature search and comparison
   */
  private async performCheck(watch: LitWatchConfig): Promise<NewPublicationAlert[]> {
    try {
      const newPublications = await this.searchDatabases(watch);
      const alerts: NewPublicationAlert[] = [];

      for (const pub of newPublications) {
        // Check if we've already alerted on this publication
        const existingAlerts = this.alerts.get(watch.id) || [];
        const alreadyAlerted = existingAlerts.some(a => a.publication.id === pub.id);

        if (!alreadyAlerted) {
          // Calculate relevance score
          const relevanceScore = this.calculateRelevance(pub, watch);

          if (relevanceScore >= watch.minRelevanceScore) {
            const alert: NewPublicationAlert = {
              watchId: watch.id,
              publication: pub,
              relevanceScore,
              matchedKeywords: this.findMatchedKeywords(pub, watch.keywords),
              alertedAt: new Date(),
              status: 'new',
            };

            alerts.push(alert);
          }
        }
      }

      // Store alerts
      if (alerts.length > 0) {
        const existingAlerts = this.alerts.get(watch.id) || [];
        this.alerts.set(watch.id, [...existingAlerts, ...alerts]);

        this.emit('alerts:new', { watchId: watch.id, count: alerts.length, alerts });

        // Send email notification if configured
        if (watch.notifyEmail) {
          this.sendEmailNotification(watch, alerts);
        }
      }

      // Update last checked timestamp
      watch.lastChecked = new Date();

      return alerts;
    } catch (error) {
      console.error(`Error checking watch ${watch.id}:`, error);
      this.emit('watch:error', { watchId: watch.id, error });
      return [];
    }
  }

  /**
   * Search configured databases for new publications
   */
  private async searchDatabases(
    watch: LitWatchConfig
  ): Promise<NewPublicationAlert['publication'][]> {
    // In production, this would query actual APIs
    // For now, return mock data structure

    const publications: NewPublicationAlert['publication'][] = [];

    // Query each database
    for (const db of watch.databases) {
      switch (db) {
        case 'pubmed':
          // const pubmedResults = await pubmedService.search({ query: watch.searchQuery, ... });
          break;
        case 'semantic_scholar':
          // const s2Results = await semanticScholarService.search({ query: watch.searchQuery, ... });
          break;
        case 'arxiv':
          // const arxivResults = await arxivService.search({ query: watch.searchQuery, ... });
          break;
      }
    }

    // Filter to only publications since last check
    const cutoffDate = watch.lastChecked || watch.createdAt;
    return publications.filter(p => p.publishedDate >= cutoffDate);
  }

  /**
   * Calculate relevance score for a publication
   */
  private calculateRelevance(
    publication: NewPublicationAlert['publication'],
    watch: LitWatchConfig
  ): number {
    let score = 0;
    const weights = {
      titleMatch: 0.4,
      abstractMatch: 0.3,
      keywordMatch: 0.2,
      authorMatch: 0.1,
    };

    // Title matching
    const titleWords = publication.title.toLowerCase().split(/\s+/);
    const queryWords = watch.searchQuery.toLowerCase().split(/\s+/);
    const titleMatches = titleWords.filter(w => queryWords.includes(w)).length;
    score += weights.titleMatch * (titleMatches / Math.max(queryWords.length, 1));

    // Abstract matching
    const abstractWords = publication.abstract.toLowerCase().split(/\s+/);
    const abstractMatches = abstractWords.filter(w => queryWords.includes(w)).length;
    score += weights.abstractMatch * (abstractMatches / Math.max(queryWords.length, 1));

    // Keyword matching
    const matchedKeywords = this.findMatchedKeywords(publication, watch.keywords);
    score += weights.keywordMatch * (matchedKeywords.length / Math.max(watch.keywords.length, 1));

    return Math.min(1.0, score);
  }

  /**
   * Find which keywords match the publication
   */
  private findMatchedKeywords(
    publication: NewPublicationAlert['publication'],
    keywords: string[]
  ): string[] {
    const text = `${publication.title} ${publication.abstract}`.toLowerCase();

    return keywords.filter(kw => text.includes(kw.toLowerCase()));
  }

  /**
   * Send email notification for new alerts
   */
  private sendEmailNotification(watch: LitWatchConfig, alerts: NewPublicationAlert[]): void {
    // In production, integrate with email service (SendGrid, AWS SES, etc.)
    console.log(`[Email] Sending notification to ${watch.notifyEmail}: ${alerts.length} new publications found`);
  }

  /**
   * Get interval in milliseconds for check frequency
   */
  private getIntervalMs(frequency: LitWatchConfig['checkFrequency']): number {
    switch (frequency) {
      case 'daily':
        return 24 * 60 * 60 * 1000; // 24 hours
      case 'weekly':
        return 7 * 24 * 60 * 60 * 1000; // 7 days
      case 'monthly':
        return 30 * 24 * 60 * 60 * 1000; // 30 days
    }
  }

  /**
   * Calculate next check time
   */
  private calculateNextCheck(watch: LitWatchConfig): Date {
    const lastCheck = watch.lastChecked || watch.createdAt;
    const intervalMs = this.getIntervalMs(watch.checkFrequency);
    return new Date(lastCheck.getTime() + intervalMs);
  }

  private generateWatchId(): string {
    return `watch-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

export const litWatcherService = new LitWatcherService();
