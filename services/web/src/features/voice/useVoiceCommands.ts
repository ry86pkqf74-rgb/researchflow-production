/**
 * Voice Command Navigation Hook
 *
 * Uses Web Speech API to enable voice-controlled navigation
 * Feature flag: FEATURE_VOICE_COMMANDS
 */

import { useCallback, useEffect, useMemo, useState } from 'react';

export type VoiceCommand =
  | { kind: 'goStage'; stage: number }
  | { kind: 'nextStage' }
  | { kind: 'prevStage' }
  | { kind: 'openTimeline' }
  | { kind: 'openArtifacts' }
  | { kind: 'openAudit' }
  | { kind: 'openSettings' }
  | { kind: 'help' }
  | { kind: 'unknown'; transcript: string };

/**
 * Parse a voice transcript into a command
 */
function parseCommand(transcriptRaw: string): VoiceCommand {
  const t = transcriptRaw.toLowerCase().trim();

  // Stage navigation: "go to stage 5", "stage 5", "open stage 5"
  const stageMatch = t.match(/(?:go to|open|show|stage)\s*(?:stage\s*)?(\d{1,2})/);
  if (stageMatch) {
    const stage = parseInt(stageMatch[1], 10);
    if (stage >= 1 && stage <= 20) {
      return { kind: 'goStage', stage };
    }
  }

  // Next/previous stage
  if (t.includes('next stage') || t.includes('go next') || t.includes('advance')) {
    return { kind: 'nextStage' };
  }
  if (t.includes('previous stage') || t.includes('go back') || t.includes('back')) {
    return { kind: 'prevStage' };
  }

  // Panel navigation
  if (t.includes('timeline') || t.includes('history')) {
    return { kind: 'openTimeline' };
  }
  if (t.includes('artifact') || t.includes('files') || t.includes('documents')) {
    return { kind: 'openArtifacts' };
  }
  if (t.includes('audit') || t.includes('log')) {
    return { kind: 'openAudit' };
  }
  if (t.includes('setting')) {
    return { kind: 'openSettings' };
  }
  if (t.includes('help') || t.includes('commands') || t.includes('what can')) {
    return { kind: 'help' };
  }

  return { kind: 'unknown', transcript: t };
}

export interface UseVoiceCommandsOptions {
  /** Callback when a valid command is recognized */
  onCommand: (command: VoiceCommand) => void;
  /** Callback for interim (partial) results */
  onInterim?: (transcript: string) => void;
  /** Callback when an error occurs */
  onError?: (error: string) => void;
  /** Language for recognition (default: en-US) */
  language?: string;
  /** Auto-restart after final result (default: false) */
  continuous?: boolean;
}

export interface UseVoiceCommandsReturn {
  /** Whether Speech Recognition API is supported */
  supported: boolean;
  /** Whether currently listening */
  isListening: boolean;
  /** Start listening for commands */
  start: () => void;
  /** Stop listening */
  stop: () => void;
  /** Toggle listening state */
  toggle: () => void;
  /** Last recognized transcript */
  lastTranscript: string;
  /** Error message if any */
  error: string | null;
}

export function useVoiceCommands(options: UseVoiceCommandsOptions): UseVoiceCommandsReturn {
  const { onCommand, onInterim, onError, language = 'en-US', continuous = false } = options;

  const [isListening, setIsListening] = useState(false);
  const [lastTranscript, setLastTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Get SpeechRecognition constructor (with vendor prefixes)
  const SpeechRecognitionCtor = useMemo(() => {
    if (typeof window === 'undefined') return null;
    return (
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition ||
      null
    );
  }, []);

  const supported = Boolean(SpeechRecognitionCtor);

  // Create recognition instance
  const recognition = useMemo(() => {
    if (!SpeechRecognitionCtor) return null;
    const r = new SpeechRecognitionCtor();
    r.continuous = continuous;
    r.interimResults = true;
    r.lang = language;
    r.maxAlternatives = 1;
    return r;
  }, [SpeechRecognitionCtor, continuous, language]);

  // Handle results
  useEffect(() => {
    if (!recognition) return;

    recognition.onresult = (event: any) => {
      const results = event.results;
      const lastResult = results[results.length - 1];
      const transcript = lastResult[0]?.transcript || '';

      if (lastResult.isFinal) {
        setLastTranscript(transcript);
        const command = parseCommand(transcript);
        onCommand(command);
      } else {
        onInterim?.(transcript);
      }
    };

    recognition.onerror = (event: any) => {
      const errorMsg = event.error || 'Unknown error';
      // Ignore 'no-speech' as it's common and not really an error
      if (errorMsg !== 'no-speech') {
        setError(errorMsg);
        onError?.(errorMsg);
      }
    };

    recognition.onend = () => {
      setIsListening(false);
      // Auto-restart if continuous mode
      if (continuous && isListening) {
        try {
          recognition.start();
          setIsListening(true);
        } catch {
          // Ignore - might already be started
        }
      }
    };

    return () => {
      recognition.onresult = null;
      recognition.onerror = null;
      recognition.onend = null;
    };
  }, [recognition, onCommand, onInterim, onError, continuous, isListening]);

  const start = useCallback(() => {
    if (!recognition) return;
    setError(null);
    try {
      recognition.start();
      setIsListening(true);
    } catch (e) {
      // Already started
      setError('Already listening');
    }
  }, [recognition]);

  const stop = useCallback(() => {
    if (!recognition) return;
    recognition.stop();
    setIsListening(false);
  }, [recognition]);

  const toggle = useCallback(() => {
    if (isListening) {
      stop();
    } else {
      start();
    }
  }, [isListening, start, stop]);

  return {
    supported,
    isListening,
    start,
    stop,
    toggle,
    lastTranscript,
    error,
  };
}

/**
 * Available voice commands reference
 */
export const VOICE_COMMANDS_HELP = [
  { command: '"Go to stage [1-20]"', description: 'Navigate to a specific stage' },
  { command: '"Next stage"', description: 'Advance to the next workflow stage' },
  { command: '"Previous stage"', description: 'Go back to previous stage' },
  { command: '"Open timeline"', description: 'Show project history timeline' },
  { command: '"Open artifacts"', description: 'Show artifact browser' },
  { command: '"Open audit"', description: 'Show audit log' },
  { command: '"Settings"', description: 'Open settings panel' },
  { command: '"Help"', description: 'Show available commands' },
];
