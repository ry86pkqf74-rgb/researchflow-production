/**
 * Results Scaffold Service
 * Task T45: Create Results section outline with data embeds
 */

export interface ResultsScaffoldRequest {
  manuscriptId: string;
  datasetIds: string[];
  primaryOutcome: string;
  secondaryOutcomes?: string[];
  includeFlowDiagram?: boolean;
  includeBaselineTable?: boolean;
}

export interface ResultsScaffold {
  manuscriptId: string;
  outline: ResultsOutlineSection[];
  fullText: string;
  dataEmbedPoints: DataEmbedPoint[];
  suggestedFigures: SuggestedFigure[];
  suggestedTables: SuggestedTable[];
  createdAt: Date;
}

export interface ResultsOutlineSection {
  id: string;
  type: 'participant_flow' | 'baseline' | 'primary_outcome' | 'secondary_outcome' | 'adverse_events';
  title: string;
  order: number;
  content: string;
  dataBindings: string[];
}

export interface DataEmbedPoint {
  sectionId: string;
  placeholder: string;
  datasetId: string;
  query: string; // What data to fetch
}

export interface SuggestedFigure {
  id: string;
  type: 'flow_diagram' | 'kaplan_meier' | 'forest_plot' | 'bar_chart' | 'scatter_plot';
  title: string;
  dataBinding: string;
  placement: 'before_section' | 'after_section';
  sectionId: string;
}

export interface SuggestedTable {
  id: string;
  type: 'baseline_characteristics' | 'outcomes' | 'subgroup_analysis';
  title: string;
  dataBinding: string;
  placement: 'before_section' | 'after_section';
  sectionId: string;
}

/**
 * Results Scaffold Service
 * Creates structured outline for Results section with data embed points
 */
export class ResultsScaffoldService {
  async createScaffold(request: ResultsScaffoldRequest): Promise<ResultsScaffold> {
    const outline: ResultsOutlineSection[] = [];
    const dataEmbedPoints: DataEmbedPoint[] = [];
    const suggestedFigures: SuggestedFigure[] = [];
    const suggestedTables: SuggestedTable[] = [];

    let order = 1;

    // Participant Flow
    if (request.includeFlowDiagram) {
      const section = this.createParticipantFlowSection(order++, request);
      outline.push(section);
      suggestedFigures.push({
        id: 'fig-1',
        type: 'flow_diagram',
        title: 'Participant Flow Diagram',
        dataBinding: 'enrollment_data',
        placement: 'before_section',
        sectionId: section.id,
      });
    }

    // Baseline Characteristics
    if (request.includeBaselineTable) {
      const section = this.createBaselineSection(order++, request);
      outline.push(section);
      suggestedTables.push({
        id: 'table-1',
        type: 'baseline_characteristics',
        title: 'Baseline Characteristics of Study Participants',
        dataBinding: 'baseline_data',
        placement: 'after_section',
        sectionId: section.id,
      });
    }

    // Primary Outcome
    const primarySection = this.createPrimaryOutcomeSection(order++, request);
    outline.push(primarySection);
    dataEmbedPoints.push({
      sectionId: primarySection.id,
      placeholder: '{primary_result}',
      datasetId: request.datasetIds[0],
      query: `primary_outcome:${request.primaryOutcome}`,
    });

    // Secondary Outcomes
    if (request.secondaryOutcomes && request.secondaryOutcomes.length > 0) {
      const secondarySection = this.createSecondaryOutcomesSection(order++, request);
      outline.push(secondarySection);
    }

    const fullText = outline.map(s => `## ${s.title}\n\n${s.content}`).join('\n\n');

    return {
      manuscriptId: request.manuscriptId,
      outline,
      fullText,
      dataEmbedPoints,
      suggestedFigures,
      suggestedTables,
      createdAt: new Date(),
    };
  }

  private createParticipantFlowSection(order: number, request: ResultsScaffoldRequest): ResultsOutlineSection {
    return {
      id: `results-section-${order}`,
      type: 'participant_flow',
      title: 'Participant Flow',
      order,
      content: `A total of {total_screened} individuals were screened, of whom {total_eligible} met eligibility criteria. After exclusions, {final_n} participants were included in the final analysis (Figure 1).`,
      dataBindings: ['total_screened', 'total_eligible', 'final_n'],
    };
  }

  private createBaselineSection(order: number, request: ResultsScaffoldRequest): ResultsOutlineSection {
    return {
      id: `results-section-${order}`,
      type: 'baseline',
      title: 'Baseline Characteristics',
      order,
      content: `Baseline characteristics of the study population are presented in Table 1. The mean age was {mean_age} years (SD {sd_age}), and {percent_female}% were female. [Describe key baseline characteristics and any group differences.]`,
      dataBindings: ['mean_age', 'sd_age', 'percent_female'],
    };
  }

  private createPrimaryOutcomeSection(order: number, request: ResultsScaffoldRequest): ResultsOutlineSection {
    return {
      id: `results-section-${order}`,
      type: 'primary_outcome',
      title: 'Primary Outcome',
      order,
      content: `The primary outcome, ${request.primaryOutcome}, occurred in {outcome_count} ({outcome_percent}%) of participants. {primary_result} (95% CI {ci_lower}-{ci_upper}, p={p_value}). [Interpret the statistical and clinical significance.]`,
      dataBindings: ['outcome_count', 'outcome_percent', 'primary_result', 'ci_lower', 'ci_upper', 'p_value'],
    };
  }

  private createSecondaryOutcomesSection(order: number, request: ResultsScaffoldRequest): ResultsOutlineSection {
    const outcomes = request.secondaryOutcomes?.join(', ') || '[secondary outcomes]';
    return {
      id: `results-section-${order}`,
      type: 'secondary_outcome',
      title: 'Secondary Outcomes',
      order,
      content: `Secondary outcomes included ${outcomes}. [Report results for each secondary outcome with appropriate statistics.]`,
      dataBindings: [],
    };
  }
}

export const resultsScaffoldService = new ResultsScaffoldService();
