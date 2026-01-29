# ROS-29: Quick Wins - Simple Fixes Available Now

This document provides implementation guidance for 4 quick wins that can be done in under 2 hours.

---

## Quick Win #1: Extract ColumnSelector as Reusable Component

**Time Estimate:** 30 minutes
**Complexity:** Easy
**Impact:** Immediate reusability across all stage components

### Step 1: Create new component file

**File:** `/services/web/src/components/ui/variable-picker.tsx`

```typescript
import React from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { CheckCircle2, Circle } from 'lucide-react';

export interface VariableInfo {
  name: string;
  type?: 'numeric' | 'categorical' | 'text' | 'date' | 'boolean';
  isNarrative?: boolean;
  description?: string;
}

interface VariablePickerProps {
  variables: VariableInfo[];
  selected: string[];
  onChange: (variables: string[]) => void;
  multiSelect?: boolean;
  groupByType?: boolean;
  filterType?: string; // Filter to only show specific type
  label?: string;
  description?: string;
}

export const VariablePicker: React.FC<VariablePickerProps> = ({
  variables,
  selected,
  onChange,
  multiSelect = true,
  groupByType = false,
  filterType,
  label = "Variables",
  description,
}) => {
  // Filter by type if specified
  const filteredVariables = filterType
    ? variables.filter(v => v.type === filterType)
    : variables;

  const handleToggle = (varName: string) => {
    if (!multiSelect) {
      onChange([varName]);
      return;
    }

    if (selected.includes(varName)) {
      onChange(selected.filter(v => v !== varName));
    } else {
      onChange([...selected, varName]);
    }
  };

  const handleSelectAll = (varsToSelect: VariableInfo[]) => {
    const names = varsToSelect.map(v => v.name);
    const allSelected = names.every(n => selected.includes(n));

    if (allSelected) {
      onChange(selected.filter(v => !names.includes(v)));
    } else {
      onChange([...new Set([...selected, ...names])]);
    }
  };

  // Group by type if requested
  const grouped = groupByType
    ? filteredVariables.reduce((acc, v) => {
        const type = v.type || 'unknown';
        if (!acc[type]) acc[type] = [];
        acc[type].push(v);
        return acc;
      }, {} as Record<string, VariableInfo[]>)
    : { all: filteredVariables };

  return (
    <div className="space-y-4">
      {label && (
        <div>
          <Label className="text-sm font-semibold">{label}</Label>
          {description && <p className="text-xs text-muted-foreground mt-1">{description}</p>}
        </div>
      )}

      {Object.entries(grouped).map(([group, vars]) => (
        <div key={group}>
          {groupByType && group !== 'all' && (
            <div className="flex items-center justify-between mb-3">
              <Label className="text-xs font-medium uppercase text-muted-foreground">
                {group}
              </Label>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleSelectAll(vars)}
                className="text-xs"
              >
                {vars.every(v => selected.includes(v.name)) ? 'Deselect All' : 'Select All'}
              </Button>
            </div>
          )}

          <div className="space-y-2 ml-2">
            {vars.map(variable => (
              <div key={variable.name} className="flex items-start gap-3">
                <Checkbox
                  id={variable.name}
                  checked={selected.includes(variable.name)}
                  onCheckedChange={() => handleToggle(variable.name)}
                  className="mt-1"
                />
                <Label
                  htmlFor={variable.name}
                  className="flex flex-col cursor-pointer flex-1"
                >
                  <span className="font-medium text-sm">{variable.name}</span>
                  {variable.description && (
                    <span className="text-xs text-muted-foreground">{variable.description}</span>
                  )}
                  {variable.type && (
                    <span className="text-xs text-muted-foreground italic">{variable.type}</span>
                  )}
                </Label>
              </div>
            ))}
          </div>
        </div>
      ))}

      {filteredVariables.length === 0 && (
        <p className="text-sm text-muted-foreground italic">No variables available</p>
      )}
    </div>
  );
};

export default VariablePicker;
```

### Step 2: Update ExtractionConfigPanel.tsx

Replace the ColumnSelector with VariablePicker:

```typescript
// OLD:
// const ColumnSelector: React.FC<...> = ...

// NEW:
import { VariablePicker, type VariableInfo } from '@/components/ui/variable-picker';

// In component, change:
<ColumnSelector
  columns={columns}
  selected={selectedColumns}
  onChange={setSelectedColumns}
/>

// To:
<VariablePicker
  variables={columns.map(c => ({
    name: c.name,
    type: c.isNarrative ? 'text' : 'unknown',
    isNarrative: c.isNarrative,
  }))}
  selected={selectedColumns}
  onChange={setSelectedColumns}
  multiSelect={true}
  groupByType={true}
/>
```

### Step 3: Export from components index

**File:** `/services/web/src/components/ui/index.ts` (or equivalent)

```typescript
export { VariablePicker, type VariableInfo } from './variable-picker';
```

---

## Quick Win #2: Add VariableSchema Types

**Time Estimate:** 20 minutes
**Complexity:** Easy
**Impact:** Foundation for all variable work

### Step 1: Update api.ts types

**File:** `/services/web/src/types/api.ts`

Add after the Dataset interface:

```typescript
/**
 * Variable schema definition with type information
 */
export interface VariableSchema {
  name: string;
  type: 'numeric' | 'categorical' | 'text' | 'date' | 'boolean' | 'unknown';
  nullable: boolean;
  description?: string;
  /** For numeric types: min and max values */
  min?: number;
  max?: number;
  mean?: number;
  median?: number;
  /** For categorical types: possible values */
  values?: string[];
  /** For numeric: number of unique values */
  uniqueCount?: number;
  /** Percentage of missing values */
  missingPercent?: number;
}

/**
 * Stage output with variable schema metadata
 */
export interface StageOutput {
  id?: string;
  title: string;
  type: 'text' | 'table' | 'list' | 'document' | 'chart' | 'json';
  content: string;
  metadata?: Record<string, unknown>;
  source?: 'ai' | 'computed' | 'template';
  /** NEW: Variable schema for this output */
  variableSchema?: VariableSchema[];
}

/**
 * Enhanced dataset with variable information
 */
export interface DatasetWithSchema extends Dataset {
  variableSchema?: VariableSchema[];
  columnNames?: string[];
}
```

### Step 2: Update uploadedFile state in workflow-pipeline.tsx

**File:** `/services/web/src/components/sections/workflow-pipeline.tsx`

```typescript
// Find the uploadedFile useState and update the interface:
const [uploadedFile, setUploadedFile] = useState<{
  id: string;
  name: string;
  size: number;
  type: string;
  uploadedAt: Date;
  status: 'uploading' | 'uploaded' | 'validated' | 'error';
  recordCount?: number;
  variableCount?: number;
  phiScanStatus?: 'clean' | 'detected' | 'pending' | 'error';
  phiScanResult?: Record<string, unknown>;
  error?: string;
  // NEW:
  variableSchema?: VariableSchema[];
  columnNames?: string[];
} | null>(null);
```

### Step 3: Update stageContext building

In the same file, update the dataContext building (around line 2837):

```typescript
if (selectedStage.id >= 4) {
  stageContext.dataContext = {
    uploadedFile: uploadedFile ? {
      name: uploadedFile.name,
      size: uploadedFile.size,
      recordCount: uploadedFile.recordCount,
      variableCount: uploadedFile.variableCount,
      phiScanStatus: uploadedFile.phiScanStatus,
      // NEW:
      variableSchema: uploadedFile.variableSchema,
      columnNames: uploadedFile.columnNames,
    } : null,
  };
}
```

---

## Quick Win #3: Add Schema Types to Core

**Time Estimate:** 15 minutes
**Complexity:** Easy
**Impact:** Consistency across frontend and backend

### Step 1: Create schema types file

**File:** `/packages/core/types/schema.ts` (create if doesn't exist)

```typescript
/**
 * Core variable schema definitions used across frontend and backend
 */

export type VariableType = 'numeric' | 'categorical' | 'text' | 'date' | 'boolean' | 'unknown';

export interface VariableSchema {
  name: string;
  type: VariableType;
  nullable: boolean;
  description?: string;
  // Numeric type properties
  min?: number;
  max?: number;
  mean?: number;
  median?: number;
  // Categorical type properties
  values?: string[];
  // General properties
  uniqueCount?: number;
  missingPercent?: number;
}

export interface StageVariableMapping {
  fromStageId: number;
  toStageId: number;
  variableMappings: {
    fromVariable: string;
    toVariable: string;
  }[];
}

export interface VariableValidationResult {
  valid: boolean;
  errors: {
    variable: string;
    error: string;
  }[];
  warnings: {
    variable: string;
    warning: string;
  }[];
}
```

### Step 2: Export from core types index

**File:** `/packages/core/types/index.ts`

```typescript
export * from './schema';
export type { VariableSchema, VariableType } from './schema';
```

---

## Quick Win #4: Add Variable Availability Hints to Stages

**Time Estimate:** 10 minutes
**Complexity:** Trivial
**Impact:** Documentation for developers

### Step 1: Add JSDoc to Stage00ManuscriptIdeation.tsx

**File:** `/services/web/src/components/stages/Stage00ManuscriptIdeation.tsx`

Add at the top of the component:

```typescript
/**
 * Stage 0: Manuscript Ideation
 *
 * Initial stage for defining research direction.
 *
 * Inputs:
 * - None (starting point)
 *
 * Outputs:
 * - researchTopic: string
 * - hypothesis: string
 * - objectives: string[]
 *
 * Available Variables from Previous Stages:
 * - None (this is the entry point)
 *
 * Passes Variables To:
 * - Stages 1-3: Uses researchTopic and hypothesis in topic context
 * - Stages 4+: Topic context available to all analysis stages
 */
```

### Step 2: Add JSDoc to Stage04DataCollection.tsx

```typescript
/**
 * Stage 4: Data Collection & Upload
 *
 * Manages research data upload and initial validation.
 *
 * Inputs:
 * - Dataset file (CSV, XLSX, JSON)
 *
 * Outputs:
 * - uploadedFile: Dataset metadata including:
 *   - name: string
 *   - recordCount: number
 *   - variableCount: number
 *   - variableSchema: VariableSchema[] (FUTURE)
 *   - columnNames: string[] (FUTURE)
 *
 * Available Variables from Previous Stages:
 * - topicContext: Research topic from Stage 0-3
 *
 * Passes Variables To:
 * - Stages 5+: Dataset metadata and schema
 * - Stage 5-7: Raw data for processing
 * - Stage 7+: Variable schema for selection
 */
```

### Step 3: Add JSDoc to Stage07StatisticalModeling.tsx

```typescript
/**
 * Stage 7: Statistical Modeling & Analysis
 *
 * Performs statistical analysis with model selection and assumptions testing.
 *
 * Inputs Required:
 * - Variables from Stage 4-6:
 *   - Dependent variable: numeric or categorical
 *   - Independent variables: numeric or categorical (type depends on model)
 *
 * Outputs:
 * - modelResults: Analysis results including:
 *   - coefficients: ModelCoefficients[]
 *   - statistics: ModelStatistics
 *   - assumptions: AssumptionTest[]
 *
 * Available Variables from Previous Stages:
 * - dataContext.uploadedFile: Dataset info from Stage 4
 * - previousStageOutputs.stage4: Raw data columns
 * - previousStageOutputs.stage5: Preprocessed data
 * - previousStageOutputs.stage6: Variable selections from Stage 6
 *
 * Variable Selection Rules:
 * - Dependent variable: Required, must match model type
 * - Independent variables: Required count depends on model type
 * - Numeric models (regression, ANOVA): Need numeric variables
 * - Categorical models (chi-square): Need categorical variables
 *
 * Passes Variables To:
 * - Stages 8+: Model results and interpretation
 */
```

---

## How to Apply These Fixes

### Option A: Apply One at a Time
1. Start with Quick Win #2 (Types) - foundational
2. Then Quick Win #1 (Component) - uses types
3. Then Quick Win #3 (Core Types) - unifies definitions
4. Then Quick Win #4 (Documentation) - helps maintainability

### Option B: Apply All Together
All 4 wins are independent and can be applied in any order.

### Testing After Applying Fixes

#### Quick Win #1 (Component):
```bash
# Check component exports
grep -r "export.*VariablePicker" services/web/src/components/

# Check imports work
cd services/web && npm run type-check
```

#### Quick Win #2 (Types):
```bash
# Verify types export
grep -r "VariableSchema" services/web/src/types/

# Check no TypeScript errors
npm run type-check
```

#### Quick Win #3 (Core Types):
```bash
# Verify exports
grep -r "export.*VariableSchema" packages/core/types/

# Build core package
cd packages/core && npm run build
```

#### Quick Win #4 (Documentation):
```bash
# No automated test needed - just verify comments render in IDE
# Hover over Stage components to see JSDoc
```

---

## Next Steps After Quick Wins

Once all 4 quick wins are applied, you have:
- ✅ Reusable VariablePicker component
- ✅ Type system for variables
- ✅ Documentation for developers
- ✅ Foundation for schema service work

Then move to the full implementation plan in `ROS-29_WORKFLOW_ENGINE_REVIEW.md`:
1. Create variable schema introspection API
2. Implement variable mapping service
3. Add validation framework
4. Integrate with workflow execution
