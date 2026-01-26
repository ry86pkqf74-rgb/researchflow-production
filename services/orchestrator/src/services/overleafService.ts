/**
 * Overleaf Integration Service
 * Task 139 - Integration with external manuscript platforms like Overleaf
 *
 * Provides:
 * - Export to Overleaf-compatible ZIP
 * - LaTeX document generation
 * - Figure/table packaging
 * - Bibliography export
 */

import { z } from 'zod';
import crypto from 'crypto';

// ─────────────────────────────────────────────────────────────
// Types & Schemas
// ─────────────────────────────────────────────────────────────

export const ManuscriptExportOptionsSchema = z.object({
  manuscriptId: z.string().uuid(),
  includeReferences: z.boolean().default(true),
  includeFigures: z.boolean().default(true),
  includeTables: z.boolean().default(true),
  includeSupplementary: z.boolean().default(false),
  latexClass: z.enum(['article', 'report', 'book', 'letter', 'custom']).default('article'),
  customPreamble: z.string().optional(),
  bibliography: z.enum(['bibtex', 'biblatex', 'natbib']).default('bibtex'),
});

export const FigureSchema = z.object({
  id: z.string(),
  filename: z.string(),
  caption: z.string().optional(),
  label: z.string().optional(),
  width: z.string().default('0.8\\textwidth'),
  bytes: z.instanceof(Buffer).or(z.string()),
});

export const TableSchema = z.object({
  id: z.string(),
  filename: z.string(),
  caption: z.string().optional(),
  label: z.string().optional(),
  content: z.string(), // LaTeX table content
});

export const ReferenceSchema = z.object({
  id: z.string(),
  type: z.enum(['article', 'book', 'inproceedings', 'misc', 'phdthesis', 'mastersthesis', 'techreport']),
  title: z.string(),
  authors: z.array(z.string()),
  year: z.number(),
  journal: z.string().optional(),
  volume: z.string().optional(),
  pages: z.string().optional(),
  doi: z.string().optional(),
  url: z.string().optional(),
  publisher: z.string().optional(),
  booktitle: z.string().optional(),
});

export const ManuscriptSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  authors: z.array(z.object({
    name: z.string(),
    affiliation: z.string().optional(),
    email: z.string().email().optional(),
    orcid: z.string().optional(),
  })),
  abstract: z.string().optional(),
  keywords: z.array(z.string()).default([]),
  sections: z.array(z.object({
    id: z.string(),
    title: z.string(),
    content: z.string(), // Markdown or LaTeX
    order: z.number(),
  })),
  figures: z.array(FigureSchema).default([]),
  tables: z.array(TableSchema).default([]),
  references: z.array(ReferenceSchema).default([]),
  acknowledgments: z.string().optional(),
  supplementary: z.array(z.object({
    id: z.string(),
    filename: z.string(),
    description: z.string().optional(),
    bytes: z.instanceof(Buffer).or(z.string()),
  })).default([]),
});

export type ManuscriptExportOptions = z.infer<typeof ManuscriptExportOptionsSchema>;
export type Figure = z.infer<typeof FigureSchema>;
export type Table = z.infer<typeof TableSchema>;
export type Reference = z.infer<typeof ReferenceSchema>;
export type Manuscript = z.infer<typeof ManuscriptSchema>;

interface ZipEntry {
  path: string;
  content: string | Buffer;
}

// ─────────────────────────────────────────────────────────────
// In-Memory Storage (mock manuscripts)
// ─────────────────────────────────────────────────────────────

const manuscripts: Map<string, Manuscript> = new Map();

// ─────────────────────────────────────────────────────────────
// LaTeX Generation
// ─────────────────────────────────────────────────────────────

function generatePreamble(ms: Manuscript, options: ManuscriptExportOptions): string {
  const lines: string[] = [];

  // Document class
  lines.push(`\\documentclass[12pt,a4paper]{${options.latexClass}}`);
  lines.push('');

  // Essential packages
  lines.push('% Essential packages');
  lines.push('\\usepackage[utf8]{inputenc}');
  lines.push('\\usepackage[T1]{fontenc}');
  lines.push('\\usepackage{graphicx}');
  lines.push('\\usepackage{amsmath,amssymb}');
  lines.push('\\usepackage{hyperref}');
  lines.push('\\usepackage{xcolor}');
  lines.push('');

  // Tables
  if (options.includeTables) {
    lines.push('% Table packages');
    lines.push('\\usepackage{booktabs}');
    lines.push('\\usepackage{longtable}');
    lines.push('\\usepackage{multirow}');
    lines.push('');
  }

  // Bibliography
  if (options.includeReferences) {
    lines.push('% Bibliography');
    if (options.bibliography === 'biblatex') {
      lines.push('\\usepackage[backend=biber,style=numeric]{biblatex}');
      lines.push('\\addbibresource{references.bib}');
    } else if (options.bibliography === 'natbib') {
      lines.push('\\usepackage{natbib}');
    }
    lines.push('');
  }

  // Graphics path
  if (options.includeFigures) {
    lines.push('% Graphics');
    lines.push('\\graphicspath{{figures/}}');
    lines.push('');
  }

  // Custom preamble
  if (options.customPreamble) {
    lines.push('% Custom preamble');
    lines.push(options.customPreamble);
    lines.push('');
  }

  // Title and authors
  lines.push('% Document info');
  lines.push(`\\title{${escapeLatex(ms.title)}}`);

  const authorList = ms.authors.map(a => {
    let author = escapeLatex(a.name);
    if (a.affiliation) {
      author += `\\thanks{${escapeLatex(a.affiliation)}}`;
    }
    return author;
  }).join(' \\and ');
  lines.push(`\\author{${authorList}}`);

  lines.push('\\date{\\today}');
  lines.push('');

  return lines.join('\n');
}

function generateMainContent(ms: Manuscript, options: ManuscriptExportOptions): string {
  const lines: string[] = [];

  lines.push('\\begin{document}');
  lines.push('');
  lines.push('\\maketitle');
  lines.push('');

  // Abstract
  if (ms.abstract) {
    lines.push('\\begin{abstract}');
    lines.push(escapeLatex(ms.abstract));
    lines.push('\\end{abstract}');
    lines.push('');
  }

  // Keywords
  if (ms.keywords.length > 0) {
    lines.push(`\\textbf{Keywords:} ${ms.keywords.map(k => escapeLatex(k)).join(', ')}`);
    lines.push('');
  }

  // Sections
  const sortedSections = [...ms.sections].sort((a, b) => a.order - b.order);
  for (const section of sortedSections) {
    lines.push(`\\section{${escapeLatex(section.title)}}`);
    lines.push(`\\label{sec:${section.id}}`);
    lines.push('');
    lines.push(markdownToLatex(section.content));
    lines.push('');
  }

  // Acknowledgments
  if (ms.acknowledgments) {
    lines.push('\\section*{Acknowledgments}');
    lines.push(escapeLatex(ms.acknowledgments));
    lines.push('');
  }

  // References
  if (options.includeReferences && ms.references.length > 0) {
    if (options.bibliography === 'biblatex') {
      lines.push('\\printbibliography');
    } else {
      lines.push('\\bibliographystyle{plain}');
      lines.push('\\bibliography{references}');
    }
    lines.push('');
  }

  lines.push('\\end{document}');

  return lines.join('\n');
}

function generateBibtex(references: Reference[]): string {
  const entries: string[] = [];

  for (const ref of references) {
    const fields: string[] = [];
    fields.push(`  title = {${ref.title}}`);
    fields.push(`  author = {${ref.authors.join(' and ')}}`);
    fields.push(`  year = {${ref.year}}`);

    if (ref.journal) fields.push(`  journal = {${ref.journal}}`);
    if (ref.volume) fields.push(`  volume = {${ref.volume}}`);
    if (ref.pages) fields.push(`  pages = {${ref.pages}}`);
    if (ref.doi) fields.push(`  doi = {${ref.doi}}`);
    if (ref.url) fields.push(`  url = {${ref.url}}`);
    if (ref.publisher) fields.push(`  publisher = {${ref.publisher}}`);
    if (ref.booktitle) fields.push(`  booktitle = {${ref.booktitle}}`);

    entries.push(`@${ref.type}{${ref.id},\n${fields.join(',\n')}\n}`);
  }

  return entries.join('\n\n');
}

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

function escapeLatex(text: string): string {
  const replacements: [RegExp, string][] = [
    [/\\/g, '\\textbackslash{}'],
    [/\{/g, '\\{'],
    [/\}/g, '\\}'],
    [/\$/g, '\\$'],
    [/&/g, '\\&'],
    [/#/g, '\\#'],
    [/%/g, '\\%'],
    [/_/g, '\\_'],
    [/\^/g, '\\^{}'],
    [/~/g, '\\textasciitilde{}'],
  ];

  let result = text;
  for (const [pattern, replacement] of replacements) {
    result = result.replace(pattern, replacement);
  }
  return result;
}

function markdownToLatex(markdown: string): string {
  let latex = markdown;

  // Headers (# -> \section, ## -> \subsection, etc.)
  latex = latex.replace(/^### (.+)$/gm, '\\subsubsection{$1}');
  latex = latex.replace(/^## (.+)$/gm, '\\subsection{$1}');
  latex = latex.replace(/^# (.+)$/gm, '\\section{$1}');

  // Bold **text** -> \textbf{text}
  latex = latex.replace(/\*\*(.+?)\*\*/g, '\\textbf{$1}');

  // Italic *text* -> \textit{text}
  latex = latex.replace(/\*(.+?)\*/g, '\\textit{$1}');

  // Code `text` -> \texttt{text}
  latex = latex.replace(/`(.+?)`/g, '\\texttt{$1}');

  // Links [text](url) -> \href{url}{text}
  latex = latex.replace(/\[(.+?)\]\((.+?)\)/g, '\\href{$2}{$1}');

  // Figure references {{fig:id}}
  latex = latex.replace(/\{\{fig:([^}]+)\}\}/g, '\\ref{fig:$1}');

  // Table references {{tab:id}}
  latex = latex.replace(/\{\{tab:([^}]+)\}\}/g, '\\ref{tab:$1}');

  // Citation references {{cite:id}}
  latex = latex.replace(/\{\{cite:([^}]+)\}\}/g, '\\cite{$1}');

  return latex;
}

// ─────────────────────────────────────────────────────────────
// Export Functions
// ─────────────────────────────────────────────────────────────

export function generateOverleafPackage(
  manuscript: Manuscript,
  options: ManuscriptExportOptions
): ZipEntry[] {
  const entries: ZipEntry[] = [];

  // Generate main.tex
  const preamble = generatePreamble(manuscript, options);
  const content = generateMainContent(manuscript, options);
  entries.push({
    path: 'main.tex',
    content: preamble + '\n' + content,
  });

  // Generate references.bib
  if (options.includeReferences && manuscript.references.length > 0) {
    entries.push({
      path: 'references.bib',
      content: generateBibtex(manuscript.references),
    });
  }

  // Add figures
  if (options.includeFigures) {
    for (const figure of manuscript.figures) {
      entries.push({
        path: `figures/${figure.filename}`,
        content: typeof figure.bytes === 'string'
          ? Buffer.from(figure.bytes, 'base64')
          : figure.bytes,
      });
    }

    // Generate figures.tex with figure environments
    if (manuscript.figures.length > 0) {
      const figuresLatex = manuscript.figures.map(fig => `
\\begin{figure}[htbp]
  \\centering
  \\includegraphics[width=${fig.width}]{${fig.filename}}
  \\caption{${fig.caption ? escapeLatex(fig.caption) : ''}}
  \\label{fig:${fig.label ?? fig.id}}
\\end{figure}
`).join('\n');

      entries.push({
        path: 'figures.tex',
        content: figuresLatex,
      });
    }
  }

  // Add tables
  if (options.includeTables) {
    for (const table of manuscript.tables) {
      entries.push({
        path: `tables/${table.filename}`,
        content: table.content,
      });
    }

    // Generate tables.tex
    if (manuscript.tables.length > 0) {
      const tablesLatex = manuscript.tables.map(tab => `
\\begin{table}[htbp]
  \\centering
  \\caption{${tab.caption ? escapeLatex(tab.caption) : ''}}
  \\label{tab:${tab.label ?? tab.id}}
  \\input{tables/${tab.filename}}
\\end{table}
`).join('\n');

      entries.push({
        path: 'tables.tex',
        content: tablesLatex,
      });
    }
  }

  // Add supplementary materials
  if (options.includeSupplementary) {
    for (const supp of manuscript.supplementary) {
      entries.push({
        path: `supplementary/${supp.filename}`,
        content: typeof supp.bytes === 'string'
          ? Buffer.from(supp.bytes, 'base64')
          : supp.bytes,
      });
    }
  }

  // Add latexmkrc for automatic compilation
  entries.push({
    path: 'latexmkrc',
    content: `# LaTeX compilation settings
$pdf_mode = 1;
$pdflatex = 'pdflatex -interaction=nonstopmode -synctex=1 %O %S';
$bibtex_use = 2;
`,
  });

  // Add README
  entries.push({
    path: 'README.md',
    content: `# ${manuscript.title}

Exported from ResearchFlow on ${new Date().toISOString()}

## Compilation

To compile this document:

1. Upload to [Overleaf](https://www.overleaf.com/):
   - New Project → Upload Project → Select this ZIP file

2. Or compile locally:
   \`\`\`bash
   latexmk -pdf main.tex
   \`\`\`

## Structure

- \`main.tex\` - Main document
- \`references.bib\` - Bibliography
- \`figures/\` - Figure files
- \`tables/\` - Table files
${options.includeSupplementary ? '- `supplementary/` - Supplementary materials' : ''}

## Authors

${manuscript.authors.map(a => `- ${a.name}${a.affiliation ? ` (${a.affiliation})` : ''}`).join('\n')}
`,
  });

  return entries;
}

// ─────────────────────────────────────────────────────────────
// Export Record Tracking
// ─────────────────────────────────────────────────────────────

interface ExportRecord {
  id: string;
  manuscriptId: string;
  userId: string;
  format: 'overleaf' | 'latex' | 'word';
  options: ManuscriptExportOptions;
  fileCount: number;
  exportedAt: string;
}

const exportRecords: ExportRecord[] = [];

export function recordExport(
  manuscriptId: string,
  userId: string,
  format: 'overleaf' | 'latex' | 'word',
  options: ManuscriptExportOptions,
  fileCount: number
): ExportRecord {
  const record: ExportRecord = {
    id: crypto.randomUUID(),
    manuscriptId,
    userId,
    format,
    options,
    fileCount,
    exportedAt: new Date().toISOString(),
  };

  exportRecords.push(record);
  return record;
}

export function getExportHistory(
  manuscriptId: string,
  limit = 10
): ExportRecord[] {
  return exportRecords
    .filter(r => r.manuscriptId === manuscriptId)
    .sort((a, b) => new Date(b.exportedAt).getTime() - new Date(a.exportedAt).getTime())
    .slice(0, limit);
}

// ─────────────────────────────────────────────────────────────
// Mock Manuscript for Testing
// ─────────────────────────────────────────────────────────────

export function getMockManuscript(id: string): Manuscript | undefined {
  if (manuscripts.has(id)) {
    return manuscripts.get(id);
  }

  // Create a sample manuscript
  const sample: Manuscript = {
    id,
    title: 'Sample Research Paper: Machine Learning in Healthcare',
    authors: [
      { name: 'Jane Doe', affiliation: 'University of Science', email: 'jane.doe@unisci.edu', orcid: '0000-0001-2345-6789' },
      { name: 'John Smith', affiliation: 'Institute of Technology' },
    ],
    abstract: 'This paper presents a comprehensive analysis of machine learning applications in healthcare. We review recent advances and propose a novel framework for clinical decision support.',
    keywords: ['machine learning', 'healthcare', 'clinical decision support', 'deep learning'],
    sections: [
      {
        id: 'intro',
        title: 'Introduction',
        content: 'Machine learning has revolutionized many fields, and healthcare is no exception. In this paper, we explore the current state of ML in clinical settings.',
        order: 1,
      },
      {
        id: 'methods',
        title: 'Methods',
        content: 'We conducted a systematic review of **200 papers** published between 2018-2024. Our analysis framework is shown in {{fig:framework}}.',
        order: 2,
      },
      {
        id: 'results',
        title: 'Results',
        content: 'Our findings indicate significant improvements in diagnostic accuracy. See {{tab:results}} for detailed metrics. As noted by previous work {{cite:smith2020}}, these results are promising.',
        order: 3,
      },
      {
        id: 'discussion',
        title: 'Discussion',
        content: 'The implications of these findings are substantial for clinical practice. However, challenges remain in terms of interpretability and regulatory approval.',
        order: 4,
      },
      {
        id: 'conclusion',
        title: 'Conclusion',
        content: 'Machine learning shows great promise for healthcare applications. Future work should focus on addressing bias and improving model transparency.',
        order: 5,
      },
    ],
    figures: [
      {
        id: 'framework',
        filename: 'framework.png',
        caption: 'Our proposed analysis framework for evaluating ML healthcare applications',
        label: 'framework',
        width: '0.9\\textwidth',
        bytes: Buffer.from('placeholder-image-data'),
      },
    ],
    tables: [
      {
        id: 'results',
        filename: 'results.tex',
        caption: 'Performance metrics across different ML models',
        label: 'results',
        content: `\\begin{tabular}{lrrr}
\\toprule
Model & Accuracy & Precision & Recall \\\\
\\midrule
Random Forest & 0.87 & 0.85 & 0.89 \\\\
Neural Network & 0.92 & 0.91 & 0.93 \\\\
XGBoost & 0.90 & 0.88 & 0.91 \\\\
\\bottomrule
\\end{tabular}`,
      },
    ],
    references: [
      {
        id: 'smith2020',
        type: 'article',
        title: 'Deep Learning in Medical Imaging',
        authors: ['Smith, John', 'Johnson, Mary'],
        year: 2020,
        journal: 'Nature Medicine',
        volume: '26',
        pages: '1-12',
        doi: '10.1038/nm.2020.12345',
      },
      {
        id: 'doe2019',
        type: 'inproceedings',
        title: 'Clinical Decision Support Systems',
        authors: ['Doe, Jane'],
        year: 2019,
        booktitle: 'Proceedings of MICCAI',
        pages: '45-52',
      },
    ],
    acknowledgments: 'This work was supported by the National Institutes of Health (Grant #12345).',
    supplementary: [],
  };

  manuscripts.set(id, sample);
  return sample;
}

// ─────────────────────────────────────────────────────────────
// Exports
// ─────────────────────────────────────────────────────────────

export default {
  generateOverleafPackage,
  recordExport,
  getExportHistory,
  getMockManuscript,
  escapeLatex,
  markdownToLatex,
  generateBibtex,
};
