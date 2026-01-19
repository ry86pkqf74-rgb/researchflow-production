/**
 * PRISMA Flow Diagram Service
 * Task: Generate PRISMA 2020 flow diagrams for systematic reviews
 */

export interface PRISMAFlowData {
  identification: {
    databaseRecords: number;
    registerRecords: number;
    otherRecords: number;
    duplicatesRemoved: number;
  };
  screening: {
    recordsScreened: number;
    recordsExcluded: number;
    exclusionReasons?: Record<string, number>;
  };
  eligibility: {
    reportsAssessed: number;
    reportsExcluded: number;
    exclusionReasons?: Record<string, number>;
  };
  included: {
    studiesIncluded: number;
    reportsIncluded: number;
  };
}

export interface PRISMADiagramOptions {
  format: 'mermaid' | 'svg' | 'json';
  showReasons: boolean;
  title?: string;
}

export interface PRISMADiagramResult {
  diagram: string;
  format: string;
  flowData: PRISMAFlowData;
  generatedAt: Date;
}

/**
 * PRISMA Flow Diagram Generator
 * Generates PRISMA 2020 compliant flow diagrams for systematic reviews
 */
export class PRISMADiagramService {
  private static instance: PRISMADiagramService;

  private constructor() {}

  static getInstance(): PRISMADiagramService {
    if (!this.instance) {
      this.instance = new PRISMADiagramService();
    }
    return this.instance;
  }

  /**
   * Generate PRISMA flow diagram
   */
  generate(data: PRISMAFlowData, options: PRISMADiagramOptions = { format: 'mermaid', showReasons: true }): PRISMADiagramResult {
    let diagram: string;

    switch (options.format) {
      case 'mermaid':
        diagram = this.generateMermaid(data, options);
        break;
      case 'svg':
        diagram = this.generateSVG(data, options);
        break;
      case 'json':
        diagram = JSON.stringify(this.generateJSON(data), null, 2);
        break;
      default:
        diagram = this.generateMermaid(data, options);
    }

    return {
      diagram,
      format: options.format,
      flowData: data,
      generatedAt: new Date()
    };
  }

  /**
   * Generate Mermaid flowchart syntax
   */
  private generateMermaid(data: PRISMAFlowData, options: PRISMADiagramOptions): string {
    const { identification, screening, eligibility, included } = data;
    const totalIdentified = identification.databaseRecords + identification.registerRecords + identification.otherRecords;
    const afterDuplicates = totalIdentified - identification.duplicatesRemoved;

    let mermaid = `flowchart TD
    subgraph Identification
        A1[("Records from databases<br/>(n=${identification.databaseRecords})")]
        A2[("Records from registers<br/>(n=${identification.registerRecords})")]
        A3[("Records from other sources<br/>(n=${identification.otherRecords})")]
        A1 --> B[Total records<br/>n=${totalIdentified}]
        A2 --> B
        A3 --> B
        B --> C[Duplicates removed<br/>n=${identification.duplicatesRemoved}]
        C --> D[Records after duplicates<br/>n=${afterDuplicates}]
    end

    subgraph Screening
        D --> E[Records screened<br/>n=${screening.recordsScreened}]
        E --> F[Records excluded<br/>n=${screening.recordsExcluded}]
        E --> G[Records sought for retrieval<br/>n=${screening.recordsScreened - screening.recordsExcluded}]
    end

    subgraph Eligibility
        G --> H[Reports assessed<br/>n=${eligibility.reportsAssessed}]
        H --> I[Reports excluded<br/>n=${eligibility.reportsExcluded}]
        H --> J[Reports included<br/>n=${eligibility.reportsAssessed - eligibility.reportsExcluded}]
    end

    subgraph Included
        J --> K[Studies included<br/>n=${included.studiesIncluded}]
        J --> L[Reports included<br/>n=${included.reportsIncluded}]
    end`;

    // Add exclusion reasons if requested
    if (options.showReasons) {
      if (screening.exclusionReasons && Object.keys(screening.exclusionReasons).length > 0) {
        const reasons = Object.entries(screening.exclusionReasons)
          .map(([reason, count]) => `${reason}: ${count}`)
          .join('<br/>');
        mermaid += `\n    F -.-> F1[("Exclusion reasons:<br/>${reasons}")]`;
      }

      if (eligibility.exclusionReasons && Object.keys(eligibility.exclusionReasons).length > 0) {
        const reasons = Object.entries(eligibility.exclusionReasons)
          .map(([reason, count]) => `${reason}: ${count}`)
          .join('<br/>');
        mermaid += `\n    I -.-> I1[("Exclusion reasons:<br/>${reasons}")]`;
      }
    }

    // Add title if provided
    if (options.title) {
      mermaid = `---\ntitle: ${options.title}\n---\n${mermaid}`;
    }

    return mermaid;
  }

  /**
   * Generate SVG diagram
   */
  private generateSVG(data: PRISMAFlowData, options: PRISMADiagramOptions): string {
    const { identification, screening, eligibility, included } = data;
    const totalIdentified = identification.databaseRecords + identification.registerRecords + identification.otherRecords;
    const afterDuplicates = totalIdentified - identification.duplicatesRemoved;

    const boxWidth = 180;
    const boxHeight = 60;
    const padding = 20;
    const arrowLength = 40;

    // Generate SVG boxes and arrows
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 900" style="font-family: Arial, sans-serif; font-size: 12px;">
  <defs>
    <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="10" refY="3.5" orient="auto">
      <polygon points="0 0, 10 3.5, 0 7" fill="#333"/>
    </marker>
  </defs>

  <!-- Title -->
  <text x="400" y="30" text-anchor="middle" font-size="16" font-weight="bold">${options.title || 'PRISMA 2020 Flow Diagram'}</text>

  <!-- Identification Section -->
  <rect x="50" y="60" width="700" height="180" fill="#e3f2fd" stroke="#1976d2" rx="5"/>
  <text x="70" y="80" font-weight="bold" fill="#1976d2">Identification</text>

  <rect x="80" y="100" width="${boxWidth}" height="${boxHeight}" fill="white" stroke="#333" rx="3"/>
  <text x="${80 + boxWidth/2}" y="125" text-anchor="middle">Records from databases</text>
  <text x="${80 + boxWidth/2}" y="145" text-anchor="middle" font-weight="bold">n = ${identification.databaseRecords}</text>

  <rect x="300" y="100" width="${boxWidth}" height="${boxHeight}" fill="white" stroke="#333" rx="3"/>
  <text x="${300 + boxWidth/2}" y="125" text-anchor="middle">Records from registers</text>
  <text x="${300 + boxWidth/2}" y="145" text-anchor="middle" font-weight="bold">n = ${identification.registerRecords}</text>

  <rect x="520" y="100" width="${boxWidth}" height="${boxHeight}" fill="white" stroke="#333" rx="3"/>
  <text x="${520 + boxWidth/2}" y="125" text-anchor="middle">Other sources</text>
  <text x="${520 + boxWidth/2}" y="145" text-anchor="middle" font-weight="bold">n = ${identification.otherRecords}</text>

  <rect x="300" y="180" width="${boxWidth}" height="${boxHeight}" fill="white" stroke="#333" rx="3"/>
  <text x="${300 + boxWidth/2}" y="200" text-anchor="middle">Duplicates removed</text>
  <text x="${300 + boxWidth/2}" y="220" text-anchor="middle" font-weight="bold">n = ${identification.duplicatesRemoved}</text>

  <!-- Screening Section -->
  <rect x="50" y="260" width="700" height="160" fill="#f3e5f5" stroke="#7b1fa2" rx="5"/>
  <text x="70" y="280" font-weight="bold" fill="#7b1fa2">Screening</text>

  <rect x="200" y="300" width="${boxWidth}" height="${boxHeight}" fill="white" stroke="#333" rx="3"/>
  <text x="${200 + boxWidth/2}" y="320" text-anchor="middle">Records screened</text>
  <text x="${200 + boxWidth/2}" y="340" text-anchor="middle" font-weight="bold">n = ${screening.recordsScreened}</text>

  <rect x="420" y="300" width="${boxWidth}" height="${boxHeight}" fill="white" stroke="#333" rx="3"/>
  <text x="${420 + boxWidth/2}" y="320" text-anchor="middle">Records excluded</text>
  <text x="${420 + boxWidth/2}" y="340" text-anchor="middle" font-weight="bold">n = ${screening.recordsExcluded}</text>

  <!-- Eligibility Section -->
  <rect x="50" y="440" width="700" height="160" fill="#fff3e0" stroke="#f57c00" rx="5"/>
  <text x="70" y="460" font-weight="bold" fill="#f57c00">Eligibility</text>

  <rect x="200" y="480" width="${boxWidth}" height="${boxHeight}" fill="white" stroke="#333" rx="3"/>
  <text x="${200 + boxWidth/2}" y="500" text-anchor="middle">Reports assessed</text>
  <text x="${200 + boxWidth/2}" y="520" text-anchor="middle" font-weight="bold">n = ${eligibility.reportsAssessed}</text>

  <rect x="420" y="480" width="${boxWidth}" height="${boxHeight}" fill="white" stroke="#333" rx="3"/>
  <text x="${420 + boxWidth/2}" y="500" text-anchor="middle">Reports excluded</text>
  <text x="${420 + boxWidth/2}" y="520" text-anchor="middle" font-weight="bold">n = ${eligibility.reportsExcluded}</text>

  <!-- Included Section -->
  <rect x="50" y="620" width="700" height="140" fill="#e8f5e9" stroke="#388e3c" rx="5"/>
  <text x="70" y="640" font-weight="bold" fill="#388e3c">Included</text>

  <rect x="200" y="660" width="${boxWidth}" height="${boxHeight}" fill="white" stroke="#333" rx="3"/>
  <text x="${200 + boxWidth/2}" y="680" text-anchor="middle">Studies included</text>
  <text x="${200 + boxWidth/2}" y="700" text-anchor="middle" font-weight="bold">n = ${included.studiesIncluded}</text>

  <rect x="420" y="660" width="${boxWidth}" height="${boxHeight}" fill="white" stroke="#333" rx="3"/>
  <text x="${420 + boxWidth/2}" y="680" text-anchor="middle">Reports included</text>
  <text x="${420 + boxWidth/2}" y="700" text-anchor="middle" font-weight="bold">n = ${included.reportsIncluded}</text>

  <!-- Arrows -->
  <line x1="170" y1="160" x2="300" y2="180" stroke="#333" marker-end="url(#arrowhead)"/>
  <line x1="390" y1="160" x2="390" y2="180" stroke="#333" marker-end="url(#arrowhead)"/>
  <line x1="610" y1="160" x2="480" y2="180" stroke="#333" marker-end="url(#arrowhead)"/>
  <line x1="390" y1="240" x2="290" y2="300" stroke="#333" marker-end="url(#arrowhead)"/>
  <line x1="380" y1="330" x2="420" y2="330" stroke="#333" marker-end="url(#arrowhead)"/>
  <line x1="290" y1="360" x2="290" y2="480" stroke="#333" marker-end="url(#arrowhead)"/>
  <line x1="380" y1="510" x2="420" y2="510" stroke="#333" marker-end="url(#arrowhead)"/>
  <line x1="290" y1="540" x2="290" y2="660" stroke="#333" marker-end="url(#arrowhead)"/>
  <line x1="290" y1="720" x2="420" y2="720" stroke="#333" stroke-dasharray="5,5"/>

  <!-- Footer -->
  <text x="400" y="800" text-anchor="middle" font-size="10" fill="#666">PRISMA 2020 Flow Diagram - Generated by ResearchFlow</text>
</svg>`;
  }

  /**
   * Generate JSON structure for custom rendering
   */
  private generateJSON(data: PRISMAFlowData): object {
    const { identification, screening, eligibility, included } = data;
    const totalIdentified = identification.databaseRecords + identification.registerRecords + identification.otherRecords;
    const afterDuplicates = totalIdentified - identification.duplicatesRemoved;

    return {
      version: 'PRISMA 2020',
      stages: [
        {
          name: 'Identification',
          color: '#e3f2fd',
          boxes: [
            { id: 'databases', label: 'Records from databases', value: identification.databaseRecords },
            { id: 'registers', label: 'Records from registers', value: identification.registerRecords },
            { id: 'other', label: 'Other sources', value: identification.otherRecords },
            { id: 'total', label: 'Total records identified', value: totalIdentified },
            { id: 'duplicates', label: 'Duplicates removed', value: identification.duplicatesRemoved },
            { id: 'after_duplicates', label: 'Records after duplicates', value: afterDuplicates }
          ]
        },
        {
          name: 'Screening',
          color: '#f3e5f5',
          boxes: [
            { id: 'screened', label: 'Records screened', value: screening.recordsScreened },
            { id: 'excluded_screening', label: 'Records excluded', value: screening.recordsExcluded, reasons: screening.exclusionReasons }
          ]
        },
        {
          name: 'Eligibility',
          color: '#fff3e0',
          boxes: [
            { id: 'assessed', label: 'Reports assessed', value: eligibility.reportsAssessed },
            { id: 'excluded_eligibility', label: 'Reports excluded', value: eligibility.reportsExcluded, reasons: eligibility.exclusionReasons }
          ]
        },
        {
          name: 'Included',
          color: '#e8f5e9',
          boxes: [
            { id: 'studies', label: 'Studies included', value: included.studiesIncluded },
            { id: 'reports', label: 'Reports included', value: included.reportsIncluded }
          ]
        }
      ],
      connections: [
        { from: 'databases', to: 'total' },
        { from: 'registers', to: 'total' },
        { from: 'other', to: 'total' },
        { from: 'total', to: 'duplicates' },
        { from: 'duplicates', to: 'after_duplicates' },
        { from: 'after_duplicates', to: 'screened' },
        { from: 'screened', to: 'excluded_screening' },
        { from: 'screened', to: 'assessed' },
        { from: 'assessed', to: 'excluded_eligibility' },
        { from: 'assessed', to: 'studies' },
        { from: 'studies', to: 'reports' }
      ]
    };
  }

  /**
   * Validate PRISMA flow data consistency
   */
  validateData(data: PRISMAFlowData): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    const { identification, screening, eligibility, included } = data;

    const totalIdentified = identification.databaseRecords + identification.registerRecords + identification.otherRecords;
    const afterDuplicates = totalIdentified - identification.duplicatesRemoved;

    // Validation rules
    if (identification.duplicatesRemoved > totalIdentified) {
      errors.push('Duplicates removed cannot exceed total identified records');
    }

    if (screening.recordsScreened > afterDuplicates) {
      errors.push('Records screened cannot exceed records after duplicate removal');
    }

    if (screening.recordsExcluded > screening.recordsScreened) {
      errors.push('Records excluded at screening cannot exceed records screened');
    }

    if (eligibility.reportsExcluded > eligibility.reportsAssessed) {
      errors.push('Reports excluded at eligibility cannot exceed reports assessed');
    }

    if (included.studiesIncluded > eligibility.reportsAssessed - eligibility.reportsExcluded) {
      errors.push('Studies included cannot exceed reports remaining after eligibility exclusions');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
}

export const prismaDiagramService = PRISMADiagramService.getInstance();
