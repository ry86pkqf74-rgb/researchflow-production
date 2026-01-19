/**
 * Audit Trail Component
 *
 * Displays timeline of manuscript events: edits, exports,
 * external calls, approvals, etc.
 */

import React, { useEffect, useState, useCallback } from 'react';
import type { ManuscriptAuditEvent, AuditEventType } from '../../../../shared/contracts/audit';

interface AuditTrailProps {
  manuscriptId: string;
}

const API_BASE = import.meta.env.VITE_API_URL || '/api';

const EVENT_ICONS: Record<AuditEventType, string> = {
  MANUSCRIPT_CREATED: '📄',
  SECTION_GENERATED: '✨',
  SECTION_EDITED: '✏️',
  SECTION_ROLLBACK: '↩️',
  EXPORT_REQUESTED: '📤',
  EXPORT_COMPLETED: '✅',
  PHI_BLOCKED: '🛑',
  PHI_SCAN_PASSED: '🔒',
  CLAIM_VERIFICATION: '🔍',
  PEER_REVIEW_SIMULATED: '👥',
  APPROVAL_REQUESTED: '🙋',
  APPROVAL_GRANTED: '✅',
  APPROVAL_DENIED: '❌',
  EXTERNAL_API_CALL: '🌐',
  STYLE_CHECK: '📝',
  PLAGIARISM_CHECK: '🔎',
  DOI_MINTED: '🔗',
  ORCID_FETCHED: '👤',
  TRANSLATION_REQUESTED: '🌍',
  FEEDBACK_SUBMITTED: '💬',
};

const EVENT_COLORS: Partial<Record<AuditEventType, string>> = {
  PHI_BLOCKED: 'border-red-300 bg-red-50',
  APPROVAL_DENIED: 'border-red-300 bg-red-50',
  APPROVAL_GRANTED: 'border-green-300 bg-green-50',
  EXPORT_COMPLETED: 'border-green-300 bg-green-50',
};

export function AuditTrail({ manuscriptId }: AuditTrailProps) {
  const [events, setEvents] = useState<ManuscriptAuditEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const limit = 50;

  const fetchEvents = useCallback(async (newOffset = 0) => {
    try {
      setLoading(true);
      const response = await fetch(
        `${API_BASE}/manuscripts/${manuscriptId}/audit?limit=${limit}&offset=${newOffset}`
      );

      if (!response.ok) {
        throw new Error('Failed to fetch audit trail');
      }

      const data = await response.json();
      setEvents(newOffset === 0 ? data.events : [...events, ...data.events]);
      setTotal(data.total);
      setOffset(newOffset);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [manuscriptId, events]);

  useEffect(() => {
    fetchEvents(0);
  }, [manuscriptId]);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return {
      date: date.toLocaleDateString(),
      time: date.toLocaleTimeString(),
    };
  };

  const formatEventDetails = (event: ManuscriptAuditEvent): string => {
    const details = event.detailsJson;
    const parts: string[] = [];

    if (details.sectionKey) parts.push(`Section: ${details.sectionKey}`);
    if (details.format) parts.push(`Format: ${details.format}`);
    if (details.externalService) parts.push(`Service: ${details.externalService}`);
    if (details.reason) parts.push(`Reason: ${details.reason}`);

    return parts.join(' • ');
  };

  const groupedByDate = events.reduce((acc, event) => {
    const { date } = formatDate(event.createdAt);
    if (!acc[date]) acc[date] = [];
    acc[date].push(event);
    return acc;
  }, {} as Record<string, ManuscriptAuditEvent[]>);

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Header */}
      <div className="p-4 border-b">
        <h2 className="font-semibold">Audit Trail</h2>
        <div className="text-sm text-gray-500">{total} events recorded</div>
      </div>

      {/* Timeline */}
      <div className="flex-1 overflow-auto p-4">
        {loading && events.length === 0 ? (
          <div className="text-center text-gray-500">Loading audit trail...</div>
        ) : error ? (
          <div className="text-center text-red-500">{error}</div>
        ) : events.length === 0 ? (
          <div className="text-center text-gray-500">No events recorded yet</div>
        ) : (
          <div className="relative">
            {/* Timeline line */}
            <div className="absolute left-4 top-0 bottom-0 w-px bg-gray-200" />

            {Object.entries(groupedByDate).map(([date, dateEvents]) => (
              <div key={date} className="mb-6">
                {/* Date header */}
                <div className="sticky top-0 bg-white py-2 z-10">
                  <div className="text-sm font-medium text-gray-600 ml-10">{date}</div>
                </div>

                {/* Events for this date */}
                {dateEvents.map((event) => {
                  const { time } = formatDate(event.createdAt);
                  const colorClass = EVENT_COLORS[event.eventType] || 'border-gray-200 bg-gray-50';

                  return (
                    <div key={event.id} className="relative flex gap-4 mb-3">
                      {/* Icon */}
                      <div className="w-8 h-8 rounded-full bg-white border-2 border-gray-200 flex items-center justify-center z-10 text-sm">
                        {EVENT_ICONS[event.eventType] || '📋'}
                      </div>

                      {/* Event card */}
                      <div className={`flex-1 p-3 rounded border ${colorClass}`}>
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="font-medium text-sm">
                              {event.eventType.replace(/_/g, ' ')}
                            </div>
                            <div className="text-xs text-gray-500 mt-1">
                              {formatEventDetails(event)}
                            </div>
                          </div>
                          <div className="text-xs text-gray-400">{time}</div>
                        </div>

                        <div className="mt-2 text-xs text-gray-500">
                          By: {event.actor}
                        </div>

                        {/* Hash for integrity verification */}
                        <div className="mt-1 text-xs font-mono text-gray-300 truncate">
                          {event.currentHash.slice(0, 16)}...
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}

            {/* Load more button */}
            {events.length < total && (
              <div className="text-center mt-4">
                <button
                  onClick={() => fetchEvents(offset + limit)}
                  disabled={loading}
                  className="px-4 py-2 text-sm bg-gray-100 rounded hover:bg-gray-200 disabled:opacity-50"
                >
                  {loading ? 'Loading...' : 'Load more'}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default AuditTrail;
