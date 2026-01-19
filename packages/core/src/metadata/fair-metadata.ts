/**
 * FAIR Metadata Generation
 *
 * Implements FAIR (Findable, Accessible, Interoperable, Reusable) metadata
 * standards for research data artifacts.
 *
 * Complies with:
 * - Dublin Core metadata schema
 * - DataCite metadata schema
 * - schema.org Dataset vocabulary
 * - DCAT (Data Catalog Vocabulary)
 *
 * References:
 * - https://www.go-fair.org/fair-principles/
 * - https://schema.datacite.org/
 * - https://schema.org/Dataset
 */

export interface FAIRMetadata {
  // ========== Findable ==========
  /** Persistent identifier (DOI, ARK, Handle, or UUID) */
  identifier: string;

  /** Title of the dataset */
  title: string;

  /** Description/abstract of the dataset */
  description: string;

  /** Keywords for discoverability */
  keywords: string[];

  /** Subject classification (e.g., MeSH terms, discipline codes) */
  subjects?: string[];

  /** Alternative titles */
  alternateTitles?: string[];

  // ========== Accessible ==========
  /** Access rights */
  accessRights: 'open' | 'restricted' | 'embargoed' | 'closed' | 'metadata-only';

  /** License (SPDX identifier preferred) */
  license: string;

  /** URL to access the dataset */
  accessURL?: string;

  /** Download URL if directly downloadable */
  downloadURL?: string;

  /** Embargo lift date (if embargoed) */
  embargoLiftDate?: string;

  /** Access restrictions/conditions */
  accessConditions?: string;

  // ========== Interoperable ==========
  /** MIME type / format */
  format: string;

  /** Schema version used */
  schemaVersion: string;

  /** Vocabularies/ontologies used */
  vocabulary: string[];

  /** Standards followed (e.g., FHIR, OMOP) */
  conformsTo?: string[];

  /** Encoding format (e.g., UTF-8) */
  encodingFormat?: string;

  // ========== Reusable ==========
  /** Creator(s) of the dataset */
  creator: Creator | Creator[];

  /** Contributors */
  contributor?: Contributor[];

  /** Publisher/organization */
  publisher?: Organization;

  /** Date created */
  dateCreated: string;

  /** Date modified */
  dateModified: string;

  /** Date published */
  datePublished?: string;

  /** Version of the dataset */
  version?: string;

  /** Provenance/lineage summary */
  provenance: string;

  /** Usage notes/documentation */
  usageNotes?: string;

  /** Citation */
  citation?: string;

  /** Related publications */
  relatedPublications?: Publication[];

  /** Funding information */
  funding?: Funding[];

  /** Data quality notes */
  qualityNotes?: string;

  /** Temporal coverage */
  temporalCoverage?: TemporalCoverage;

  /** Spatial coverage */
  spatialCoverage?: SpatialCoverage;
}

export interface Creator {
  name: string;
  affiliation?: string;
  identifier?: string; // ORCID preferred
  email?: string;
  role?: string;
}

export interface Contributor {
  name: string;
  affiliation?: string;
  identifier?: string;
  contributorType?: 'DataCollector' | 'DataCurator' | 'DataManager' | 'Editor' | 'Researcher' | 'Other';
}

export interface Organization {
  name: string;
  identifier?: string; // ROR ID preferred
  url?: string;
}

export interface Publication {
  title: string;
  identifier?: string; // DOI preferred
  citation?: string;
  url?: string;
}

export interface Funding {
  funderName: string;
  funderIdentifier?: string;
  awardNumber?: string;
  awardTitle?: string;
}

export interface TemporalCoverage {
  startDate: string;
  endDate?: string;
}

export interface SpatialCoverage {
  description?: string;
  geometry?: any; // GeoJSON
  place?: string[];
}

/**
 * Generate FAIR metadata from artifact
 */
export function generateFAIRMetadata(
  artifact: any,
  options?: Partial<FAIRMetadata>
): FAIRMetadata {
  return {
    // Findable
    identifier: artifact.id || generateIdentifier(),
    title: artifact.title || options?.title || `Dataset ${artifact.id}`,
    description: artifact.description || options?.description || '',
    keywords: artifact.tags || options?.keywords || [],
    subjects: options?.subjects,
    alternateTitles: options?.alternateTitles,

    // Accessible
    accessRights: determineAccessRights(artifact),
    license: artifact.license || options?.license || 'CC-BY-4.0',
    accessURL: artifact.url || options?.accessURL,
    downloadURL: artifact.downloadURL || options?.downloadURL,
    embargoLiftDate: artifact.embargoDate || options?.embargoLiftDate,
    accessConditions: options?.accessConditions,

    // Interoperable
    format: artifact.mimeType || artifact.format || options?.format || 'application/json',
    schemaVersion: artifact.schemaVersion || options?.schemaVersion || '1.0.0',
    vocabulary: options?.vocabulary || ['http://purl.org/dc/terms/'],
    conformsTo: options?.conformsTo,
    encodingFormat: options?.encodingFormat || 'UTF-8',

    // Reusable
    creator: normalizeCreator(artifact.createdBy || options?.creator),
    contributor: artifact.contributors?.map(normalizeContributor) || options?.contributor,
    publisher: options?.publisher,
    dateCreated: artifact.createdAt || new Date().toISOString(),
    dateModified: artifact.updatedAt || new Date().toISOString(),
    datePublished: artifact.publishedAt || options?.datePublished,
    version: artifact.version || options?.version,
    provenance: artifact.lineageSummary || options?.provenance || 'Unknown provenance',
    usageNotes: artifact.usageNotes || options?.usageNotes,
    citation: generateCitation(artifact, options),
    relatedPublications: options?.relatedPublications,
    funding: options?.funding,
    qualityNotes: artifact.qualityNotes || options?.qualityNotes,
    temporalCoverage: options?.temporalCoverage,
    spatialCoverage: options?.spatialCoverage
  };
}

/**
 * Determine access rights from artifact properties
 */
function determineAccessRights(artifact: any): FAIRMetadata['accessRights'] {
  if (artifact.isPublic === true) return 'open';
  if (artifact.embargoDate) return 'embargoed';
  if (artifact.restricted === true) return 'restricted';
  if (artifact.metadataOnly === true) return 'metadata-only';
  return 'closed';
}

/**
 * Normalize creator to standard format
 */
function normalizeCreator(creator: any): Creator {
  if (typeof creator === 'string') {
    return { name: creator };
  }
  return creator;
}

/**
 * Normalize contributor to standard format
 */
function normalizeContributor(contributor: any): Contributor {
  if (typeof contributor === 'string') {
    return { name: contributor };
  }
  return contributor;
}

/**
 * Generate a citation string
 */
function generateCitation(artifact: any, options?: Partial<FAIRMetadata>): string {
  const creator = options?.creator || artifact.createdBy || 'Unknown';
  const creatorName = typeof creator === 'string' ? creator :
                      Array.isArray(creator) ? creator[0].name : creator.name;

  const year = new Date(artifact.createdAt || Date.now()).getFullYear();
  const title = artifact.title || options?.title || `Dataset ${artifact.id}`;
  const version = artifact.version || options?.version;

  let citation = `${creatorName} (${year}). ${title}`;

  if (version) {
    citation += ` (Version ${version})`;
  }

  if (artifact.id) {
    citation += `. ${artifact.id}`;
  }

  return citation;
}

/**
 * Generate a persistent identifier (UUID-based)
 */
function generateIdentifier(): string {
  // In production, this should request a DOI or use a proper ID service
  return `urn:uuid:${crypto.randomUUID()}`;
}

/**
 * Export FAIR metadata as DataCite XML
 */
export function exportDataCiteXML(metadata: FAIRMetadata): string {
  const creators = Array.isArray(metadata.creator) ? metadata.creator : [metadata.creator];

  const lines: string[] = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<resource xmlns="http://datacite.org/schema/kernel-4"',
    '  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"',
    '  xsi:schemaLocation="http://datacite.org/schema/kernel-4 http://schema.datacite.org/meta/kernel-4/metadata.xsd">',
    `  <identifier identifierType="DOI">${metadata.identifier}</identifier>`,
    '  <creators>'
  ];

  for (const creator of creators) {
    lines.push(`    <creator>`);
    lines.push(`      <creatorName>${escapeXML(creator.name)}</creatorName>`);
    if (creator.affiliation) {
      lines.push(`      <affiliation>${escapeXML(creator.affiliation)}</affiliation>`);
    }
    if (creator.identifier) {
      lines.push(`      <nameIdentifier schemeURI="http://orcid.org/" nameIdentifierScheme="ORCID">${creator.identifier}</nameIdentifier>`);
    }
    lines.push(`    </creator>`);
  }

  lines.push('  </creators>');
  lines.push(`  <titles>`);
  lines.push(`    <title>${escapeXML(metadata.title)}</title>`);
  lines.push(`  </titles>`);
  lines.push(`  <publisher>${escapeXML(metadata.publisher?.name || 'Unknown')}</publisher>`);
  lines.push(`  <publicationYear>${new Date(metadata.datePublished || metadata.dateCreated).getFullYear()}</publicationYear>`);
  lines.push('</resource>');

  return lines.join('\n');
}

/**
 * Export FAIR metadata as JSON-LD (schema.org Dataset)
 */
export function exportJSONLD(metadata: FAIRMetadata): any {
  return {
    '@context': 'https://schema.org',
    '@type': 'Dataset',
    '@id': metadata.identifier,
    'name': metadata.title,
    'description': metadata.description,
    'keywords': metadata.keywords.join(', '),
    'license': metadata.license,
    'url': metadata.accessURL,
    'creator': Array.isArray(metadata.creator) ?
      metadata.creator.map(c => ({
        '@type': 'Person',
        'name': c.name,
        'affiliation': c.affiliation,
        'identifier': c.identifier
      })) :
      {
        '@type': 'Person',
        'name': metadata.creator.name,
        'affiliation': metadata.creator.affiliation,
        'identifier': metadata.creator.identifier
      },
    'dateCreated': metadata.dateCreated,
    'dateModified': metadata.dateModified,
    'datePublished': metadata.datePublished,
    'version': metadata.version,
    'encodingFormat': metadata.format,
    'spatialCoverage': metadata.spatialCoverage?.description,
    'temporalCoverage': metadata.temporalCoverage ?
      `${metadata.temporalCoverage.startDate}/${metadata.temporalCoverage.endDate || '..'}` :
      undefined
  };
}

/**
 * Validate FAIR metadata completeness
 */
export function validateFAIRMetadata(metadata: FAIRMetadata): {
  valid: boolean;
  score: number;
  missing: string[];
  warnings: string[];
} {
  const missing: string[] = [];
  const warnings: string[] = [];
  let score = 0;
  const maxScore = 20;

  // Required fields
  if (!metadata.identifier) missing.push('identifier');
  else score += 2;

  if (!metadata.title) missing.push('title');
  else score += 2;

  if (!metadata.description) missing.push('description');
  else score += 2;

  if (!metadata.creator) missing.push('creator');
  else score += 2;

  if (!metadata.dateCreated) missing.push('dateCreated');
  else score += 1;

  if (!metadata.accessRights) missing.push('accessRights');
  else score += 2;

  if (!metadata.license) missing.push('license');
  else score += 2;

  // Recommended fields
  if (metadata.keywords && metadata.keywords.length > 0) score += 1;
  else warnings.push('No keywords provided for discoverability');

  if (metadata.accessURL || metadata.downloadURL) score += 1;
  else warnings.push('No access URL provided');

  if (metadata.schemaVersion) score += 1;
  else warnings.push('No schema version specified');

  if (metadata.provenance && metadata.provenance !== 'Unknown provenance') score += 1;
  else warnings.push('Provenance information missing');

  if (metadata.usageNotes) score += 1;
  else warnings.push('Usage notes would improve reusability');

  if (metadata.version) score += 1;
  else warnings.push('No version information');

  const valid = missing.length === 0;

  return {
    valid,
    score,
    missing,
    warnings
  };
}

/**
 * Helper to escape XML special characters
 */
function escapeXML(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// Example usage
if (require.main === module) {
  const exampleArtifact = {
    id: 'thyroid-001',
    title: 'Thyroid Cancer Patient Data 2024',
    description: 'De-identified clinical data from thyroid cancer patients',
    tags: ['thyroid', 'cancer', 'clinical-data'],
    createdBy: 'Dr. Jane Smith',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-15T00:00:00Z',
    license: 'CC-BY-NC-4.0',
    isPublic: false,
    schemaVersion: '2.0.0'
  };

  const metadata = generateFAIRMetadata(exampleArtifact, {
    creator: {
      name: 'Dr. Jane Smith',
      affiliation: 'University Hospital',
      identifier: '0000-0001-2345-6789'
    },
    publisher: {
      name: 'ResearchFlow Platform',
      identifier: 'https://ror.org/example'
    },
    vocabulary: [
      'http://purl.org/dc/terms/',
      'http://purl.bioontology.org/ontology/MESH'
    ],
    conformsTo: ['HL7 FHIR R4'],
    funding: [{
      funderName: 'NIH',
      awardNumber: 'R01-CA123456',
      awardTitle: 'Thyroid Cancer Research'
    }]
  });

  console.log('FAIR Metadata:');
  console.log(JSON.stringify(metadata, null, 2));

  console.log('\n--- Validation ---');
  const validation = validateFAIRMetadata(metadata);
  console.log(`Valid: ${validation.valid}`);
  console.log(`Score: ${validation.score}/20`);
  if (validation.missing.length > 0) {
    console.log(`Missing: ${validation.missing.join(', ')}`);
  }
  if (validation.warnings.length > 0) {
    console.log(`Warnings: ${validation.warnings.join(', ')}`);
  }

  console.log('\n--- JSON-LD Export ---');
  console.log(JSON.stringify(exportJSONLD(metadata), null, 2));
}
