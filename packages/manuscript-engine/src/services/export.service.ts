/**
 * Export Service
 * Export manuscripts to multiple formats
 */

import type { Manuscript, ExportFormat, ExportOptions } from '../types';

export interface ExportResult {
  format: ExportFormat;
  data: Buffer | string;
  filename: string;
  mimeType: string;
}

/**
 * Export Service - Export manuscripts to various formats
 */
export class ExportService {
  private static instance: ExportService;

  private constructor() {}

  static getInstance(): ExportService {
    if (!this.instance) {
      this.instance = new ExportService();
    }
    return this.instance;
  }

  /**
   * Export manuscript to specified format
   */
  async export(manuscript: Manuscript, options: ExportOptions): Promise<ExportResult> {
    switch (options.format) {
      case 'docx':
        return this.exportToWord(manuscript, options);
      case 'pdf':
        return this.exportToPDF(manuscript, options);
      case 'latex':
        return this.exportToLatex(manuscript, options);
      case 'markdown':
        return this.exportToMarkdown(manuscript, options);
      default:
        throw new Error(`Unsupported export format: ${options.format}`);
    }
  }

  /**
   * Export to Microsoft Word (.docx)
   */
  private async exportToWord(manuscript: Manuscript, options: ExportOptions): Promise<ExportResult> {
    // Placeholder implementation - in production, use docx library
    const content = this.generatePlainText(manuscript, options);

    return {
      format: 'docx',
      data: Buffer.from(content),
      filename: `${this.sanitizeFilename(manuscript.title)}.docx`,
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    };
  }

  /**
   * Export to PDF
   */
  private async exportToPDF(manuscript: Manuscript, options: ExportOptions): Promise<ExportResult> {
    // Placeholder implementation - in production, use pdfkit library
    const content = this.generatePlainText(manuscript, options);

    return {
      format: 'pdf',
      data: Buffer.from(content),
      filename: `${this.sanitizeFilename(manuscript.title)}.pdf`,
      mimeType: 'application/pdf',
    };
  }

  /**
   * Export to LaTeX
   */
  private async exportToLatex(manuscript: Manuscript, options: ExportOptions): Promise<ExportResult> {
    const latex = this.generateLatex(manuscript, options);

    return {
      format: 'latex',
      data: latex,
      filename: `${this.sanitizeFilename(manuscript.title)}.tex`,
      mimeType: 'application/x-latex',
    };
  }

  /**
   * Export to Markdown
   */
  private async exportToMarkdown(manuscript: Manuscript, options: ExportOptions): Promise<ExportResult> {
    const markdown = this.generateMarkdown(manuscript, options);

    return {
      format: 'markdown',
      data: markdown,
      filename: `${this.sanitizeFilename(manuscript.title)}.md`,
      mimeType: 'text/markdown',
    };
  }

  /**
   * Generate plain text representation
   */
  private generatePlainText(manuscript: Manuscript, options: ExportOptions): string {
    let content = '';

    // Title
    content += `${manuscript.title}\n\n`;

    // Authors
    if (manuscript.authors.length > 0) {
      const authorList = manuscript.authors
        .sort((a, b) => a.order - b.order)
        .map(a => `${a.name}${a.corresponding ? '*' : ''}`)
        .join(', ');
      content += `${authorList}\n\n`;
    }

    // Abstract
    if (manuscript.abstract) {
      content += `ABSTRACT\n\n${manuscript.abstract}\n\n`;
    }

    // Keywords
    if (manuscript.keywords.length > 0) {
      content += `Keywords: ${manuscript.keywords.join(', ')}\n\n`;
    }

    // Sections would be added from version content
    content += '[Section content would be inserted here from manuscript version]\n\n';

    return content;
  }

  /**
   * Generate LaTeX
   */
  private generateLatex(manuscript: Manuscript, options: ExportOptions): string {
    let latex = '\\documentclass{article}\n';
    latex += '\\usepackage{graphicx}\n';
    latex += '\\usepackage{cite}\n\n';

    latex += '\\begin{document}\n\n';

    // Title
    latex += `\\title{${this.escapeLatex(manuscript.title)}}\n`;

    // Authors
    if (manuscript.authors.length > 0) {
      const authors = manuscript.authors
        .sort((a, b) => a.order - b.order)
        .map(a => this.escapeLatex(a.name))
        .join(' \\and ');
      latex += `\\author{${authors}}\n`;
    }

    latex += '\\maketitle\n\n';

    // Abstract
    if (manuscript.abstract) {
      latex += '\\begin{abstract}\n';
      latex += this.escapeLatex(manuscript.abstract);
      latex += '\n\\end{abstract}\n\n';
    }

    // Sections
    latex += '% Sections would be inserted here\n\n';

    latex += '\\end{document}\n';

    return latex;
  }

  /**
   * Generate Markdown
   */
  private generateMarkdown(manuscript: Manuscript, options: ExportOptions): string {
    let md = '';

    // Title
    md += `# ${manuscript.title}\n\n`;

    // Authors
    if (manuscript.authors.length > 0) {
      md += manuscript.authors
        .sort((a, b) => a.order - b.order)
        .map(a => `${a.name}${a.corresponding ? '\\*' : ''}`)
        .join(', ');
      md += '\n\n';
    }

    // Abstract
    if (manuscript.abstract) {
      md += `## Abstract\n\n${manuscript.abstract}\n\n`;
    }

    // Keywords
    if (manuscript.keywords.length > 0) {
      md += `**Keywords:** ${manuscript.keywords.join(', ')}\n\n`;
    }

    // Sections
    md += '## Introduction\n\n[Content]\n\n';
    md += '## Methods\n\n[Content]\n\n';
    md += '## Results\n\n[Content]\n\n';
    md += '## Discussion\n\n[Content]\n\n';
    md += '## References\n\n[Content]\n\n';

    return md;
  }

  /**
   * Sanitize filename
   */
  private sanitizeFilename(title: string): string {
    return title
      .replace(/[^a-zA-Z0-9-_]/g, '_')
      .replace(/_+/g, '_')
      .substring(0, 100);
  }

  /**
   * Escape LaTeX special characters
   */
  private escapeLatex(text: string): string {
    return text
      .replace(/\\/g, '\\textbackslash{}')
      .replace(/[&%$#_{}]/g, '\\$&')
      .replace(/~/g, '\\textasciitilde{}')
      .replace(/\^/g, '\\textasciicircum{}');
  }
}

/**
 * Factory function
 */
export function getExportService(): ExportService {
  return ExportService.getInstance();
}
