/**
 * Appendices Builder Service
 * Task T56: Build supplementary materials section
 */

export interface AppendicesBuilderRequest {
  manuscriptId: string;
  appendices: AppendixItem[];
}

export interface AppendixItem {
  id: string;
  type: 'supplementary_table' | 'supplementary_figure' | 'supplementary_methods' | 'supplementary_results' | 'other';
  title: string;
  description: string;
  content?: string;
  fileUrl?: string;
}

export interface BuiltAppendices {
  manuscriptId: string;
  appendices: FormattedAppendix[];
  fullText: string;
  tableOfContents: string;
  createdAt: Date;
}

export interface FormattedAppendix {
  number: string; // e.g., "S1", "S2"
  title: string;
  description: string;
  reference: string; // How to cite in main text
  type: AppendixItem['type'];
}

/**
 * Appendices Builder Service
 * Organizes and formats supplementary materials
 */
export class AppendicesBuilderService {
  async buildAppendices(request: AppendicesBuilderRequest): Promise<BuiltAppendices> {
    const formatted: FormattedAppendix[] = [];

    // Separate counters for different types
    let figureNum = 1;
    let tableNum = 1;
    let methodsNum = 1;
    let resultsNum = 1;
    let otherNum = 1;

    for (const appendix of request.appendices) {
      let number: string;
      let prefix: string;

      switch (appendix.type) {
        case 'supplementary_figure':
          number = `S${figureNum++}`;
          prefix = 'Supplementary Figure';
          break;
        case 'supplementary_table':
          number = `S${tableNum++}`;
          prefix = 'Supplementary Table';
          break;
        case 'supplementary_methods':
          number = `SM${methodsNum++}`;
          prefix = 'Supplementary Methods';
          break;
        case 'supplementary_results':
          number = `SR${resultsNum++}`;
          prefix = 'Supplementary Results';
          break;
        default:
          number = `S${otherNum++}`;
          prefix = 'Supplementary Material';
      }

      formatted.push({
        number,
        title: `${prefix} ${number}. ${appendix.title}`,
        description: appendix.description,
        reference: `See ${prefix} ${number}`,
        type: appendix.type,
      });
    }

    const fullText = formatted
      .map(a => `${a.title}\n${a.description}${a.type === 'supplementary_methods' || a.type === 'supplementary_results' ? '\n\n[Full content would be included here]' : ''}`)
      .join('\n\n---\n\n');

    const tableOfContents = this.generateTableOfContents(formatted);

    return {
      manuscriptId: request.manuscriptId,
      appendices: formatted,
      fullText,
      tableOfContents,
      createdAt: new Date(),
    };
  }

  private generateTableOfContents(appendices: FormattedAppendix[]): string {
    let toc = 'Supplementary Materials\n\n';

    // Group by type
    const byType: Record<string, FormattedAppendix[]> = {};

    for (const appendix of appendices) {
      if (!byType[appendix.type]) {
        byType[appendix.type] = [];
      }
      byType[appendix.type].push(appendix);
    }

    // Format TOC
    const typeOrder: AppendixItem['type'][] = [
      'supplementary_methods',
      'supplementary_results',
      'supplementary_figure',
      'supplementary_table',
      'other',
    ];

    for (const type of typeOrder) {
      if (byType[type] && byType[type].length > 0) {
        const typeName = this.formatTypeName(type);
        toc += `${typeName}:\n`;

        for (const appendix of byType[type]) {
          toc += `  ${appendix.number}. ${appendix.title.split('.')[1]?.trim() || appendix.title}\n`;
        }

        toc += '\n';
      }
    }

    return toc;
  }

  private formatTypeName(type: AppendixItem['type']): string {
    const names: Record<AppendixItem['type'], string> = {
      supplementary_methods: 'Supplementary Methods',
      supplementary_results: 'Supplementary Results',
      supplementary_figure: 'Supplementary Figures',
      supplementary_table: 'Supplementary Tables',
      other: 'Other Supplementary Materials',
    };

    return names[type];
  }

  /**
   * Generate captions for supplementary figures/tables
   */
  generateCaption(appendix: AppendixItem): string {
    let caption = appendix.description;

    // Add standard suffix based on type
    if (appendix.type === 'supplementary_figure') {
      caption += ' [Figure caption should describe what is shown, methods used to generate the figure, and define any abbreviations.]';
    } else if (appendix.type === 'supplementary_table') {
      caption += ' [Table caption should describe the data presented and define abbreviations. Include footnotes for statistical tests and p-values.]';
    }

    return caption;
  }

  /**
   * Validate appendices for completeness
   */
  validateAppendices(appendices: AppendixItem[]): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    for (const appendix of appendices) {
      // Check title
      if (!appendix.title || appendix.title.trim().length === 0) {
        errors.push(`Appendix ${appendix.id}: Missing title`);
      }

      // Check description
      if (!appendix.description || appendix.description.trim().length < 10) {
        errors.push(`Appendix ${appendix.id}: Description too short or missing`);
      }

      // Check content or file URL
      if (!appendix.content && !appendix.fileUrl) {
        errors.push(`Appendix ${appendix.id}: No content or file URL provided`);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}

export const appendicesBuilderService = new AppendicesBuilderService();
