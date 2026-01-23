/**
 * Word Budget Validator
 * Phase 3.2: Section word count validation for manuscripts
 * 
 * Enforces journal-standard word limits for each IMRaD section.
 * Supports custom budgets per manuscript or journal target.
 */

export interface WordBudget {
  section: string;
  min: number;
  max: number;
  target?: number;
  description?: string;
}

export interface WordBudgetValidation {
  valid: boolean;
  wordCount: number;
  characterCount: number;
  paragraphCount: number;
  sentenceCount: number;
  message: string;
  deviation?: {
    fromMin?: number;
    fromMax?: number;
    fromTarget?: number;
    percentage: number;
  };
  suggestions?: string[];
}

/**
 * Default word budgets based on common journal requirements
 */
export const DEFAULT_BUDGETS: WordBudget[] = [
  { 
    section: 'title', 
    min: 5, 
    max: 25, 
    target: 15,
    description: 'Concise, informative title' 
  },
  { 
    section: 'abstract', 
    min: 150, 
    max: 300, 
    target: 250,
    description: 'Structured abstract with key findings' 
  },
  { 
    section: 'introduction', 
    min: 400, 
    max: 800, 
    target: 600,
    description: 'Background, rationale, and objectives' 
  },
  { 
    section: 'methods', 
    min: 800, 
    max: 2000, 
    target: 1200,
    description: 'Detailed methodology for reproducibility' 
  },
  { 
    section: 'results', 
    min: 600, 
    max: 1500, 
    target: 1000,
    description: 'Clear presentation of findings' 
  },
  { 
    section: 'discussion', 
    min: 800, 
    max: 1500, 
    target: 1200,
    description: 'Interpretation, limitations, implications' 
  },
  { 
    section: 'conclusion', 
    min: 100, 
    max: 300, 
    target: 200,
    description: 'Summary of key findings and implications' 
  },
  { 
    section: 'acknowledgements', 
    min: 0, 
    max: 150, 
    target: 75,
    description: 'Funding sources and contributions' 
  }
];

/**
 * Journal-specific budget presets
 */
export const JOURNAL_PRESETS: Record<string, WordBudget[]> = {
  'jama': [
    { section: 'abstract', min: 200, max: 350 },
    { section: 'introduction', min: 300, max: 600 },
    { section: 'methods', min: 800, max: 1500 },
    { section: 'results', min: 600, max: 1200 },
    { section: 'discussion', min: 600, max: 1200 }
  ],
  'nejm': [
    { section: 'abstract', min: 200, max: 300 },
    { section: 'introduction', min: 200, max: 400 },
    { section: 'methods', min: 600, max: 1200 },
    { section: 'results', min: 500, max: 1000 },
    { section: 'discussion', min: 500, max: 1000 }
  ],
  'lancet': [
    { section: 'abstract', min: 250, max: 300 },
    { section: 'introduction', min: 300, max: 500 },
    { section: 'methods', min: 800, max: 1500 },
    { section: 'results', min: 600, max: 1200 },
    { section: 'discussion', min: 600, max: 1000 }
  ],
  'surgery': [
    { section: 'abstract', min: 200, max: 250 },
    { section: 'introduction', min: 400, max: 600 },
    { section: 'methods', min: 800, max: 2000 },
    { section: 'results', min: 600, max: 1500 },
    { section: 'discussion', min: 800, max: 1500 }
  ]
};

/**
 * Count words in text
 */
export function countWords(text: string): number {
  if (!text || typeof text !== 'string') return 0;
  
  // Remove markdown/HTML formatting
  const cleaned = text
    .replace(/<[^>]*>/g, ' ')           // Remove HTML tags
    .replace(/```[\s\S]*?```/g, ' ')    // Remove code blocks
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1') // Convert links to text
    .replace(/[#*_~`]/g, '')            // Remove markdown symbols
    .replace(/\s+/g, ' ')               // Normalize whitespace
    .trim();
  
  if (!cleaned) return 0;
  
  return cleaned.split(/\s+/).filter(word => word.length > 0).length;
}

/**
 * Count characters in text
 */
export function countCharacters(text: string, includeSpaces = true): number {
  if (!text) return 0;
  return includeSpaces ? text.length : text.replace(/\s/g, '').length;
}

/**
 * Count paragraphs in text
 */
export function countParagraphs(text: string): number {
  if (!text) return 0;
  return text.split(/\n\s*\n/).filter(p => p.trim().length > 0).length;
}

/**
 * Count sentences in text
 */
export function countSentences(text: string): number {
  if (!text) return 0;
  // Match sentence-ending punctuation followed by space or end of string
  const sentences = text.match(/[.!?]+(?:\s|$)/g);
  return sentences ? sentences.length : 0;
}

/**
 * Validate word budget for a section
 */
export function validateWordBudget(
  content: string,
  section: string,
  budgets: WordBudget[] = DEFAULT_BUDGETS
): WordBudgetValidation {
  const wordCount = countWords(content);
  const characterCount = countCharacters(content);
  const paragraphCount = countParagraphs(content);
  const sentenceCount = countSentences(content);
  
  const budget = budgets.find(b => b.section.toLowerCase() === section.toLowerCase());
  
  if (!budget) {
    return {
      valid: true,
      wordCount,
      characterCount,
      paragraphCount,
      sentenceCount,
      message: `No budget defined for section: ${section}`
    };
  }
  
  const suggestions: string[] = [];
  let valid = true;
  let message = '';
  const deviation: WordBudgetValidation['deviation'] = {
    percentage: 0
  };
  
  if (wordCount < budget.min) {
    valid = false;
    deviation.fromMin = budget.min - wordCount;
    deviation.percentage = -Math.round((deviation.fromMin / budget.min) * 100);
    message = `${section} is too short: ${wordCount} words (minimum: ${budget.min})`;
    
    suggestions.push(`Add ${deviation.fromMin} more words to meet minimum requirement`);
    
    if (budget.section === 'methods') {
      suggestions.push('Consider adding more detail about study design, participants, or procedures');
    } else if (budget.section === 'discussion') {
      suggestions.push('Consider expanding on implications or comparisons with existing literature');
    } else if (budget.section === 'results') {
      suggestions.push('Consider adding more statistical details or subgroup analyses');
    }
  } else if (wordCount > budget.max) {
    valid = false;
    deviation.fromMax = wordCount - budget.max;
    deviation.percentage = Math.round((deviation.fromMax / budget.max) * 100);
    message = `${section} is too long: ${wordCount} words (maximum: ${budget.max})`;
    
    suggestions.push(`Remove ${deviation.fromMax} words to meet maximum requirement`);
    suggestions.push('Consider moving detailed methods to supplementary materials');
    suggestions.push('Look for redundant phrases or unnecessary qualifiers');
  } else {
    message = `${section} is within budget: ${wordCount} words (${budget.min}-${budget.max})`;
    
    if (budget.target) {
      deviation.fromTarget = wordCount - budget.target;
      deviation.percentage = Math.round((deviation.fromTarget / budget.target) * 100);
      
      if (Math.abs(deviation.percentage) <= 10) {
        message += ` - near target (${budget.target})`;
      }
    }
  }
  
  return {
    valid,
    wordCount,
    characterCount,
    paragraphCount,
    sentenceCount,
    message,
    deviation,
    suggestions: suggestions.length > 0 ? suggestions : undefined
  };
}

/**
 * Validate all sections of a manuscript
 */
export function validateManuscript(
  sections: Record<string, string>,
  budgets: WordBudget[] = DEFAULT_BUDGETS
): {
  valid: boolean;
  totalWords: number;
  sections: Record<string, WordBudgetValidation>;
  summary: string;
} {
  const results: Record<string, WordBudgetValidation> = {};
  let totalWords = 0;
  let allValid = true;
  const issues: string[] = [];
  
  for (const [section, content] of Object.entries(sections)) {
    const validation = validateWordBudget(content, section, budgets);
    results[section] = validation;
    totalWords += validation.wordCount;
    
    if (!validation.valid) {
      allValid = false;
      issues.push(validation.message);
    }
  }
  
  let summary: string;
  if (allValid) {
    summary = `All ${Object.keys(sections).length} sections are within word budget. Total: ${totalWords} words.`;
  } else {
    summary = `${issues.length} section(s) need adjustment: ${issues.join('; ')}`;
  }
  
  return {
    valid: allValid,
    totalWords,
    sections: results,
    summary
  };
}

/**
 * Get budget for a specific journal
 */
export function getJournalBudgets(journal: string): WordBudget[] {
  const key = journal.toLowerCase().replace(/[^a-z]/g, '');
  return JOURNAL_PRESETS[key] || DEFAULT_BUDGETS;
}

/**
 * Merge custom budgets with defaults
 */
export function mergeBudgets(
  customBudgets: Partial<WordBudget>[],
  baseBudgets: WordBudget[] = DEFAULT_BUDGETS
): WordBudget[] {
  const merged = [...baseBudgets];
  
  for (const custom of customBudgets) {
    if (!custom.section) continue;
    
    const idx = merged.findIndex(b => b.section === custom.section);
    if (idx >= 0) {
      merged[idx] = { ...merged[idx], ...custom };
    } else {
      merged.push(custom as WordBudget);
    }
  }
  
  return merged;
}

export default {
  validateWordBudget,
  validateManuscript,
  countWords,
  countCharacters,
  countParagraphs,
  countSentences,
  getJournalBudgets,
  mergeBudgets,
  DEFAULT_BUDGETS,
  JOURNAL_PRESETS
};
