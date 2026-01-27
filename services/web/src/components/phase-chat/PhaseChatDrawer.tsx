/**
 * Phase Chat Drawer
 *
 * Slide-out drawer for phase-specific AI chat.
 * Shows available agents for the current workflow stage.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  getAgentsForStage,
  sendPhaseChatMessage,
  type AgentInfo,
  type PhaseChatInput,
  type PhaseChatResponse,
} from '../../api/phaseChat';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  agentUsed?: string;
}

interface PhaseChatDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  currentStage: number;
  defaultTopic?: string;
}

export function PhaseChatDrawer({
  isOpen,
  onClose,
  currentStage,
  defaultTopic,
}: PhaseChatDrawerProps) {
  const [agents, setAgents] = useState<AgentInfo[]>([]);
  const [stageDescription, setStageDescription] = useState<string>('');
  const [selectedTopic, setSelectedTopic] = useState(defaultTopic || '');
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | undefined>();
  const [error, setError] = useState<string | null>(null);

  // Fetch available agents when stage changes
  useEffect(() => {
    if (isOpen && currentStage) {
      getAgentsForStage(currentStage)
        .then((response) => {
          setAgents(response.agents);
          setStageDescription(response.stageDescription);
          if (response.agents.length > 0 && !selectedTopic) {
            setSelectedTopic(response.agents[0].id);
          }
        })
        .catch((err) => {
          console.error('Failed to fetch agents:', err);
          setError('Failed to load available assistants');
        });
    }
  }, [isOpen, currentStage]);

  // Reset messages when stage changes
  useEffect(() => {
    setMessages([]);
    setConversationId(undefined);
  }, [currentStage]);

  const sendMessage = useCallback(async () => {
    if (!inputValue.trim() || isLoading) return;

    const userMessage: Message = {
      id: `msg_${Date.now()}`,
      role: 'user',
      content: inputValue,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);
    setError(null);

    try {
      const input: PhaseChatInput = {
        query: inputValue,
        topic: selectedTopic || undefined,
        conversationId,
      };

      const response = await sendPhaseChatMessage(currentStage, input);

      if (!conversationId) {
        setConversationId(response.conversationId);
      }

      const assistantMessage: Message = {
        id: `msg_${Date.now()}_resp`,
        role: 'assistant',
        content: response.response.content,
        timestamp: new Date(),
        agentUsed: response.agentUsed,
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err) {
      console.error('Failed to send message:', err);
      setError('Failed to get response. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [inputValue, isLoading, currentStage, selectedTopic, conversationId]);

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed right-0 top-0 bottom-0 w-[400px] max-w-full bg-white shadow-[-2px_0_10px_rgba(0,0,0,0.1)] flex flex-col z-[1000]">
      {/* Header */}
      <div className="flex justify-between items-center p-4 border-b border-gray-200">
        <div>
          <h3 className="m-0 text-lg font-semibold">Stage {currentStage} Assistant</h3>
          <p className="m-0 text-sm text-gray-500">{stageDescription}</p>
        </div>
        <button
          onClick={onClose}
          className="bg-transparent border-none text-2xl cursor-pointer p-1 hover:bg-gray-100 rounded"
        >
          ×
        </button>
      </div>

      {/* Agent Selector */}
      <div className="p-3 border-b border-gray-200">
        <label htmlFor="topic-select" className="block text-sm font-medium text-gray-700 mb-1">
          Assistant Type:
        </label>
        <select
          id="topic-select"
          value={selectedTopic}
          onChange={(e) => setSelectedTopic(e.target.value)}
          className="w-full p-2 border border-gray-300 rounded text-sm"
        >
          {agents.map((agent) => (
            <option key={agent.id} value={agent.id}>
              {agent.name}
            </option>
          ))}
        </select>
        {selectedTopic && agents.find((a) => a.id === selectedTopic) && (
          <p className="mt-1 text-xs text-gray-500">
            {agents.find((a) => a.id === selectedTopic)?.description}
          </p>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4">
        {messages.length === 0 && (
          <div className="text-center text-gray-500 py-10">
            <p className="text-sm">Ask questions specific to Stage {currentStage}.</p>
            <p className="text-xs mt-2">
              Selected assistant:{' '}
              {agents.find((a) => a.id === selectedTopic)?.name || 'General'}
            </p>
          </div>
        )}

        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`mb-3 p-3 rounded-lg max-w-[85%] ${
              msg.role === 'user'
                ? 'bg-blue-50 ml-auto'
                : 'bg-gray-100'
            }`}
          >
            <div className="text-sm whitespace-pre-wrap">{msg.content}</div>
            {msg.agentUsed && (
              <div className="text-xs text-gray-500 mt-1">via {msg.agentUsed}</div>
            )}
          </div>
        ))}

        {isLoading && (
          <div className="mb-3 p-3 rounded-lg bg-gray-100 max-w-[85%]">
            <div className="text-sm animate-pulse">Thinking...</div>
          </div>
        )}
      </div>

      {/* Error Banner */}
      {error && (
        <div className="bg-red-50 text-red-700 px-4 py-2 text-sm">{error}</div>
      )}

      {/* Input */}
      <div className="p-4 border-t border-gray-200 flex gap-2">
        <textarea
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder={`Ask about Stage ${currentStage}...`}
          disabled={isLoading}
          rows={2}
          className="flex-1 p-2 border border-gray-300 rounded resize-none text-sm"
        />
        <button
          onClick={sendMessage}
          disabled={isLoading || !inputValue.trim()}
          className="px-4 py-2 bg-blue-600 text-white border-none rounded cursor-pointer disabled:bg-gray-300 disabled:cursor-not-allowed hover:bg-blue-700"
        >
          Send
        </button>
      </div>
    </div>
  );
}

export default PhaseChatDrawer;
