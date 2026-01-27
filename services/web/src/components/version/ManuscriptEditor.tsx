// ============================================
// ResearchFlow Manuscript Editor
// ============================================
// Text editor with Git-based version control and history sidebar

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { versionApi, CommitInfo, DiffResult } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';

interface ManuscriptEditorProps {
  projectId: string;
  filePath: string;
  onSave?: (commit: CommitInfo) => void;
}

export function ManuscriptEditor({ projectId, filePath, onSave }: ManuscriptEditorProps) {
  const { user, mode } = useAuth();

  const [content, setContent] = useState('');
  const [originalContent, setOriginalContent] = useState('');
  const [commitMessage, setCommitMessage] = useState('');
  const [history, setHistory] = useState<CommitInfo[]>([]);
  const [selectedCommit, setSelectedCommit] = useState<string | null>(null);
  const [diff, setDiff] = useState<DiffResult | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(true);

  const hasChanges = content !== originalContent;

  // Load file content and history
  const loadFile = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const [fileResponse, historyResponse] = await Promise.all([
        versionApi.getFile(projectId, filePath),
        versionApi.getHistory(projectId, filePath, 20),
      ]);

      if (fileResponse.error) {
        // File might not exist yet, that's ok
        if (fileResponse.status !== 404) {
          setError(fileResponse.error.message);
        }
        setContent('');
        setOriginalContent('');
      } else if (fileResponse.data) {
        setContent(fileResponse.data.content);
        setOriginalContent(fileResponse.data.content);
      }

      if (historyResponse.data) {
        setHistory(historyResponse.data);
      }
    } catch (err) {
      setError('Failed to load file');
    } finally {
      setIsLoading(false);
    }
  }, [projectId, filePath]);

  useEffect(() => {
    loadFile();
  }, [loadFile]);

  // Save file with commit
  const handleSave = async () => {
    if (!commitMessage.trim()) {
      setError('Please enter a commit message');
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const response = await versionApi.saveFile(projectId, {
        file_path: filePath,
        content,
        author_name: user?.name || (mode === 'demo' ? 'Demo User' : 'Unknown'),
        author_email: user?.email || (mode === 'demo' ? 'demo@researchflow.local' : 'unknown@researchflow.local'),
        message: commitMessage,
      });

      if (response.error) {
        setError(response.error.message);
        return;
      }

      if (response.data) {
        setOriginalContent(content);
        setCommitMessage('');
        setHistory(prev => [response.data!, ...prev]);
        onSave?.(response.data);
      }
    } catch {
      setError('Failed to save file');
    } finally {
      setIsSaving(false);
    }
  };

  // View a specific version
  const viewVersion = async (commitId: string) => {
    setSelectedCommit(commitId);

    try {
      const response = await versionApi.getFile(projectId, filePath, commitId);
      if (response.data) {
        setContent(response.data.content);
      }
    } catch {
      setError('Failed to load version');
    }
  };

  // View diff between versions
  const viewDiff = async (commitOld: string, commitNew: string) => {
    try {
      const response = await versionApi.getDiff(projectId, filePath, commitOld, commitNew);
      if (response.data) {
        setDiff(response.data);
      }
    } catch {
      setError('Failed to load diff');
    }
  };

  // Restore current view
  const restoreCurrentVersion = () => {
    setSelectedCommit(null);
    setContent(originalContent);
    setDiff(null);
  };

  // Restore to a previous version
  const restoreVersion = async (commitId: string) => {
    if (!confirm('Are you sure you want to restore this version? This will create a new commit.')) {
      return;
    }

    try {
      const response = await versionApi.restoreVersion(projectId, {
        file_path: filePath,
        commit_id: commitId,
        author_name: user?.name || (mode === 'demo' ? 'Demo User' : 'Unknown'),
        author_email: user?.email || (mode === 'demo' ? 'demo@researchflow.local' : 'unknown@researchflow.local'),
        message: `Restore ${filePath} to version ${commitId.substring(0, 7)}`,
      });

      if (response.data) {
        await loadFile();
        setSelectedCommit(null);
      }
    } catch {
      setError('Failed to restore version');
    }
  };

  const formatDate = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="flex h-full bg-white rounded-lg shadow overflow-hidden">
      {/* Main Editor */}
      <div className="flex-1 flex flex-col">
        {/* Toolbar */}
        <div className="flex items-center justify-between px-4 py-2 bg-gray-50 border-b">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-600">{filePath}</span>
            {selectedCommit && (
              <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded">
                Viewing: {selectedCommit.substring(0, 7)}
              </span>
            )}
            {hasChanges && !selectedCommit && (
              <span className="text-xs bg-orange-100 text-orange-800 px-2 py-1 rounded">
                Unsaved changes
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {selectedCommit ? (
              <>
                <button
                  onClick={() => restoreVersion(selectedCommit)}
                  className="px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700"
                >
                  Restore This Version
                </button>
                <button
                  onClick={restoreCurrentVersion}
                  className="px-3 py-1 text-sm bg-gray-600 text-white rounded hover:bg-gray-700"
                >
                  Back to Latest
                </button>
              </>
            ) : (
              <button
                onClick={() => setShowHistory(!showHistory)}
                className="px-3 py-1 text-sm border rounded hover:bg-gray-100"
              >
                {showHistory ? 'Hide' : 'Show'} History
              </button>
            )}
          </div>
        </div>

        {/* Editor Area */}
        <div className="flex-1 p-4">
          {diff ? (
            <div className="h-full overflow-auto">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-600">
                  Diff: {diff.commit_old.substring(0, 7)} → {diff.commit_new.substring(0, 7)}
                </span>
                <button
                  onClick={() => setDiff(null)}
                  className="text-sm text-blue-600 hover:underline"
                >
                  Close Diff
                </button>
              </div>
              <pre className="p-4 bg-gray-50 rounded text-sm font-mono overflow-auto whitespace-pre-wrap">
                {diff.diff}
              </pre>
              <div className="mt-2 text-sm text-gray-600">
                <span className="text-green-600">+{diff.additions}</span>
                {' / '}
                <span className="text-red-600">-{diff.deletions}</span>
              </div>
            </div>
          ) : (
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              disabled={!!selectedCommit}
              className="w-full h-full p-4 border rounded font-mono text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50"
              placeholder="Start writing your manuscript..."
            />
          )}
        </div>

        {/* Save Panel */}
        {!selectedCommit && !diff && (
          <div className="px-4 py-3 bg-gray-50 border-t">
            {error && (
              <div className="mb-2 text-sm text-red-600">{error}</div>
            )}
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={commitMessage}
                onChange={(e) => setCommitMessage(e.target.value)}
                placeholder="Describe your changes..."
                className="flex-1 px-3 py-2 border rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && hasChanges && commitMessage.trim()) {
                    handleSave();
                  }
                }}
              />
              <button
                onClick={handleSave}
                disabled={!hasChanges || isSaving || !commitMessage.trim()}
                className="px-4 py-2 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                {isSaving ? 'Saving...' : 'Save & Commit'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* History Sidebar */}
      {showHistory && (
        <div className="w-80 border-l bg-gray-50 flex flex-col">
          <div className="px-4 py-3 border-b bg-white">
            <h3 className="font-medium text-gray-800">Version History</h3>
            <p className="text-xs text-gray-500 mt-1">{history.length} commits</p>
          </div>
          <div className="flex-1 overflow-y-auto">
            {history.length === 0 ? (
              <div className="p-4 text-sm text-gray-500 text-center">
                No commits yet
              </div>
            ) : (
              <div className="divide-y">
                {history.map((commit, index) => (
                  <div
                    key={commit.commit_id}
                    className={`p-3 cursor-pointer hover:bg-white transition-colors ${
                      selectedCommit === commit.commit_id ? 'bg-blue-50 border-l-2 border-blue-500' : ''
                    }`}
                    onClick={() => viewVersion(commit.commit_id)}
                  >
                    <div className="flex items-start justify-between">
                      <span className="font-mono text-xs text-gray-500">
                        {commit.commit_id.substring(0, 7)}
                      </span>
                      <span className="text-xs text-gray-400">
                        {formatDate(commit.timestamp)}
                      </span>
                    </div>
                    <p className="text-sm text-gray-800 mt-1 line-clamp-2">
                      {commit.message}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      by {commit.author_name}
                    </p>
                    {index < history.length - 1 && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          viewDiff(history[index + 1].commit_id, commit.commit_id);
                        }}
                        className="text-xs text-blue-600 hover:underline mt-2"
                      >
                        View diff from previous
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default ManuscriptEditor;
