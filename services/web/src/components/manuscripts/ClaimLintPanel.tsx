/**
 * Claim Lint Panel
 *
 * Highlights unsubstantiated claims and suggests evidence/citations.
 * Uses claim verifier service from worker.
 */

import React, { useEffect, useState, useCallback } from 'react';
import type { ClaimCheckFinding, ManuscriptSectionKey } from '../../../../shared/contracts/manuscripts';

interface ClaimLintPanelProps {
  manuscriptId: string;
  onHighlightClaim?: (finding: ClaimCheckFinding) => void;
}

const API_BASE = import.meta.env.VITE_API_URL || '/api';

const SEVERITY_STYLES = {
  high: 'bg-red-50 border-red-200 text-red-800',
  medium: 'bg-yellow-50 border-yellow-200 text-yellow-800',
  low: 'bg-blue-50 border-blue-200 text-blue-800',
};

const SEVERITY_ICONS = {
  high: '🔴',
  medium: '🟡',
  low: '🔵',
};

export function ClaimLintPanel({ manuscriptId, onHighlightClaim }: ClaimLintPanelProps) {
  const [findings, setFindings] = useState<ClaimCheckFinding[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState({ total: 0, verified: 0, unsubstantiated: 0 });
  const [filterSeverity, setFilterSeverity] = useState<string>('all');

  const runVerification = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE}/manuscripts/${manuscriptId}/claims/verify`, {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Failed to verify claims');
      }

      const data = await response.json();
      setFindings(data.findings || []);
      setStats({
        total: data.totalClaims || 0,
        verified: data.verifiedClaims || 0,
        unsubstantiated: data.unsubstantiatedClaims || 0,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [manuscriptId]);

  useEffect(() => {
    runVerification();
  }, [runVerification]);

  const filteredFindings = findings.filter(
    (f) => filterSeverity === 'all' || f.severity === filterSeverity
  );

  const groupedBySection = filteredFindings.reduce((acc, finding) => {
    const section = finding.sectionKey;
    if (!acc[section]) acc[section] = [];
    acc[section].push(finding);
    return acc;
  }, {} as Record<ManuscriptSectionKey, ClaimCheckFinding[]>);

  return (
    <div className="h-full flex flex-col bg-white border-l">
      {/* Header */}
      <div className="p-4 border-b">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold">Claim Verification</h2>
          <button
            onClick={runVerification}
            disabled={loading}
            className="px-3 py-1 text-sm bg-blue-50 text-blue-600 rounded hover:bg-blue-100 disabled:opacity-50"
          >
            {loading ? 'Checking...' : 'Re-check'}
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-2 text-center text-sm">
          <div className="p-2 bg-gray-50 rounded">
            <div className="font-semibold">{stats.total}</div>
            <div className="text-gray-500">Claims</div>
          </div>
          <div className="p-2 bg-green-50 rounded">
            <div className="font-semibold text-green-600">{stats.verified}</div>
            <div className="text-gray-500">Verified</div>
          </div>
          <div className="p-2 bg-yellow-50 rounded">
            <div className="font-semibold text-yellow-600">{stats.unsubstantiated}</div>
            <div className="text-gray-500">Unverified</div>
          </div>
        </div>
      </div>

      {/* Filter */}
      <div className="p-2 border-b flex gap-1">
        {['all', 'high', 'medium', 'low'].map((sev) => (
          <button
            key={sev}
            onClick={() => setFilterSeverity(sev)}
            className={`px-2 py-1 text-xs rounded capitalize ${
              filterSeverity === sev
                ? 'bg-gray-800 text-white'
                : 'bg-gray-100 hover:bg-gray-200'
            }`}
          >
            {sev === 'all' ? 'All' : SEVERITY_ICONS[sev as keyof typeof SEVERITY_ICONS]} {sev}
          </button>
        ))}
      </div>

      {/* Findings list */}
      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="p-4 text-center text-gray-500">
            Analyzing claims...
          </div>
        ) : error ? (
          <div className="p-4 text-center text-red-500">{error}</div>
        ) : filteredFindings.length === 0 ? (
          <div className="p-4 text-center text-gray-500">
            {findings.length === 0
              ? 'No claims to verify. Add content to your manuscript.'
              : 'No findings match the current filter.'}
          </div>
        ) : (
          <div className="p-2">
            {Object.entries(groupedBySection).map(([section, sectionFindings]) => (
              <div key={section} className="mb-4">
                <div className="text-xs font-semibold text-gray-500 uppercase px-2 py-1">
                  {section}
                </div>
                {sectionFindings.map((finding, idx) => (
                  <button
                    key={idx}
                    onClick={() => onHighlightClaim?.(finding)}
                    className={`w-full text-left p-3 mb-2 rounded border ${
                      SEVERITY_STYLES[finding.severity]
                    } hover:shadow-sm transition-shadow`}
                  >
                    <div className="flex items-start gap-2">
                      <span>{SEVERITY_ICONS[finding.severity]}</span>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm line-clamp-2">{finding.sentence}</div>
                        <div className="text-xs mt-1 opacity-75">{finding.note}</div>
                        {finding.evidenceRefs.length > 0 && (
                          <div className="text-xs mt-1">
                            Suggested refs: {finding.evidenceRefs.join(', ')}
                          </div>
                        )}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default ClaimLintPanel;
