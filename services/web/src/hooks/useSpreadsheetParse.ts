/**
 * useSpreadsheetParse Hook
 * 
 * React hook for managing spreadsheet cell extraction workflow.
 * Handles:
 * - File upload to artifact storage
 * - Job submission to worker
 * - Real-time progress polling
 * - Results retrieval
 */

import { useState, useCallback, useEffect, useRef } from 'react';

// Types
export interface BlockTextConfig {
  minChars?: number;
  minNewlines?: number;
  minClinicalMarkers?: number;
  denyColumns?: string[];
  allowColumns?: string[];
}

export interface LargeSheetConfig {
  chunkRows?: number;
  llmConcurrency?: number;
  llmBatchSize?: number;
  joinBackToSheet?: boolean;
  enableDask?: boolean;
}

export interface PromptPackConfig {
  cellExtract?: string;
  rosExtract?: string;
  outcomeExtract?: string;
}

export interface SpreadsheetParseRequest {
  artifactPath: string;
  fileType?: 'csv' | 'xlsx' | 'xls' | 'tsv';
  sheetName?: string | null;
  blockTextConfig?: BlockTextConfig;
  largeSheetConfig?: LargeSheetConfig;
  promptPack?: PromptPackConfig;
  priority?: 'low' | 'normal' | 'high' | 'critical';
}

export interface ExtractionProgress {
  phase: 'queued' | 'scanning' | 'detecting' | 'extracting' | 'merging' | 'completed' | 'failed';
  processedRows: number;
  totalRows: number;
  processedCells: number;
  totalCells: number;
  currentChunk: number;
  totalChunks: number;
  estimatedTimeRemaining?: number;
  tokensUsed?: number;
  costUsd?: number;
}

export interface ExtractionResult {
  summary: {
    totalRows: number;
    totalCells: number;
    extractedCells: number;
    skippedCells: number;
    errorCells: number;
    tokensUsed: number;
    costUsd: number;
    durationMs: number;
  };
  entities: {
    diagnoses: Array<{ term: string; count: number; meshId?: string }>;
    procedures: Array<{ term: string; count: number; meshId?: string }>;
    medications: Array<{ term: string; count: number; rxcui?: string }>;
    symptoms: Array<{ term: string; count: number }>;
  };
  extractions: Array<{
    rowIndex: number;
    columnName: string;
    noteType: string;
    confidence: number;
    entities: Record<string, unknown>;
  }>;
  artifactPaths: {
    jsonl: string;
    parquet?: string;
    manifest: string;
  };
}

export type JobStatus = 'idle' | 'uploading' | 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled';

export interface UseSpreadsheetParseReturn {
  jobId: string | null;
  status: JobStatus;
  progress: ExtractionProgress | null;
  results: ExtractionResult | null;
  error: string | null;
  isLoading: boolean;
  uploadFile: (file: File) => Promise<string>;
  startParsing: (request: SpreadsheetParseRequest) => Promise<void>;
  cancelJob: () => Promise<void>;
  reset: () => void;
}

const API_BASE = '/api/extraction/spreadsheet';
const POLL_INTERVAL = 2000; // 2 seconds

export function useSpreadsheetParse(): UseSpreadsheetParseReturn {
  const [jobId, setJobId] = useState<string | null>(null);
  const [status, setStatus] = useState<JobStatus>('idle');
  const [progress, setProgress] = useState<ExtractionProgress | null>(null);
  const [results, setResults] = useState<ExtractionResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  // Clean up polling on unmount
  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, []);
  
  // Upload file to artifact storage
  const uploadFile = useCallback(async (file: File): Promise<string> => {
    setStatus('uploading');
    setError(null);
    
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      const response = await fetch('/api/artifacts/upload', {
        method: 'POST',
        body: formData,
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Upload failed: ${response.statusText}`);
      }
      
      const data = await response.json();
      return data.artifactPath;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Upload failed';
      setError(message);
      setStatus('failed');
      throw err;
    }
  }, []);
  
  // Poll for job status
  const pollStatus = useCallback(async (id: string) => {
    try {
      const response = await fetch(`${API_BASE}/status/${id}`);
      
      if (!response.ok) {
        throw new Error(`Status check failed: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      setProgress(data.progress);
      
      if (data.status === 'completed') {
        setStatus('completed');
        // Fetch results
        const resultsResponse = await fetch(`${API_BASE}/results/${id}`);
        if (resultsResponse.ok) {
          const resultsData = await resultsResponse.json();
          setResults(resultsData);
        }
        // Stop polling
        if (pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current);
          pollIntervalRef.current = null;
        }
      } else if (data.status === 'failed') {
        setStatus('failed');
        setError(data.error || 'Extraction failed');
        if (pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current);
          pollIntervalRef.current = null;
        }
      } else if (data.status === 'cancelled') {
        setStatus('cancelled');
        if (pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current);
          pollIntervalRef.current = null;
        }
      }
    } catch (err) {
      console.error('Status poll error:', err);
      // Don't stop polling on transient errors
    }
  }, []);
  
  // Start parsing job
  const startParsing = useCallback(async (request: SpreadsheetParseRequest): Promise<void> => {
    setStatus('queued');
    setError(null);
    setProgress(null);
    setResults(null);
    
    try {
      const response = await fetch(`${API_BASE}/parse`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Job submission failed: ${response.statusText}`);
      }
      
      const data = await response.json();
      setJobId(data.jobId);
      setStatus('processing');
      
      // Start polling
      pollIntervalRef.current = setInterval(() => {
        pollStatus(data.jobId);
      }, POLL_INTERVAL);
      
      // Initial poll
      pollStatus(data.jobId);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to start parsing';
      setError(message);
      setStatus('failed');
      throw err;
    }
  }, [pollStatus]);
  
  // Cancel job
  const cancelJob = useCallback(async (): Promise<void> => {
    if (!jobId) return;
    
    try {
      const response = await fetch(`${API_BASE}/cancel/${jobId}`, {
        method: 'POST',
      });
      
      if (!response.ok) {
        throw new Error(`Cancel failed: ${response.statusText}`);
      }
      
      setStatus('cancelled');
      
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    } catch (err) {
      console.error('Cancel error:', err);
      throw err;
    }
  }, [jobId]);
  
  // Reset state
  const reset = useCallback(() => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
    
    setJobId(null);
    setStatus('idle');
    setProgress(null);
    setResults(null);
    setError(null);
  }, []);
  
  const isLoading = status === 'uploading' || status === 'queued' || status === 'processing';
  
  return {
    jobId,
    status,
    progress,
    results,
    error,
    isLoading,
    uploadFile,
    startParsing,
    cancelJob,
    reset,
  };
}

export default useSpreadsheetParse;
