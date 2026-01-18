# @researchflow/manuscript-engine

AI-powered writing assistance tools for medical manuscript generation.

## Overview

Phase 4 of the manuscript-engine package provides comprehensive AI writing tools including:

- **AI Writing Services** (Tasks 61-70): Draft generation, grammar checking, claim verification, tone adjustment, and more
- **Advanced Tools** (Tasks 71-80): Data-driven sentence building, readability analysis, abbreviation management, citation suggestions, and claim highlighting

## Features

### AI Writing Services

1. **OpenAI Drafter** - Generate initial drafts using GPT models
2. **Claude Writer** - Reasoned paragraph generation with chain-of-thought
3. **Grammar Checker** - AI-powered grammar and style checking
4. **Claim Verifier** - Verify claims against data and literature
5. **Transition Suggester** - Context-aware transition suggestions
6. **Tone Adjuster** - Adjust writing tone (formal/semi-formal/clinical)
7. **Synonym Finder** - Medical terminology-aware synonyms
8. **Medical NLP** - Entity recognition and terminology standardization
9. **Clarity Analyzer** - AI-powered clarity feedback
10. **Paraphrase Service** - AI-assisted paraphrasing with originality checks

### Advanced Tools

11. **Sentence Builder** - Construct data-driven sentences
12. **Readability Service** - Calculate Flesch-Kincaid, Gunning Fog, and other metrics
13. **Abbreviation Manager** - Track and manage abbreviations
14. **Citation Suggester** - Context-based citation recommendations
15. **Claim Highlighter** - Highlight unsubstantiated claims

## Installation

```bash
npm install @researchflow/manuscript-engine
```

## Usage

### Initialize All Services

```typescript
import { initializeManuscriptEngine } from '@researchflow/manuscript-engine';

const services = initializeManuscriptEngine();
```

### Generate Draft Section

```typescript
import { getOpenAIDrafter } from '@researchflow/manuscript-engine';

const drafter = getOpenAIDrafter();

const result = await drafter.generateDraft('introduction', {
  section: 'introduction',
  studyType: 'randomized controlled trial',
  objective: 'Evaluate treatment efficacy in patients with condition X',
  keyFindings: ['Significant reduction in primary outcome', 'Well-tolerated'],
});

console.log(result.draft);
console.log(`Word count: ${result.metadata.wordCount}`);
```

### Check Grammar

```typescript
import { getGrammarChecker } from '@researchflow/manuscript-engine';

const grammar = getGrammarChecker();

const result = await grammar.checkGrammar(text);

if (!result.passed) {
  console.log(`Found ${result.issues.length} issues`);
  result.issues.forEach((issue) => {
    console.log(`${issue.severity}: ${issue.message}`);
  });
}
```

### Verify Claims

```typescript
import { getClaimVerifier } from '@researchflow/manuscript-engine';

const verifier = getClaimVerifier();

const result = await verifier.verifyClaim('Treatment reduced mortality by 25%', {
  studyData: { mortality_reduction: 0.25 },
  literatureContext: 'Previous studies showed 15-20% reduction',
});

console.log(`Verified: ${result.verified}`);
console.log(`Confidence: ${result.confidence}`);
console.log(`Recommendation: ${result.recommendation}`);
```

### Calculate Readability

```typescript
import { getReadability } from '@researchflow/manuscript-engine';

const readability = getReadability();

const metrics = readability.calculateMetrics(text);

console.log(`Flesch-Kincaid Grade: ${metrics.fleschKincaidGrade}`);
console.log(`Reading Ease: ${metrics.fleschReadingEase}`);
console.log(metrics.recommendation);
```

### Highlight Claims

```typescript
import { getClaimHighlighter } from '@researchflow/manuscript-engine';

const highlighter = getClaimHighlighter();

const result = await highlighter.highlightClaims(text, {
  studyData: { /* your data */ },
});

console.log(`Substantiation rate: ${(result.substantiationRate * 100).toFixed(1)}%`);
console.log(`Unreferenced claims: ${result.unreferencedClaimCount}`);
```

## Section Prompts

Use built-in prompts for section generation:

```typescript
import { buildIntroductionPrompt, buildMethodsPrompt } from '@researchflow/manuscript-engine';

const introPrompt = buildIntroductionPrompt({
  section: 'introduction',
  studyType: 'cohort study',
  objective: 'Assess long-term outcomes',
});

const methodsPrompt = buildMethodsPrompt({
  section: 'methods',
  studyType: 'cohort study',
  methodology: 'Retrospective analysis of 10-year follow-up data',
});
```

## Phrase Library

Access medical phrase templates:

```typescript
import { PHRASE_LIBRARY, getPhrasesBySection, fillPhrase } from '@researchflow/manuscript-engine';

// Get all introduction phrases
const introPhrases = getPhrasesBySection('introduction');

// Use a specific template
const phrase = introPhrases.find((p) => p.category === 'objective');
const filled = fillPhrase(phrase, {
  association_type: 'relationship',
  variable1: 'medication adherence',
  variable2: 'clinical outcomes',
});

console.log(filled);
// Output: "We aimed to evaluate the relationship between medication adherence and clinical outcomes"
```

## PHI Protection

All services route through @researchflow/ai-router which includes PHI protection:

- Input PHI scanning before AI processing
- Output PHI redaction
- Automatic blocking of requests with detected PHI
- Audit logging of all AI operations

## Testing

```bash
# Run unit tests
npm test

# Run tests with coverage (target: 85%)
npm run test:coverage

# Watch mode
npm run test:watch
```

## Architecture

### Singleton Pattern

All services use the singleton pattern for consistent state management:

```typescript
// Multiple calls return the same instance
const service1 = getGrammarChecker();
const service2 = getGrammarChecker();
console.log(service1 === service2); // true
```

### AI Router Integration

All AI operations route through @researchflow/ai-router for:
- Model tier selection (NANO/MINI/FRONTIER)
- Cost optimization
- Quality gating
- PHI protection
- Automatic tier escalation

### Zod Validation

All request payloads are validated using Zod schemas:

```typescript
import { SentenceConstructionRequestSchema } from '@researchflow/manuscript-engine';

const request = {
  data: { mean: 45.2, sd: 8.1 },
  context: 'Patient demographics',
  targetSection: 'methods',
  tone: 'clinical',
};

// Validates automatically
const validated = SentenceConstructionRequestSchema.parse(request);
```

## Type Safety

Full TypeScript support with comprehensive types:

```typescript
import type {
  ManuscriptSection,
  WritingTone,
  ReadabilityMetrics,
  ClaimVerificationResult,
  GrammarCheckResult,
} from '@researchflow/manuscript-engine';
```

## Performance

- Services are optimized for batch operations
- Parallel processing where possible
- Token usage and cost tracking
- Caching of AI responses

## License

Private - Part of ResearchFlow Production

## Support

For issues or questions, contact the ResearchFlow development team.
