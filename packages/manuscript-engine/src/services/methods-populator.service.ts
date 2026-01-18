/**
 * Methods Populator Service
 * Task T44: Auto-populate Methods section from dataset metadata
 */

export interface MethodsPopulatorRequest {
  manuscriptId: string;
  datasetIds: string[];
  studyDesign?: string;
  statisticalMethods?: string[];
}

export interface PopulatedMethods {
  manuscriptId: string;
  sections: {
    studyDesign: string;
    setting: string;
    participants: string;
    variables: string;
    dataSources: string;
    statisticalMethods: string;
    ethics: string;
  };
  fullText: string;
  dataBindings: Record<string, string>; // Maps placeholders to data sources
  createdAt: Date;
}

/**
 * Methods Populator Service
 * Automatically generates Methods section from dataset metadata
 */
export class MethodsPopulatorService {
  async populateMethods(request: MethodsPopulatorRequest): Promise<PopulatedMethods> {
    // In production, fetch dataset metadata
    const metadata = await this.fetchDatasetMetadata(request.datasetIds);

    const sections = {
      studyDesign: this.generateStudyDesignSection(metadata, request.studyDesign),
      setting: this.generateSettingSection(metadata),
      participants: this.generateParticipantsSection(metadata),
      variables: this.generateVariablesSection(metadata),
      dataSources: this.generateDataSourcesSection(metadata),
      statisticalMethods: this.generateStatisticalMethodsSection(metadata, request.statisticalMethods),
      ethics: this.generateEthicsSection(metadata),
    };

    const fullText = Object.entries(sections)
      .map(([key, value]) => `### ${this.formatSectionTitle(key)}\n\n${value}`)
      .join('\n\n');

    return {
      manuscriptId: request.manuscriptId,
      sections,
      fullText,
      dataBindings: {}, // Map of placeholder → data source
      createdAt: new Date(),
    };
  }

  private async fetchDatasetMetadata(datasetIds: string[]): Promise<any> {
    // Fetch from data-mapper service
    return {
      studyType: 'retrospective cohort',
      institution: 'Academic Medical Center',
      dates: '2020-01-01 to 2023-12-31',
      sampleSize: 500,
      inclusionCriteria: ['Age ≥18 years', 'Diagnosis of condition'],
      variables: ['age', 'sex', 'outcome'],
    };
  }

  private generateStudyDesignSection(metadata: any, studyDesign?: string): string {
    return `We conducted a ${studyDesign || metadata.studyType || '[study design]'} at ${metadata.institution || '[institution]'} from ${metadata.dates || '[dates]'}.`;
  }

  private generateSettingSection(metadata: any): string {
    return `The study was conducted at ${metadata.institution || '[institution]'} during ${metadata.dates || '[date range]'}.`;
  }

  private generateParticipantsSection(metadata: any): string {
    const criteria = metadata.inclusionCriteria?.join('; ') || '[inclusion criteria]';
    return `We included ${metadata.sampleSize || '[N]'} participants who met the following criteria: ${criteria}.`;
  }

  private generateVariablesSection(metadata: any): string {
    const vars = metadata.variables?.join(', ') || '[variables]';
    return `Variables extracted included: ${vars}.`;
  }

  private generateDataSourcesSection(metadata: any): string {
    return `Data were obtained from [data source, e.g., electronic health records, surveys].`;
  }

  private generateStatisticalMethodsSection(metadata: any, methods?: string[]): string {
    const methodsList = methods?.join(', ') || 'descriptive statistics, t-tests, regression analysis';
    return `Statistical analyses included ${methodsList}. All analyses were performed using [statistical software]. P-values <0.05 were considered statistically significant.`;
  }

  private generateEthicsSection(metadata: any): string {
    return `This study was approved by the Institutional Review Board at ${metadata.institution || '[institution]'} (IRB #[number]). [Informed consent statement].`;
  }

  private formatSectionTitle(key: string): string {
    return key.replace(/([A-Z])/g, ' $1').trim().replace(/^./, str => str.toUpperCase());
  }
}

export const methodsPopulatorService = new MethodsPopulatorService();
