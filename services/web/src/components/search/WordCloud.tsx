/**
 * Word Cloud Component
 * Task 184: Word cloud for research topics
 */

import { useMemo, useState } from 'react';

interface WordCloudWord {
  text: string;
  value: number;
  color?: string;
}

interface WordCloudProps {
  words: WordCloudWord[];
  width?: number;
  height?: number;
  onWordClick?: (word: string) => void;
  maxFontSize?: number;
  minFontSize?: number;
}

export function WordCloud({
  words,
  width = 600,
  height = 400,
  onWordClick,
  maxFontSize = 48,
  minFontSize = 12,
}: WordCloudProps) {
  const [hoveredWord, setHoveredWord] = useState<string | null>(null);

  const processedWords = useMemo(() => {
    if (words.length === 0) return [];

    const maxValue = Math.max(...words.map((w) => w.value));
    const minValue = Math.min(...words.map((w) => w.value));
    const range = maxValue - minValue || 1;

    return words.map((word, index) => {
      const normalizedValue = (word.value - minValue) / range;
      const fontSize = minFontSize + normalizedValue * (maxFontSize - minFontSize);

      // Generate color based on value or use provided color
      const hue = word.color ? undefined : 200 + (normalizedValue * 60);
      const saturation = 70;
      const lightness = 30 + (normalizedValue * 20);
      const color = word.color || `hsl(${hue}, ${saturation}%, ${lightness}%)`;

      // Simple spiral positioning
      const angle = index * 0.5;
      const radius = 20 + index * 3;
      const x = width / 2 + Math.cos(angle) * radius;
      const y = height / 2 + Math.sin(angle) * radius;

      return {
        ...word,
        fontSize,
        color,
        x,
        y,
        rotation: (Math.random() - 0.5) * 30,
      };
    });
  }, [words, width, height, maxFontSize, minFontSize]);

  if (words.length === 0) {
    return (
      <div
        className="flex items-center justify-center text-muted-foreground"
        style={{ width, height }}
      >
        No words to display
      </div>
    );
  }

  return (
    <div
      className="relative overflow-hidden"
      style={{ width, height }}
    >
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
      >
        {processedWords.map((word, index) => (
          <text
            key={`${word.text}-${index}`}
            x={word.x}
            y={word.y}
            fontSize={word.fontSize}
            fill={word.color}
            textAnchor="middle"
            dominantBaseline="middle"
            transform={`rotate(${word.rotation}, ${word.x}, ${word.y})`}
            style={{
              cursor: onWordClick ? 'pointer' : 'default',
              transition: 'all 0.2s ease',
              opacity: hoveredWord && hoveredWord !== word.text ? 0.4 : 1,
              fontWeight: hoveredWord === word.text ? 'bold' : 'normal',
            }}
            onMouseEnter={() => setHoveredWord(word.text)}
            onMouseLeave={() => setHoveredWord(null)}
            onClick={() => onWordClick?.(word.text)}
          >
            {word.text}
          </text>
        ))}
      </svg>

      {hoveredWord && (
        <div className="absolute bottom-2 left-2 bg-card border rounded px-2 py-1 text-sm shadow">
          <span className="font-medium">{hoveredWord}</span>
          <span className="text-muted-foreground ml-2">
            {words.find((w) => w.text === hoveredWord)?.value} occurrences
          </span>
        </div>
      )}
    </div>
  );
}

/**
 * Extract words from text for word cloud
 */
export function extractWords(
  text: string,
  minLength: number = 3,
  maxWords: number = 50
): WordCloudWord[] {
  const stopWords = new Set([
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
    'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'been',
    'be', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
    'should', 'may', 'might', 'must', 'shall', 'can', 'need', 'dare', 'ought',
    'used', 'this', 'that', 'these', 'those', 'it', 'its', 'they', 'them',
    'their', 'what', 'which', 'who', 'whom', 'when', 'where', 'why', 'how',
  ]);

  const wordCounts = new Map<string, number>();
  const words = text.toLowerCase().match(/\b[a-z]+\b/g) || [];

  for (const word of words) {
    if (word.length >= minLength && !stopWords.has(word)) {
      wordCounts.set(word, (wordCounts.get(word) || 0) + 1);
    }
  }

  return Array.from(wordCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, maxWords)
    .map(([text, value]) => ({ text, value }));
}

/**
 * Word Cloud with data fetching
 */
interface ResearchWordCloudProps {
  researchId?: string;
  onWordClick?: (word: string) => void;
}

export function ResearchWordCloud({ researchId, onWordClick }: ResearchWordCloudProps) {
  const [words, setWords] = useState<WordCloudWord[]>([]);
  const [loading, setLoading] = useState(true);

  useMemo(() => {
    async function fetchWords() {
      try {
        const url = researchId
          ? `/api/research/${researchId}/wordcloud`
          : '/api/research/wordcloud';
        const response = await fetch(url);
        if (response.ok) {
          const data = await response.json();
          setWords(data.words);
        }
      } catch (error) {
        console.error('Failed to fetch word cloud data:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchWords();
  }, [researchId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="bg-card border rounded-lg p-4">
      <h3 className="font-semibold mb-4">Research Topics</h3>
      <WordCloud words={words} onWordClick={onWordClick} />
    </div>
  );
}
