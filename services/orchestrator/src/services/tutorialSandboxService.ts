/**
 * Tutorial Sandbox Service
 * Task 145 - Embed tutorial code sandboxes
 *
 * Provides:
 * - Interactive code execution environment
 * - Sandboxed execution with resource limits
 * - Demo data for tutorials
 * - Progress tracking
 */

import { z } from 'zod';
import crypto from 'crypto';

// ─────────────────────────────────────────────────────────────
// Types & Schemas
// ─────────────────────────────────────────────────────────────

export const SandboxLanguageSchema = z.enum([
  'PYTHON',
  'JAVASCRIPT',
  'R',
  'SQL',
]);

export const ExecutionStatusSchema = z.enum([
  'PENDING',
  'RUNNING',
  'COMPLETED',
  'FAILED',
  'TIMEOUT',
  'CANCELLED',
]);

export const CodeSnippetSchema = z.object({
  id: z.string(),
  tutorialId: z.string(),
  stepIndex: z.number(),
  title: z.string(),
  description: z.string().optional(),
  language: SandboxLanguageSchema,
  code: z.string(),
  expectedOutput: z.string().optional(),
  hints: z.array(z.string()).default([]),
  isEditable: z.boolean().default(true),
  isRunnable: z.boolean().default(true),
  order: z.number(),
});

export const ExecutionResultSchema = z.object({
  id: z.string(),
  snippetId: z.string(),
  userId: z.string(),
  code: z.string(),
  status: ExecutionStatusSchema,
  output: z.string().optional(),
  error: z.string().optional(),
  executionTimeMs: z.number().optional(),
  memoryUsedMb: z.number().optional(),
  createdAt: z.string().datetime(),
});

export const SandboxConfigSchema = z.object({
  maxExecutionTimeMs: z.number().default(30000),
  maxMemoryMb: z.number().default(256),
  maxOutputLines: z.number().default(1000),
  allowNetworkAccess: z.boolean().default(false),
  demoDatasets: z.array(z.string()).default([]),
});

export const TutorialWithSandboxSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  category: z.string(),
  difficulty: z.enum(['BEGINNER', 'INTERMEDIATE', 'ADVANCED']),
  estimatedMinutes: z.number(),
  prerequisites: z.array(z.string()).default([]),
  snippets: z.array(CodeSnippetSchema),
  sandboxConfig: SandboxConfigSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type SandboxLanguage = z.infer<typeof SandboxLanguageSchema>;
export type ExecutionStatus = z.infer<typeof ExecutionStatusSchema>;
export type CodeSnippet = z.infer<typeof CodeSnippetSchema>;
export type ExecutionResult = z.infer<typeof ExecutionResultSchema>;
export type SandboxConfig = z.infer<typeof SandboxConfigSchema>;
export type TutorialWithSandbox = z.infer<typeof TutorialWithSandboxSchema>;

// ─────────────────────────────────────────────────────────────
// In-Memory Storage
// ─────────────────────────────────────────────────────────────

const tutorials: Map<string, TutorialWithSandbox> = new Map();
const executions: ExecutionResult[] = [];
const userProgress: Map<string, Set<string>> = new Map(); // userId -> completed snippet IDs

// ─────────────────────────────────────────────────────────────
// Sample Tutorials
// ─────────────────────────────────────────────────────────────

const SAMPLE_TUTORIALS: Omit<TutorialWithSandbox, 'createdAt' | 'updatedAt'>[] = [
  {
    id: 'getting-started-python',
    title: 'Getting Started with ResearchFlow API (Python)',
    description: 'Learn how to interact with ResearchFlow using Python',
    category: 'API',
    difficulty: 'BEGINNER',
    estimatedMinutes: 15,
    prerequisites: [],
    sandboxConfig: {
      maxExecutionTimeMs: 30000,
      maxMemoryMb: 256,
      maxOutputLines: 500,
      allowNetworkAccess: false,
      demoDatasets: ['sample_cohort'],
    },
    snippets: [
      {
        id: 'py-intro-1',
        tutorialId: 'getting-started-python',
        stepIndex: 1,
        title: 'Hello ResearchFlow',
        description: 'Your first ResearchFlow script',
        language: 'PYTHON',
        code: `# Welcome to ResearchFlow!
# Let's start with a simple example

import json

# Sample research project data
project = {
    "title": "Clinical Outcomes Study",
    "status": "active",
    "artifacts": 12
}

print("Project:", project["title"])
print("Status:", project["status"])
print(f"Total artifacts: {project['artifacts']}")`,
        expectedOutput: 'Project: Clinical Outcomes Study\nStatus: active\nTotal artifacts: 12',
        hints: ['Try modifying the project data to see different outputs'],
        isEditable: true,
        isRunnable: true,
        order: 1,
      },
      {
        id: 'py-intro-2',
        tutorialId: 'getting-started-python',
        stepIndex: 2,
        title: 'Working with Artifacts',
        description: 'Learn to manipulate research artifacts',
        language: 'PYTHON',
        code: `# Working with research artifacts
from datetime import datetime

artifacts = [
    {"id": "a1", "type": "DATASET", "name": "Patient Demographics", "created": "2024-01-15"},
    {"id": "a2", "type": "CODE", "name": "Analysis Script", "created": "2024-01-16"},
    {"id": "a3", "type": "FIGURE", "name": "Survival Curve", "created": "2024-01-17"},
]

# Filter by type
datasets = [a for a in artifacts if a["type"] == "DATASET"]
print(f"Found {len(datasets)} dataset(s)")

# List all artifact names
for artifact in artifacts:
    print(f"- {artifact['name']} ({artifact['type']})")`,
        hints: [
          'Try filtering by different artifact types',
          'Add more artifacts to the list',
        ],
        isEditable: true,
        isRunnable: true,
        order: 2,
      },
      {
        id: 'py-intro-3',
        tutorialId: 'getting-started-python',
        stepIndex: 3,
        title: 'Data Analysis',
        description: 'Basic statistical analysis',
        language: 'PYTHON',
        code: `# Basic statistical analysis
import statistics

# Sample clinical measurements
values = [4.2, 5.1, 4.8, 5.5, 4.9, 5.2, 4.7, 5.0, 5.3, 4.6]

# Calculate statistics
mean_val = statistics.mean(values)
std_val = statistics.stdev(values)
median_val = statistics.median(values)

print(f"n = {len(values)}")
print(f"Mean: {mean_val:.2f}")
print(f"Std Dev: {std_val:.2f}")
print(f"Median: {median_val:.2f}")

# Check for outliers (simple method: >2 std from mean)
outliers = [v for v in values if abs(v - mean_val) > 2 * std_val]
print(f"Outliers: {outliers if outliers else 'None detected'}")`,
        hints: ['Try adding outlier values to see detection'],
        isEditable: true,
        isRunnable: true,
        order: 3,
      },
    ],
  },
  {
    id: 'data-analysis-basics',
    title: 'Data Analysis Fundamentals',
    description: 'Learn essential data analysis techniques',
    category: 'Analysis',
    difficulty: 'INTERMEDIATE',
    estimatedMinutes: 25,
    prerequisites: ['getting-started-python'],
    sandboxConfig: {
      maxExecutionTimeMs: 60000,
      maxMemoryMb: 512,
      maxOutputLines: 1000,
      allowNetworkAccess: false,
      demoDatasets: ['sample_cohort', 'demo_measurements'],
    },
    snippets: [
      {
        id: 'analysis-1',
        tutorialId: 'data-analysis-basics',
        stepIndex: 1,
        title: 'Loading and Exploring Data',
        description: 'How to load and inspect research data',
        language: 'PYTHON',
        code: `# Simulated data loading (in real use, would load from ResearchFlow)
import json

# Sample cohort data
cohort_data = [
    {"patient_id": "P001", "age": 45, "sex": "M", "treatment": "A", "outcome": 1},
    {"patient_id": "P002", "age": 62, "sex": "F", "treatment": "B", "outcome": 0},
    {"patient_id": "P003", "age": 38, "sex": "F", "treatment": "A", "outcome": 1},
    {"patient_id": "P004", "age": 51, "sex": "M", "treatment": "B", "outcome": 0},
    {"patient_id": "P005", "age": 44, "sex": "F", "treatment": "A", "outcome": 1},
]

print(f"Loaded {len(cohort_data)} records")
print("\\nFirst record:")
print(json.dumps(cohort_data[0], indent=2))

# Basic summary
ages = [p["age"] for p in cohort_data]
print(f"\\nAge range: {min(ages)} - {max(ages)}")
print(f"Average age: {sum(ages)/len(ages):.1f}")`,
        isEditable: true,
        isRunnable: true,
        order: 1,
      },
      {
        id: 'analysis-2',
        tutorialId: 'data-analysis-basics',
        stepIndex: 2,
        title: 'Group Analysis',
        description: 'Analyzing data by groups',
        language: 'PYTHON',
        code: `# Continuing with cohort_data from previous step
from collections import defaultdict

cohort_data = [
    {"patient_id": "P001", "age": 45, "sex": "M", "treatment": "A", "outcome": 1},
    {"patient_id": "P002", "age": 62, "sex": "F", "treatment": "B", "outcome": 0},
    {"patient_id": "P003", "age": 38, "sex": "F", "treatment": "A", "outcome": 1},
    {"patient_id": "P004", "age": 51, "sex": "M", "treatment": "B", "outcome": 0},
    {"patient_id": "P005", "age": 44, "sex": "F", "treatment": "A", "outcome": 1},
]

# Group by treatment
by_treatment = defaultdict(list)
for p in cohort_data:
    by_treatment[p["treatment"]].append(p)

print("Analysis by Treatment Group:")
print("-" * 40)

for treatment, patients in sorted(by_treatment.items()):
    n = len(patients)
    outcomes = [p["outcome"] for p in patients]
    response_rate = sum(outcomes) / n * 100
    avg_age = sum(p["age"] for p in patients) / n

    print(f"\\nTreatment {treatment}:")
    print(f"  n = {n}")
    print(f"  Response rate: {response_rate:.1f}%")
    print(f"  Average age: {avg_age:.1f}")`,
        isEditable: true,
        isRunnable: true,
        order: 2,
      },
    ],
  },
  {
    id: 'sql-for-researchers',
    title: 'SQL for Research Data',
    description: 'Query research databases with SQL',
    category: 'Database',
    difficulty: 'BEGINNER',
    estimatedMinutes: 20,
    prerequisites: [],
    sandboxConfig: {
      maxExecutionTimeMs: 10000,
      maxMemoryMb: 128,
      maxOutputLines: 500,
      allowNetworkAccess: false,
      demoDatasets: ['demo_patients', 'demo_visits'],
    },
    snippets: [
      {
        id: 'sql-1',
        tutorialId: 'sql-for-researchers',
        stepIndex: 1,
        title: 'Basic SELECT',
        description: 'Query data from a table',
        language: 'SQL',
        code: `-- Select all columns from patients table
SELECT * FROM demo_patients LIMIT 5;

-- Select specific columns
SELECT patient_id, age, diagnosis
FROM demo_patients
WHERE age > 50
ORDER BY age DESC;`,
        isEditable: true,
        isRunnable: true,
        order: 1,
      },
      {
        id: 'sql-2',
        tutorialId: 'sql-for-researchers',
        stepIndex: 2,
        title: 'Aggregations',
        description: 'Calculate summary statistics',
        language: 'SQL',
        code: `-- Count patients by diagnosis
SELECT
    diagnosis,
    COUNT(*) as patient_count,
    AVG(age) as avg_age,
    MIN(age) as min_age,
    MAX(age) as max_age
FROM demo_patients
GROUP BY diagnosis
ORDER BY patient_count DESC;`,
        isEditable: true,
        isRunnable: true,
        order: 2,
      },
    ],
  },
];

// ─────────────────────────────────────────────────────────────
// Initialization
// ─────────────────────────────────────────────────────────────

function initializeTutorials(): void {
  if (tutorials.size === 0) {
    const now = new Date().toISOString();
    for (const tutorial of SAMPLE_TUTORIALS) {
      tutorials.set(tutorial.id, {
        ...tutorial,
        createdAt: now,
        updatedAt: now,
      });
    }
  }
}

// ─────────────────────────────────────────────────────────────
// Tutorial API
// ─────────────────────────────────────────────────────────────

export function listTutorials(options?: {
  category?: string;
  difficulty?: string;
}): TutorialWithSandbox[] {
  initializeTutorials();

  let results = Array.from(tutorials.values());

  if (options?.category) {
    results = results.filter(t => t.category === options.category);
  }

  if (options?.difficulty) {
    results = results.filter(t => t.difficulty === options.difficulty);
  }

  return results;
}

export function getTutorial(id: string): TutorialWithSandbox | undefined {
  initializeTutorials();
  return tutorials.get(id);
}

export function getSnippet(tutorialId: string, snippetId: string): CodeSnippet | undefined {
  const tutorial = tutorials.get(tutorialId);
  if (!tutorial) return undefined;
  return tutorial.snippets.find(s => s.id === snippetId);
}

export function getTutorialCategories(): Array<{ id: string; name: string; count: number }> {
  initializeTutorials();

  const categoryCounts = new Map<string, number>();
  for (const tutorial of tutorials.values()) {
    categoryCounts.set(
      tutorial.category,
      (categoryCounts.get(tutorial.category) ?? 0) + 1
    );
  }

  return Array.from(categoryCounts.entries()).map(([id, count]) => ({
    id,
    name: id,
    count,
  }));
}

// ─────────────────────────────────────────────────────────────
// Code Execution
// ─────────────────────────────────────────────────────────────

export interface ExecuteCodeInput {
  tutorialId: string;
  snippetId: string;
  code: string;
  userId: string;
}

export async function executeCode(input: ExecuteCodeInput): Promise<ExecutionResult> {
  initializeTutorials();

  const tutorial = tutorials.get(input.tutorialId);
  if (!tutorial) {
    throw new Error('Tutorial not found');
  }

  const snippet = tutorial.snippets.find(s => s.id === input.snippetId);
  if (!snippet) {
    throw new Error('Snippet not found');
  }

  if (!snippet.isRunnable) {
    throw new Error('This snippet cannot be executed');
  }

  const resultId = crypto.randomUUID();
  const startTime = Date.now();

  // Create pending result
  const result: ExecutionResult = {
    id: resultId,
    snippetId: input.snippetId,
    userId: input.userId,
    code: input.code,
    status: 'RUNNING',
    createdAt: new Date().toISOString(),
  };

  try {
    // In production, this would:
    // 1. Create an isolated container
    // 2. Copy code and dependencies
    // 3. Execute with resource limits
    // 4. Capture stdout/stderr
    // 5. Clean up container

    // Mock execution based on language
    const output = await mockExecute(
      snippet.language,
      input.code,
      tutorial.sandboxConfig
    );

    result.status = 'COMPLETED';
    result.output = output;
    result.executionTimeMs = Date.now() - startTime;
    result.memoryUsedMb = Math.random() * 50 + 10; // Mock memory usage

    // Track progress
    markSnippetCompleted(input.userId, input.snippetId);

  } catch (error: any) {
    result.status = 'FAILED';
    result.error = error.message ?? 'Execution failed';
    result.executionTimeMs = Date.now() - startTime;
  }

  executions.push(result);
  return result;
}

async function mockExecute(
  language: SandboxLanguage,
  code: string,
  config: SandboxConfig
): Promise<string> {
  // Simulate execution delay
  await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 200));

  // Mock output based on language
  switch (language) {
    case 'PYTHON':
      return mockPythonExecution(code);
    case 'SQL':
      return mockSqlExecution(code);
    case 'JAVASCRIPT':
      return mockJsExecution(code);
    case 'R':
      return mockRExecution(code);
    default:
      throw new Error(`Unsupported language: ${language}`);
  }
}

function mockPythonExecution(code: string): string {
  // Very basic mock - look for print statements
  const lines: string[] = [];

  // Extract string literals from print statements (simplified)
  const printMatches = code.matchAll(/print\s*\(\s*f?"([^"]+)"/g);
  for (const match of printMatches) {
    lines.push(match[1]);
  }

  // If no prints found, return generic output
  if (lines.length === 0) {
    return 'Code executed successfully.\n(Sandbox mode - limited output capture)';
  }

  return lines.join('\n');
}

function mockSqlExecution(code: string): string {
  // Mock SQL results
  if (code.toLowerCase().includes('select *')) {
    return `patient_id | age | diagnosis
-----------+-----+-----------
P001       | 45  | T2D
P002       | 62  | HTN
P003       | 38  | T2D
(3 rows)`;
  }

  if (code.toLowerCase().includes('count(*)')) {
    return `diagnosis | patient_count | avg_age
----------+--------------+---------
T2D       | 15           | 52.3
HTN       | 12           | 58.7
(2 rows)`;
  }

  return 'Query executed successfully.';
}

function mockJsExecution(code: string): string {
  return 'JavaScript executed successfully.\n(Sandbox mode)';
}

function mockRExecution(code: string): string {
  return 'R code executed successfully.\n(Sandbox mode)';
}

// ─────────────────────────────────────────────────────────────
// Progress Tracking
// ─────────────────────────────────────────────────────────────

function markSnippetCompleted(userId: string, snippetId: string): void {
  if (!userProgress.has(userId)) {
    userProgress.set(userId, new Set());
  }
  userProgress.get(userId)!.add(snippetId);
}

export function getUserProgress(userId: string, tutorialId?: string): {
  completedSnippets: string[];
  totalSnippets: number;
  percentComplete: number;
} {
  initializeTutorials();

  const completed = userProgress.get(userId) ?? new Set();

  let totalSnippets = 0;
  let completedCount = 0;

  if (tutorialId) {
    const tutorial = tutorials.get(tutorialId);
    if (tutorial) {
      totalSnippets = tutorial.snippets.length;
      completedCount = tutorial.snippets.filter(s => completed.has(s.id)).length;
    }
  } else {
    for (const tutorial of tutorials.values()) {
      totalSnippets += tutorial.snippets.length;
      completedCount += tutorial.snippets.filter(s => completed.has(s.id)).length;
    }
  }

  return {
    completedSnippets: Array.from(completed),
    totalSnippets,
    percentComplete: totalSnippets > 0 ? Math.round(completedCount / totalSnippets * 100) : 0,
  };
}

export function getExecutionHistory(
  userId: string,
  options?: { snippetId?: string; limit?: number }
): ExecutionResult[] {
  let results = executions.filter(e => e.userId === userId);

  if (options?.snippetId) {
    results = results.filter(e => e.snippetId === options.snippetId);
  }

  results.sort((a, b) =>
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  if (options?.limit) {
    results = results.slice(0, options.limit);
  }

  return results;
}

// ─────────────────────────────────────────────────────────────
// Demo Data Management
// ─────────────────────────────────────────────────────────────

const DEMO_DATASETS: Record<string, unknown[]> = {
  sample_cohort: [
    { patient_id: 'P001', age: 45, sex: 'M', treatment: 'A', outcome: 1 },
    { patient_id: 'P002', age: 62, sex: 'F', treatment: 'B', outcome: 0 },
    { patient_id: 'P003', age: 38, sex: 'F', treatment: 'A', outcome: 1 },
  ],
  demo_measurements: [
    { id: 1, value: 4.2, unit: 'mg/dL', timestamp: '2024-01-01T10:00:00Z' },
    { id: 2, value: 5.1, unit: 'mg/dL', timestamp: '2024-01-01T14:00:00Z' },
    { id: 3, value: 4.8, unit: 'mg/dL', timestamp: '2024-01-02T10:00:00Z' },
  ],
  demo_patients: [
    { patient_id: 'P001', age: 45, diagnosis: 'T2D' },
    { patient_id: 'P002', age: 62, diagnosis: 'HTN' },
    { patient_id: 'P003', age: 38, diagnosis: 'T2D' },
  ],
};

export function getDemoDataset(name: string): unknown[] | undefined {
  return DEMO_DATASETS[name];
}

export function listDemoDatasets(): Array<{ name: string; recordCount: number }> {
  return Object.entries(DEMO_DATASETS).map(([name, data]) => ({
    name,
    recordCount: data.length,
  }));
}

// ─────────────────────────────────────────────────────────────
// Exports
// ─────────────────────────────────────────────────────────────

export default {
  // Tutorials
  listTutorials,
  getTutorial,
  getSnippet,
  getTutorialCategories,

  // Execution
  executeCode,
  getExecutionHistory,

  // Progress
  getUserProgress,

  // Demo Data
  getDemoDataset,
  listDemoDatasets,
};
