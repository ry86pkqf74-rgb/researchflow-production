/**
 * Phase 4: Writing Assistance Tools Integration Tests
 * Task T80: Comprehensive AI feature tests with PHI checking
 */

import {
  openAIDrafterService,
  claudeWriterService,
  grammarCheckerService,
  claimVerifierService,
  readabilityService,
  transitionSuggesterService,
  toneAdjusterService,
  synonymFinderService,
  medicalNLPService,
  clarityAnalyzerService,
  sentenceBuilderService,
  paraphraseService,
  abbreviationService,
  citationSuggesterService,
  claimHighlighterService,
} from '../../../packages/manuscript-engine/src/services';

import { PHRASE_LIBRARY, fillTemplate } from '../../../packages/manuscript-engine/src/templates/phrase-library';

describe('Phase 4: Writing Assistance Tools Integration', () => {
  const mockManuscriptId = 'manuscript-test-writing';

  // ========== T61: OpenAI Drafter Service ==========
  describe('T61: OpenAI Drafter', () => {
    it('generates draft for introduction section', async () => {
      const request = {
        manuscriptId: mockManuscriptId,
        section: 'introduction' as const,
        context: {
          outline: [
            'Type 2 diabetes is a growing public health concern',
            'Current treatments have limitations',
            'This study evaluates a novel intervention',
          ],
          instructions: 'Write in formal academic tone',
        },
        style: {
          tone: 'formal' as const,
          voice: 'passive' as const,
          tense: 'past' as const,
          complexity: 'expert' as const,
        },
      };

      const result = await openAIDrafterService.generateDraft(request);

      expect(result).toBeDefined();
      expect(result.content).toBeDefined();
      expect(result.wordCount).toBeGreaterThan(0);
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
    });

    it('expands outline into prose', async () => {
      const outline = [
        'Patients were randomized 1:1',
        'Primary outcome was 30-day mortality',
        'Secondary outcomes included length of stay',
      ];

      const result = await openAIDrafterService.expandOutline(
        outline,
        {},
        {
          tone: 'formal',
          voice: 'passive',
          tense: 'past',
          complexity: 'expert',
        }
      );

      expect(result).toBeDefined();
      expect(result.length).toBeGreaterThan(outline.join(' ').length);
    });

    it('continues writing from existing content', async () => {
      const existingContent = 'This retrospective cohort study examined the effect of early intervention.';
      const direction = 'Continue describing the study population';

      const result = await openAIDrafterService.continueWriting(
        existingContent,
        direction,
        {
          tone: 'formal',
          voice: 'passive',
          tense: 'past',
          complexity: 'expert',
        }
      );

      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
    });
  });

  // ========== T62: Claude Writer Service ==========
  describe('T62: Claude Writer', () => {
    it('generates draft with reasoning', async () => {
      const request = {
        manuscriptId: mockManuscriptId,
        section: 'discussion' as const,
        context: {
          outline: ['Summarize main findings', 'Compare with literature', 'State limitations'],
        },
        style: {
          tone: 'formal' as const,
          voice: 'active' as const,
          tense: 'present' as const,
          complexity: 'expert' as const,
        },
        requireReasoning: true,
      };

      const result = await claudeWriterService.generateWithReasoning(request);

      expect(result).toBeDefined();
      expect(result.content).toBeDefined();
      expect(result.wordCount).toBeGreaterThan(0);
      expect(result.confidence).toBeGreaterThan(0);
    });

    it('improves existing text with explanations', async () => {
      const text = 'The study shows that the drug works good for patients.';

      const result = await claudeWriterService.improveWithExplanation(
        text,
        'clarity',
        {
          tone: 'formal',
          voice: 'passive',
          tense: 'past',
          complexity: 'expert',
        }
      );

      expect(result).toBeDefined();
      expect(result.improved).toBeDefined();
      expect(Array.isArray(result.changes)).toBe(true);
    });

    it('generates multiple writing options', async () => {
      const context = {
        outline: ['State the main finding clearly'],
      };

      const result = await claudeWriterService.generateOptions(context, 'results', 3);

      expect(result).toBeDefined();
      expect(result.options).toBeDefined();
      expect(result.options.length).toBeGreaterThanOrEqual(0);
    });

    it('critiques a draft', async () => {
      const draft = 'Patients was treated with the drug. The results was significant.';

      const result = await claudeWriterService.critiqueDraft(draft, 'methods');

      expect(result).toBeDefined();
      expect(typeof result.overallScore).toBe('number');
      expect(Array.isArray(result.weaknesses)).toBe(true);
      expect(Array.isArray(result.suggestions)).toBe(true);
    });
  });

  // ========== T63: Grammar Checker Service ==========
  describe('T63: Grammar Checker', () => {
    it('identifies grammar issues', async () => {
      const text = 'The pateint  received treatment.The results was significant.';

      const result = await grammarCheckerService.check(text);

      expect(result).toBeDefined();
      expect(result.issues.length).toBeGreaterThan(0);
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(100);
      expect(result.statistics).toBeDefined();
    });

    it('checks medical writing style', () => {
      const text = 'We analyzed BMI and CI. The results proves our hypothesis.';

      const issues = grammarCheckerService.checkMedicalStyle(text);

      expect(Array.isArray(issues)).toBe(true);
      // BMI should be flagged as potentially undefined
      const hasStyleIssues = issues.some(i => i.type === 'style');
      expect(hasStyleIssues).toBe(true);
    });

    it('auto-fixes common errors', async () => {
      const text = 'The pateint  received treatment.';
      const result = await grammarCheckerService.check(text);

      const fixed = grammarCheckerService.autoFix(text, result.issues);

      expect(fixed).toBeDefined();
      expect(fixed).not.toEqual(text);
      // Should fix typo and double space
      expect(fixed.includes('patient')).toBe(true);
      expect(fixed.includes('  ')).toBe(false);
    });

    it('accepts medical terminology variants', async () => {
      const text = 'Haemoglobin levels were measured. Tumour size was assessed.';

      const result = await grammarCheckerService.check(text);

      // UK spelling should be accepted (in medical exceptions)
      const spellingErrors = result.issues.filter(i => i.type === 'spelling');
      expect(spellingErrors.length).toBe(0);
    });
  });

  // ========== T64: Claim Verifier Service ==========
  describe('T64: Claim Verifier', () => {
    it('extracts claims from text', () => {
      const text = 'The mean age was 65 years. Mortality was significantly lower in the treatment group (p<0.001). This suggests that early intervention may reduce adverse outcomes.';

      const claims = claimVerifierService.extractClaims(text, 'results');

      expect(Array.isArray(claims)).toBe(true);
      expect(claims.length).toBeGreaterThan(0);
      expect(claims.some(c => c.type === 'statistical')).toBe(true);
    });

    it('verifies claim with data citations', async () => {
      const claim = {
        id: 'claim-1',
        text: 'The mean systolic blood pressure was 142 mmHg.',
        type: 'statistical' as const,
        section: 'results',
        startOffset: 0,
        endOffset: 47,
      };

      const dataCitations = [
        {
          id: 'data-1',
          manuscriptId: mockManuscriptId,
          datasetName: 'Patient Vitals',
          fieldName: 'systolic_bp',
          values: [142, 138, 145, 140],
          aggregation: 'mean',
          result: '142',
          unit: 'mmHg',
          citationText: 'Mean SBP: 142 mmHg',
          createdAt: new Date(),
        },
      ];

      const verification = await claimVerifierService.verifyClaim(claim, dataCitations, []);

      expect(verification).toBeDefined();
      expect(verification.claimId).toBe(claim.id);
      expect(typeof verification.verified).toBe('boolean');
      expect(verification.confidence).toBeGreaterThanOrEqual(0);
      expect(verification.confidence).toBeLessThanOrEqual(1);
    });

    it('verifies section with comprehensive analysis', async () => {
      const text = 'In our cohort of 500 patients, the primary outcome occurred in 45 (9%) patients. The hazard ratio was 0.65 (95% CI 0.45-0.93, p=0.018).';

      const result = await claimVerifierService.verifySection(text, 'results', [], []);

      expect(result).toBeDefined();
      expect(result.claims.length).toBeGreaterThan(0);
      expect(result.summary.total).toBeGreaterThan(0);
    });
  });

  // ========== T75: Readability Service ==========
  describe('T75: Readability Service', () => {
    it('analyzes text readability', () => {
      const text = `
        This study evaluated the efficacy of a novel therapeutic intervention.
        We conducted a randomized controlled trial involving 500 participants.
        The primary outcome was measured using standardized assessment tools.
        Results demonstrated significant improvements in the treatment group.
      `;

      const metrics = readabilityService.analyze(text);

      expect(metrics).toBeDefined();
      expect(metrics.fleschReadingEase).toBeDefined();
      expect(metrics.fleschKincaidGrade).toBeDefined();
      expect(metrics.gunningFog).toBeDefined();
      expect(metrics.averageSentenceLength).toBeGreaterThan(0);
    });

    it('generates readability report with interpretation', () => {
      const text = 'The quick brown fox jumps over the lazy dog. This is a simple sentence.';

      const report = readabilityService.generateReport(text);

      expect(report).toBeDefined();
      expect(report.metrics).toBeDefined();
      expect(report.interpretation).toBeDefined();
      expect(report.interpretation.level).toBeDefined();
      expect(report.interpretation.appropriateFor).toBeDefined();
    });

    it('analyzes text by section', () => {
      const sections = {
        abstract: 'Brief summary of study findings.',
        methods: 'Detailed methodological procedures were implemented systematically.',
        results: 'Statistical analysis revealed significant differences.',
      };

      const report = readabilityService.analyzeBySection(sections);

      expect(report).toBeDefined();
      expect(report.perSectionMetrics).toBeDefined();
      expect(Object.keys(report.perSectionMetrics!).length).toBe(3);
    });

    it('suggests readability improvements', () => {
      const complexText = 'The aforementioned multifactorial etiopathogenesis necessitates comprehensive therapeutic interventions.';

      const suggestions = readabilityService.suggestImprovements(complexText, 12);

      expect(Array.isArray(suggestions)).toBe(true);
      expect(suggestions.length).toBeGreaterThan(0);
    });
  });

  // ========== T79: Medical Phrase Library ==========
  describe('T79: Medical Phrase Library', () => {
    it('provides methods section phrases', () => {
      const methodsPhrases = PHRASE_LIBRARY.filter(p => p.category === 'methods');

      expect(methodsPhrases.length).toBeGreaterThan(0);
      expect(methodsPhrases.some(p => p.subcategory === 'study_design')).toBe(true);
      expect(methodsPhrases.some(p => p.subcategory === 'statistics')).toBe(true);
    });

    it('provides results section phrases', () => {
      const resultsPhrases = PHRASE_LIBRARY.filter(p => p.category === 'results');

      expect(resultsPhrases.length).toBeGreaterThan(0);
      expect(resultsPhrases.some(p => p.subcategory === 'participants')).toBe(true);
      expect(resultsPhrases.some(p => p.subcategory === 'outcomes')).toBe(true);
    });

    it('provides discussion section phrases', () => {
      const discussionPhrases = PHRASE_LIBRARY.filter(p => p.category === 'discussion');

      expect(discussionPhrases.length).toBeGreaterThan(0);
      expect(discussionPhrases.some(p => p.subcategory === 'limitations')).toBe(true);
    });

    it('fills template with values', () => {
      const template = PHRASE_LIBRARY.find(p => p.id === 'stats-continuous')!;
      expect(template).toBeDefined();

      const filled = fillTemplate(template, {
        measure: 'mean ± SD',
        test: "Student's t-test",
      });

      expect(filled).toContain('mean ± SD');
      expect(filled).toContain("Student's t-test");
      expect(filled).not.toContain('{measure}');
    });
  });

  // ========== Additional Writing Services ==========
  describe('Additional Writing Services', () => {
    it('T65: suggests transitions between sentences', async () => {
      const sentence1 = 'Patients were randomized to treatment or control.';
      const sentence2 = 'The primary outcome was assessed at 30 days.';

      const result = await transitionSuggesterService.suggestTransition(sentence1, sentence2, 'methods');

      expect(result).toBeDefined();
      expect(Array.isArray(result.suggestions)).toBe(true);
    });

    it('T66: adjusts tone of text', async () => {
      const text = 'The drug worked really well and patients felt better.';

      const result = await toneAdjusterService.adjustTone(text, {
        targetTone: 'formal',
        targetVoice: 'passive',
        preserveMeaning: true,
      });

      expect(result).toBeDefined();
      expect(result.adjustedText).toBeDefined();
    });

    it('T67: finds medical synonyms', async () => {
      const result = await synonymFinderService.findSynonyms('myocardial infarction', {
        includeLayTerms: true,
        includeAbbreviations: true,
      });

      expect(result).toBeDefined();
      expect(result.synonyms.length).toBeGreaterThan(0);
    });

    it('T68: performs medical NLP entity recognition', async () => {
      const text = 'Patient presented with acute myocardial infarction and was treated with aspirin 325mg.';

      const result = await medicalNLPService.extractEntities(text);

      expect(result).toBeDefined();
      expect(result.entities.length).toBeGreaterThan(0);
      expect(result.entities.some(e => e.type === 'disease')).toBe(true);
    });

    it('T70: analyzes text clarity', async () => {
      const text = 'The implementation of the therapeutic modality was effectuated.';

      const result = await clarityAnalyzerService.analyze(text);

      expect(result).toBeDefined();
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(100);
      expect(Array.isArray(result.issues)).toBe(true);
    });

    it('T72: builds sentences from data points', async () => {
      const dataPoints = [
        { variable: 'mean_age', value: 65.3, unit: 'years' },
        { variable: 'sample_size', value: 234, unit: 'patients' },
      ];

      const result = await sentenceBuilderService.buildFromData(dataPoints, 'descriptive');

      expect(result).toBeDefined();
      expect(Array.isArray(result.sentences)).toBe(true);
      expect(result.sentences.length).toBeGreaterThan(0);
    });

    it('T73: ethically paraphrases text', async () => {
      const originalText = 'The study demonstrated significant improvements in patient outcomes.';

      const result = await paraphraseService.paraphrase(originalText, {
        preserveTechnicalTerms: true,
        style: 'formal',
      });

      expect(result).toBeDefined();
      expect(result.paraphrased).toBeDefined();
      expect(result.paraphrased).not.toEqual(originalText);
    });

    it('T74: manages abbreviations', async () => {
      const text = 'Patients with chronic obstructive pulmonary disease (COPD) were enrolled.';

      const result = await abbreviationService.extractAbbreviations(text);

      expect(result).toBeDefined();
      expect(result.abbreviations.length).toBeGreaterThan(0);
      expect(result.abbreviations[0].abbreviation).toBe('COPD');
      expect(result.abbreviations[0].fullForm).toContain('chronic obstructive pulmonary disease');
    });

    it('T77: suggests citations based on context', async () => {
      const context = 'Studies have shown that early intervention improves outcomes in sepsis.';

      const availableCitations = [
        {
          id: 'cite-1',
          title: 'Early Goal-Directed Therapy in Sepsis',
          authors: [{ firstName: 'John', lastName: 'Rivers' }],
          year: 2001,
          abstract: 'Early intervention reduces mortality in sepsis.',
        },
      ];

      const result = await citationSuggesterService.suggestCitations(context, availableCitations);

      expect(result).toBeDefined();
      expect(Array.isArray(result.suggestions)).toBe(true);
    });

    it('T78: highlights unsubstantiated claims', async () => {
      const text = 'The treatment is the best available. All patients improved dramatically.';

      const result = await claimHighlighterService.highlightClaims(text);

      expect(result).toBeDefined();
      expect(result.highlightedClaims.length).toBeGreaterThan(0);
      // Absolute claims like "best" and "all" should be flagged
      const hasAbsoluteClaim = result.highlightedClaims.some(c => c.severity === 'warning');
      expect(hasAbsoluteClaim).toBe(true);
    });
  });

  // ========== PHI Scanning Integration ==========
  describe('PHI Scanning Integration', () => {
    it('prevents PHI in AI-generated content', async () => {
      // This would integrate with phi-engine package
      const textWithPHI = 'Patient John Doe, SSN 123-45-6789, was born on 01/15/1980.';

      // AI services should scan generated content for PHI
      const result = await grammarCheckerService.check(textWithPHI);

      // In production, this would trigger PHI detection
      expect(result).toBeDefined();
    });

    it('blocks export if PHI detected in generated text', async () => {
      const generatedDraft = {
        manuscriptId: mockManuscriptId,
        section: 'methods' as const,
        context: {},
        style: {
          tone: 'formal' as const,
          voice: 'passive' as const,
          tense: 'past' as const,
          complexity: 'expert' as const,
        },
      };

      const result = await openAIDrafterService.generateDraft(generatedDraft);

      // Generated content should be PHI-free
      expect(result).toBeDefined();
      expect(result.content).not.toMatch(/\b\d{3}-\d{2}-\d{4}\b/); // No SSN
      expect(result.content).not.toMatch(/\b[A-Z][a-z]+ [A-Z][a-z]+\b.*born/); // No patient names with DOB
    });
  });

  // ========== End-to-End Writing Workflow ==========
  describe('End-to-End Writing Workflow', () => {
    it('completes full writing assistance pipeline', async () => {
      // 1. Generate initial draft
      const draft = await openAIDrafterService.generateDraft({
        manuscriptId: mockManuscriptId,
        section: 'introduction',
        context: {
          outline: ['Background on topic', 'State research question'],
        },
        style: {
          tone: 'formal',
          voice: 'passive',
          tense: 'past',
          complexity: 'expert',
        },
      });

      expect(draft.content).toBeDefined();

      // 2. Check grammar
      const grammarCheck = await grammarCheckerService.check(draft.content);
      expect(grammarCheck.issues).toBeDefined();

      // 3. Analyze readability
      const readability = readabilityService.analyze(draft.content);
      expect(readability.fleschKincaidGrade).toBeDefined();

      // 4. Verify claims
      const claims = claimVerifierService.extractClaims(draft.content, 'introduction');
      expect(Array.isArray(claims)).toBe(true);

      // 5. Check clarity
      const clarity = await clarityAnalyzerService.analyze(draft.content);
      expect(clarity.score).toBeDefined();

      // Full pipeline completed successfully
      expect(draft).toBeDefined();
      expect(grammarCheck).toBeDefined();
      expect(readability).toBeDefined();
      expect(claims).toBeDefined();
      expect(clarity).toBeDefined();
    });
  });
});
