import { v4 as uuid } from 'uuid';
import { createHash } from 'crypto';

export interface DataCitation {
  id: string;
  manuscriptId: string;
  datasetId: string;
  datasetName: string;
  accessDate: Date;
  columns?: string[];
  rowRange?: [number, number];
  filterCriteria?: string;
  auditHash: string;
  sectionUsed: string[];
}

export class DataCitationService {
  private citations: Map<string, DataCitation> = new Map();

  createCitation(request: {
    manuscriptId: string;
    datasetId: string;
    datasetName: string;
    columns?: string[];
    rowRange?: [number, number];
    filterCriteria?: string;
    section: string;
  }): DataCitation {
    const id = uuid();
    const auditHash = createHash('sha256')
      .update(JSON.stringify({
        datasetId: request.datasetId,
        columns: request.columns?.sort(),
        rowRange: request.rowRange,
        timestamp: new Date().toISOString()
      }))
      .digest('hex');

    const citation: DataCitation = {
      id,
      manuscriptId: request.manuscriptId,
      datasetId: request.datasetId,
      datasetName: request.datasetName,
      accessDate: new Date(),
      columns: request.columns,
      rowRange: request.rowRange,
      filterCriteria: request.filterCriteria,
      auditHash,
      sectionUsed: [request.section]
    };

    this.citations.set(id, citation);
    return citation;
  }

  addSectionToCitation(id: string, section: string): DataCitation | null {
    const citation = this.citations.get(id);
    if (citation && !citation.sectionUsed.includes(section)) {
      citation.sectionUsed.push(section);
    }
    return citation || null;
  }

  getCitationsForManuscript(manuscriptId: string): DataCitation[] {
    return Array.from(this.citations.values()).filter(c => c.manuscriptId === manuscriptId);
  }
}

export const dataCitationService = new DataCitationService();
