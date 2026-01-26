import crypto from "crypto";

export type ConferenceFormat = 'poster' | 'symposium' | 'presentation';

export interface FileManifest {
  id: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  description: string;
  generatedAt: string;
}

export interface ExportResult {
  exportId: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  format: ConferenceFormat;
  files: FileManifest[];
  downloadUrl: string;
  expiresAt: string;
  metadata: {
    researchId: string;
    title: string;
    generatedAt: string;
    estimatedPrintSize?: string;
  };
}

const exportStore = new Map<string, ExportResult>();

function generatePosterFiles(researchId: string): FileManifest[] {
  const timestamp = new Date().toISOString();
  return [
    {
      id: crypto.randomUUID(),
      filename: `research_poster_${researchId}.pdf`,
      mimeType: 'application/pdf',
      sizeBytes: Math.floor(Math.random() * 5000000) + 2000000,
      description: 'Research poster (48x36 inches, 300 DPI)',
      generatedAt: timestamp
    },
    {
      id: crypto.randomUUID(),
      filename: `poster_thumbnail_${researchId}.png`,
      mimeType: 'image/png',
      sizeBytes: Math.floor(Math.random() * 500000) + 100000,
      description: 'Poster thumbnail preview',
      generatedAt: timestamp
    },
    {
      id: crypto.randomUUID(),
      filename: `visual_abstract_${researchId}.png`,
      mimeType: 'image/png',
      sizeBytes: Math.floor(Math.random() * 1000000) + 200000,
      description: 'Visual abstract for social media',
      generatedAt: timestamp
    },
    {
      id: crypto.randomUUID(),
      filename: `qr_supplemental_${researchId}.png`,
      mimeType: 'image/png',
      sizeBytes: Math.floor(Math.random() * 50000) + 10000,
      description: 'QR code linking to supplemental materials',
      generatedAt: timestamp
    }
  ];
}

function generateSymposiumFiles(researchId: string): FileManifest[] {
  const timestamp = new Date().toISOString();
  return [
    {
      id: crypto.randomUUID(),
      filename: `symposium_slides_${researchId}.pptx`,
      mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      sizeBytes: Math.floor(Math.random() * 10000000) + 3000000,
      description: 'Symposium presentation slides (12-15 slides)',
      generatedAt: timestamp
    },
    {
      id: crypto.randomUUID(),
      filename: `speaker_notes_${researchId}.docx`,
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      sizeBytes: Math.floor(Math.random() * 200000) + 50000,
      description: 'Detailed speaker notes and talking points',
      generatedAt: timestamp
    },
    {
      id: crypto.randomUUID(),
      filename: `symposium_handout_${researchId}.pdf`,
      mimeType: 'application/pdf',
      sizeBytes: Math.floor(Math.random() * 1000000) + 200000,
      description: 'Audience handout with key findings',
      generatedAt: timestamp
    },
    {
      id: crypto.randomUUID(),
      filename: `discussion_questions_${researchId}.pdf`,
      mimeType: 'application/pdf',
      sizeBytes: Math.floor(Math.random() * 100000) + 20000,
      description: 'Suggested discussion questions for Q&A',
      generatedAt: timestamp
    },
    {
      id: crypto.randomUUID(),
      filename: `references_${researchId}.pdf`,
      mimeType: 'application/pdf',
      sizeBytes: Math.floor(Math.random() * 150000) + 30000,
      description: 'Full reference list for distribution',
      generatedAt: timestamp
    }
  ];
}

function generatePresentationFiles(researchId: string): FileManifest[] {
  const timestamp = new Date().toISOString();
  return [
    {
      id: crypto.randomUUID(),
      filename: `presentation_deck_${researchId}.pptx`,
      mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      sizeBytes: Math.floor(Math.random() * 15000000) + 5000000,
      description: 'Conference presentation deck (20-25 slides)',
      generatedAt: timestamp
    },
    {
      id: crypto.randomUUID(),
      filename: `presentation_deck_${researchId}.pdf`,
      mimeType: 'application/pdf',
      sizeBytes: Math.floor(Math.random() * 8000000) + 2000000,
      description: 'PDF version of presentation',
      generatedAt: timestamp
    },
    {
      id: crypto.randomUUID(),
      filename: `speaker_notes_detailed_${researchId}.docx`,
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      sizeBytes: Math.floor(Math.random() * 300000) + 80000,
      description: 'Comprehensive speaker notes with timing',
      generatedAt: timestamp
    },
    {
      id: crypto.randomUUID(),
      filename: `qa_preparation_${researchId}.pdf`,
      mimeType: 'application/pdf',
      sizeBytes: Math.floor(Math.random() * 150000) + 40000,
      description: 'Anticipated questions and prepared responses',
      generatedAt: timestamp
    },
    {
      id: crypto.randomUUID(),
      filename: `figure_exports_${researchId}.zip`,
      mimeType: 'application/zip',
      sizeBytes: Math.floor(Math.random() * 20000000) + 5000000,
      description: 'High-resolution figure exports (PNG, SVG)',
      generatedAt: timestamp
    },
    {
      id: crypto.randomUUID(),
      filename: `presentation_recording_script_${researchId}.docx`,
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      sizeBytes: Math.floor(Math.random() * 100000) + 25000,
      description: 'Script for pre-recorded presentations',
      generatedAt: timestamp
    }
  ];
}

const printSizeMap: Record<ConferenceFormat, string> = {
  'poster': '48" x 36" (landscape)',
  'symposium': 'Letter/A4 handouts',
  'presentation': '16:9 widescreen slides'
};

export async function generateConferenceMaterials(
  researchId: string, 
  format: ConferenceFormat,
  title?: string
): Promise<ExportResult> {
  const exportId = crypto.randomUUID();
  const timestamp = new Date().toISOString();
  
  let files: FileManifest[];
  switch (format) {
    case 'poster':
      files = generatePosterFiles(researchId);
      break;
    case 'symposium':
      files = generateSymposiumFiles(researchId);
      break;
    case 'presentation':
      files = generatePresentationFiles(researchId);
      break;
    default:
      files = generatePresentationFiles(researchId);
  }

  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + 24);

  const result: ExportResult = {
    exportId,
    status: 'completed',
    format,
    files,
    downloadUrl: `/api/ros/conference/download/${exportId}`,
    expiresAt: expiresAt.toISOString(),
    metadata: {
      researchId,
      title: title || `Research Study ${researchId.slice(0, 8)}`,
      generatedAt: timestamp,
      estimatedPrintSize: printSizeMap[format]
    }
  };

  exportStore.set(exportId, result);
  
  return result;
}

export function getExportStatus(exportId: string): ExportResult | undefined {
  return exportStore.get(exportId);
}

export function listExports(researchId: string): ExportResult[] {
  return Array.from(exportStore.values())
    .filter(e => e.metadata.researchId === researchId);
}
