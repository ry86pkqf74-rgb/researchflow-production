/**
 * Word Budget Validator for Manuscript Sections
 * Ensures manuscript sections stay within journal-appropriate word limits
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
  section: string;
  min: number;
  max: number;
  message: string;
  overBy?: number;
  underBy?: number;
}

/**
 * Default word budgets based on typical clinical research journal requirements
 */
export const DEFAULT_BUDGETS: WordBudget[] = [
  {
    section: 'abstract',
    min: 150,
    max: 300,
    target: 250,
    description: 'Structured abstract with Background, Methods, Results, Conclusions'
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
    description: 'Study design, participants, interventions, outcomes, analysis'
  },
  {
    section: 'results',
    min: 800,
    max: 2500,
    target: 1500,
    description: 'Findings with tables and figures referenced'
  },
  {
    section: 'discussion',
    min: 1000,
    max: 2500,
    target: 1800,
    description: 'Interpretation, limitations, implications, conclusions'
  },
  {
    section: 'conclusions',
    min: 100,
    max: 300,
    target: 200,
    description: 'Key takeaways and clinical implications'
  }
];

/**
 * Count words in a text string
 */
function countWords(text: string): number {
  if (!text || typeof text !== 'string') return 0;
  return text
    .trim()
    .split(/\s+/)
    .filter(word => word.length > 0)
    .length;
}

/**
 * Validate content against word budget for a specific section
 */
export function validateWordBudget(
  content: string,
  section: string,
  customBudgets?: WordBudget[]
): WordBudgetValidation {
  const budgets = customBudgets || DEFAULT_BUDGETS;
  const budget = budgets.find(b => b.section.toLowerCase() === section.toLowerCase());
  
  const wordCount = countWords(content);
  
  if (!budget) {
    return {
      valid: true,
      wordCount,
      section,
      min: 0,
      max: Infinity,
      message: `No budget defined for section "${section}". Word count: ${wordCount}`
    };
  }
  
  const { min, max } = budget;
  
  if (wordCount < min) {
    return {
      valid: false,
      wordCount,
      section,
      min,
      max,
      message: `Section "${section}" is under minimum (${wordCount}/${min} words)`,
      underBy: min - wordCount
    };
  }
  
  if (wordCount > max) {
    return {
      valid: false,
      wordCount,
      section,
      min,
      max,
      message: `Section "${section}" exceeds maximum (${wordCount}/${max} words)`,
      overBy: wordCount - max
    };
  }
  
  return {
    valid: true,
    wordCount,
    section,
    min,
    max,
    message: `Section "${section}" is within budget (${wordCount} words, range: ${min}-${max})`
  };
}

/**
 * Validate all sections of a manuscript
 */
export function validateManuscript(
  sections: Record<string, string>,
  customBudgets?: WordBudget[]
): Record<string, WordBudgetValidation> {
  const results: Record<string, WordBudgetValidation> = {};
  
  for (const [section, content] of Object.entries(sections)) {
    results[section] = validateWordBudget(content, section, customBudgets);
  }
  
  return results;
}

/**
 * Get total word count for all sections
 */
export function getTotalWordCount(sections: Record<string, string>): number {
  return Object.values(sections).reduce((total, content) => {
    return total + countWords(content);
  }, 0);
}

/**
 * Check if manuscript is within typical journal limits (3000-5000 words)
 */
export function isWithinJournalLimits(
  sections: Record<string, string>,
  minTotal: number = 3000,
  maxTotal: number = 5000
): { valid: boolean; totalWords: number; message: string } {
  const totalWords = getTotalWordCount(sections);
  
  if (totalWords < minTotal) {
    return {
      valid: false,
      totalWords,
      message: `Manuscript is under minimum total (${totalWords}/${minTotal} words)`
    };
  }
  
  if (totalWords > maxTotal) {
    return {
      valid: false,
      totalWords,
      message: `Manuscript exceeds maximum total (${totalWords}/${maxTotal} words)`
    };
  }
  
  return {
    valid: true,
    totalWords,
    message: `Manuscript is within limits (${totalWords} words, range: ${minTotal}-${maxTotal})`
  };
}
