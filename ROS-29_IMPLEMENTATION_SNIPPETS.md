# ROS-29: Implementation Snippets & Code Samples

Ready-to-use code snippets for implementing ROS-29 quick wins and Phase 1 tasks.

---

## Part 1: Quick Win #1 - Variable Picker Component

### Complete Component Code

**File:** `/services/web/src/components/ui/variable-picker.tsx`

```typescript
/**
 * Reusable Variable Selection Component
 *
 * Features:
 * - Single or multi-select modes
 * - Type-based filtering and grouping
 * - Search/filter capability
 * - Batch select/deselect by category
 * - TypeScript support
 *
 * Usage:
 * <VariablePicker
 *   variables={[
 *     { name: 'age', type: 'numeric' },
 *     { name: 'diagnosis', type: 'categorical' }
 *   ]}
 *   selected={['age']}
 *   onChange={setSelected}
 *   multiSelect={true}
 *   filterType="numeric"
 * />
 */

import React, { useMemo, useState } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CheckCircle2, Search, X } from 'lucide-react';

export interface VariableInfo {
  name: string;
  type?: 'numeric' | 'categorical' | 'text' | 'date' | 'boolean' | 'unknown';
  isNarrative?: boolean;
  description?: string;
}

export interface VariablePickerProps {
  variables: VariableInfo[];
  selected: string[];
  onChange: (variables: string[]) => void;
  /** Allow multiple selections (default: true) */
  multiSelect?: boolean;
  /** Group variables by type (default: false) */
  groupByType?: boolean;
  /** Show only variables of this type */
  filterType?: string;
  /** Show search box (default: false) */
  searchable?: boolean;
  /** Component label */
  label?: string;
  /** Component description */
  description?: string;
  /** Show type badges (default: true) */
  showTypeBadges?: boolean;
  /** CSS class for root element */
  className?: string;
}

export const VariablePicker: React.FC<VariablePickerProps> = ({
  variables,
  selected,
  onChange,
  multiSelect = true,
  groupByType = false,
  filterType,
  searchable = false,
  label = "Variables",
  description,
  showTypeBadges = true,
  className = "",
}) => {
  const [searchTerm, setSearchTerm] = useState("");

  // Filter by type if specified
  const filteredVariables = useMemo(
    () => {
      let result = variables;

      if (filterType) {
        result = result.filter(v => v.type === filterType);
      }

      if (searchTerm) {
        const lower = searchTerm.toLowerCase();
        result = result.filter(
          v =>
            v.name.toLowerCase().includes(lower) ||
            (v.description?.toLowerCase().includes(lower) ?? false)
        );
      }

      return result;
    },
    [variables, filterType, searchTerm]
  );

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
  const grouped = useMemo(
    () => {
      if (!groupByType) {
        return { all: filteredVariables };
      }

      return filteredVariables.reduce(
        (acc, v) => {
          const type = v.type || 'unknown';
          if (!acc[type]) acc[type] = [];
          acc[type].push(v);
          return acc;
        },
        {} as Record<string, VariableInfo[]>
      );
    },
    [filteredVariables, groupByType]
  );

  const getTypeBadgeColor = (type?: string): string => {
    switch (type) {
      case 'numeric':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'categorical':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200';
      case 'text':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'date':
        return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200';
      case 'boolean':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    }
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {label && (
        <div>
          <Label className="text-sm font-semibold">{label}</Label>
          {description && (
            <p className="text-xs text-muted-foreground mt-1">{description}</p>
          )}
          {selected.length > 0 && (
            <div className="mt-2 flex items-center justify-between">
              <span className="text-xs text-muted-foreground">
                {selected.length} selected
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onChange([])}
                className="text-xs h-6"
              >
                <X className="h-3 w-3 mr-1" />
                Clear
              </Button>
            </div>
          )}
        </div>
      )}

      {searchable && (
        <div className="relative">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search variables..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="pl-8"
          />
        </div>
      )}

      <div className="space-y-4">
        {Object.entries(grouped).map(([group, vars]) => (
          <div key={group}>
            {groupByType && group !== 'all' && (
              <div className="flex items-center justify-between mb-3">
                <Label className="text-xs font-medium uppercase text-muted-foreground">
                  {group}
                </Label>
                {multiSelect && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleSelectAll(vars)}
                    className="text-xs h-5"
                  >
                    {vars.every(v => selected.includes(v.name))
                      ? 'Deselect All'
                      : 'Select All'}
                  </Button>
                )}
              </div>
            )}

            <div className="space-y-2 ml-2">
              {vars.map(variable => (
                <div
                  key={variable.name}
                  className="flex items-start gap-3 rounded-md hover:bg-muted/50 p-2 transition-colors"
                >
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
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{variable.name}</span>
                      {showTypeBadges && variable.type && variable.type !== 'unknown' && (
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full ${getTypeBadgeColor(
                            variable.type
                          )}`}
                        >
                          {variable.type}
                        </span>
                      )}
                    </div>
                    {variable.description && (
                      <span className="text-xs text-muted-foreground mt-1">
                        {variable.description}
                      </span>
                    )}
                  </Label>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {filteredVariables.length === 0 && (
        <p className="text-sm text-muted-foreground italic text-center py-4">
          {searchTerm ? 'No variables match your search' : 'No variables available'}
        </p>
      )}
    </div>
  );
};

export default VariablePicker;
```

### Export from index

**File:** `/services/web/src/components/ui/index.ts` (add to existing exports)

```typescript
export { VariablePicker, type VariableInfo, type VariablePickerProps } from './variable-picker';
```

---

## Part 2: Quick Win #2 - Type Definitions

### Add to api.ts

**File:** `/services/web/src/types/api.ts` (add after Dataset interface)

```typescript
/**
 * Variable schema definition with type and metadata information
 * Used throughout the workflow to describe variables in datasets
 */
export interface VariableSchema {
  /** Variable name/column name */
  name: string;

  /** Data type of the variable */
  type: 'numeric' | 'categorical' | 'text' | 'date' | 'boolean' | 'unknown';

  /** Whether NULL/missing values are allowed */
  nullable: boolean;

  /** Optional description of the variable */
  description?: string;

  // ===== Numeric type properties =====
  /** Minimum value (for numeric types) */
  min?: number;

  /** Maximum value (for numeric types) */
  max?: number;

  /** Mean value (for numeric types) */
  mean?: number;

  /** Median value (for numeric types) */
  median?: number;

  // ===== Categorical type properties =====
  /** Possible values (for categorical types) */
  values?: string[];

  // ===== General properties =====
  /** Number of unique values in the variable */
  uniqueCount?: number;

  /** Percentage of missing/NULL values (0-100) */
  missingPercent?: number;

  /** Standard deviation (for numeric types) */
  stdDev?: number;

  /** Sample size this schema was computed from */
  sampleSize?: number;
}

/**
 * Requirements for variables needed by a workflow stage
 * Defines what variables a stage expects as input
 */
export interface VariableRequirement {
  /** Variable name */
  name: string;

  /** Required data type */
  type: 'numeric' | 'categorical' | 'text' | 'date' | 'boolean' | 'unknown' | 'any';

  /** Whether this variable is optional (default: false = required) */
  optional?: boolean;

  /** Description of why this variable is needed */
  description?: string;

  /** Range constraints (for numeric types) */
  min?: number;
  max?: number;

  /** Allowed values (for categorical types) */
  allowedValues?: string[];
}

/**
 * Result of variable validation
 * Returned when checking if provided variables meet stage requirements
 */
export interface VariableValidationResult {
  /** Whether validation passed */
  valid: boolean;

  /** Validation errors (variable missing, wrong type, etc.) */
  errors: {
    variable: string;
    error: string;
  }[];

  /** Non-fatal warnings (missing metadata, type inference, etc.) */
  warnings: {
    variable: string;
    warning: string;
  }[];
}

/**
 * Extended Dataset interface with variable schema information
 * Represents a dataset with full variable information
 */
export interface DatasetWithSchema extends Dataset {
  /** Schema of variables in this dataset */
  variableSchema?: VariableSchema[];

  /** List of column/variable names */
  columnNames?: string[];

  /** Variable type mapping (name -> type) */
  columnTypes?: Record<string, 'numeric' | 'categorical' | 'text' | 'date' | 'boolean'>;
}

/**
 * Stage output with variable schema metadata
 * Represents the output of a workflow stage with type information
 */
export interface StageOutputWithSchema {
  id?: string;
  title: string;
  type: 'text' | 'table' | 'list' | 'document' | 'chart' | 'json';
  content: string;
  metadata?: Record<string, unknown>;
  source?: 'ai' | 'computed' | 'template';

  /** Variables produced by this stage */
  variableSchema?: VariableSchema[];

  /** Transformation applied to produce these variables */
  transformation?: {
    fromVariables: string[];
    toVariables: string[];
    description: string;
  };
}
```

---

## Part 3: Create Core Types File

**File:** `/packages/core/types/schema.ts` (new file)

```typescript
/**
 * Core variable schema and validation types
 * Used consistently across frontend, backend, and orchestrator
 *
 * @packageDocumentation
 */

/**
 * Supported variable data types
 */
export type VariableType =
  | 'numeric'
  | 'categorical'
  | 'text'
  | 'date'
  | 'boolean'
  | 'unknown';

/**
 * Variable schema with full metadata
 */
export interface VariableSchema {
  name: string;
  type: VariableType;
  nullable: boolean;
  description?: string;

  // Numeric statistics
  min?: number;
  max?: number;
  mean?: number;
  median?: number;
  stdDev?: number;

  // Categorical values
  values?: string[];

  // General metadata
  uniqueCount?: number;
  missingPercent?: number;
  sampleSize?: number;
}

/**
 * Variable requirements for a stage
 */
export interface VariableRequirement {
  name: string;
  type: VariableType | 'any';
  optional?: boolean;
  description?: string;
  min?: number;
  max?: number;
  allowedValues?: string[];
}

/**
 * Validation result for variables
 */
export interface VariableValidationResult {
  valid: boolean;
  errors: Array<{
    variable: string;
    error: string;
  }>;
  warnings: Array<{
    variable: string;
    warning: string;
  }>;
}

/**
 * Mapping between variables in two stages
 */
export interface VariableMapping {
  /** Source stage ID */
  fromStageId: number;

  /** Target stage ID */
  toStageId: number;

  /** Variable mappings */
  mappings: Array<{
    /** Source variable name */
    fromVariable: string;

    /** Target variable name (may differ due to transformation) */
    toVariable: string;

    /** Type of transformation applied */
    transformation?: 'direct' | 'transformed' | 'derived';

    /** Description of transformation */
    description?: string;
  }>;
}

/**
 * Stage variable metadata for workflow execution
 */
export interface StageVariableContext {
  /** Variables available from this stage */
  outputs: VariableSchema[];

  /** Variables required as input to this stage */
  inputs: VariableRequirement[];

  /** Transformations applied by this stage */
  transformations: Array<{
    input: string[];
    output: string;
    description: string;
  }>;
}

/**
 * Variable type compatibility checker
 * Determines if one type can be used where another is expected
 */
export const isTypeCompatible = (
  provided: VariableType,
  required: VariableType | 'any'
): boolean => {
  if (required === 'any') return true;
  if (provided === required) return true;

  // Numeric can often be used where categorical is needed
  if (required === 'categorical' && provided === 'numeric') return true;

  // Text can often be coerced to categorical
  if (required === 'categorical' && provided === 'text') return true;

  return false;
};

/**
 * Infer variable type from sample values
 * Useful for auto-detecting types from dataset
 */
export const inferVariableType = (values: unknown[]): VariableType => {
  if (!values || values.length === 0) return 'unknown';

  const nonNull = values.filter(v => v !== null && v !== undefined);
  if (nonNull.length === 0) return 'unknown';

  // Check for boolean
  if (nonNull.every(v => v === true || v === false)) return 'boolean';

  // Check for numeric
  if (nonNull.every(v => typeof v === 'number' || !isNaN(Number(v)))) {
    return 'numeric';
  }

  // Check for date
  const datePattern = /\d{4}-\d{2}-\d{2}|^\d{1,2}\/\d{1,2}\/\d{2,4}$/;
  if (nonNull.every(v => datePattern.test(String(v)))) {
    return 'date';
  }

  // Check for categorical (limited unique values)
  const uniqueCount = new Set(nonNull).size;
  if (uniqueCount <= Math.sqrt(nonNull.length)) {
    return 'categorical';
  }

  // Default to text
  return 'text';
};
```

### Export from core types index

**File:** `/packages/core/types/index.ts` (add to existing exports)

```typescript
export * from './schema';
export type {
  VariableType,
  VariableSchema,
  VariableRequirement,
  VariableValidationResult,
  VariableMapping,
  StageVariableContext,
} from './schema';
export {
  isTypeCompatible,
  inferVariableType,
} from './schema';
```

---

## Part 4: Update Workflow Pipeline Context

**File:** `/services/web/src/components/sections/workflow-pipeline.tsx`

Find this section around line 179 and update:

```typescript
// BEFORE:
interface StageMetadata {
  columnCount?: number;
}

// AFTER:
import type { VariableSchema } from '@/types/api';

interface StageMetadata {
  columnCount?: number;
  variableSchema?: VariableSchema[];
  columnNames?: string[];
}
```

Then find the uploadedFile useState around line 2015 and update:

```typescript
// BEFORE:
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
} | null>(null);

// AFTER:
const [uploadedFile, setUploadedFile] = useState<{
  id: string;
  name: string;
  size: number;
  type: string;
  uploadedAt: Date;
  status: 'uploading' | 'uploaded' | 'validated' | 'error';
  recordCount?: number;
  variableCount?: number;
  variableSchema?: VariableSchema[];
  columnNames?: string[];
  phiScanStatus?: 'clean' | 'detected' | 'pending' | 'error';
  phiScanResult?: Record<string, unknown>;
  error?: string;
} | null>(null);
```

Then find the stageContext building around line 2837 and update dataContext:

```typescript
// BEFORE:
if (selectedStage.id >= 4) {
  stageContext.dataContext = {
    uploadedFile: uploadedFile ? {
      name: uploadedFile.name,
      size: uploadedFile.size,
      recordCount: uploadedFile.recordCount,
      variableCount: uploadedFile.variableCount,
      phiScanStatus: uploadedFile.phiScanStatus,
    } : null,
  };
}

// AFTER:
if (selectedStage.id >= 4) {
  stageContext.dataContext = {
    uploadedFile: uploadedFile ? {
      name: uploadedFile.name,
      size: uploadedFile.size,
      recordCount: uploadedFile.recordCount,
      variableCount: uploadedFile.variableCount,
      variableSchema: uploadedFile.variableSchema,
      columnNames: uploadedFile.columnNames,
      phiScanStatus: uploadedFile.phiScanStatus,
    } : null,
  };
}
```

---

## Part 5: Stage Component JSDoc Template

Use this template for adding variable documentation to stage components.

**Template:**

```typescript
/**
 * Stage [N]: [Stage Name]
 *
 * [Brief description of what this stage does]
 *
 * ============================================
 * INPUTS (Variables needed from previous stages)
 * ============================================
 * [Stage M].variable1: [Type] - [Description]
 * [Stage M].variable2: [Type] - [Description]
 *
 * ============================================
 * OUTPUTS (Variables produced by this stage)
 * ============================================
 * output1: [Type] - [Description]
 * output2: [Type] - [Description]
 *
 * ============================================
 * VARIABLES AVAILABLE IN STAGE CONTEXT
 * ============================================
 * stageContext.topicContext    → Available in stages 1-3
 * stageContext.dataContext     → Available in stages 4+
 * stageContext.previousOutputs → Available in stages 5-11
 * stageContext.manuscriptContext → Available in stages 12-20
 *
 * ============================================
 * VALIDATION RULES
 * ============================================
 * - [Rule 1]
 * - [Rule 2]
 *
 * ============================================
 * PASSES VARIABLES TO
 * ============================================
 * → Stages [X-Y]: [variable names and usage]
 */
```

**Example for Stage 7:**

```typescript
/**
 * Stage 7: Statistical Modeling & Analysis
 *
 * Performs statistical analysis with model selection and assumptions testing.
 * Supports multiple model types (regression, ANOVA, chi-square, etc.) with
 * comprehensive diagnostics and validation.
 *
 * ============================================
 * INPUTS (Variables needed from previous stages)
 * ============================================
 * - From Stage 4-6: Raw and preprocessed dataset
 *   - Variables: Any numeric or categorical columns from dataset
 *   - Type: Variables from uploadedFile.variableSchema
 *
 * ============================================
 * OUTPUTS (Variables produced by this stage)
 * ============================================
 * - modelResults: object
 *   - coefficients: Array of model coefficients
 *   - statistics: Model fit statistics (R², p-values)
 *   - assumptions: Test results for model assumptions
 *   - predictions: Predicted values for validation
 *
 * ============================================
 * VARIABLES AVAILABLE IN STAGE CONTEXT
 * ============================================
 * stageContext.dataContext.uploadedFile
 *   → name: string
 *   → recordCount: number
 *   → variableSchema: VariableSchema[] (NEW)
 *   → columnNames: string[] (NEW)
 *
 * stageContext.previousStageOutputs
 *   → stage4: Raw data outputs
 *   → stage5: Preprocessed data
 *   → stage6: Variable selections
 *
 * ============================================
 * VALIDATION RULES
 * ============================================
 * - Dependent variable type must match model type
 * - Independent variables must be compatible with model
 * - Numeric models: Need numeric variables
 * - Categorical models: Need categorical variables
 * - Sample size must be adequate (at least 10 obs per variable)
 *
 * ============================================
 * PASSES VARIABLES TO
 * ============================================
 * → Stages 8-11: Model results and diagnostics
 * → Stage 12+: Summary statistics and interpretation
 */
```

---

## Part 6: Import Statements Template

When updating components to use VariablePicker, use these imports:

```typescript
// Add to top of component file:
import { VariablePicker, type VariableInfo } from '@/components/ui/variable-picker';
import type { VariableSchema } from '@/types/api';

// In component JSX:
<VariablePicker
  variables={uploadedFile?.variableSchema?.map(schema => ({
    name: schema.name,
    type: schema.type,
    description: schema.description,
  })) || []}
  selected={selectedVariables}
  onChange={setSelectedVariables}
  multiSelect={true}
  groupByType={true}
  searchable={true}
  label="Select Variables for Analysis"
  description="Choose one or more variables from your dataset"
/>
```

---

## Verification Checklist

After implementing each quick win, verify:

```bash
# After Quick Win #1 (Component):
✅ Component file created at src/components/ui/variable-picker.tsx
✅ Exports in index.ts
✅ No TypeScript errors: npm run type-check
✅ Component can be imported: import { VariablePicker } from '@/components/ui/variable-picker'

# After Quick Win #2 (Types):
✅ Types added to src/types/api.ts
✅ No TypeScript errors: npm run type-check
✅ Types are exported from index
✅ Can be imported: import type { VariableSchema } from '@/types/api'

# After Quick Win #3 (Core Types):
✅ File created at packages/core/types/schema.ts
✅ Exports in packages/core/types/index.ts
✅ Core package builds: npm run build (in packages/core)
✅ Can be imported: import type { VariableSchema } from '@researchflow/core/types'

# After Quick Win #4 (Documentation):
✅ JSDoc comments added to Stage components
✅ Comments appear in IDE hover tooltips
✅ Comments describe variable inputs/outputs
✅ Comments include validation rules
```

---

## Next Steps

After implementing all quick wins:

1. **Test Component:** Use VariablePicker in one Stage to verify it works
2. **Test Types:** Add type annotations to variables throughout pipeline
3. **Test Documentation:** Verify JSDoc helps developers understand variable flow
4. **Review:** Get feedback before moving to Phase 1 schema service work

See `ROS-29_WORKFLOW_ENGINE_REVIEW.md` section 6 for Phase 1 full implementation.
