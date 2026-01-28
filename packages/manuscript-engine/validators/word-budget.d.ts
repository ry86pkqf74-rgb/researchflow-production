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
export declare const DEFAULT_BUDGETS: WordBudget[];
/**
 * Validate content against word budget for a specific section
 */
export declare function validateWordBudget(content: string, section: string, customBudgets?: WordBudget[]): WordBudgetValidation;
/**
 * Validate all sections of a manuscript
 */
export declare function validateManuscript(sections: Record<string, string>, customBudgets?: WordBudget[]): Record<string, WordBudgetValidation>;
/**
 * Get total word count for all sections
 */
export declare function getTotalWordCount(sections: Record<string, string>): number;
/**
 * Check if manuscript is within typical journal limits (3000-5000 words)
 */
export declare function isWithinJournalLimits(sections: Record<string, string>, minTotal?: number, maxTotal?: number): {
    valid: boolean;
    totalWords: number;
    message: string;
};
//# sourceMappingURL=word-budget.d.ts.map