/**
 * Artifact Picker Modal
 *
 * Allows users to select figures, tables, and other artifacts
 * to embed in the manuscript editor.
 */

import React, { useEffect, useState } from 'react';
import type { ManuscriptArtifact } from '../../../../shared/contracts/artifacts';

interface ArtifactPickerProps {
  manuscriptId: string;
  onSelect: (artifact: { id: string; kind: string; caption?: string }) => void;
  onClose: () => void;
  allowedKinds?: string[];
}

const API_BASE = import.meta.env.VITE_API_URL || '/api';

export function ArtifactPicker({
  manuscriptId,
  onSelect,
  onClose,
  allowedKinds = ['figure', 'table', 'supplement'],
}: ArtifactPickerProps) {
  const [artifacts, setArtifacts] = useState<ManuscriptArtifact[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedKind, setSelectedKind] = useState<string>('all');

  useEffect(() => {
    fetchArtifacts();
  }, [manuscriptId]);

  const fetchArtifacts = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE}/manuscripts/${manuscriptId}/artifacts`);

      if (!response.ok) {
        throw new Error('Failed to fetch artifacts');
      }

      const data = await response.json();
      setArtifacts(data.artifacts || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const filteredArtifacts = artifacts.filter((a) => {
    const kindMatch = selectedKind === 'all' || a.kind === selectedKind;
    const allowedMatch = allowedKinds.includes(a.kind);
    return kindMatch && allowedMatch;
  });

  const getArtifactIcon = (kind: string) => {
    switch (kind) {
      case 'figure':
        return '📊';
      case 'table':
        return '📋';
      case 'supplement':
        return '📎';
      case 'data':
        return '💾';
      default:
        return '📄';
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="p-4 border-b flex items-center justify-between">
          <h2 className="text-lg font-semibold">Insert Artifact</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-2xl"
          >
            &times;
          </button>
        </div>

        {/* Filter tabs */}
        <div className="p-2 border-b flex gap-2">
          <button
            className={`px-3 py-1 rounded ${
              selectedKind === 'all' ? 'bg-blue-500 text-white' : 'bg-gray-100'
            }`}
            onClick={() => setSelectedKind('all')}
          >
            All
          </button>
          {allowedKinds.map((kind) => (
            <button
              key={kind}
              className={`px-3 py-1 rounded capitalize ${
                selectedKind === kind ? 'bg-blue-500 text-white' : 'bg-gray-100'
              }`}
              onClick={() => setSelectedKind(kind)}
            >
              {getArtifactIcon(kind)} {kind}s
            </button>
          ))}
        </div>

        {/* Artifact list */}
        <div className="flex-1 overflow-auto p-4">
          {loading ? (
            <div className="text-center py-8 text-gray-500">Loading artifacts...</div>
          ) : error ? (
            <div className="text-center py-8 text-red-500">{error}</div>
          ) : filteredArtifacts.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No artifacts found. Upload figures or tables first.
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              {filteredArtifacts.map((artifact) => (
                <button
                  key={artifact.id}
                  onClick={() =>
                    onSelect({
                      id: artifact.id,
                      kind: artifact.kind,
                      caption: artifact.caption,
                    })
                  }
                  className="p-4 border rounded-lg hover:border-blue-500 hover:bg-blue-50 text-left transition-colors"
                >
                  <div className="flex items-start gap-3">
                    <span className="text-3xl">{getArtifactIcon(artifact.kind)}</span>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{artifact.name}</div>
                      <div className="text-sm text-gray-500 capitalize">
                        {artifact.kind} • {artifact.format}
                      </div>
                      {artifact.caption && (
                        <div className="text-sm text-gray-600 mt-1 line-clamp-2">
                          {artifact.caption}
                        </div>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

export default ArtifactPicker;
