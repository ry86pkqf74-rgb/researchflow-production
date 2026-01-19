/**
 * AI Co-drafter Sidebar
 *
 * Query-based AI assistant for expanding, clarifying, or
 * suggesting improvements to selected text.
 */

import React, { useState, useCallback } from 'react';
import type { ManuscriptSectionKey } from '../../../../shared/contracts/manuscripts';

interface AICodrawerProps {
  manuscriptId: string;
  sectionKey: ManuscriptSectionKey;
  selectedText?: string;
  onInsertSuggestion: (text: string) => void;
  onClose: () => void;
}

const API_BASE = import.meta.env.VITE_API_URL || '/api';

type Action = 'expand' | 'clarify' | 'simplify' | 'cite' | 'custom';

const ACTIONS: { id: Action; label: string; icon: string; description: string }[] = [
  { id: 'expand', label: 'Expand', icon: '📝', description: 'Add more detail and context' },
  { id: 'clarify', label: 'Clarify', icon: '💡', description: 'Make the text clearer' },
  { id: 'simplify', label: 'Simplify', icon: '✂️', description: 'Use simpler language' },
  { id: 'cite', label: 'Add Citation', icon: '📚', description: 'Suggest citations needed' },
  { id: 'custom', label: 'Custom', icon: '✨', description: 'Custom instruction' },
];

export function AICodrawer({
  manuscriptId,
  sectionKey,
  selectedText,
  onInsertSuggestion,
  onClose,
}: AICodrawerProps) {
  const [action, setAction] = useState<Action>('expand');
  const [customInstruction, setCustomInstruction] = useState('');
  const [loading, setLoading] = useState(false);
  const [suggestion, setSuggestion] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = useCallback(async () => {
    if (!selectedText && action !== 'custom') {
      setError('Please select text in the editor first');
      return;
    }

    setLoading(true);
    setError(null);
    setSuggestion(null);

    try {
      const response = await fetch(`${API_BASE}/manuscripts/${manuscriptId}/codraft`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sectionKey,
          instruction: action === 'custom' ? customInstruction : action,
          selectedText: selectedText || '',
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate suggestion');
      }

      const data = await response.json();

      // Poll for job completion
      const jobId = data.jobId;
      const result = await pollJobStatus(jobId);

      if (result.status === 'SUCCEEDED') {
        setSuggestion(result.contentMd || result.suggestion);
      } else if (result.status === 'BLOCKED') {
        setError('Request blocked: PHI detected in content');
      } else {
        setError(result.error || 'Generation failed');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [manuscriptId, sectionKey, action, customInstruction, selectedText]);

  const pollJobStatus = async (jobId: string, maxAttempts = 30): Promise<any> => {
    for (let i = 0; i < maxAttempts; i++) {
      await new Promise((resolve) => setTimeout(resolve, 1000));

      const response = await fetch(`${API_BASE}/jobs/${jobId}`);
      const data = await response.json();

      if (data.status !== 'QUEUED' && data.status !== 'RUNNING') {
        return data;
      }
    }

    throw new Error('Request timed out');
  };

  const handleInsert = () => {
    if (suggestion) {
      onInsertSuggestion(suggestion);
      setSuggestion(null);
    }
  };

  return (
    <div className="fixed right-0 top-0 h-full w-96 bg-white shadow-xl border-l flex flex-col z-40">
      {/* Header */}
      <div className="p-4 border-b flex items-center justify-between">
        <h2 className="font-semibold flex items-center gap-2">
          <span>🤖</span> AI Co-drafter
        </h2>
        <button
          onClick={onClose}
          className="text-gray-500 hover:text-gray-700 text-xl"
        >
          &times;
        </button>
      </div>

      {/* Selected text preview */}
      {selectedText && (
        <div className="p-4 border-b bg-gray-50">
          <div className="text-xs text-gray-500 mb-1">Selected text:</div>
          <div className="text-sm italic line-clamp-3">{selectedText}</div>
        </div>
      )}

      {/* Action selection */}
      <div className="p-4 border-b">
        <div className="text-sm font-medium mb-2">What would you like to do?</div>
        <div className="grid grid-cols-2 gap-2">
          {ACTIONS.map((a) => (
            <button
              key={a.id}
              onClick={() => setAction(a.id)}
              className={`p-2 rounded text-left text-sm ${
                action === a.id
                  ? 'bg-blue-100 border-blue-500 border'
                  : 'bg-gray-50 border border-gray-200 hover:bg-gray-100'
              }`}
            >
              <div className="font-medium">
                {a.icon} {a.label}
              </div>
              <div className="text-xs text-gray-500">{a.description}</div>
            </button>
          ))}
        </div>

        {action === 'custom' && (
          <textarea
            value={customInstruction}
            onChange={(e) => setCustomInstruction(e.target.value)}
            placeholder="Enter your custom instruction..."
            className="w-full mt-3 p-2 border rounded text-sm h-20 resize-none"
          />
        )}
      </div>

      {/* Generate button */}
      <div className="p-4">
        <button
          onClick={handleGenerate}
          disabled={loading || (action === 'custom' && !customInstruction)}
          className="w-full py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <span className="animate-spin">⏳</span> Generating...
            </>
          ) : (
            <>✨ Generate Suggestion</>
          )}
        </button>
      </div>

      {/* Error message */}
      {error && (
        <div className="px-4 pb-4">
          <div className="p-3 bg-red-50 border border-red-200 rounded text-sm text-red-600">
            {error}
          </div>
        </div>
      )}

      {/* Suggestion result */}
      {suggestion && (
        <div className="flex-1 overflow-auto p-4 border-t">
          <div className="text-sm font-medium mb-2">Suggestion:</div>
          <div className="p-3 bg-green-50 border border-green-200 rounded text-sm whitespace-pre-wrap">
            {suggestion}
          </div>

          <div className="mt-4 flex gap-2">
            <button
              onClick={handleInsert}
              className="flex-1 py-2 bg-green-600 text-white rounded hover:bg-green-700"
            >
              Insert
            </button>
            <button
              onClick={() => setSuggestion(null)}
              className="px-4 py-2 border rounded hover:bg-gray-50"
            >
              Discard
            </button>
          </div>
        </div>
      )}

      {/* Section context */}
      <div className="p-4 border-t bg-gray-50 text-xs text-gray-500">
        Section: {sectionKey}
      </div>
    </div>
  );
}

export default AICodrawer;
