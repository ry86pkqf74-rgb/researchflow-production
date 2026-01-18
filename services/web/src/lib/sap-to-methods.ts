export interface Endpoint {
  id: string;
  name: string;
  type: "primary" | "secondary";
  dataType: "continuous" | "binary" | "categorical" | "time-to-event";
}

export interface SAPConfig {
  studyTitle?: string;
  studyDesign?: string;
  endpoints: Endpoint[];
  selectedTests: string[];
  alphaLevel: string;
  correctionMethod: string;
  covariates: string[];
  subgroupAnalyses: string[];
  sensitivityAnalyses: string[];
  sampleSize?: number;
  powerAnalysis?: string;
}

interface StatisticalTestInfo {
  id: string;
  name: string;
  category: string;
  description: string;
  methodsText: string;
}

const STATISTICAL_TESTS_INFO: Record<string, StatisticalTestInfo> = {
  "ttest-ind": {
    id: "ttest-ind",
    name: "Independent t-test",
    category: "Comparison",
    description: "Compare means between two independent groups",
    methodsText: "Independent samples t-tests were used to compare continuous outcomes between groups",
  },
  "ttest-paired": {
    id: "ttest-paired",
    name: "Paired t-test",
    category: "Comparison",
    description: "Compare means between paired/matched samples",
    methodsText: "Paired t-tests were used to compare outcomes within matched pairs",
  },
  "anova-one": {
    id: "anova-one",
    name: "One-way ANOVA",
    category: "Comparison",
    description: "Compare means across 3+ independent groups",
    methodsText: "One-way analysis of variance (ANOVA) was performed to compare means across multiple groups",
  },
  "anova-two": {
    id: "anova-two",
    name: "Two-way ANOVA",
    category: "Comparison",
    description: "Analyze effects of two categorical factors",
    methodsText: "Two-way ANOVA was used to evaluate the effects of two categorical factors and their interaction",
  },
  "chi-square": {
    id: "chi-square",
    name: "Chi-square test",
    category: "Categorical",
    description: "Test association between categorical variables",
    methodsText: "Chi-square tests were used to assess associations between categorical variables",
  },
  "fisher": {
    id: "fisher",
    name: "Fisher's exact test",
    category: "Categorical",
    description: "Exact test for small sample categorical data",
    methodsText: "Fisher's exact test was used when expected cell frequencies were less than 5",
  },
  "linear-reg": {
    id: "linear-reg",
    name: "Linear Regression",
    category: "Regression",
    description: "Model continuous outcome with predictors",
    methodsText: "Multivariable linear regression models were constructed to evaluate the association between predictors and continuous outcomes",
  },
  "logistic-reg": {
    id: "logistic-reg",
    name: "Logistic Regression",
    category: "Regression",
    description: "Model binary outcome with predictors",
    methodsText: "Logistic regression was used to model binary outcomes, with results expressed as odds ratios (ORs) with 95% confidence intervals",
  },
  "cox-reg": {
    id: "cox-reg",
    name: "Cox Proportional Hazards",
    category: "Survival",
    description: "Time-to-event analysis with covariates",
    methodsText: "Cox proportional hazards regression was used for time-to-event analyses, with results expressed as hazard ratios (HRs) with 95% confidence intervals",
  },
  "kaplan-meier": {
    id: "kaplan-meier",
    name: "Kaplan-Meier",
    category: "Survival",
    description: "Survival curve estimation",
    methodsText: "Survival curves were estimated using the Kaplan-Meier method, and group differences were assessed using the log-rank test",
  },
  "mann-whitney": {
    id: "mann-whitney",
    name: "Mann-Whitney U",
    category: "Non-parametric",
    description: "Non-parametric comparison of two groups",
    methodsText: "Mann-Whitney U tests were used for non-normally distributed continuous variables",
  },
  "wilcoxon": {
    id: "wilcoxon",
    name: "Wilcoxon signed-rank",
    category: "Non-parametric",
    description: "Non-parametric paired comparison",
    methodsText: "Wilcoxon signed-rank tests were used for paired comparisons of non-normally distributed data",
  },
  "correlation": {
    id: "correlation",
    name: "Pearson Correlation",
    category: "Association",
    description: "Linear association between continuous variables",
    methodsText: "Pearson correlation coefficients were calculated to assess linear associations between continuous variables",
  },
  "spearman": {
    id: "spearman",
    name: "Spearman Correlation",
    category: "Association",
    description: "Monotonic association (rank-based)",
    methodsText: "Spearman rank correlation was used to assess monotonic associations",
  },
};

const CORRECTION_METHOD_TEXT: Record<string, string> = {
  none: "",
  bonferroni: "Bonferroni correction was applied to adjust for multiple comparisons",
  holm: "The Holm-Bonferroni step-down procedure was used to control the family-wise error rate",
  fdr: "The Benjamini-Hochberg procedure was used to control the false discovery rate",
};

export function formatAlphaLevel(alpha: string): string {
  const level = parseFloat(alpha);
  const confidence = (1 - level) * 100;
  return `Statistical significance was set at α = ${alpha} (two-sided), corresponding to ${confidence}% confidence intervals.`;
}

export function formatCovariates(covariates: string[]): string {
  if (covariates.length === 0) return "";
  if (covariates.length === 1) return `Models were adjusted for ${covariates[0]}.`;
  const last = covariates[covariates.length - 1];
  const rest = covariates.slice(0, -1).join(", ");
  return `Models were adjusted for the following covariates: ${rest}, and ${last}.`;
}

export function formatEndpoints(endpoints: Endpoint[]): string {
  const primary = endpoints.filter((e) => e.type === "primary");
  const secondary = endpoints.filter((e) => e.type === "secondary");

  const parts: string[] = [];

  if (primary.length > 0) {
    const names = primary.map((e) => e.name).join("; ");
    parts.push(
      `The primary outcome${primary.length > 1 ? "s were" : " was"} ${names}.`
    );
  }

  if (secondary.length > 0) {
    const names = secondary.map((e) => e.name).join("; ");
    parts.push(
      `Secondary outcome${secondary.length > 1 ? "s included" : " was"} ${names}.`
    );
  }

  return parts.join(" ");
}

export function formatDataTypes(endpoints: Endpoint[]): string {
  const types = new Set(endpoints.map((e) => e.dataType));
  const descriptions: string[] = [];

  if (types.has("continuous")) {
    descriptions.push("Continuous outcomes were analyzed as mean ± standard deviation or median (interquartile range) as appropriate.");
  }
  if (types.has("binary")) {
    descriptions.push("Binary outcomes were expressed as frequencies and percentages.");
  }
  if (types.has("categorical")) {
    descriptions.push("Categorical variables were summarized as counts and proportions.");
  }
  if (types.has("time-to-event")) {
    descriptions.push("Time-to-event outcomes were analyzed using survival analysis methods.");
  }

  return descriptions.join(" ");
}

export function formatStatisticalTests(testIds: string[]): string {
  const tests = testIds
    .map((id) => STATISTICAL_TESTS_INFO[id])
    .filter(Boolean);

  if (tests.length === 0) return "";

  const byCategory = tests.reduce(
    (acc, test) => {
      if (!acc[test.category]) acc[test.category] = [];
      acc[test.category].push(test);
      return acc;
    },
    {} as Record<string, StatisticalTestInfo[]>
  );

  const sentences: string[] = [];
  for (const tests of Object.values(byCategory)) {
    sentences.push(...tests.map((t) => t.methodsText));
  }

  return sentences.join(". ") + ".";
}

export function formatSubgroupAnalyses(subgroups: string[]): string {
  if (subgroups.length === 0) return "";
  const list = subgroups.join("; ");
  return `Pre-specified subgroup analyses were performed according to: ${list}.`;
}

export function formatSensitivityAnalyses(analyses: string[]): string {
  if (analyses.length === 0) return "";
  const list = analyses.join("; ");
  return `Sensitivity analyses included: ${list}.`;
}

export function formatSampleSize(sampleSize?: number, powerAnalysis?: string): string {
  if (!sampleSize && !powerAnalysis) return "";
  const parts: string[] = [];
  if (sampleSize) {
    parts.push(`The study included ${sampleSize.toLocaleString()} participants.`);
  }
  if (powerAnalysis) {
    parts.push(powerAnalysis);
  }
  return parts.join(" ");
}

export function generateMethodsText(config: SAPConfig): string {
  const sections: string[] = [];

  if (config.studyDesign) {
    sections.push(`Study Design: ${config.studyDesign}`);
  }

  const endpointsText = formatEndpoints(config.endpoints);
  if (endpointsText) {
    sections.push(`Outcomes: ${endpointsText}`);
  }

  const dataTypesText = formatDataTypes(config.endpoints);
  if (dataTypesText) {
    sections.push(`Data Handling: ${dataTypesText}`);
  }

  const testsText = formatStatisticalTests(config.selectedTests);
  if (testsText) {
    sections.push(`Statistical Tests: ${testsText}`);
  }

  const alphaText = formatAlphaLevel(config.alphaLevel);
  const correctionText = CORRECTION_METHOD_TEXT[config.correctionMethod] || "";
  const significanceSection = [alphaText, correctionText].filter(Boolean).join(" ");
  if (significanceSection) {
    sections.push(`Significance Level: ${significanceSection}`);
  }

  const covariatesText = formatCovariates(config.covariates);
  if (covariatesText) {
    sections.push(`Covariates: ${covariatesText}`);
  }

  const subgroupText = formatSubgroupAnalyses(config.subgroupAnalyses);
  if (subgroupText) {
    sections.push(`Subgroup Analyses: ${subgroupText}`);
  }

  const sensitivityText = formatSensitivityAnalyses(config.sensitivityAnalyses);
  if (sensitivityText) {
    sections.push(`Sensitivity Analyses: ${sensitivityText}`);
  }

  const sampleText = formatSampleSize(config.sampleSize, config.powerAnalysis);
  if (sampleText) {
    sections.push(`Sample Size: ${sampleText}`);
  }

  return sections.join("\n\n");
}

export function generateMethodsProse(config: SAPConfig): string {
  const paragraphs: string[] = [];

  if (config.studyDesign) {
    paragraphs.push(config.studyDesign);
  }

  const endpointsText = formatEndpoints(config.endpoints);
  const dataTypesText = formatDataTypes(config.endpoints);
  if (endpointsText || dataTypesText) {
    paragraphs.push([endpointsText, dataTypesText].filter(Boolean).join(" "));
  }

  const testsText = formatStatisticalTests(config.selectedTests);
  if (testsText) {
    paragraphs.push(testsText);
  }

  const alphaText = formatAlphaLevel(config.alphaLevel);
  const correctionText = CORRECTION_METHOD_TEXT[config.correctionMethod] || "";
  const significanceSection = [alphaText, correctionText].filter(Boolean).join(" ");
  if (significanceSection) {
    paragraphs.push(significanceSection);
  }

  const covariatesText = formatCovariates(config.covariates);
  if (covariatesText) {
    paragraphs.push(covariatesText);
  }

  const additionalAnalyses: string[] = [];
  const subgroupText = formatSubgroupAnalyses(config.subgroupAnalyses);
  if (subgroupText) additionalAnalyses.push(subgroupText);
  const sensitivityText = formatSensitivityAnalyses(config.sensitivityAnalyses);
  if (sensitivityText) additionalAnalyses.push(sensitivityText);
  if (additionalAnalyses.length > 0) {
    paragraphs.push(additionalAnalyses.join(" "));
  }

  const sampleText = formatSampleSize(config.sampleSize, config.powerAnalysis);
  if (sampleText) {
    paragraphs.push(sampleText);
  }

  paragraphs.push("All analyses were performed using [statistical software] version [X.X].");

  return paragraphs.join("\n\n");
}
