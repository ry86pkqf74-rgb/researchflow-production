'use client';

/**
 * ChatAgentPanel Component
 *
 * Reusable chat panel for workflow-specific AI assistants.
 * Supports IRB, Analysis, and Manuscript agent types.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import type {
  ChatAgentPanelProps,
  ChatMessage,
  ChatAction,
  AgentType,
} from './types';
import * as chatApi from '@/lib/api/chat';

// Agent display configuration
const AGENT_CONFIG: Record<AgentType, { name: string; icon: string; color: string }> = {
  irb: { name: 'IRB Assistant', icon: '🏛️', color: 'blue' },
  analysis: { name: 'Analysis Assistant', icon: '📊', color: 'green' },
  manuscript: { name: 'Manuscript Assistant', icon: '📝', color: 'purple' },
};

/**
 * Main ChatAgentPanel component
 */
export function ChatAgentPanel({
  agentType,
  artifactType,
  artifactId,
  projectId,
  getClientContext,
  onActionExecuted,
  className = '',
  defaultOpen = true,
}: ChatAgentPanelProps) {
  // State
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [governanceWarning, setGovernanceWarning] = useState<string | null>(null);

  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Config for current agent
  const config = AGENT_CONFIG[agentType];

  // Check if feature is enabled
  const isEnabled = typeof window !== 'undefined' &&
    (process.env.NEXT_PUBLIC_ENABLE_CHAT_AGENTS === 'true' || true); // Default enabled

  // Initialize session and load messages
  useEffect(() => {
    if (!isEnabled || !isOpen) return;

    async function initSession() {
      try {
        const session = await chatApi.createOrGetSession(
          agentType,
          artifactType,
          artifactId,
          { projectId }
        );
        setSessionId(session.id);

        const existingMessages = await chatApi.getSessionMessages(session.id);
        setMessages(existingMessages);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to initialize chat');
      }
    }

    initSession();
  }, [agentType, artifactType, artifactId, projectId, isEnabled, isOpen]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Send message handler
  const handleSendMessage = useCallback(async () => {
    if (!inputValue.trim() || isLoading) return;

    const messageContent = inputValue.trim();
    setInputValue('');
    setIsLoading(true);
    setError(null);
    setGovernanceWarning(null);

    try {
      const context = getClientContext?.();
      const response = await chatApi.sendMessage(
        agentType,
        artifactType,
        artifactId,
        messageContent,
        context
      );

      if (!response.success) {
        setError(response.error?.message || 'Failed to send message');
        setInputValue(messageContent); // Restore input
        return;
      }

      // Update messages
      setMessages(prev => [...prev, response.userMessage, response.assistantMessage]);

      // Show governance warning if any
      if (response.governance.phiWarning) {
        setGovernanceWarning(response.governance.phiWarning);
      }

      // Update session ID if new
      if (response.session.id && !sessionId) {
        setSessionId(response.session.id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send message');
      setInputValue(messageContent); // Restore input
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  }, [inputValue, isLoading, agentType, artifactType, artifactId, getClientContext, sessionId]);

  // Action handlers
  const handleApproveAction = useCallback(async (actionId: string) => {
    try {
      const result = await chatApi.approveAction(actionId);
      if (result.success) {
        updateActionInMessages(actionId, result.action);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to approve action');
    }
  }, []);

  const handleRejectAction = useCallback(async (actionId: string) => {
    try {
      const result = await chatApi.rejectAction(actionId);
      if (result.success) {
        updateActionInMessages(actionId, result.action);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reject action');
    }
  }, []);

  const handleExecuteAction = useCallback(async (actionId: string) => {
    try {
      const context = getClientContext?.();
      if (!context?.artifactContent) {
        setError('Cannot execute action: artifact content not available');
        return;
      }

      const result = await chatApi.executeAction(
        actionId,
        context.artifactContent,
        context.artifactMetadata
      );

      if (result.success) {
        updateActionInMessages(actionId, result.action);
        onActionExecuted?.(result.action, result);
      } else {
        setError(result.error?.message || 'Failed to execute action');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to execute action');
    }
  }, [getClientContext, onActionExecuted]);

  // Helper to update action in messages
  const updateActionInMessages = (actionId: string, updatedAction: ChatAction) => {
    setMessages(prev => prev.map(msg => {
      if (msg.actions) {
        return {
          ...msg,
          actions: msg.actions.map(a => a.id === actionId ? updatedAction : a),
        };
      }
      return msg;
    }));
  };

  // Handle Enter key
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  if (!isEnabled) {
    return null;
  }

  return (
    <div className={`chat-agent-panel ${className}`}>
      {/* Header */}
      <div
        className="chat-header"
        onClick={() => setIsOpen(!isOpen)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 16px',
          backgroundColor: `var(--${config.color}-50, #f0f9ff)`,
          borderBottom: isOpen ? '1px solid #e5e7eb' : 'none',
          cursor: 'pointer',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>{config.icon}</span>
          <span style={{ fontWeight: 500 }}>{config.name}</span>
        </div>
        <span style={{ transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>
          ▼
        </span>
      </div>

      {isOpen && (
        <>
          {/* Governance Warning */}
          {governanceWarning && (
            <div style={{
              padding: '8px 16px',
              backgroundColor: '#fef3c7',
              color: '#92400e',
              fontSize: '14px',
            }}>
              ⚠️ {governanceWarning}
            </div>
          )}

          {/* Error Display */}
          {error && (
            <div style={{
              padding: '8px 16px',
              backgroundColor: '#fee2e2',
              color: '#dc2626',
              fontSize: '14px',
            }}>
              ❌ {error}
              <button
                onClick={() => setError(null)}
                style={{ marginLeft: '8px', textDecoration: 'underline', cursor: 'pointer', background: 'none', border: 'none', color: 'inherit' }}
              >
                Dismiss
              </button>
            </div>
          )}

          {/* Messages */}
          <div
            className="chat-messages"
            style={{
              height: '300px',
              overflowY: 'auto',
              padding: '16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
            }}
          >
            {messages.length === 0 ? (
              <div style={{ color: '#6b7280', textAlign: 'center', padding: '20px' }}>
                Start a conversation with {config.name}
              </div>
            ) : (
              messages.map(message => (
                <MessageBubble
                  key={message.id}
                  message={message}
                  onApproveAction={handleApproveAction}
                  onRejectAction={handleRejectAction}
                  onExecuteAction={handleExecuteAction}
                />
              ))
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div style={{
            padding: '12px 16px',
            borderTop: '1px solid #e5e7eb',
            display: 'flex',
            gap: '8px',
          }}>
            <textarea
              ref={inputRef}
              value={inputValue}
              onChange={e => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={`Ask ${config.name}...`}
              disabled={isLoading}
              rows={2}
              style={{
                flex: 1,
                padding: '8px 12px',
                borderRadius: '8px',
                border: '1px solid #d1d5db',
                resize: 'none',
                fontFamily: 'inherit',
                fontSize: '14px',
              }}
            />
            <button
              onClick={handleSendMessage}
              disabled={isLoading || !inputValue.trim()}
              style={{
                padding: '8px 16px',
                backgroundColor: isLoading || !inputValue.trim() ? '#d1d5db' : '#3b82f6',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: isLoading || !inputValue.trim() ? 'not-allowed' : 'pointer',
                fontWeight: 500,
              }}
            >
              {isLoading ? '...' : 'Send'}
            </button>
          </div>
        </>
      )}

      <style jsx>{`
        .chat-agent-panel {
          border: 1px solid #e5e7eb;
          border-radius: 12px;
          background: white;
          overflow: hidden;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
        }
      `}</style>
    </div>
  );
}

/**
 * Message bubble component
 */
function MessageBubble({
  message,
  onApproveAction,
  onRejectAction,
  onExecuteAction,
}: {
  message: ChatMessage;
  onApproveAction: (id: string) => void;
  onRejectAction: (id: string) => void;
  onExecuteAction: (id: string) => void;
}) {
  const isUser = message.role === 'user';

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: isUser ? 'flex-end' : 'flex-start',
    }}>
      <div style={{
        maxWidth: '85%',
        padding: '10px 14px',
        borderRadius: '12px',
        backgroundColor: isUser ? '#3b82f6' : '#f3f4f6',
        color: isUser ? 'white' : '#1f2937',
      }}>
        <div style={{ whiteSpace: 'pre-wrap', fontSize: '14px' }}>
          {message.content}
        </div>

        {message.phiDetected && (
          <div style={{
            marginTop: '8px',
            padding: '4px 8px',
            backgroundColor: isUser ? 'rgba(255,255,255,0.2)' : '#fef3c7',
            borderRadius: '4px',
            fontSize: '12px',
          }}>
            ⚠️ PHI detected
          </div>
        )}
      </div>

      {/* Actions */}
      {message.actions && message.actions.length > 0 && (
        <div style={{
          marginTop: '8px',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          maxWidth: '85%',
        }}>
          {message.actions.map(action => (
            <ActionCard
              key={action.id}
              action={action}
              onApprove={() => onApproveAction(action.id)}
              onReject={() => onRejectAction(action.id)}
              onExecute={() => onExecuteAction(action.id)}
            />
          ))}
        </div>
      )}

      <div style={{
        fontSize: '11px',
        color: '#9ca3af',
        marginTop: '4px',
      }}>
        {new Date(message.createdAt).toLocaleTimeString()}
      </div>
    </div>
  );
}

/**
 * Action card component
 */
function ActionCard({
  action,
  onApprove,
  onReject,
  onExecute,
}: {
  action: ChatAction;
  onApprove: () => void;
  onReject: () => void;
  onExecute: () => void;
}) {
  const statusColors: Record<string, string> = {
    proposed: '#f59e0b',
    approved: '#3b82f6',
    executed: '#10b981',
    failed: '#ef4444',
    rejected: '#6b7280',
  };

  return (
    <div style={{
      padding: '12px',
      backgroundColor: 'white',
      border: '1px solid #e5e7eb',
      borderRadius: '8px',
      boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)',
    }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '8px',
      }}>
        <span style={{
          fontWeight: 500,
          fontSize: '13px',
          textTransform: 'capitalize',
        }}>
          {action.actionType.replace('_', ' ')}
          {action.payload.section && (
            <span style={{ color: '#6b7280', fontWeight: 400 }}>
              {' → '}{action.payload.section}
            </span>
          )}
        </span>
        <span style={{
          padding: '2px 8px',
          borderRadius: '9999px',
          fontSize: '11px',
          fontWeight: 500,
          backgroundColor: `${statusColors[action.status]}20`,
          color: statusColors[action.status],
          textTransform: 'uppercase',
        }}>
          {action.status}
        </span>
      </div>

      {action.payload.content && (
        <pre style={{
          fontSize: '12px',
          backgroundColor: '#f9fafb',
          padding: '8px',
          borderRadius: '4px',
          overflow: 'auto',
          maxHeight: '100px',
          margin: '8px 0',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
        }}>
          {action.payload.content.substring(0, 200)}
          {action.payload.content.length > 200 ? '...' : ''}
        </pre>
      )}

      {action.status === 'proposed' && (
        <div style={{
          display: 'flex',
          gap: '8px',
          marginTop: '8px',
        }}>
          <button
            onClick={onApprove}
            style={{
              flex: 1,
              padding: '6px 12px',
              backgroundColor: '#10b981',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              fontSize: '13px',
              cursor: 'pointer',
            }}
          >
            Approve
          </button>
          <button
            onClick={onReject}
            style={{
              flex: 1,
              padding: '6px 12px',
              backgroundColor: '#f3f4f6',
              color: '#4b5563',
              border: '1px solid #d1d5db',
              borderRadius: '6px',
              fontSize: '13px',
              cursor: 'pointer',
            }}
          >
            Reject
          </button>
        </div>
      )}

      {action.status === 'approved' && (
        <button
          onClick={onExecute}
          style={{
            width: '100%',
            padding: '6px 12px',
            backgroundColor: '#3b82f6',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            fontSize: '13px',
            cursor: 'pointer',
            marginTop: '8px',
          }}
        >
          Apply Changes
        </button>
      )}
    </div>
  );
}

export default ChatAgentPanel;
