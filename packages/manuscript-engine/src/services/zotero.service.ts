/**
 * Zotero Integration Service
 * Task T35: Sync citations with Zotero reference manager
 */

export interface ZoteroConfig {
  apiKey: string;
  userId: string;
  libraryId?: string;
  libraryType: 'user' | 'group';
}

export interface ZoteroItem {
  key: string; // Unique identifier in Zotero
  version: number;
  itemType: string; // 'journalArticle', 'book', 'conferencePaper', etc.
  title: string;
  creators: Array<{
    creatorType: 'author' | 'editor' | 'contributor';
    firstName?: string;
    lastName: string;
  }>;
  abstractNote?: string;
  publicationTitle?: string; // Journal name
  date?: string;
  DOI?: string;
  url?: string;
  pages?: string;
  volume?: string;
  issue?: string;
  tags: Array<{ tag: string }>;
  collections: string[]; // Collection keys this item belongs to
  dateAdded: string;
  dateModified: string;
}

export interface ZoteroCollection {
  key: string;
  name: string;
  parentCollection?: string;
  items: ZoteroItem[];
}

export interface ZoteroSyncResult {
  imported: number;
  updated: number;
  skipped: number;
  errors: Array<{ item: string; error: string }>;
}

/**
 * Zotero Integration Service
 * Bidirectional sync between ResearchFlow and Zotero
 */
export class ZoteroService {
  private readonly baseUrl = 'https://api.zotero.org';
  private config: ZoteroConfig | null = null;

  /**
   * Configure Zotero API access
   */
  configure(config: ZoteroConfig): void {
    this.config = config;
  }

  /**
   * Import citations from Zotero collection
   */
  async importFromCollection(
    collectionKey: string,
    manuscriptId: string
  ): Promise<ZoteroSyncResult> {
    this.ensureConfigured();

    const result: ZoteroSyncResult = {
      imported: 0,
      updated: 0,
      skipped: 0,
      errors: [],
    };

    try {
      // Fetch items from collection
      const items = await this.fetchCollectionItems(collectionKey);

      for (const item of items) {
        try {
          // Check if citation already exists (by DOI or title)
          const existingCitation = await this.findExistingCitation(item);

          if (existingCitation) {
            // Update if Zotero version is newer
            if (await this.shouldUpdate(existingCitation, item)) {
              await this.updateCitation(existingCitation.id, item);
              result.updated++;
            } else {
              result.skipped++;
            }
          } else {
            // Import as new citation
            await this.createCitation(manuscriptId, item);
            result.imported++;
          }
        } catch (error) {
          result.errors.push({
            item: item.title,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }
    } catch (error) {
      throw new Error(`Failed to import from Zotero: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    return result;
  }

  /**
   * Export citations to Zotero
   */
  async exportToZotero(
    citationIds: string[],
    targetCollection?: string
  ): Promise<ZoteroSyncResult> {
    this.ensureConfigured();

    const result: ZoteroSyncResult = {
      imported: 0,
      updated: 0,
      skipped: 0,
      errors: [],
    };

    for (const citationId of citationIds) {
      try {
        // Fetch citation from database
        const citation = await this.fetchCitation(citationId);

        // Check if already exists in Zotero
        const existingItem = await this.findZoteroItemByDOI(citation.doi);

        if (existingItem) {
          result.skipped++;
        } else {
          // Create new item in Zotero
          await this.createZoteroItem(citation, targetCollection);
          result.imported++;
        }
      } catch (error) {
        result.errors.push({
          item: citationId,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return result;
  }

  /**
   * List available Zotero collections
   */
  async listCollections(): Promise<ZoteroCollection[]> {
    this.ensureConfigured();

    const url = this.buildUrl('/collections');
    const response = await this.fetchWithAuth(url);

    const collections: ZoteroCollection[] = response.map((col: any) => ({
      key: col.key,
      name: col.data.name,
      parentCollection: col.data.parentCollection,
      items: [], // Populated on demand
    }));

    return collections;
  }

  /**
   * Fetch items from a specific collection
   */
  async fetchCollectionItems(collectionKey: string): Promise<ZoteroItem[]> {
    this.ensureConfigured();

    const url = this.buildUrl(`/collections/${collectionKey}/items`);
    const response = await this.fetchWithAuth(url);

    return response.map((item: any) => this.parseZoteroItem(item));
  }

  /**
   * Search Zotero library
   */
  async search(query: string): Promise<ZoteroItem[]> {
    this.ensureConfigured();

    const url = this.buildUrl(`/items?q=${encodeURIComponent(query)}`);
    const response = await this.fetchWithAuth(url);

    return response.map((item: any) => this.parseZoteroItem(item));
  }

  /**
   * Create a new item in Zotero
   */
  async createZoteroItem(citation: any, collectionKey?: string): Promise<ZoteroItem> {
    this.ensureConfigured();

    const zoteroItem = this.convertToZoteroFormat(citation);

    if (collectionKey) {
      zoteroItem.collections = [collectionKey];
    }

    const url = this.buildUrl('/items');
    const response = await fetch(url, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify([zoteroItem]),
    });

    if (!response.ok) {
      throw new Error(`Zotero API error: ${response.status}`);
    }

    const result = await response.json();
    return this.parseZoteroItem(result.successful[0]);
  }

  /**
   * Sync changes bidirectionally
   */
  async bidirectionalSync(manuscriptId: string, collectionKey: string): Promise<{
    toZotero: ZoteroSyncResult;
    fromZotero: ZoteroSyncResult;
  }> {
    // Import from Zotero
    const fromZotero = await this.importFromCollection(collectionKey, manuscriptId);

    // Export new citations to Zotero
    const localCitations = await this.fetchManuscriptCitations(manuscriptId);
    const citationIds = localCitations.map(c => c.id);
    const toZotero = await this.exportToZotero(citationIds, collectionKey);

    return { toZotero, fromZotero };
  }

  // ========== Private Methods ==========

  private ensureConfigured(): void {
    if (!this.config) {
      throw new Error('Zotero service not configured. Call configure() first.');
    }
  }

  private buildUrl(path: string): string {
    const { userId, libraryType, libraryId } = this.config!;
    const library = libraryId || userId;

    return `${this.baseUrl}/${libraryType}s/${library}${path}`;
  }

  private getHeaders(): HeadersInit {
    return {
      'Zotero-API-Key': this.config!.apiKey,
      'Content-Type': 'application/json',
    };
  }

  private async fetchWithAuth(url: string): Promise<any> {
    const response = await fetch(url, {
      headers: this.getHeaders(),
    });

    if (!response.ok) {
      throw new Error(`Zotero API error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  private parseZoteroItem(rawItem: any): ZoteroItem {
    return {
      key: rawItem.key,
      version: rawItem.version,
      itemType: rawItem.data.itemType,
      title: rawItem.data.title || '',
      creators: rawItem.data.creators || [],
      abstractNote: rawItem.data.abstractNote,
      publicationTitle: rawItem.data.publicationTitle,
      date: rawItem.data.date,
      DOI: rawItem.data.DOI,
      url: rawItem.data.url,
      pages: rawItem.data.pages,
      volume: rawItem.data.volume,
      issue: rawItem.data.issue,
      tags: rawItem.data.tags || [],
      collections: rawItem.data.collections || [],
      dateAdded: rawItem.data.dateAdded,
      dateModified: rawItem.data.dateModified,
    };
  }

  private convertToZoteroFormat(citation: any): any {
    return {
      itemType: 'journalArticle',
      title: citation.title,
      creators: citation.authors.map((a: any) => ({
        creatorType: 'author',
        firstName: a.firstName,
        lastName: a.lastName,
      })),
      abstractNote: citation.abstract,
      publicationTitle: citation.journal,
      date: citation.year.toString(),
      DOI: citation.doi,
      url: citation.url,
      pages: citation.pages,
      volume: citation.volume,
      issue: citation.issue,
      tags: citation.keywords?.map((kw: string) => ({ tag: kw })) || [],
    };
  }

  private async findExistingCitation(item: ZoteroItem): Promise<any | null> {
    // In production, query database for existing citation
    return null;
  }

  private async shouldUpdate(existingCitation: any, zoteroItem: ZoteroItem): Promise<boolean> {
    // Compare modification dates or versions
    return false;
  }

  private async updateCitation(citationId: string, zoteroItem: ZoteroItem): Promise<void> {
    // Update citation in database
  }

  private async createCitation(manuscriptId: string, zoteroItem: ZoteroItem): Promise<void> {
    // Create new citation in database
  }

  private async fetchCitation(citationId: string): Promise<any> {
    // Fetch from database
    return {};
  }

  private async findZoteroItemByDOI(doi?: string): Promise<ZoteroItem | null> {
    if (!doi) return null;

    try {
      const results = await this.search(`doi:${doi}`);
      return results[0] || null;
    } catch {
      return null;
    }
  }

  private async fetchManuscriptCitations(manuscriptId: string): Promise<any[]> {
    // Fetch from database
    return [];
  }
}

export const zoteroService = new ZoteroService();
