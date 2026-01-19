/**
 * JSONLogic Rules Engine
 *
 * Provides configurable business logic for:
 * - Validation rules
 * - Data routing
 * - Access control decisions
 * - Workflow branching
 */

// JSONLogic types
interface JsonLogicRule {
  [operator: string]: any;
}

interface RuleDefinition {
  id: string;
  name: string;
  description?: string;
  rule: JsonLogicRule;
  enabled: boolean;
  priority: number; // Lower = higher priority
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  tags?: string[];
}

interface RuleEvaluationResult {
  ruleId: string;
  ruleName: string;
  result: any;
  passed: boolean;
  evaluatedAt: Date;
  duration: number; // ms
}

interface RuleSet {
  id: string;
  name: string;
  description?: string;
  rules: string[]; // Rule IDs
  combinator: 'all' | 'any' | 'none';
  enabled: boolean;
}

// JSONLogic operators
const OPERATORS: Record<string, (...args: any[]) => any> = {
  // Comparison
  '==': (a: any, b: any) => a == b,
  '===': (a: any, b: any) => a === b,
  '!=': (a: any, b: any) => a != b,
  '!==': (a: any, b: any) => a !== b,
  '>': (a: number, b: number) => a > b,
  '>=': (a: number, b: number) => a >= b,
  '<': (a: number, b: number) => a < b,
  '<=': (a: number, b: number) => a <= b,

  // Logic
  '!': (a: any) => !a,
  '!!': (a: any) => !!a,
  'and': (...args: any[]) => args.every(Boolean),
  'or': (...args: any[]) => args.some(Boolean),

  // String
  'in': (needle: any, haystack: any) => {
    if (Array.isArray(haystack)) return haystack.includes(needle);
    if (typeof haystack === 'string') return haystack.includes(needle);
    return false;
  },
  'cat': (...args: string[]) => args.join(''),
  'substr': (str: string, start: number, len?: number) =>
    len ? str.substr(start, len) : str.substr(start),

  // Numeric
  '+': (...args: number[]) => args.reduce((a, b) => a + b, 0),
  '-': (a: number, b?: number) => b === undefined ? -a : a - b,
  '*': (...args: number[]) => args.reduce((a, b) => a * b, 1),
  '/': (a: number, b: number) => a / b,
  '%': (a: number, b: number) => a % b,
  'min': (...args: number[]) => Math.min(...args),
  'max': (...args: number[]) => Math.max(...args),

  // Array
  'map': (arr: any[], rule: JsonLogicRule) => arr.map(item => evaluate(rule, item)),
  'filter': (arr: any[], rule: JsonLogicRule) => arr.filter(item => evaluate(rule, item)),
  'reduce': (arr: any[], rule: JsonLogicRule, initial: any) =>
    arr.reduce((acc, item) => evaluate(rule, { accumulator: acc, current: item }), initial),
  'all': (arr: any[], rule: JsonLogicRule) => arr.every(item => evaluate(rule, item)),
  'some': (arr: any[], rule: JsonLogicRule) => arr.some(item => evaluate(rule, item)),
  'none': (arr: any[], rule: JsonLogicRule) => !arr.some(item => evaluate(rule, item)),
  'merge': (...arrays: any[][]) => arrays.flat(),

  // Data access
  'var': (path: string | number, data: any, defaultValue?: any) => {
    if (path === '' || path === null) return data;
    const keys = String(path).split('.');
    let result = data;
    for (const key of keys) {
      if (result === null || result === undefined) return defaultValue;
      result = result[key];
    }
    return result === undefined ? defaultValue : result;
  },
  'missing': (keys: string[], data: any) => {
    return keys.filter(key => {
      const val = OPERATORS['var'](key, data);
      return val === undefined || val === null;
    });
  },
  'missing_some': (minimum: number, keys: string[], data: any) => {
    const missing = OPERATORS['missing'](keys, data);
    return missing.length >= keys.length - minimum + 1 ? missing : [];
  },

  // Control
  'if': (...args: any[]) => {
    for (let i = 0; i < args.length - 1; i += 2) {
      if (args[i]) return args[i + 1];
    }
    return args.length % 2 === 1 ? args[args.length - 1] : null;
  },
  '?:': (cond: any, then: any, else_: any) => cond ? then : else_,

  // Date (custom)
  'now': () => new Date().toISOString(),
  'date_diff': (a: string, b: string, unit: 'days' | 'hours' | 'minutes' = 'days') => {
    const diff = new Date(a).getTime() - new Date(b).getTime();
    switch (unit) {
      case 'minutes': return diff / 60000;
      case 'hours': return diff / 3600000;
      case 'days': return diff / 86400000;
      default: return diff;
    }
  },

  // Custom operators for ResearchFlow
  'schema_version_gte': (version: string, minVersion: string) => {
    const [major1, minor1, patch1] = version.split('.').map(Number);
    const [major2, minor2, patch2] = minVersion.split('.').map(Number);
    if (major1 !== major2) return major1 > major2;
    if (minor1 !== minor2) return minor1 > minor2;
    return patch1 >= patch2;
  },
  'has_role': (roles: string[], requiredRole: string) =>
    roles.includes(requiredRole) || roles.includes('admin'),
  'matches_pattern': (str: string, pattern: string) =>
    new RegExp(pattern).test(str)
};

/**
 * Evaluate a JSONLogic rule against data
 */
export function evaluate(rule: JsonLogicRule | any, data: any = {}): any {
  // Primitives pass through
  if (rule === null || rule === undefined) return rule;
  if (typeof rule !== 'object') return rule;

  // Arrays evaluate each element
  if (Array.isArray(rule)) {
    return rule.map(item => evaluate(item, data));
  }

  // Find the operator
  const operators = Object.keys(rule);
  if (operators.length !== 1) {
    throw new Error('Invalid rule: must have exactly one operator');
  }

  const operator = operators[0];
  let args = rule[operator];

  // Normalize args to array
  if (!Array.isArray(args)) {
    args = [args];
  }

  // Special handling for 'var'
  if (operator === 'var') {
    return OPERATORS['var'](args[0], data, args[1]);
  }

  // Evaluate nested rules in args
  args = args.map((arg: any) => {
    // Don't evaluate if it's a rule that should be passed as-is (for map/filter/etc)
    if (operator === 'map' || operator === 'filter' || operator === 'reduce' ||
        operator === 'all' || operator === 'some' || operator === 'none') {
      // First arg is data, second is rule
      return arg;
    }
    return evaluate(arg, data);
  });

  // Get operator function
  const fn = OPERATORS[operator];
  if (!fn) {
    throw new Error(`Unknown operator: ${operator}`);
  }

  // Special handling for array operations
  if (operator === 'map' || operator === 'filter' || operator === 'all' ||
      operator === 'some' || operator === 'none') {
    const arr = args[0];
    const itemRule = rule[operator][1];
    return fn(arr, itemRule);
  }

  if (operator === 'reduce') {
    const arr = args[0];
    const itemRule = rule[operator][1];
    const initial = args[2];
    return fn(arr, itemRule, initial);
  }

  // Execute operator
  return fn(...args);
}

/**
 * Rules Service
 */
export class RulesService {
  private rules: Map<string, RuleDefinition> = new Map();
  private ruleSets: Map<string, RuleSet> = new Map();

  /**
   * Create a new rule
   */
  createRule(
    name: string,
    rule: JsonLogicRule,
    options: {
      description?: string;
      priority?: number;
      tags?: string[];
      createdBy?: string;
    } = {}
  ): RuleDefinition {
    // Validate rule
    this.validateRule(rule);

    const id = this.generateId('rule');
    const definition: RuleDefinition = {
      id,
      name,
      description: options.description,
      rule,
      enabled: true,
      priority: options.priority || 100,
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: options.createdBy || 'system',
      tags: options.tags
    };

    this.rules.set(id, definition);
    return definition;
  }

  /**
   * Update a rule
   */
  updateRule(id: string, updates: Partial<Omit<RuleDefinition, 'id' | 'createdAt'>>): RuleDefinition {
    const rule = this.rules.get(id);
    if (!rule) {
      throw new Error(`Rule not found: ${id}`);
    }

    if (updates.rule) {
      this.validateRule(updates.rule);
    }

    Object.assign(rule, updates, { updatedAt: new Date() });
    return rule;
  }

  /**
   * Delete a rule
   */
  deleteRule(id: string): boolean {
    return this.rules.delete(id);
  }

  /**
   * Get rule by ID
   */
  getRule(id: string): RuleDefinition | undefined {
    return this.rules.get(id);
  }

  /**
   * List all rules
   */
  listRules(filters?: { tags?: string[]; enabled?: boolean }): RuleDefinition[] {
    let rules = Array.from(this.rules.values());

    if (filters?.tags?.length) {
      rules = rules.filter(r =>
        r.tags?.some(t => filters.tags!.includes(t))
      );
    }

    if (filters?.enabled !== undefined) {
      rules = rules.filter(r => r.enabled === filters.enabled);
    }

    return rules.sort((a, b) => a.priority - b.priority);
  }

  /**
   * Evaluate a rule against data
   */
  evaluateRule(ruleId: string, data: any): RuleEvaluationResult {
    const rule = this.rules.get(ruleId);
    if (!rule) {
      throw new Error(`Rule not found: ${ruleId}`);
    }

    const start = Date.now();
    const result = evaluate(rule.rule, data);
    const duration = Date.now() - start;

    return {
      ruleId: rule.id,
      ruleName: rule.name,
      result,
      passed: Boolean(result),
      evaluatedAt: new Date(),
      duration
    };
  }

  /**
   * Evaluate multiple rules
   */
  evaluateRules(
    ruleIds: string[],
    data: any,
    combinator: 'all' | 'any' | 'none' = 'all'
  ): {
    results: RuleEvaluationResult[];
    passed: boolean;
  } {
    const results = ruleIds.map(id => this.evaluateRule(id, data));

    let passed: boolean;
    switch (combinator) {
      case 'all':
        passed = results.every(r => r.passed);
        break;
      case 'any':
        passed = results.some(r => r.passed);
        break;
      case 'none':
        passed = results.every(r => !r.passed);
        break;
    }

    return { results, passed };
  }

  /**
   * Create a rule set
   */
  createRuleSet(
    name: string,
    ruleIds: string[],
    options: {
      description?: string;
      combinator?: 'all' | 'any' | 'none';
    } = {}
  ): RuleSet {
    // Validate all rules exist
    for (const id of ruleIds) {
      if (!this.rules.has(id)) {
        throw new Error(`Rule not found: ${id}`);
      }
    }

    const ruleSet: RuleSet = {
      id: this.generateId('rset'),
      name,
      description: options.description,
      rules: ruleIds,
      combinator: options.combinator || 'all',
      enabled: true
    };

    this.ruleSets.set(ruleSet.id, ruleSet);
    return ruleSet;
  }

  /**
   * Evaluate a rule set
   */
  evaluateRuleSet(ruleSetId: string, data: any): {
    ruleSetId: string;
    results: RuleEvaluationResult[];
    passed: boolean;
  } {
    const ruleSet = this.ruleSets.get(ruleSetId);
    if (!ruleSet) {
      throw new Error(`Rule set not found: ${ruleSetId}`);
    }

    const { results, passed } = this.evaluateRules(
      ruleSet.rules,
      data,
      ruleSet.combinator
    );

    return {
      ruleSetId: ruleSet.id,
      results,
      passed
    };
  }

  /**
   * Validate a rule is syntactically correct
   */
  validateRule(rule: JsonLogicRule): void {
    try {
      // Test evaluation with empty data
      evaluate(rule, {});
    } catch (error: any) {
      throw new Error(`Invalid rule: ${error.message}`);
    }
  }

  private generateId(prefix: string): string {
    return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).substr(2, 6)}`;
  }
}

// Export convenience function
export const jsonLogic = {
  evaluate,
  RulesService
};

export default RulesService;
