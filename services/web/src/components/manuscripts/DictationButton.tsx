/**
 * Voice Dictation Button
 *
 * Uses the Web Speech API to transcribe voice to text
 * for hands-free manuscript editing.
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';

interface DictationButtonProps {
  onTranscript: (text: string) => void;
  disabled?: boolean;
  language?: string;
}

// Check for Web Speech API support
const SpeechRecognition =
  typeof window !== 'undefined'
    ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    : null;

export function DictationButton({
  onTranscript,
  disabled = false,
  language = 'en-US',
}: DictationButtonProps) {
  const [isListening, setIsListening] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState('');
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    setIsSupported(!!SpeechRecognition);
  }, []);

  const startListening = useCallback(() => {
    if (!SpeechRecognition || disabled) return;

    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;

    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = language;

    recognition.onstart = () => {
      setIsListening(true);
      setInterimTranscript('');
    };

    recognition.onresult = (event: any) => {
      let finalTranscript = '';
      let interim = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          finalTranscript += result[0].transcript;
        } else {
          interim += result[0].transcript;
        }
      }

      setInterimTranscript(interim);

      if (finalTranscript) {
        onTranscript(finalTranscript);
        setInterimTranscript('');
      }
    };

    recognition.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error);
      setIsListening(false);
      setInterimTranscript('');

      if (event.error === 'not-allowed') {
        alert('Microphone access denied. Please allow microphone access to use dictation.');
      }
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognition.start();
  }, [disabled, language, onTranscript]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    setIsListening(false);
    setInterimTranscript('');
  }, []);

  const toggleListening = useCallback(() => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  }, [isListening, startListening, stopListening]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, []);

  if (!isSupported) {
    return (
      <button
        disabled
        className="p-2 rounded bg-gray-100 text-gray-400 cursor-not-allowed"
        title="Voice dictation not supported in this browser"
      >
        🎤
      </button>
    );
  }

  return (
    <div className="relative inline-block">
      <button
        onClick={toggleListening}
        disabled={disabled}
        className={`p-2 rounded transition-colors ${
          isListening
            ? 'bg-red-500 text-white animate-pulse'
            : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        title={isListening ? 'Stop dictation' : 'Start voice dictation'}
      >
        {isListening ? '⏹️' : '🎤'}
      </button>

      {/* Interim transcript indicator */}
      {interimTranscript && (
        <div className="absolute left-full ml-2 top-0 bg-blue-50 border border-blue-200 rounded px-2 py-1 text-sm whitespace-nowrap max-w-xs truncate">
          <span className="text-gray-500">Hearing: </span>
          <span className="italic">{interimTranscript}</span>
        </div>
      )}

      {/* Recording indicator */}
      {isListening && (
        <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full animate-ping" />
      )}
    </div>
  );
}

export default DictationButton;
