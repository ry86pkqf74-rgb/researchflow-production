/**
 * Manuscripts Dashboard
 *
 * Displays progress bars, word counts, and validation status
 * for all manuscript sections.
 */

import React, { useEffect, useState } from 'react';
import { Link } from 'wouter';
import type { Manuscript, ManuscriptSectionKey } from '../../../../shared/contracts/manuscripts';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

interface ManuscriptWithProgress extends Manuscript {
  wordCounts: Record<ManuscriptSectionKey, number>;
  completedSections: number;
  totalSections: number;
  validationIssues: number;
}

const IMRAD_SECTIONS: ManuscriptSectionKey[] = [
  'TITLE',
  'ABSTRACT',
  'INTRODUCTION',
  'METHODS',
  'RESULTS',
  'DISCUSSION',
  'REFERENCES',
];

const SECTION_TARGETS: Partial<Record<ManuscriptSectionKey, number>> = {
  TITLE: 20,
  ABSTRACT: 300,
  INTRODUCTION: 600,
  METHODS: 1000,
  RESULTS: 1000,
  DISCUSSION: 1200,
};

export function ManuscriptsDashboard() {
  const [manuscripts, setManuscripts] = useState<ManuscriptWithProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchManuscripts();
  }, []);

  const fetchManuscripts = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE}/manuscripts`);
      if (!response.ok) throw new Error('Failed to fetch manuscripts');

      const data = await response.json();

      // Fetch additional data for each manuscript
      const enriched = await Promise.all(
        data.manuscripts.map(async (m: Manuscript) => {
          try {
            const [wordCountsRes, validationRes] = await Promise.all([
              fetch(`${API_BASE}/manuscripts/${m.id}/word-counts`),
              fetch(`${API_BASE}/manuscripts/${m.id}/validate`).catch(() => null),
            ]);

            const wordCounts = wordCountsRes.ok
              ? (await wordCountsRes.json()).wordCounts
              : {};

            const validation = validationRes?.ok
              ? await validationRes.json()
              : { issues: [] };

            const completedSections = IMRAD_SECTIONS.filter(
              (s) => (wordCounts[s] || 0) > 50
            ).length;

            return {
              ...m,
              wordCounts,
              completedSections,
              totalSections: IMRAD_SECTIONS.length,
              validationIssues: validation.issues?.length || 0,
            };
          } catch {
            return {
              ...m,
              wordCounts: {},
              completedSections: 0,
              totalSections: IMRAD_SECTIONS.length,
              validationIssues: 0,
            };
          }
        })
      );

      setManuscripts(enriched);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'DRAFT':
        return 'bg-yellow-100 text-yellow-800';
      case 'IN_REVIEW':
        return 'bg-blue-100 text-blue-800';
      case 'APPROVED':
        return 'bg-green-100 text-green-800';
      case 'EXPORTED':
        return 'bg-purple-100 text-purple-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getModeColor = (mode: string) => {
    switch (mode) {
      case 'DEMO':
        return 'bg-orange-100 text-orange-800';
      case 'LIVE':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div className="p-8 text-center text-gray-500">
        Loading manuscripts...
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 text-center text-red-500">
        Error: {error}
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Manuscripts</h1>
        <button className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
          + New Manuscript
        </button>
      </div>

      {manuscripts.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <div className="text-4xl mb-4">📝</div>
          <div className="text-gray-600">No manuscripts yet</div>
          <div className="text-sm text-gray-500 mt-2">
            Create your first manuscript to get started
          </div>
        </div>
      ) : (
        <div className="grid gap-4">
          {manuscripts.map((manuscript) => (
            <Link key={manuscript.id} href={`/manuscripts/${manuscript.id}`}>
              <div className="p-6 bg-white border rounded-lg shadow-sm hover:shadow-md transition-shadow cursor-pointer">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h2 className="text-lg font-semibold mb-1">
                      {manuscript.title || 'Untitled Manuscript'}
                    </h2>
                    <div className="flex items-center gap-2 mb-4">
                      <span
                        className={`px-2 py-0.5 text-xs rounded ${getStatusColor(
                          manuscript.status
                        )}`}
                      >
                        {manuscript.status}
                      </span>
                      <span
                        className={`px-2 py-0.5 text-xs rounded ${getModeColor(
                          manuscript.mode
                        )}`}
                      >
                        {manuscript.mode}
                      </span>
                      {manuscript.validationIssues > 0 && (
                        <span className="px-2 py-0.5 text-xs rounded bg-red-100 text-red-800">
                          {manuscript.validationIssues} issues
                        </span>
                      )}
                    </div>

                    {/* Progress bar */}
                    <div className="mb-3">
                      <div className="flex items-center justify-between text-sm text-gray-600 mb-1">
                        <span>Section Progress</span>
                        <span>
                          {manuscript.completedSections}/{manuscript.totalSections}
                        </span>
                      </div>
                      <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-blue-500 transition-all"
                          style={{
                            width: `${
                              (manuscript.completedSections /
                                manuscript.totalSections) *
                              100
                            }%`,
                          }}
                        />
                      </div>
                    </div>

                    {/* Section word counts */}
                    <div className="flex flex-wrap gap-2">
                      {IMRAD_SECTIONS.map((section) => {
                        const count = manuscript.wordCounts[section] || 0;
                        const target = SECTION_TARGETS[section] || 500;
                        const progress = Math.min((count / target) * 100, 100);

                        return (
                          <div
                            key={section}
                            className="text-xs"
                            title={`${count} / ${target} words`}
                          >
                            <div className="flex items-center gap-1">
                              <div
                                className={`w-2 h-2 rounded-full ${
                                  progress >= 80
                                    ? 'bg-green-500'
                                    : progress >= 30
                                    ? 'bg-yellow-500'
                                    : 'bg-gray-300'
                                }`}
                              />
                              <span className="text-gray-600">{section}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Date info */}
                  <div className="text-right text-sm text-gray-500">
                    <div>
                      Updated{' '}
                      {new Date(manuscript.updatedAt).toLocaleDateString()}
                    </div>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export default ManuscriptsDashboard;
