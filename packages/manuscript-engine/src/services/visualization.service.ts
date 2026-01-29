import type { ChartType } from '../types/manuscript.types';

// Re-export ChartType for consumers who import from services
export type { ChartType };

export interface ChartConfig {
  type: ChartType;
  title: string;
  xAxis: { label: string; column?: string };
  yAxis: { label: string; column?: string };
  data: { name: string; values: { x: number | string; y: number }[] }[];
}

export interface GeneratedChart {
  id: string;
  config: ChartConfig;
  dataSourceId: string;
  figureNumber?: number;
  caption: string;
  altText: string;
  format: 'svg' | 'png';
}

export class VisualizationService {
  generateCaption(config: ChartConfig, figureNumber: number): string {
    const types: Record<ChartType, string> = {
      bar: 'Bar chart showing',
      line: 'Line graph depicting',
      scatter: 'Scatter plot illustrating',
      box: 'Box plot comparing',
      histogram: 'Distribution of',
      kaplan_meier: 'Kaplan-Meier survival curve for',
      forest: 'Forest plot of'
    };
    return `Figure ${figureNumber}. ${types[config.type] || 'Figure showing'} ${config.yAxis.label} by ${config.xAxis.label}.`;
  }

  generateAltText(config: ChartConfig): string {
    const dataDesc = config.data.map(s => `${s.name}: ${s.values.length} points`).join('; ');
    return `${config.type} chart titled "${config.title}". X-axis: ${config.xAxis.label}. Y-axis: ${config.yAxis.label}. Data: ${dataDesc}.`;
  }

  createRenderJob(chart: GeneratedChart): object {
    return {
      jobType: 'render_chart',
      payload: {
        chartId: chart.id,
        config: chart.config,
        format: chart.format,
        width: 800,
        height: 600,
        dpi: 300
      }
    };
  }
}

export const visualizationService = new VisualizationService();
