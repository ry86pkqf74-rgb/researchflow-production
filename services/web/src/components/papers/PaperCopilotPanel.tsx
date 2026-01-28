/**
 * Paper Copilot Chat Panel
 *
 * Track B Phase 12: AI Copilot for PDFs
 *
 * Features:
 * - Chat interface for paper Q&A
 * - RAG-powered context retrieval
 * - Summary generation
 * - Claim extraction
 * - Chat history
 */

import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Send,
  Loader2,
  MessageSquare,
  FileText,
  Lightbulb,
  Trash2,
  MoreVertical,
  Sparkles,
  RefreshCw,
  BookOpen,
  ClipboardList,
  CheckCircle,
  AlertCircle,
  Cpu,
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

// =============================================================================
// Types
// =============================================================================

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  context_chunk_ids?: string[];
  model_used?: string;
  tokens_input?: number;
  tokens_output?: number;
  latency_ms?: number;
  created_at: string;
}

interface ChunkStatus {
  paper_id: string;
  status: 'pending' | 'processing' | 'ready' | 'error';
  count: number;
  last_chunked_at?: string;
}

interface Summary {
  summary_type: string;
  content: string;
  model_used: string;
  is_stale: boolean;
  created_at: string;
  updated_at: string;
}

interface Claim {
  id: string;
  claim_text: string;
  claim_type: string;
  page_number?: number;
  confidence_score: number;
  is_verified: boolean;
  created_at: string;
}

interface PaperCopilotPanelProps {
  paperId: string;
  className?: string;
}

// =============================================================================
// Chat Message Component
// =============================================================================

function ChatMessageItem({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'user';

  return (
    <div className={cn(
      "flex gap-3 p-3 rounded-lg",
      isUser ? "bg-primary/5 ml-8" : "bg-muted/50 mr-8"
    )}>
      <div className={cn(
        "w-7 h-7 rounded-full flex items-center justify-center shrink-0",
        isUser ? "bg-primary text-primary-foreground" : "bg-secondary"
      )}>
        {isUser ? (
          <span className="text-xs font-medium">U</span>
        ) : (
          <Cpu className="h-4 w-4" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm whitespace-pre-wrap break-words">
          {message.content}
        </div>
        {!isUser && message.tokens_output && (
          <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
            <span>{message.model_used}</span>
            <span>•</span>
            <span>{message.tokens_output} tokens</span>
            {message.latency_ms && (
              <>
                <span>•</span>
                <span>{(message.latency_ms / 1000).toFixed(1)}s</span>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// =============================================================================
// Main Component
// =============================================================================

export function PaperCopilotPanel({ paperId, className }: PaperCopilotPanelProps) {
  const [input, setInput] = useState("");
  const [activeTab, setActiveTab] = useState("chat");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Scroll to bottom on new messages
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // ===========================================================================
  // Queries
  // ===========================================================================

  // Get chunking status
  const { data: chunkStatus, isLoading: chunkStatusLoading } = useQuery<ChunkStatus>({
    queryKey: ['paper-chunks', paperId],
    queryFn: async () => {
      const res = await apiRequest('GET', `/api/papers/${paperId}/copilot/chunks`);
      return res.json();
    },
    refetchInterval: (data) => {
      // Poll while processing
      return data?.status === 'processing' ? 2000 : false;
    },
  });

  // Get chat history
  const { data: chatHistory, isLoading: chatLoading } = useQuery<{ messages: ChatMessage[] }>({
    queryKey: ['paper-chat', paperId],
    queryFn: async () => {
      const res = await apiRequest('GET', `/api/papers/${paperId}/copilot/chat`);
      return res.json();
    },
    enabled: chunkStatus?.status === 'ready',
  });

  // Get summaries
  const { data: summariesData } = useQuery<{ summaries: Summary[] }>({
    queryKey: ['paper-summaries', paperId],
    queryFn: async () => {
      const res = await apiRequest('GET', `/api/papers/${paperId}/copilot/summaries`);
      return res.json();
    },
    enabled: activeTab === 'summary',
  });

  // Get claims
  const { data: claimsData } = useQuery<{ claims: Claim[] }>({
    queryKey: ['paper-claims', paperId],
    queryFn: async () => {
      const res = await apiRequest('GET', `/api/papers/${paperId}/copilot/claims`);
      return res.json();
    },
    enabled: activeTab === 'claims',
  });

  // Scroll to bottom when messages change
  useEffect(() => {
    if (chatHistory?.messages) {
      scrollToBottom();
    }
  }, [chatHistory?.messages]);

  // ===========================================================================
  // Mutations
  // ===========================================================================

  // Start chunking
  const chunkMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', `/api/papers/${paperId}/copilot/chunk`);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Processing started", description: "Paper is being analyzed for AI chat" });
      queryClient.invalidateQueries({ queryKey: ['paper-chunks', paperId] });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to start processing", variant: "destructive" });
    },
  });

  // Send chat message
  const chatMutation = useMutation({
    mutationFn: async (message: string) => {
      const res = await apiRequest('POST', `/api/papers/${paperId}/copilot/chat`, { message });
      return res.json();
    },
    onSuccess: () => {
      setInput("");
      queryClient.invalidateQueries({ queryKey: ['paper-chat', paperId] });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to get response", variant: "destructive" });
    },
  });

  // Clear chat
  const clearChatMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('DELETE', `/api/papers/${paperId}/copilot/chat`);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Chat cleared" });
      queryClient.invalidateQueries({ queryKey: ['paper-chat', paperId] });
    },
  });

  // Generate summary
  const summaryMutation = useMutation({
    mutationFn: async (type: string) => {
      const res = await apiRequest('POST', `/api/papers/${paperId}/copilot/summarize`, { type });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['paper-summaries', paperId] });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to generate summary", variant: "destructive" });
    },
  });

  // Extract claims
  const claimsMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', `/api/papers/${paperId}/copilot/extract-claims`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['paper-claims', paperId] });
      toast({ title: "Claims extracted" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to extract claims", variant: "destructive" });
    },
  });

  // ===========================================================================
  // Handlers
  // ===========================================================================

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || chatMutation.isPending) return;
    chatMutation.mutate(input.trim());
  };

  const handleQuickAction = (action: string) => {
    const prompts: Record<string, string> = {
      'summarize': 'Can you summarize this paper in 3-4 key points?',
      'methods': 'What methods were used in this study?',
      'findings': 'What are the main findings of this paper?',
      'limitations': 'What are the limitations mentioned in this paper?',
    };
    setInput(prompts[action] || '');
  };

  // ===========================================================================
  // Render
  // ===========================================================================

  // Not ready state
  if (chunkStatus?.status !== 'ready') {
    return (
      <div className={cn("flex flex-col h-full", className)}>
        <div className="p-4 border-b">
          <h3 className="font-semibold flex items-center gap-2">
            <Sparkles className="h-4 w-4" />
            AI Copilot
          </h3>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
          {chunkStatus?.status === 'processing' ? (
            <>
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mb-4" />
              <p className="text-sm font-medium">Processing paper...</p>
              <p className="text-xs text-muted-foreground mt-1">
                This may take a minute
              </p>
            </>
          ) : chunkStatus?.status === 'error' ? (
            <>
              <AlertCircle className="h-8 w-8 text-destructive mb-4" />
              <p className="text-sm font-medium">Processing failed</p>
              <Button
                variant="outline"
                size="sm"
                className="mt-4"
                onClick={() => chunkMutation.mutate()}
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Retry
              </Button>
            </>
          ) : (
            <>
              <Cpu className="h-8 w-8 text-muted-foreground mb-4" />
              <p className="text-sm font-medium">Enable AI Copilot</p>
              <p className="text-xs text-muted-foreground mt-1 mb-4">
                Process this paper to enable AI-powered chat
              </p>
              <Button
                onClick={() => chunkMutation.mutate()}
                disabled={chunkMutation.isPending}
              >
                {chunkMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4 mr-2" />
                )}
                Analyze Paper
              </Button>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col h-full", className)}>
      {/* Header */}
      <div className="p-3 border-b">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold flex items-center gap-2">
            <Sparkles className="h-4 w-4" />
            AI Copilot
          </h3>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => clearChatMutation.mutate()}>
                <Trash2 className="h-4 w-4 mr-2" />
                Clear Chat
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem disabled>
                <Badge variant="secondary" className="text-xs">
                  {chunkStatus?.count || 0} chunks
                </Badge>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
        <TabsList className="mx-3 mt-2 grid grid-cols-3">
          <TabsTrigger value="chat" className="text-xs">
            <MessageSquare className="h-3 w-3 mr-1" />
            Chat
          </TabsTrigger>
          <TabsTrigger value="summary" className="text-xs">
            <FileText className="h-3 w-3 mr-1" />
            Summary
          </TabsTrigger>
          <TabsTrigger value="claims" className="text-xs">
            <Lightbulb className="h-3 w-3 mr-1" />
            Claims
          </TabsTrigger>
        </TabsList>

        {/* Chat Tab */}
        <TabsContent value="chat" className="flex-1 flex flex-col m-0 p-0">
          {/* Messages */}
          <ScrollArea className="flex-1 p-3">
            {chatLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : chatHistory?.messages?.length === 0 ? (
              <div className="text-center py-8">
                <BookOpen className="h-8 w-8 mx-auto text-muted-foreground mb-3" />
                <p className="text-sm text-muted-foreground mb-4">
                  Ask questions about this paper
                </p>
                <div className="flex flex-wrap gap-2 justify-center">
                  {[
                    { key: 'summarize', label: 'Summarize' },
                    { key: 'methods', label: 'Methods' },
                    { key: 'findings', label: 'Findings' },
                    { key: 'limitations', label: 'Limitations' },
                  ].map((action) => (
                    <Button
                      key={action.key}
                      variant="outline"
                      size="sm"
                      onClick={() => handleQuickAction(action.key)}
                    >
                      {action.label}
                    </Button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {chatHistory?.messages?.map((msg) => (
                  <ChatMessageItem key={msg.id} message={msg} />
                ))}
                {chatMutation.isPending && (
                  <div className="flex gap-3 p-3 rounded-lg bg-muted/50 mr-8">
                    <div className="w-7 h-7 rounded-full bg-secondary flex items-center justify-center shrink-0">
                      <Loader2 className="h-4 w-4 animate-spin" />
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Thinking...
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            )}
          </ScrollArea>

          {/* Input */}
          <form onSubmit={handleSend} className="p-3 border-t">
            <div className="flex gap-2">
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask about this paper..."
                disabled={chatMutation.isPending}
                className="flex-1"
              />
              <Button
                type="submit"
                size="icon"
                disabled={!input.trim() || chatMutation.isPending}
              >
                {chatMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </div>
          </form>
        </TabsContent>

        {/* Summary Tab */}
        <TabsContent value="summary" className="flex-1 flex flex-col m-0 p-0">
          <ScrollArea className="flex-1 p-3">
            {/* Summary types */}
            <div className="space-y-4">
              {['full', 'abstract', 'methods', 'results', 'key_findings'].map((type) => {
                const summary = summariesData?.summaries?.find(s => s.summary_type === type);
                const isGenerating = summaryMutation.isPending && summaryMutation.variables === type;

                return (
                  <div key={type} className="border rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-sm font-medium capitalize">{type.replace('_', ' ')}</h4>
                      {summary ? (
                        <Badge variant="secondary" className="text-xs">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Generated
                        </Badge>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => summaryMutation.mutate(type)}
                          disabled={summaryMutation.isPending}
                        >
                          {isGenerating ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <>
                              <Sparkles className="h-3 w-3 mr-1" />
                              Generate
                            </>
                          )}
                        </Button>
                      )}
                    </div>
                    {summary && (
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                        {summary.content}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        </TabsContent>

        {/* Claims Tab */}
        <TabsContent value="claims" className="flex-1 flex flex-col m-0 p-0">
          <div className="p-3 border-b">
            <Button
              size="sm"
              onClick={() => claimsMutation.mutate()}
              disabled={claimsMutation.isPending}
            >
              {claimsMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <ClipboardList className="h-4 w-4 mr-2" />
              )}
              Extract Claims
            </Button>
          </div>

          <ScrollArea className="flex-1 p-3">
            {claimsData?.claims?.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">
                No claims extracted yet
              </div>
            ) : (
              <div className="space-y-3">
                {claimsData?.claims?.map((claim) => (
                  <div key={claim.id} className="border rounded-lg p-3">
                    <div className="flex items-start gap-2">
                      <Lightbulb className="h-4 w-4 mt-0.5 text-yellow-500 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm">{claim.claim_text}</p>
                        <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                          <Badge variant="outline" className="capitalize">
                            {claim.claim_type}
                          </Badge>
                          {claim.page_number && (
                            <span>Page {claim.page_number}</span>
                          )}
                          <span>
                            Confidence: {Math.round(claim.confidence_score * 100)}%
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default PaperCopilotPanel;
