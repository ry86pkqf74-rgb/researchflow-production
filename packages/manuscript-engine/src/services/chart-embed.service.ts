import { v4 as uuid } from 'uuid';
import type { GeneratedChart } from './visualization.service';

export interface FigureEmbed {
  id: string;
  chartId: string;
  figureNumber: number;
  caption: string;
  altText: string;
  section: string;
  position: 'inline' | 'end_of_section' | 'appendix';
  embedCode: string;
}

export class ChartEmbedService {
  private figures: Map<string, FigureEmbed> = new Map();
  private nextFigureNumber: number = 1;

  embedChart(params: {
    chart: GeneratedChart;
    section: string;
    position?: 'inline' | 'end_of_section' | 'appendix';
    customCaption?: string;
  }): FigureEmbed {
    const figureNumber = this.nextFigureNumber++;
    const caption = params.customCaption || this.generateCaption(params.chart, figureNumber);

    const embed: FigureEmbed = {
      id: uuid(),
      chartId: params.chart.id,
      figureNumber,
      caption,
      altText: params.chart.altText,
      section: params.section,
      position: params.position || 'end_of_section',
      embedCode: this.generateEmbedCode(params.chart.id, figureNumber)
    };

    this.figures.set(embed.id, embed);
    return embed;
  }

  private generateCaption(chart: GeneratedChart, figureNumber: number): string {
    return `Figure ${figureNumber}. ${chart.caption}`;
  }

  private generateEmbedCode(chartId: string, figureNumber: number): string {
    return `[FIGURE ${figureNumber}: ${chartId}]`;
  }

  updateCaption(figureId: string, newCaption: string): FigureEmbed | null {
    const figure = this.figures.get(figureId);
    if (figure) {
      figure.caption = newCaption;
    }
    return figure || null;
  }

  getFiguresForSection(section: string): FigureEmbed[] {
    return Array.from(this.figures.values()).filter(f => f.section === section);
  }

  renumberFigures(): void {
    const sorted = Array.from(this.figures.values()).sort(
      (a, b) => a.figureNumber - b.figureNumber
    );
    sorted.forEach((fig, index) => {
      fig.figureNumber = index + 1;
      fig.caption = fig.caption.replace(/Figure \d+\./, `Figure ${index + 1}.`);
    });
  }
}

export const chartEmbedService = new ChartEmbedService();
