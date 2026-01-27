/**
 * Chat Agent Types
 *
 * TypeScript types for the chat agent components
 */

export type AgentType = 'irb' | 'analysis' | 'manuscript';

export interface ChatSession {
  id: string;
  projectId: string | null;
  artifactType: string;
  artifactId: string;
  agentType: AgentType;
  title: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ChatMessage {
  id: string;
  sessionId: string;
  role: 'system' | 'user' | 'assistant';
  authorId: string | null;
  content: string;
  metadata: Record<string, unknown>;
  phiDetected: boolean;
  createdAt: string;
  actions?: ChatAction[];
}

export interface ChatAction {
  id: string;
  messageId: string;
  actionType: string;
  status: 'proposed' | 'approved' | 'executed' | 'failed' | 'rejected';
  payload: {
    type?: string;
    section?: string;
    name?: string;
    content?: string;
    [key: string]: unknown;
  };
  result: Record<string, unknown>;
  createdAt: string;
  executedAt: string | null;
}

export interface GovernanceInfo {
  mode: 'DEMO' | 'LIVE';
  phiDetected: boolean;
  phiWarning: string | null;
}

export interface SendMessageResponse {
  success: boolean;
  session: Pick<ChatSession, 'id' | 'artifactType' | 'artifactId' | 'agentType'>;
  userMessage: ChatMessage;
  assistantMessage: ChatMessage;
  governance: GovernanceInfo;
  error?: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}

export interface GetMessagesResponse {
  success: boolean;
  messages: ChatMessage[];
}

export interface ActionResponse {
  success: boolean;
  action: ChatAction;
  message?: string;
  changes?: {
    before?: string;
    after?: string;
    diff?: string;
  };
  error?: {
    code: string;
    message: string;
  };
}

export interface ChatAgentPanelProps {
  agentType: AgentType;
  artifactType: string;
  artifactId: string;
  projectId?: string;
  getClientContext?: () => {
    artifactContent?: string;
    artifactMetadata?: Record<string, unknown>;
    projectContext?: Record<string, unknown>;
  };
  onActionExecuted?: (action: ChatAction, result: ActionResponse) => void;
  className?: string;
  defaultOpen?: boolean;
}

export interface ChatInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

export interface ChatMessageProps {
  message: ChatMessage;
  onApproveAction?: (actionId: string) => void;
  onRejectAction?: (actionId: string) => void;
  onExecuteAction?: (actionId: string) => void;
}

export interface ChatActionButtonProps {
  action: ChatAction;
  onApprove: () => void;
  onReject: () => void;
  onExecute: () => void;
  disabled?: boolean;
}
