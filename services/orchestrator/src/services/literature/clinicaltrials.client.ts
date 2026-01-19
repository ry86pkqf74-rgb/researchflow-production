/**
 * ClinicalTrials.gov API Client
 *
 * Provides search capabilities for clinical trials registry.
 * Uses the v2 API.
 */

import CacheService from '../cache.service.js';
import { logger } from '../../logger/file-logger.js';

export interface ClinicalTrial {
  nctId: string;
  title: string;
  briefSummary?: string;
  status: string;
  phase?: string;
  conditions: string[];
  interventions: string[];
  sponsor?: string;
  startDate?: string;
  completionDate?: string;
  enrollment?: number;
  url: string;
  source: 'clinicaltrials';
}

export interface ClinicalTrialsSearchOptions {
  maxResults?: number;
  status?: string[];
  phase?: string[];
  condition?: string;
  intervention?: string;
}

export class ClinicalTrialsClient {
  private baseUrl: string;
  private cache: CacheService;

  constructor(cache: CacheService) {
    this.cache = cache;
    this.baseUrl = process.env.CLINICALTRIALS_BASE_URL || 'https://clinicaltrials.gov/api/v2';
  }

  /**
   * Search for clinical trials
   */
  async search(query: string, options: ClinicalTrialsSearchOptions = {}): Promise<ClinicalTrial[]> {
    const maxResults = Math.min(options.maxResults ?? 20, 100);
    const ttl = parseInt(process.env.LITERATURE_CACHE_TTL_SECONDS || '86400', 10);

    // Normalize cache key
    const cacheKey = `ct:q:${query.trim().toLowerCase()}|n:${maxResults}`;

    return this.cache.getOrSet(cacheKey, async () => {
      const params = new URLSearchParams({
        'query.term': query,
        pageSize: String(maxResults),
        format: 'json',
      });

      // Add optional filters
      if (options.status?.length) {
        params.append('filter.overallStatus', options.status.join(','));
      }
      if (options.phase?.length) {
        params.append('filter.phase', options.phase.join(','));
      }
      if (options.condition) {
        params.append('query.cond', options.condition);
      }
      if (options.intervention) {
        params.append('query.intr', options.intervention);
      }

      const url = `${this.baseUrl}/studies?${params.toString()}`;

      const res = await fetch(url, {
        headers: {
          Accept: 'application/json',
        },
        signal: AbortSignal.timeout(20000),
      });

      if (!res.ok) {
        throw new Error(`ClinicalTrials.gov search failed: ${res.status}`);
      }

      const json = await res.json();
      const studies = json?.studies ?? [];

      logger.info(`ClinicalTrials.gov search: ${studies.length} results for "${query}"`);

      return studies.map((study: any) => this.parseStudy(study));
    }, ttl);
  }

  /**
   * Fetch a specific trial by NCT ID
   */
  async fetchTrial(nctId: string): Promise<ClinicalTrial | null> {
    const ttl = parseInt(process.env.LITERATURE_CACHE_TTL_SECONDS || '86400', 10);
    const cacheKey = `ct:study:${nctId}`;

    return this.cache.getOrSet(cacheKey, async () => {
      const url = `${this.baseUrl}/studies/${nctId}?format=json`;

      const res = await fetch(url, {
        headers: {
          Accept: 'application/json',
        },
        signal: AbortSignal.timeout(15000),
      });

      if (!res.ok) {
        if (res.status === 404) {
          return null;
        }
        throw new Error(`ClinicalTrials.gov fetch failed: ${res.status}`);
      }

      const study = await res.json();
      return this.parseStudy(study);
    }, ttl);
  }

  /**
   * Parse study response into structured format
   */
  private parseStudy(study: any): ClinicalTrial {
    const protocol = study?.protocolSection ?? {};
    const identification = protocol?.identificationModule ?? {};
    const status = protocol?.statusModule ?? {};
    const description = protocol?.descriptionModule ?? {};
    const design = protocol?.designModule ?? {};
    const eligibility = protocol?.eligibilityModule ?? {};
    const sponsor = protocol?.sponsorCollaboratorsModule ?? {};
    const conditions = protocol?.conditionsModule ?? {};
    const arms = protocol?.armsInterventionsModule ?? {};

    // Extract NCT ID
    const nctId = identification?.nctId || '';

    // Extract title
    const title = identification?.officialTitle || identification?.briefTitle || '';

    // Extract status and phase
    const overallStatus = status?.overallStatus || '';
    const phases = design?.phases ?? [];
    const phase = phases.length > 0 ? phases.join(', ') : undefined;

    // Extract conditions
    const conditionList = conditions?.conditions ?? [];

    // Extract interventions
    const interventionList = (arms?.interventions ?? []).map((i: any) =>
      i?.name || i?.type || ''
    ).filter(Boolean);

    // Extract sponsor
    const leadSponsor = sponsor?.leadSponsor?.name || undefined;

    // Extract dates
    const startDate = status?.startDateStruct?.date || undefined;
    const completionDate = status?.completionDateStruct?.date ||
                          status?.primaryCompletionDateStruct?.date || undefined;

    // Extract enrollment
    const enrollment = eligibility?.healthyVolunteers !== undefined
      ? design?.enrollmentInfo?.count
      : undefined;

    return {
      nctId,
      title,
      briefSummary: description?.briefSummary || undefined,
      status: overallStatus,
      phase,
      conditions: conditionList,
      interventions: interventionList,
      sponsor: leadSponsor,
      startDate,
      completionDate,
      enrollment,
      url: `https://clinicaltrials.gov/study/${nctId}`,
      source: 'clinicaltrials' as const,
    };
  }
}

export default ClinicalTrialsClient;
