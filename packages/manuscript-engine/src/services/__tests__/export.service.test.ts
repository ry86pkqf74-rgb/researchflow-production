/**
 * Export Service Unit Tests
 * Task T85-T86: Test manuscript export functionality
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ExportService } from '../export.service';
import type { Manuscript, ExportOptions } from '../../types';

describe('ExportService', () => {
  let service: ExportService;

  beforeEach(() => {
    service = ExportService.getInstance();
  });

  const sampleManuscript: Manuscript = {
    id: 'manuscript-001',
    title: 'Exercise Reduces Blood Pressure in Hypertensive Adults',
    authors: [
      {
        id: 'author-001',
        name: 'Jane Smith',
        email: 'jane@example.com',
        affiliation: 'University Medical Center',
        order: 1,
        corresponding: true,
        roles: ['conceptualization', 'writing']
      },
      {
        id: 'author-002',
        name: 'John Doe',
        email: 'john@example.com',
        affiliation: 'Research Institute',
        order: 2,
        corresponding: false,
        roles: ['analysis']
      }
    ],
    abstract: 'Background: Hypertension is common. Methods: RCT with 200 adults. Results: BP decreased 12 mmHg (p<0.001). Conclusions: Exercise reduces BP.',
    keywords: ['hypertension', 'exercise', 'blood pressure', 'RCT'],
    currentVersion: 'v1',
    versions: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    status: 'draft'
  };

  describe('getInstance', () => {
    it('should return singleton instance', () => {
      const instance1 = ExportService.getInstance();
      const instance2 = ExportService.getInstance();

      expect(instance1).toBe(instance2);
    });
  });

  describe('export', () => {
    it('should export to DOCX format', async () => {
      const options: ExportOptions = {
        format: 'docx'
      };

      const result = await service.export(sampleManuscript, options);

      expect(result.format).toBe('docx');
      expect(result.filename).toContain('.docx');
      expect(result.mimeType).toBe('application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      expect(result.data).toBeInstanceOf(Buffer);
    });

    it('should export to PDF format', async () => {
      const options: ExportOptions = {
        format: 'pdf'
      };

      const result = await service.export(sampleManuscript, options);

      expect(result.format).toBe('pdf');
      expect(result.filename).toContain('.pdf');
      expect(result.mimeType).toBe('application/pdf');
      expect(result.data).toBeInstanceOf(Buffer);
    });

    it('should export to LaTeX format', async () => {
      const options: ExportOptions = {
        format: 'latex'
      };

      const result = await service.export(sampleManuscript, options);

      expect(result.format).toBe('latex');
      expect(result.filename).toContain('.tex');
      expect(result.mimeType).toBe('application/x-latex');
      expect(typeof result.data).toBe('string');
    });

    it('should export to Markdown format', async () => {
      const options: ExportOptions = {
        format: 'markdown'
      };

      const result = await service.export(sampleManuscript, options);

      expect(result.format).toBe('markdown');
      expect(result.filename).toContain('.md');
      expect(result.mimeType).toBe('text/markdown');
      expect(typeof result.data).toBe('string');
    });

    it('should throw error for unsupported format', async () => {
      const options: ExportOptions = {
        format: 'unsupported' as any
      };

      await expect(service.export(sampleManuscript, options))
        .rejects
        .toThrow('Unsupported export format');
    });
  });

  describe('exportToWord', () => {
    it('should generate Word document with title', async () => {
      const options: ExportOptions = { format: 'docx' };
      const result = await service.export(sampleManuscript, options);

      const content = result.data.toString();
      expect(content).toContain(sampleManuscript.title);
    });

    it('should include authors in Word export', async () => {
      const options: ExportOptions = { format: 'docx' };
      const result = await service.export(sampleManuscript, options);

      const content = result.data.toString();
      expect(content).toContain('Jane Smith');
      expect(content).toContain('John Doe');
    });

    it('should mark corresponding author', async () => {
      const options: ExportOptions = { format: 'docx' };
      const result = await service.export(sampleManuscript, options);

      const content = result.data.toString();
      expect(content).toContain('Jane Smith*'); // Corresponding author marked with *
    });

    it('should include abstract in Word export', async () => {
      const options: ExportOptions = { format: 'docx' };
      const result = await service.export(sampleManuscript, options);

      const content = result.data.toString();
      expect(content).toContain('ABSTRACT');
      expect(content).toContain(sampleManuscript.abstract);
    });

    it('should include keywords in Word export', async () => {
      const options: ExportOptions = { format: 'docx' };
      const result = await service.export(sampleManuscript, options);

      const content = result.data.toString();
      expect(content).toContain('Keywords:');
      expect(content).toContain('hypertension');
      expect(content).toContain('exercise');
    });

    it('should sort authors by order', async () => {
      const manuscriptWithUnorderedAuthors: Manuscript = {
        ...sampleManuscript,
        authors: [
          { ...sampleManuscript.authors[1], order: 1 },
          { ...sampleManuscript.authors[0], order: 2 }
        ]
      };

      const options: ExportOptions = { format: 'docx' };
      const result = await service.export(manuscriptWithUnorderedAuthors, options);

      const content = result.data.toString();
      const johnIndex = content.indexOf('John Doe');
      const janeIndex = content.indexOf('Jane Smith');
      expect(johnIndex).toBeLessThan(janeIndex);
    });
  });

  describe('exportToPDF', () => {
    it('should generate PDF with title', async () => {
      const options: ExportOptions = { format: 'pdf' };
      const result = await service.export(sampleManuscript, options);

      const content = result.data.toString();
      expect(content).toContain(sampleManuscript.title);
    });

    it('should include authors in PDF', async () => {
      const options: ExportOptions = { format: 'pdf' };
      const result = await service.export(sampleManuscript, options);

      const content = result.data.toString();
      expect(content).toContain('Jane Smith');
    });

    it('should have correct MIME type', async () => {
      const options: ExportOptions = { format: 'pdf' };
      const result = await service.export(sampleManuscript, options);

      expect(result.mimeType).toBe('application/pdf');
    });
  });

  describe('exportToLatex', () => {
    it('should generate valid LaTeX document structure', async () => {
      const options: ExportOptions = { format: 'latex' };
      const result = await service.export(sampleManuscript, options);

      const latex = result.data as string;
      expect(latex).toContain('\\documentclass{article}');
      expect(latex).toContain('\\begin{document}');
      expect(latex).toContain('\\end{document}');
    });

    it('should include required packages', async () => {
      const options: ExportOptions = { format: 'latex' };
      const result = await service.export(sampleManuscript, options);

      const latex = result.data as string;
      expect(latex).toContain('\\usepackage{graphicx}');
      expect(latex).toContain('\\usepackage{cite}');
    });

    it('should include title', async () => {
      const options: ExportOptions = { format: 'latex' };
      const result = await service.export(sampleManuscript, options);

      const latex = result.data as string;
      expect(latex).toContain('\\title{');
      expect(latex).toContain('Exercise Reduces Blood Pressure');
    });

    it('should include authors', async () => {
      const options: ExportOptions = { format: 'latex' };
      const result = await service.export(sampleManuscript, options);

      const latex = result.data as string;
      expect(latex).toContain('\\author{');
      expect(latex).toContain('Jane Smith');
      expect(latex).toContain('\\and');
      expect(latex).toContain('John Doe');
    });

    it('should include maketitle command', async () => {
      const options: ExportOptions = { format: 'latex' };
      const result = await service.export(sampleManuscript, options);

      const latex = result.data as string;
      expect(latex).toContain('\\maketitle');
    });

    it('should include abstract environment', async () => {
      const options: ExportOptions = { format: 'latex' };
      const result = await service.export(sampleManuscript, options);

      const latex = result.data as string;
      expect(latex).toContain('\\begin{abstract}');
      expect(latex).toContain('\\end{abstract}');
      expect(latex).toContain('Hypertension is common');
    });

    it('should escape LaTeX special characters in title', async () => {
      const manuscriptWithSpecialChars: Manuscript = {
        ...sampleManuscript,
        title: 'Study with $100 & 50% increase'
      };

      const options: ExportOptions = { format: 'latex' };
      const result = await service.export(manuscriptWithSpecialChars, options);

      const latex = result.data as string;
      expect(latex).toContain('\\$');
      expect(latex).toContain('\\&');
      expect(latex).toContain('\\%');
    });

    it('should escape LaTeX special characters in abstract', async () => {
      const manuscriptWithSpecialChars: Manuscript = {
        ...sampleManuscript,
        abstract: 'Results: #1 treatment, ~50% reduction'
      };

      const options: ExportOptions = { format: 'latex' };
      const result = await service.export(manuscriptWithSpecialChars, options);

      const latex = result.data as string;
      expect(latex).toContain('\\#');
      expect(latex).toContain('\\textasciitilde{}');
      expect(latex).toContain('\\%');
    });

    it('should escape underscores', async () => {
      const manuscriptWithUnderscore: Manuscript = {
        ...sampleManuscript,
        title: 'Study_with_underscores'
      };

      const options: ExportOptions = { format: 'latex' };
      const result = await service.export(manuscriptWithUnderscore, options);

      const latex = result.data as string;
      expect(latex).toContain('\\_');
    });

    it('should escape curly braces', async () => {
      const manuscriptWithBraces: Manuscript = {
        ...sampleManuscript,
        title: 'Study {with} braces'
      };

      const options: ExportOptions = { format: 'latex' };
      const result = await service.export(manuscriptWithBraces, options);

      const latex = result.data as string;
      expect(latex).toContain('\\{');
      expect(latex).toContain('\\}');
    });
  });

  describe('exportToMarkdown', () => {
    it('should generate Markdown with title as H1', async () => {
      const options: ExportOptions = { format: 'markdown' };
      const result = await service.export(sampleManuscript, options);

      const md = result.data as string;
      expect(md).toContain('# Exercise Reduces Blood Pressure');
    });

    it('should include authors', async () => {
      const options: ExportOptions = { format: 'markdown' };
      const result = await service.export(sampleManuscript, options);

      const md = result.data as string;
      expect(md).toContain('Jane Smith');
      expect(md).toContain('John Doe');
    });

    it('should mark corresponding author with asterisk', async () => {
      const options: ExportOptions = { format: 'markdown' };
      const result = await service.export(sampleManuscript, options);

      const md = result.data as string;
      expect(md).toContain('Jane Smith\\*');
    });

    it('should include abstract section', async () => {
      const options: ExportOptions = { format: 'markdown' };
      const result = await service.export(sampleManuscript, options);

      const md = result.data as string;
      expect(md).toContain('## Abstract');
      expect(md).toContain('Hypertension is common');
    });

    it('should include keywords', async () => {
      const options: ExportOptions = { format: 'markdown' };
      const result = await service.export(sampleManuscript, options);

      const md = result.data as string;
      expect(md).toContain('**Keywords:**');
      expect(md).toContain('hypertension, exercise, blood pressure, RCT');
    });

    it('should include section headers', async () => {
      const options: ExportOptions = { format: 'markdown' };
      const result = await service.export(sampleManuscript, options);

      const md = result.data as string;
      expect(md).toContain('## Introduction');
      expect(md).toContain('## Methods');
      expect(md).toContain('## Results');
      expect(md).toContain('## Discussion');
      expect(md).toContain('## References');
    });
  });

  describe('sanitizeFilename', () => {
    it('should replace spaces with underscores', async () => {
      const manuscriptWithSpaces: Manuscript = {
        ...sampleManuscript,
        title: 'A Study With Many Spaces'
      };

      const options: ExportOptions = { format: 'docx' };
      const result = await service.export(manuscriptWithSpaces, options);

      expect(result.filename).toBe('A_Study_With_Many_Spaces.docx');
    });

    it('should replace special characters with underscores', async () => {
      const manuscriptWithSpecialChars: Manuscript = {
        ...sampleManuscript,
        title: 'Study @#$% with special!'
      };

      const options: ExportOptions = { format: 'docx' };
      const result = await service.export(manuscriptWithSpecialChars, options);

      expect(result.filename).toMatch(/^Study_+with_special_+\.docx$/);
    });

    it('should collapse multiple underscores', async () => {
      const manuscriptWithMultipleSpaces: Manuscript = {
        ...sampleManuscript,
        title: 'Study    with    many    spaces'
      };

      const options: ExportOptions = { format: 'docx' };
      const result = await service.export(manuscriptWithMultipleSpaces, options);

      expect(result.filename).not.toContain('__');
    });

    it('should preserve alphanumeric characters', async () => {
      const manuscriptWithAlphanumeric: Manuscript = {
        ...sampleManuscript,
        title: 'Study123ABC'
      };

      const options: ExportOptions = { format: 'docx' };
      const result = await service.export(manuscriptWithAlphanumeric, options);

      expect(result.filename).toBe('Study123ABC.docx');
    });

    it('should preserve hyphens and underscores', async () => {
      const manuscriptWithHyphens: Manuscript = {
        ...sampleManuscript,
        title: 'Study-Name_Test'
      };

      const options: ExportOptions = { format: 'docx' };
      const result = await service.export(manuscriptWithHyphens, options);

      expect(result.filename).toBe('Study-Name_Test.docx');
    });

    it('should truncate long filenames', async () => {
      const manuscriptWithLongTitle: Manuscript = {
        ...sampleManuscript,
        title: 'A'.repeat(150)
      };

      const options: ExportOptions = { format: 'docx' };
      const result = await service.export(manuscriptWithLongTitle, options);

      expect(result.filename.length).toBeLessThanOrEqual(105); // 100 + '.docx'
    });
  });

  describe('Edge Cases', () => {
    it('should handle manuscript without authors', async () => {
      const manuscriptNoAuthors: Manuscript = {
        ...sampleManuscript,
        authors: []
      };

      const options: ExportOptions = { format: 'docx' };
      const result = await service.export(manuscriptNoAuthors, options);

      expect(result.data).toBeDefined();
    });

    it('should handle manuscript without abstract', async () => {
      const manuscriptNoAbstract: Manuscript = {
        ...sampleManuscript,
        abstract: ''
      };

      const options: ExportOptions = { format: 'latex' };
      const result = await service.export(manuscriptNoAbstract, options);

      const latex = result.data as string;
      expect(latex).not.toContain('\\begin{abstract}');
    });

    it('should handle manuscript without keywords', async () => {
      const manuscriptNoKeywords: Manuscript = {
        ...sampleManuscript,
        keywords: []
      };

      const options: ExportOptions = { format: 'markdown' };
      const result = await service.export(manuscriptNoKeywords, options);

      const md = result.data as string;
      expect(md).not.toContain('**Keywords:**');
    });

    it('should handle empty title', async () => {
      const manuscriptEmptyTitle: Manuscript = {
        ...sampleManuscript,
        title: ''
      };

      const options: ExportOptions = { format: 'docx' };
      const result = await service.export(manuscriptEmptyTitle, options);

      expect(result.filename).toMatch(/\.docx$/);
    });

    it('should handle Unicode characters in title', async () => {
      const manuscriptUnicode: Manuscript = {
        ...sampleManuscript,
        title: 'Étude sur hypertension'
      };

      const options: ExportOptions = { format: 'docx' };
      const result = await service.export(manuscriptUnicode, options);

      const content = result.data.toString();
      expect(content).toContain('Étude');
    });

    it('should handle very long abstract', async () => {
      const manuscriptLongAbstract: Manuscript = {
        ...sampleManuscript,
        abstract: 'Abstract text. '.repeat(500)
      };

      const options: ExportOptions = { format: 'pdf' };
      const result = await service.export(manuscriptLongAbstract, options);

      expect(result.data).toBeDefined();
      expect(result.data.toString().length).toBeGreaterThan(1000);
    });

    it('should handle backslash in LaTeX export', async () => {
      const manuscriptWithBackslash: Manuscript = {
        ...sampleManuscript,
        title: 'Study\\Test'
      };

      const options: ExportOptions = { format: 'latex' };
      const result = await service.export(manuscriptWithBackslash, options);

      const latex = result.data as string;
      expect(latex).toContain('\\textbackslash\\{\\}');
    });

    it('should handle caret character in LaTeX export', async () => {
      const manuscriptWithCaret: Manuscript = {
        ...sampleManuscript,
        abstract: 'Results: 2^3 = 8'
      };

      const options: ExportOptions = { format: 'latex' };
      const result = await service.export(manuscriptWithCaret, options);

      const latex = result.data as string;
      expect(latex).toContain('\\textasciicircum{}');
    });
  });

  describe('Multiple Exports', () => {
    it('should export same manuscript to multiple formats', async () => {
      const formats: ('docx' | 'pdf' | 'latex' | 'markdown')[] = ['docx', 'pdf', 'latex', 'markdown'];

      for (const format of formats) {
        const options: ExportOptions = { format };
        const result = await service.export(sampleManuscript, options);

        expect(result.format).toBe(format);
        expect(result.data).toBeDefined();
      }
    });

    it('should generate consistent filenames across formats', async () => {
      const docxResult = await service.export(sampleManuscript, { format: 'docx' });
      const pdfResult = await service.export(sampleManuscript, { format: 'pdf' });

      const docxBase = docxResult.filename.replace('.docx', '');
      const pdfBase = pdfResult.filename.replace('.pdf', '');

      expect(docxBase).toBe(pdfBase);
    });
  });
});
