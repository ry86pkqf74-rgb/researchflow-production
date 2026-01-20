# Phase 3: Frontend API Integration

**Target:** `services/web/src/components/ui/conference-readiness.tsx`
**Language:** TypeScript/React
**Estimated LOC:** ~150 lines of modifications

---

## Overview

The ConferenceReadinessPanel component has the UI structure but needs proper API integration. This phase wires the component to the orchestrator endpoints.

---

## File 1: Create API Client Functions

Create `services/web/src/lib/api/conference.ts`:

```typescript
/**
 * Conference API Client
 *
 * Type-safe API functions for conference preparation workflow.
 */

import { apiRequest } from '../api-client';

// ============================================================================
// Types
// ============================================================================

export interface DiscoverConferencesRequest {
  keywords: string[];
  yearRange?: [number, number];
  formats?: string[];
  locationPref?: string;
  maxResults?: number;
  mode?: 'DEMO' | 'LIVE';
}

export interface DiscoveredConference {
  id: string;
  name: string;
  abbreviation: string;
  url: string;
  typicalMonth: string;
  abstractDeadline?: string;
  formats: string[];
  tags: string[];
  score: number;
  scoreBreakdown: {
    keyword: number;
    format: number;
    timing: number;
    location: number;
  };
  matchExplanation: string;
}

export interface DiscoverConferencesResponse {
  success: boolean;
  data: {
    conferences: DiscoveredConference[];
    totalFound: number;
    queryMetadata: {
      keywords: string[];
      mode: string;
      timestamp: string;
    };
  };
}

export interface ExtractGuidelinesRequest {
  conferenceName: string;
  conferenceUrl?: string;
  formats?: string[];
  mode?: 'DEMO' | 'LIVE';
}

export interface ExtractedGuidelines {
  conferenceName: string;
  rawTextHash: string;
  extractedFields: {
    abstractWordLimit?: number;
    abstractCharLimit?: number;
    posterSize?: string;
    slideLimits?: {
      maxSlides?: number;
      speakingTimeMinutes?: number;
    };
    acceptedFileTypes?: string[];
    blindingRequired?: boolean;
    requiredSections?: string[];
    formattingHints?: Record<string, string>;
  };
  sanitizationApplied: boolean;
}

export interface ExtractGuidelinesResponse {
  success: boolean;
  data: ExtractedGuidelines;
}

export interface ExportMaterialsRequest {
  researchId: string;
  conferenceName: string;
  conferenceUrl?: string;
  formats: ('poster' | 'oral' | 'symposium')[];
  title: string;
  authors?: string[];
  abstract: string;
  sections: {
    background?: string;
    methods?: string;
    results?: string;
    conclusions?: string;
  };
  blindingMode?: boolean;
  mode?: 'DEMO' | 'LIVE';
}

export interface GeneratedMaterial {
  filename: string;
  format: string;
  path: string;
  size: number;
  hash: string;
  mimeType: string;
}

export interface ExportMaterialsResponse {
  success: boolean;
  data: {
    runId: string;
    guidelines: ExtractedGuidelines;
    materials: GeneratedMaterial[];
    bundleHash: string;
    downloadUrl: string;
    checklist: {
      id: string;
      category: string;
      label: string;
      status: 'pass' | 'fail' | 'warning' | 'pending';
      message?: string;
    }[];
  };
}

export interface ExportStatusResponse {
  success: boolean;
  data: {
    runId: string;
    manifest: {
      files: GeneratedMaterial[];
      createdAt: string;
      toolVersions: Record<string, string>;
    };
    downloadUrl: string;
  };
}

// ============================================================================
// API Functions
// ============================================================================

/**
 * Discover conferences matching search criteria
 */
export async function discoverConferences(
  request: DiscoverConferencesRequest
): Promise<DiscoverConferencesResponse> {
  return apiRequest<DiscoverConferencesResponse>('/api/ros/conference/discover', {
    method: 'POST',
    body: JSON.stringify({
      keywords: request.keywords,
      yearRange: request.yearRange,
      formats: request.formats,
      locationPref: request.locationPref,
      maxResults: request.maxResults ?? 10,
      mode: request.mode ?? 'DEMO',
    }),
  });
}

/**
 * Extract guidelines from a conference
 */
export async function extractGuidelines(
  request: ExtractGuidelinesRequest
): Promise<ExtractGuidelinesResponse> {
  return apiRequest<ExtractGuidelinesResponse>('/api/ros/conference/guidelines/extract', {
    method: 'POST',
    body: JSON.stringify({
      conferenceName: request.conferenceName,
      conferenceUrl: request.conferenceUrl,
      formats: request.formats ?? ['poster', 'oral'],
      mode: request.mode ?? 'DEMO',
    }),
  });
}

/**
 * Generate conference materials and create bundle
 */
export async function exportMaterials(
  request: ExportMaterialsRequest
): Promise<ExportMaterialsResponse> {
  return apiRequest<ExportMaterialsResponse>('/api/ros/conference/export', {
    method: 'POST',
    body: JSON.stringify({
      researchId: request.researchId,
      conferenceName: request.conferenceName,
      conferenceUrl: request.conferenceUrl,
      formats: request.formats,
      title: request.title,
      authors: request.authors,
      abstract: request.abstract,
      sections: request.sections,
      blindingMode: request.blindingMode ?? false,
      mode: request.mode ?? 'DEMO',
    }),
  });
}

/**
 * Get status of a previous export
 */
export async function getExportStatus(runId: string): Promise<ExportStatusResponse> {
  return apiRequest<ExportStatusResponse>(`/api/ros/conference/export/${runId}`);
}

/**
 * Get download URL for a file
 */
export function getDownloadUrl(runId: string, filename: string): string {
  return `/api/ros/conference/download/${runId}/${filename}`;
}

/**
 * Download a file directly
 */
export async function downloadFile(runId: string, filename: string): Promise<void> {
  const url = getDownloadUrl(runId, filename);
  const response = await fetch(url, {
    credentials: 'include',
  });

  if (!response.ok) {
    throw new Error(`Download failed: ${response.statusText}`);
  }

  // Trigger browser download
  const blob = await response.blob();
  const downloadUrl = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = downloadUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(downloadUrl);
}
```

---

## File 2: Update Conference Readiness Component

Modify `services/web/src/components/ui/conference-readiness.tsx` to use the API functions.

Add these imports near the top:

```typescript
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  discoverConferences,
  extractGuidelines,
  exportMaterials,
  downloadFile,
  type DiscoveredConference,
  type ExtractedGuidelines,
  type GeneratedMaterial,
} from '@/lib/api/conference';
import { useToast } from '@/components/ui/use-toast';
```

Add these hooks inside the component (replace any existing mock implementations):

```typescript
// Inside ConferenceReadinessPanel component

const { toast } = useToast();

// State for workflow
const [selectedConference, setSelectedConference] = useState<DiscoveredConference | null>(null);
const [extractedGuidelines, setExtractedGuidelines] = useState<ExtractedGuidelines | null>(null);
const [exportResult, setExportResult] = useState<{
  runId: string;
  materials: GeneratedMaterial[];
  downloadUrl: string;
} | null>(null);

// Discovery mutation
const discoveryMutation = useMutation({
  mutationFn: discoverConferences,
  onSuccess: (response) => {
    if (response.success && response.data.conferences.length > 0) {
      toast({
        title: 'Conferences Found',
        description: `Found ${response.data.totalFound} matching conferences`,
      });
    } else {
      toast({
        title: 'No Conferences Found',
        description: 'Try different keywords or broaden your search',
        variant: 'destructive',
      });
    }
  },
  onError: (error) => {
    toast({
      title: 'Discovery Failed',
      description: error instanceof Error ? error.message : 'Unknown error',
      variant: 'destructive',
    });
  },
});

// Guidelines extraction mutation
const guidelinesMutation = useMutation({
  mutationFn: extractGuidelines,
  onSuccess: (response) => {
    if (response.success) {
      setExtractedGuidelines(response.data);
      toast({
        title: 'Guidelines Extracted',
        description: `Requirements loaded for ${response.data.conferenceName}`,
      });
    }
  },
  onError: (error) => {
    toast({
      title: 'Extraction Failed',
      description: error instanceof Error ? error.message : 'Unknown error',
      variant: 'destructive',
    });
  },
});

// Export mutation
const exportMutation = useMutation({
  mutationFn: exportMaterials,
  onSuccess: (response) => {
    if (response.success) {
      setExportResult({
        runId: response.data.runId,
        materials: response.data.materials,
        downloadUrl: response.data.downloadUrl,
      });
      toast({
        title: 'Materials Generated',
        description: `${response.data.materials.length} files ready for download`,
      });
    }
  },
  onError: (error) => {
    toast({
      title: 'Export Failed',
      description: error instanceof Error ? error.message : 'Unknown error',
      variant: 'destructive',
    });
  },
});

// Handler functions
const handleDiscover = async () => {
  const keywords = searchKeywords.split(',').map(k => k.trim()).filter(Boolean);
  if (keywords.length === 0) {
    toast({
      title: 'Enter Keywords',
      description: 'Please enter at least one keyword to search',
      variant: 'destructive',
    });
    return;
  }

  discoveryMutation.mutate({
    keywords,
    formats: selectedFormats,
    maxResults: 10,
    mode: 'DEMO', // or get from governance context
  });
};

const handleSelectConference = async (conference: DiscoveredConference) => {
  setSelectedConference(conference);

  // Automatically extract guidelines
  guidelinesMutation.mutate({
    conferenceName: conference.name,
    conferenceUrl: conference.url,
    formats: selectedFormats,
    mode: 'DEMO',
  });
};

const handleExport = async () => {
  if (!selectedConference || !researchId) {
    toast({
      title: 'Missing Information',
      description: 'Please select a conference and ensure research is loaded',
      variant: 'destructive',
    });
    return;
  }

  exportMutation.mutate({
    researchId,
    conferenceName: selectedConference.name,
    conferenceUrl: selectedConference.url,
    formats: selectedFormats as ('poster' | 'oral' | 'symposium')[],
    title: manuscriptTitle || 'Untitled Research',
    authors: blindingMode ? undefined : authorList,
    abstract: abstractText,
    sections: {
      background: backgroundSection,
      methods: methodsSection,
      results: resultsSection,
      conclusions: conclusionsSection,
    },
    blindingMode,
    mode: 'DEMO',
  });
};

const handleDownload = async (filename: string) => {
  if (!exportResult?.runId) return;

  try {
    await downloadFile(exportResult.runId, filename);
    toast({
      title: 'Download Started',
      description: filename,
    });
  } catch (error) {
    toast({
      title: 'Download Failed',
      description: error instanceof Error ? error.message : 'Unknown error',
      variant: 'destructive',
    });
  }
};
```

Update the JSX to use the new mutations. Replace button onClick handlers:

```tsx
{/* Discovery Button */}
<Button
  onClick={handleDiscover}
  disabled={discoveryMutation.isPending}
>
  {discoveryMutation.isPending ? (
    <>
      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      Searching...
    </>
  ) : (
    <>
      <Search className="mr-2 h-4 w-4" />
      Discover Conferences
    </>
  )}
</Button>

{/* Conference List */}
{discoveryMutation.data?.data.conferences && (
  <div className="space-y-2">
    {discoveryMutation.data.data.conferences.map((conf) => (
      <Card
        key={conf.id}
        className={cn(
          "cursor-pointer hover:border-primary transition-colors",
          selectedConference?.id === conf.id && "border-primary"
        )}
        onClick={() => handleSelectConference(conf)}
      >
        <CardContent className="p-4">
          <div className="flex justify-between items-start">
            <div>
              <h4 className="font-semibold">{conf.name}</h4>
              <p className="text-sm text-muted-foreground">{conf.abbreviation}</p>
            </div>
            <Badge variant="secondary">
              Score: {(conf.score * 100).toFixed(0)}%
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            {conf.matchExplanation}
          </p>
        </CardContent>
      </Card>
    ))}
  </div>
)}

{/* Export Button */}
<Button
  onClick={handleExport}
  disabled={exportMutation.isPending || !selectedConference}
>
  {exportMutation.isPending ? (
    <>
      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      Generating...
    </>
  ) : (
    <>
      <FileOutput className="mr-2 h-4 w-4" />
      Generate Materials
    </>
  )}
</Button>

{/* Download Section */}
{exportResult && (
  <Card>
    <CardHeader>
      <CardTitle className="text-lg">Generated Materials</CardTitle>
    </CardHeader>
    <CardContent>
      <div className="space-y-2">
        {exportResult.materials.map((material) => (
          <div
            key={material.filename}
            className="flex items-center justify-between p-2 border rounded"
          >
            <div className="flex items-center gap-2">
              {material.format === 'pdf' && <FileText className="h-4 w-4" />}
              {material.format === 'pptx' && <Presentation className="h-4 w-4" />}
              <span className="text-sm">{material.filename}</span>
              <span className="text-xs text-muted-foreground">
                ({(material.size / 1024).toFixed(1)} KB)
              </span>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleDownload(material.filename)}
            >
              <Download className="h-4 w-4" />
            </Button>
          </div>
        ))}

        {/* Bundle Download */}
        <Button
          className="w-full mt-4"
          onClick={() => handleDownload(`conference_bundle_${exportResult.runId}.zip`)}
        >
          <Package className="mr-2 h-4 w-4" />
          Download Complete Bundle
        </Button>
      </div>
    </CardContent>
  </Card>
)}
```

---

## File 3: Add API Client Base (if not exists)

Ensure `services/web/src/lib/api-client.ts` has the base request function:

```typescript
/**
 * Base API request function with error handling
 */
export async function apiRequest<T>(
  url: string,
  options: RequestInit = {}
): Promise<T> {
  const response = await fetch(url, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(error.error || error.message || 'API request failed');
  }

  return response.json();
}
```

---

## Verification Steps

1. Start all services (worker, orchestrator, web)
2. Navigate to Stage 20 in the workflow
3. Enter keywords and click "Discover Conferences"
4. Select a conference from the results
5. Verify guidelines are extracted
6. Click "Generate Materials"
7. Download the generated files

---

## Next Phase

Once frontend is integrated, proceed to [Phase 4: Testing Suite](./04-PHASE4-TESTING.md).
