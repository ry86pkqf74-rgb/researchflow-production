import type { ResearchBrief } from "@packages/core/types";

export function countWords(text: string): number {
  if (!text || !text.trim()) return 0;
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export function truncateToWordLimit(text: string, limit: number): string {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length <= limit) return text;
  return words.slice(0, limit).join(" ") + "...";
}

interface AbstractSection {
  title: string;
  content: string;
  wordCount: number;
}

export function generateBackgroundSection(brief: ResearchBrief): string {
  const objective = brief.studyObjectives[0] || "examine key clinical outcomes";
  const population = brief.population || "the study population";
  
  return `Understanding ${objective.toLowerCase()} in ${population} remains an important area of clinical investigation. ` +
    `Current evidence regarding the relationship between ${brief.exposure || "the exposure of interest"} and ` +
    `${brief.outcomes?.[0] || "key outcomes"} is limited, warranting further study.`;
}

export function generateObjectiveSection(brief: ResearchBrief): string {
  const objectives = brief.studyObjectives.length > 0 
    ? brief.studyObjectives.join("; ").toLowerCase()
    : "evaluate the association between exposure and outcomes";
  
  return `The objective of this study was to ${objectives} ` +
    `in ${brief.population || "the target population"} ` +
    `over ${brief.timeframe || "the study period"}.`;
}

export function generateMethodsSection(brief: ResearchBrief): string {
  const parts: string[] = [];
  
  parts.push(`This ${brief.timeframe ? "retrospective cohort" : "observational"} study examined ` +
    `${brief.population || "participants meeting inclusion criteria"}.`);
  
  if (brief.exposure) {
    parts.push(`The primary exposure was ${brief.exposure}` +
      `${brief.comparator ? `, compared with ${brief.comparator}` : ""}.`);
  }
  
  if (brief.outcomes && brief.outcomes.length > 0) {
    parts.push(`Outcomes assessed included ${brief.outcomes.join(", ")}.`);
  }
  
  if (brief.keyConfounders && brief.keyConfounders.length > 0) {
    parts.push(`Analyses were adjusted for ${brief.keyConfounders.slice(0, 3).join(", ")}${brief.keyConfounders.length > 3 ? ", and other covariates" : ""}.`);
  }
  
  return parts.join(" ");
}

export function generateResultsSection(_brief: ResearchBrief): string {
  return "[Results will be populated after analysis completion. " +
    "This section will include key findings, effect sizes, confidence intervals, and p-values.]";
}

export function generateConclusionSection(brief: ResearchBrief): string {
  const exposure = brief.exposure || "the exposure";
  const outcome = brief.outcomes?.[0] || "the primary outcome";
  
  return `This study will provide evidence regarding the association between ${exposure} and ${outcome}. ` +
    `[Conclusions will be finalized based on study results and should address clinical implications.]`;
}

export interface GeneratedAbstract {
  background: AbstractSection;
  objective: AbstractSection;
  methods: AbstractSection;
  results: AbstractSection;
  conclusion: AbstractSection;
  fullText: string;
  totalWords: number;
}

export function generateAbstract(brief: ResearchBrief, wordLimit: number): GeneratedAbstract {
  const background = generateBackgroundSection(brief);
  const objective = generateObjectiveSection(brief);
  const methods = generateMethodsSection(brief);
  const results = generateResultsSection(brief);
  const conclusion = generateConclusionSection(brief);
  
  const sections: AbstractSection[] = [
    { title: "Background", content: background, wordCount: countWords(background) },
    { title: "Objective", content: objective, wordCount: countWords(objective) },
    { title: "Methods", content: methods, wordCount: countWords(methods) },
    { title: "Results", content: results, wordCount: countWords(results) },
    { title: "Conclusion", content: conclusion, wordCount: countWords(conclusion) },
  ];
  
  const fullText = sections.map(s => `${s.title}: ${s.content}`).join("\n\n");
  const totalWords = countWords(fullText.replace(/Background:|Objective:|Methods:|Results:|Conclusion:/g, ""));
  
  let adjustedText = fullText;
  if (totalWords > wordLimit) {
    adjustedText = truncateToWordLimit(fullText, wordLimit);
  }
  
  return {
    background: sections[0],
    objective: sections[1],
    methods: sections[2],
    results: sections[3],
    conclusion: sections[4],
    fullText: adjustedText,
    totalWords,
  };
}

export function generateStructuredAbstract(brief: ResearchBrief, wordLimit: number): string {
  const abstract = generateAbstract(brief, wordLimit);
  
  const lines = [
    `BACKGROUND: ${abstract.background.content}`,
    "",
    `OBJECTIVE: ${abstract.objective.content}`,
    "",
    `METHODS: ${abstract.methods.content}`,
    "",
    `RESULTS: ${abstract.results.content}`,
    "",
    `CONCLUSION: ${abstract.conclusion.content}`,
  ];
  
  return lines.join("\n");
}

export function getWordLimitRecommendation(wordLimit: 150 | 250 | 350): string {
  switch (wordLimit) {
    case 150:
      return "Concise format suitable for letters and brief communications";
    case 250:
      return "Standard format for most clinical journals";
    case 350:
      return "Extended format for comprehensive original research";
    default:
      return "";
  }
}
