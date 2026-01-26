/**
 * Citation Export Utilities
 * Task T30: BibTeX, RIS, EndNote XML, and CSV export formats
 */

import type { Citation } from '../types/citation.types';

/**
 * Export citations to BibTeX format (.bib)
 *
 * Example:
 * @article{smith2023cancer,
 *   title={Cancer Treatment Outcomes},
 *   author={Smith, John and Jones, Mary},
 *   journal={Journal of Medicine},
 *   year={2023},
 *   volume={10},
 *   pages={123--145},
 *   doi={10.1234/jmed.2023.001}
 * }
 */
export function exportToBibTeX(citations: Citation[]): string {
  const entries = citations.map(citation => {
    const citeKey = generateCiteKey(citation);
    const entryType = inferBibTeXType(citation);

    const fields: string[] = [];

    // Required fields
    fields.push(`  title={${escapeBibTeX(citation.title)}}`);

    // Authors
    if (citation.authors.length > 0) {
      const authorStr = citation.authors
        .map(a => `${a.lastName}, ${a.firstName || a.initials || ''}`)
        .join(' and ');
      fields.push(`  author={${escapeBibTeX(authorStr)}}`);
    }

    // Journal/Source
    if (citation.journal) {
      fields.push(`  journal={${escapeBibTeX(citation.journal)}}`);
    }

    // Year
    fields.push(`  year={${citation.year}}`);

    // Volume
    if (citation.volume) {
      fields.push(`  volume={${citation.volume}}`);
    }

    // Issue
    if (citation.issue) {
      fields.push(`  number={${citation.issue}}`);
    }

    // Pages
    if (citation.pages) {
      const pageRange = citation.pages.replace('-', '--'); // BibTeX uses double dash
      fields.push(`  pages={${pageRange}}`);
    }

    // DOI
    if (citation.doi) {
      fields.push(`  doi={${citation.doi}}`);
    }

    // PMID
    if (citation.sourceType === 'pubmed' && citation.externalId) {
      fields.push(`  pmid={${citation.externalId}}`);
    }

    // URL
    if (citation.url) {
      fields.push(`  url={${citation.url}}`);
    }

    // Abstract
    if (citation.abstract) {
      fields.push(`  abstract={${escapeBibTeX(citation.abstract)}}`);
    }

    return `@${entryType}{${citeKey},\n${fields.join(',\n')}\n}`;
  });

  return entries.join('\n\n');
}

/**
 * Export citations to RIS format (.ris)
 * Used by EndNote, Mendeley, Zotero
 *
 * Example:
 * TY  - JOUR
 * TI  - Cancer Treatment Outcomes
 * AU  - Smith, John
 * AU  - Jones, Mary
 * PY  - 2023
 * JO  - Journal of Medicine
 * VL  - 10
 * SP  - 123
 * EP  - 145
 * DO  - 10.1234/jmed.2023.001
 * ER  -
 */
export function exportToRIS(citations: Citation[]): string {
  const entries = citations.map(citation => {
    const lines: string[] = [];

    // Type of reference
    lines.push(`TY  - ${inferRISType(citation)}`);

    // Title
    lines.push(`TI  - ${citation.title}`);

    // Authors (one per line)
    for (const author of citation.authors) {
      const authorName = `${author.lastName}, ${author.firstName || author.initials || ''}`;
      lines.push(`AU  - ${authorName}`);
    }

    // Publication year
    lines.push(`PY  - ${citation.year}`);

    // Journal
    if (citation.journal) {
      lines.push(`JO  - ${citation.journal}`);
    }

    // Volume
    if (citation.volume) {
      lines.push(`VL  - ${citation.volume}`);
    }

    // Issue
    if (citation.issue) {
      lines.push(`IS  - ${citation.issue}`);
    }

    // Pages
    if (citation.pages) {
      const [start, end] = citation.pages.split('-');
      if (start) lines.push(`SP  - ${start.trim()}`);
      if (end) lines.push(`EP  - ${end.trim()}`);
    }

    // DOI
    if (citation.doi) {
      lines.push(`DO  - ${citation.doi}`);
    }

    // URL
    if (citation.url) {
      lines.push(`UR  - ${citation.url}`);
    }

    // Abstract
    if (citation.abstract) {
      lines.push(`AB  - ${citation.abstract}`);
    }

    // Keywords
    if (citation.keywords && citation.keywords.length > 0) {
      for (const keyword of citation.keywords) {
        lines.push(`KW  - ${keyword}`);
      }
    }

    // End of record
    lines.push('ER  -');

    return lines.join('\n');
  });

  return entries.join('\n\n');
}

/**
 * Export citations to EndNote XML format
 */
export function exportToEndNoteXML(citations: Citation[]): string {
  const records = citations.map((citation, index) => {
    return `  <record>
    <rec-number>${index + 1}</rec-number>
    <ref-type name="Journal Article">17</ref-type>
    <contributors>
      <authors>
        ${citation.authors.map(a => `<author>${a.lastName}, ${a.firstName || a.initials || ''}</author>`).join('\n        ')}
      </authors>
    </contributors>
    <titles>
      <title>${escapeXML(citation.title)}</title>
      ${citation.journal ? `<secondary-title>${escapeXML(citation.journal)}</secondary-title>` : ''}
    </titles>
    <dates>
      <year>${citation.year}</year>
    </dates>
    ${citation.volume ? `<volume>${citation.volume}</volume>` : ''}
    ${citation.issue ? `<number>${citation.issue}</number>` : ''}
    ${citation.pages ? `<pages>${citation.pages}</pages>` : ''}
    ${citation.doi ? `<electronic-resource-num>${citation.doi}</electronic-resource-num>` : ''}
    ${citation.url ? `<urls><related-urls><url>${escapeXML(citation.url)}</url></related-urls></urls>` : ''}
    ${citation.abstract ? `<abstract>${escapeXML(citation.abstract)}</abstract>` : ''}
  </record>`;
  });

  return `<?xml version="1.0" encoding="UTF-8"?>
<xml>
${records.join('\n')}
</xml>`;
}

/**
 * Export citations to CSV format
 * Useful for spreadsheet import or custom processing
 */
export function exportToCSV(citations: Citation[]): string {
  const headers = [
    'ID',
    'Source Type',
    'External ID',
    'Title',
    'Authors',
    'Journal',
    'Year',
    'Volume',
    'Issue',
    'Pages',
    'DOI',
    'URL',
    'Abstract',
    'Keywords',
  ];

  const rows = citations.map(c => {
    const authors = c.authors
      .map(a => `${a.lastName}, ${a.firstName || a.initials || ''}`)
      .join('; ');

    const keywords = c.keywords?.join('; ') || '';

    return [
      c.id,
      c.sourceType,
      c.externalId,
      c.title,
      authors,
      c.journal || '',
      c.year.toString(),
      c.volume || '',
      c.issue || '',
      c.pages || '',
      c.doi || '',
      c.url || '',
      c.abstract || '',
      keywords,
    ].map(escapeCSV);
  });

  return [
    headers.join(','),
    ...rows.map(row => row.join(',')),
  ].join('\n');
}

/**
 * Export citations to plain text format (for simple reading)
 */
export function exportToPlainText(
  citations: Citation[],
  style: 'ama' | 'apa' | 'vancouver' = 'ama'
): string {
  return citations
    .map((citation, index) => {
      const num = index + 1;
      const formatted = formatCitationPlainText(citation, style);
      return `${num}. ${formatted}`;
    })
    .join('\n\n');
}

// ========== Helper Functions ==========

function generateCiteKey(citation: Citation): string {
  const firstAuthor = citation.authors[0];
  const authorPart = firstAuthor
    ? firstAuthor.lastName.toLowerCase().replace(/[^\w]/g, '')
    : 'unknown';

  const titlePart = citation.title
    .split(' ')
    .slice(0, 2)
    .join('')
    .toLowerCase()
    .replace(/[^\w]/g, '');

  return `${authorPart}${citation.year}${titlePart}`;
}

function inferBibTeXType(citation: Citation): string {
  if (citation.journal) return 'article';
  if (citation.sourceType === 'isbn') return 'book';
  if (citation.sourceType === 'arxiv') return 'misc';
  return 'misc';
}

function inferRISType(citation: Citation): string {
  if (citation.journal) return 'JOUR'; // Journal article
  if (citation.sourceType === 'isbn') return 'BOOK';
  if (citation.sourceType === 'arxiv') return 'RPRT'; // Report
  return 'GEN'; // Generic
}

function escapeBibTeX(text: string): string {
  return text
    .replace(/\\/g, '\\textbackslash{}')
    .replace(/[{}]/g, '\\$&')
    .replace(/[#$%&_]/g, '\\$&');
}

function escapeXML(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function escapeCSV(text: string): string {
  // Enclose in quotes if contains comma, quote, or newline
  if (/[,"\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function formatCitationPlainText(
  citation: Citation,
  style: 'ama' | 'apa' | 'vancouver'
): string {
  const authors = citation.authors
    .map(a => `${a.lastName} ${a.initials || a.firstName?.[0] || ''}`)
    .join(', ');

  switch (style) {
    case 'ama':
      return `${authors}. ${citation.title}. ${citation.journal || ''}. ${citation.year};${citation.volume || ''}(${citation.issue || ''}):${citation.pages || ''}.`;

    case 'apa':
      return `${authors} (${citation.year}). ${citation.title}. ${citation.journal || ''}, ${citation.volume || ''}(${citation.issue || ''}), ${citation.pages || ''}.`;

    case 'vancouver':
      return `${authors}. ${citation.title}. ${citation.journal || ''}. ${citation.year};${citation.volume || ''}(${citation.issue || ''}):${citation.pages || ''}.`;

    default:
      return `${authors} (${citation.year}). ${citation.title}.`;
  }
}

/**
 * Detect citation format from file extension or content
 */
export function detectCitationFormat(
  filename: string
): 'bibtex' | 'ris' | 'endnote' | 'csv' | 'txt' | 'unknown' {
  const ext = filename.split('.').pop()?.toLowerCase();

  switch (ext) {
    case 'bib':
      return 'bibtex';
    case 'ris':
      return 'ris';
    case 'xml':
      return 'endnote';
    case 'csv':
      return 'csv';
    case 'txt':
      return 'txt';
    default:
      return 'unknown';
  }
}

export const citationExporters = {
  bibtex: exportToBibTeX,
  ris: exportToRIS,
  endnote: exportToEndNoteXML,
  csv: exportToCSV,
  txt: exportToPlainText,
} as const;
