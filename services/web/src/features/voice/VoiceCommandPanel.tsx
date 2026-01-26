/**
 * Voice Command Navigation Panel
 *
 * Provides a UI for voice-controlled navigation with visual feedback
 * Feature flag: FEATURE_VOICE_COMMANDS
 */

import React, { useCallback, useState } from 'react';
import { Mic, MicOff, HelpCircle, Volume2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useVoiceCommands, VoiceCommand, VOICE_COMMANDS_HELP } from './useVoiceCommands';
import { cn } from '@/lib/utils';

export interface VoiceCommandPanelProps {
  /** Callback when stage navigation is requested */
  onNavigateStage?: (stage: number) => void;
  /** Callback to advance to next stage */
  onNextStage?: () => void;
  /** Callback to go to previous stage */
  onPrevStage?: () => void;
  /** Callback to open timeline */
  onOpenTimeline?: () => void;
  /** Callback to open artifacts */
  onOpenArtifacts?: () => void;
  /** Callback to open audit log */
  onOpenAudit?: () => void;
  /** Callback to open settings */
  onOpenSettings?: () => void;
  /** Optional className */
  className?: string;
  /** Compact mode (just the button) */
  compact?: boolean;
}

export function VoiceCommandPanel({
  onNavigateStage,
  onNextStage,
  onPrevStage,
  onOpenTimeline,
  onOpenArtifacts,
  onOpenAudit,
  onOpenSettings,
  className,
  compact = false,
}: VoiceCommandPanelProps) {
  const [interimTranscript, setInterimTranscript] = useState('');
  const [showHelp, setShowHelp] = useState(false);
  const [lastCommand, setLastCommand] = useState<string | null>(null);

  const handleCommand = useCallback(
    (command: VoiceCommand) => {
      switch (command.kind) {
        case 'goStage':
          setLastCommand(`Going to Stage ${command.stage}`);
          onNavigateStage?.(command.stage);
          break;
        case 'nextStage':
          setLastCommand('Next stage');
          onNextStage?.();
          break;
        case 'prevStage':
          setLastCommand('Previous stage');
          onPrevStage?.();
          break;
        case 'openTimeline':
          setLastCommand('Opening timeline');
          onOpenTimeline?.();
          break;
        case 'openArtifacts':
          setLastCommand('Opening artifacts');
          onOpenArtifacts?.();
          break;
        case 'openAudit':
          setLastCommand('Opening audit log');
          onOpenAudit?.();
          break;
        case 'openSettings':
          setLastCommand('Opening settings');
          onOpenSettings?.();
          break;
        case 'help':
          setLastCommand('Showing help');
          setShowHelp(true);
          break;
        case 'unknown':
          setLastCommand(`Unknown: "${command.transcript}"`);
          break;
      }

      // Clear interim transcript
      setInterimTranscript('');

      // Clear last command after 3 seconds
      setTimeout(() => setLastCommand(null), 3000);
    },
    [onNavigateStage, onNextStage, onPrevStage, onOpenTimeline, onOpenArtifacts, onOpenAudit, onOpenSettings]
  );

  const handleInterim = useCallback((transcript: string) => {
    setInterimTranscript(transcript);
  }, []);

  const handleError = useCallback((error: string) => {
    setLastCommand(`Error: ${error}`);
    setTimeout(() => setLastCommand(null), 3000);
  }, []);

  const {
    supported,
    isListening,
    toggle,
    error,
  } = useVoiceCommands({
    onCommand: handleCommand,
    onInterim: handleInterim,
    onError: handleError,
  });

  // If not supported, show minimal UI
  if (!supported) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" disabled className={className}>
              <MicOff className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Voice commands not supported in this browser</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  // Compact mode: just the microphone button
  if (compact) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={isListening ? 'default' : 'ghost'}
              size="icon"
              onClick={toggle}
              className={cn(
                isListening && 'bg-red-500 hover:bg-red-600 text-white animate-pulse',
                className
              )}
            >
              {isListening ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>{isListening ? 'Listening... Click to stop' : 'Click to enable voice commands'}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  // Full panel mode
  return (
    <Card className={cn('w-full max-w-sm', className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Volume2 className="h-4 w-4" />
            Voice Navigation
          </CardTitle>
          <Popover open={showHelp} onOpenChange={setShowHelp}>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7">
                <HelpCircle className="h-4 w-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80" align="end">
              <div className="space-y-2">
                <h4 className="font-medium">Available Commands</h4>
                <div className="space-y-1">
                  {VOICE_COMMANDS_HELP.map((item, i) => (
                    <div key={i} className="flex justify-between text-sm">
                      <code className="bg-muted px-1 rounded">{item.command}</code>
                      <span className="text-muted-foreground">{item.description}</span>
                    </div>
                  ))}
                </div>
              </div>
            </PopoverContent>
          </Popover>
        </div>
        <CardDescription>
          {isListening ? 'Listening for commands...' : 'Click microphone to start'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Microphone button */}
        <div className="flex justify-center">
          <Button
            variant={isListening ? 'destructive' : 'outline'}
            size="lg"
            onClick={toggle}
            className={cn(
              'h-16 w-16 rounded-full',
              isListening && 'animate-pulse'
            )}
          >
            {isListening ? (
              <Mic className="h-8 w-8" />
            ) : (
              <MicOff className="h-8 w-8" />
            )}
          </Button>
        </div>

        {/* Status display */}
        <div className="min-h-[2rem] text-center">
          {isListening && interimTranscript && (
            <p className="text-sm text-muted-foreground italic">
              "{interimTranscript}"
            </p>
          )}
          {lastCommand && (
            <Badge
              variant={lastCommand.startsWith('Error') || lastCommand.startsWith('Unknown') ? 'destructive' : 'secondary'}
              className="animate-in fade-in"
            >
              {lastCommand}
            </Badge>
          )}
          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}
        </div>

        {/* Quick reference */}
        <div className="text-xs text-muted-foreground text-center">
          Say "help" for available commands
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Compact voice button for navigation bars
 */
export function VoiceCommandButton(props: Omit<VoiceCommandPanelProps, 'compact'>) {
  return <VoiceCommandPanel {...props} compact />;
}
