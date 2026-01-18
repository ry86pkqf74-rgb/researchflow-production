/**
 * Outline Expander Service
 * Task T51: Expand bullet point outlines into prose
 */

export interface OutlineExpanderRequest {
  manuscriptId: string;
  outline: OutlineItem[];
  targetWordCount?: number;
  style?: 'formal' | 'conversational' | 'technical';
}

export interface OutlineItem {
  id: string;
  level: number; // 1 = main point, 2 = sub-point, etc.
  text: string;
  children?: OutlineItem[];
}

export interface ExpandedOutline {
  manuscriptId: string;
  prose: string;
  wordCount: number;
  paragraphs: ExpandedParagraph[];
  expansionRatio: number; // prose words / outline words
  createdAt: Date;
}

export interface ExpandedParagraph {
  sourceOutlineId: string;
  text: string;
  wordCount: number;
}

/**
 * Outline Expander Service
 * Expands bullet point outlines into full prose paragraphs
 */
export class OutlineExpanderService {
  async expandOutline(request: OutlineExpanderRequest): Promise<ExpandedOutline> {
    const paragraphs: ExpandedParagraph[] = [];

    for (const item of request.outline) {
      const paragraph = await this.expandItem(item, request.style);
      paragraphs.push(paragraph);

      // Recursively expand children
      if (item.children && item.children.length > 0) {
        for (const child of item.children) {
          const childParagraph = await this.expandItem(child, request.style);
          paragraphs.push(childParagraph);
        }
      }
    }

    const prose = paragraphs.map(p => p.text).join('\n\n');
    const wordCount = prose.split(/\s+/).length;

    const outlineWordCount = this.countOutlineWords(request.outline);
    const expansionRatio = wordCount / Math.max(outlineWordCount, 1);

    return {
      manuscriptId: request.manuscriptId,
      prose,
      wordCount,
      paragraphs,
      expansionRatio,
      createdAt: new Date(),
    };
  }

  private async expandItem(
    item: OutlineItem,
    style: OutlineExpanderRequest['style']
  ): Promise<ExpandedParagraph> {
    // In production, use AI to expand
    // For now, template expansion based on style
    let expanded: string;

    switch (style) {
      case 'formal':
        expanded = this.expandFormal(item);
        break;
      case 'conversational':
        expanded = this.expandConversational(item);
        break;
      case 'technical':
        expanded = this.expandTechnical(item);
        break;
      default:
        expanded = this.expandFormal(item);
    }

    return {
      sourceOutlineId: item.id,
      text: expanded,
      wordCount: expanded.split(/\s+/).length,
    };
  }

  private expandFormal(item: OutlineItem): string {
    // Formal academic style
    const starters = [
      'This study examined',
      'The findings demonstrate',
      'Research indicates',
      'Evidence suggests',
      'Analysis revealed',
    ];

    const starter = starters[Math.floor(Math.random() * starters.length)];

    return `${item.text} ${starter} that [expand this point with supporting details and evidence. Add 2-3 sentences to develop the idea fully. Include specific examples and citations where appropriate. Maintain formal academic tone throughout.]`;
  }

  private expandConversational(item: OutlineItem): string {
    // More accessible style
    return `${item.text} [Explain this concept in clear, accessible language. Break down complex ideas. Use examples that readers can relate to. Keep sentences shorter and more direct.]`;
  }

  private expandTechnical(item: OutlineItem): string {
    // Technical/methods style
    return `${item.text} [Provide technical details, specific protocols, and precise measurements. Include methodological considerations. Specify equipment, software versions, and parameters used. Maintain precision and reproducibility.]`;
  }

  private countOutlineWords(outline: OutlineItem[]): number {
    let total = 0;

    for (const item of outline) {
      total += item.text.split(/\s+/).length;

      if (item.children && item.children.length > 0) {
        total += this.countOutlineWords(item.children);
      }
    }

    return total;
  }

  /**
   * Convert flat bullet list to structured outline
   */
  parseBulletList(bulletText: string): OutlineItem[] {
    const lines = bulletText.split('\n').filter(l => l.trim().length > 0);
    const outline: OutlineItem[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const level = this.detectIndentLevel(line);
      const text = line.replace(/^[\s\-\*•]+/, '').trim();

      outline.push({
        id: `outline-item-${i}`,
        level,
        text,
        children: [],
      });
    }

    return outline;
  }

  private detectIndentLevel(line: string): number {
    const leadingSpaces = line.match(/^\s*/)?.[0].length || 0;
    return Math.floor(leadingSpaces / 2) + 1;
  }

  /**
   * Generate outline from existing prose
   */
  async extractOutline(prose: string): Promise<OutlineItem[]> {
    // In production, use NLP to extract key points
    // For now, split by paragraphs
    const paragraphs = prose.split('\n\n').filter(p => p.trim().length > 0);

    return paragraphs.map((p, i) => ({
      id: `extracted-${i}`,
      level: 1,
      text: p.split('.')[0] + '.', // First sentence as outline point
      children: [],
    }));
  }
}

export const outlineExpanderService = new OutlineExpanderService();
