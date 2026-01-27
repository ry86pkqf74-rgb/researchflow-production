"""
Deterministic Rule Calculator

Executes threshold-based, lookup table, and formula-based scoring rules
for clinical prediction models, staging systems, and grading criteria.

IMPORTANT: This module performs deterministic calculations only.
No LLM/AI calls should be made here - keep it pure computation.
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional


@dataclass
class CalculationResult:
    """Result of a rule calculation."""
    outputs: Dict[str, Any]
    interpretation: Optional[str] = None
    warnings: List[str] = field(default_factory=list)
    matched_criteria: List[str] = field(default_factory=list)


class RuleCalculator:
    """
    Execute deterministic rules from RuleSpec definitions.

    Supports three rule types:
    - threshold: Point-based scoring with criteria evaluation
    - lookup_table: Direct mapping from input keys to output
    - formula: Mathematical formula evaluation

    Example usage:
        rule_spec = {
            'ruleType': 'threshold',
            'ruleDefinition': {
                'criteria': [
                    {'variable': 'age', 'condition': 'gte', 'threshold': 75, 'points': 2},
                    {'variable': 'chf', 'condition': 'boolean', 'points': 1},
                ],
                'categories': [
                    {'min': 0, 'max': 0, 'label': 'Low'},
                    {'min': 1, 'max': 2, 'label': 'Moderate'},
                    {'min': 3, 'max': 9, 'label': 'High'},
                ],
            },
            'testCases': [...],
        }
        calculator = RuleCalculator(rule_spec)
        result = calculator.calculate({'age': 80, 'chf': True})
    """

    def __init__(self, rule_spec: Dict[str, Any]):
        """
        Initialize calculator with rule specification.

        Args:
            rule_spec: Rule specification with ruleType, ruleDefinition, testCases
        """
        self.rule_type = rule_spec.get('ruleType', 'threshold')
        self.definition = rule_spec.get('ruleDefinition', {})
        self.test_cases = rule_spec.get('testCases', [])

    def calculate(self, inputs: Dict[str, Any]) -> CalculationResult:
        """
        Execute the rule and return results.

        Args:
            inputs: Dictionary of input variable values

        Returns:
            CalculationResult with outputs, interpretation, and any warnings
        """
        warnings: List[str] = []

        if self.rule_type == 'threshold':
            outputs, matched = self._calculate_threshold(inputs, warnings)
        elif self.rule_type == 'lookup_table':
            outputs, matched = self._calculate_lookup(inputs, warnings)
        elif self.rule_type == 'formula':
            outputs, matched = self._calculate_formula(inputs, warnings)
        else:
            raise ValueError(f"Unsupported rule type: {self.rule_type}")

        interpretation = self._get_interpretation(outputs)

        return CalculationResult(
            outputs=outputs,
            interpretation=interpretation,
            warnings=warnings,
            matched_criteria=matched,
        )

    def _calculate_threshold(
        self, inputs: Dict[str, Any], warnings: List[str]
    ) -> tuple[Dict[str, Any], List[str]]:
        """Calculate score based on threshold criteria."""
        score = 0
        matched_criteria: List[str] = []

        for criterion in self.definition.get('criteria', []):
            variable = criterion.get('variable')
            value = inputs.get(variable)

            if value is None:
                if criterion.get('required', False):
                    warnings.append(f"Missing required input: {variable}")
                continue

            condition = criterion.get('condition', 'equals')
            target = criterion.get('value') or criterion.get('threshold')
            points = criterion.get('points', 1)

            if self._evaluate_condition(value, condition, target):
                score += points
                matched_criteria.append(criterion.get('name', variable))

        # Categorize the score
        category = self._categorize_score(score)

        return {'score': score, 'category': category}, matched_criteria

    def _calculate_lookup(
        self, inputs: Dict[str, Any], warnings: List[str]
    ) -> tuple[Dict[str, Any], List[str]]:
        """Look up result in a table (e.g., TNM staging)."""
        table = self.definition.get('table', {})
        keys = self.definition.get('keys', [])

        # Build lookup key
        key_parts = []
        for k in keys:
            val = inputs.get(k)
            if val is None:
                warnings.append(f"Missing key: {k}")
                return {'error': f"Missing required key: {k}"}, []
            key_parts.append(f"{k}:{val}")

        lookup_key = '|'.join(sorted(key_parts))

        if lookup_key in table:
            return table[lookup_key], [lookup_key]

        # Try case-insensitive match
        for tk, tv in table.items():
            if tk.lower() == lookup_key.lower():
                return tv, [tk]

        warnings.append(f"No match found for: {lookup_key}")
        return {'stage': 'Unknown', 'warning': 'No matching entry'}, []

    def _calculate_formula(
        self, inputs: Dict[str, Any], warnings: List[str]
    ) -> tuple[Dict[str, Any], List[str]]:
        """Evaluate a mathematical formula."""
        formula = self.definition.get('formula', '')
        variables = self.definition.get('variables', [])

        # Build evaluation context
        context: Dict[str, float] = {}
        for var in variables:
            name = var.get('name')
            value = inputs.get(name)
            if value is None:
                if var.get('required', True):
                    warnings.append(f"Missing required variable: {name}")
                    return {'error': f"Missing: {name}"}, []
                value = var.get('default', 0)
            context[name] = float(value)

        # Safe evaluation using only allowed operations
        try:
            safe_context = {
                'abs': abs,
                'round': round,
                'min': min,
                'max': max,
                'log': math.log,
                'log10': math.log10,
                'exp': math.exp,
                'sqrt': math.sqrt,
                'pow': pow,
                **context,
            }
            result = eval(formula, {"__builtins__": {}}, safe_context)
            category = self._categorize_score(result)
            return {'value': result, 'category': category}, list(context.keys())
        except Exception as e:
            warnings.append(f"Formula evaluation failed: {e}")
            return {'error': str(e)}, []

    def _evaluate_condition(self, value: Any, condition: str, target: Any) -> bool:
        """Evaluate a single condition."""
        try:
            if condition == 'equals':
                return value == target
            elif condition == 'gte':
                return float(value) >= float(target)
            elif condition == 'gt':
                return float(value) > float(target)
            elif condition == 'lte':
                return float(value) <= float(target)
            elif condition == 'lt':
                return float(value) < float(target)
            elif condition == 'boolean':
                return bool(value)
            elif condition == 'in':
                return value in (target if isinstance(target, list) else [target])
            elif condition == 'between':
                if isinstance(target, dict):
                    return target.get('min', float('-inf')) <= float(value) <= target.get('max', float('inf'))
                return False
            return False
        except (ValueError, TypeError):
            return False

    def _categorize_score(self, score: float) -> str:
        """Assign category based on score ranges."""
        categories = self.definition.get('categories', [])
        for cat in categories:
            min_val = cat.get('min', float('-inf'))
            max_val = cat.get('max', float('inf'))
            if min_val <= score <= max_val:
                return cat.get('label', 'Unknown')
        return 'Unknown'

    def _get_interpretation(self, outputs: Dict[str, Any]) -> Optional[str]:
        """Get interpretation text for the result."""
        interpretations = self.definition.get('interpretations', {})
        category = outputs.get('category')
        score = outputs.get('score') or outputs.get('value')

        if category and category in interpretations:
            return interpretations[category]

        # Try range-based interpretation
        for interp in self.definition.get('interpretation_ranges', []):
            min_val = interp.get('min', float('-inf'))
            max_val = interp.get('max', float('inf'))
            if score is not None and min_val <= score <= max_val:
                return interp.get('meaning')

        return None

    def validate(self) -> List[Dict[str, Any]]:
        """
        Run test cases to validate the rule.

        Returns:
            List of test results with passed/failed status
        """
        results = []
        for i, test in enumerate(self.test_cases):
            test_inputs = test.get('inputs', {})
            expected = test.get('expectedOutput', {})

            try:
                actual = self.calculate(test_inputs)
                passed = all(
                    actual.outputs.get(k) == v for k, v in expected.items()
                )
                results.append({
                    'test_index': i,
                    'passed': passed,
                    'expected': expected,
                    'actual': actual.outputs,
                    'description': test.get('description', f'Test {i}'),
                })
            except Exception as e:
                results.append({
                    'test_index': i,
                    'passed': False,
                    'error': str(e),
                    'description': test.get('description', f'Test {i}'),
                })

        return results


# =============================================================================
# Pre-built Scoring Systems
# =============================================================================

def create_cha2ds2_vasc_calculator() -> RuleCalculator:
    """
    Create a CHA2DS2-VASc calculator for atrial fibrillation stroke risk.

    Scoring:
    - CHF (1 point)
    - Hypertension (1 point)
    - Age ≥75 (2 points)
    - Diabetes (1 point)
    - Stroke/TIA/TE history (2 points)
    - Vascular disease (1 point)
    - Age 65-74 (1 point)
    - Sex category - female (1 point)

    Returns:
        Configured RuleCalculator for CHA2DS2-VASc
    """
    rule_spec = {
        'ruleType': 'threshold',
        'ruleDefinition': {
            'criteria': [
                {'variable': 'chf', 'condition': 'boolean', 'points': 1, 'name': 'CHF/LV dysfunction'},
                {'variable': 'hypertension', 'condition': 'boolean', 'points': 1, 'name': 'Hypertension'},
                {'variable': 'age_75_plus', 'condition': 'boolean', 'points': 2, 'name': 'Age ≥75'},
                {'variable': 'diabetes', 'condition': 'boolean', 'points': 1, 'name': 'Diabetes'},
                {'variable': 'stroke_tia', 'condition': 'boolean', 'points': 2, 'name': 'Stroke/TIA/TE'},
                {'variable': 'vascular_disease', 'condition': 'boolean', 'points': 1, 'name': 'Vascular disease'},
                {'variable': 'age_65_74', 'condition': 'boolean', 'points': 1, 'name': 'Age 65-74'},
                {'variable': 'female', 'condition': 'boolean', 'points': 1, 'name': 'Female sex'},
            ],
            'categories': [
                {'min': 0, 'max': 0, 'label': 'Low risk'},
                {'min': 1, 'max': 1, 'label': 'Low-moderate risk'},
                {'min': 2, 'max': 9, 'label': 'Moderate-high risk'},
            ],
            'interpretations': {
                'Low risk': 'Annual stroke risk ~0.2%. Anticoagulation generally not recommended.',
                'Low-moderate risk': 'Annual stroke risk ~1.3%. Consider anticoagulation.',
                'Moderate-high risk': 'Annual stroke risk ≥2.2%. Anticoagulation recommended.',
            },
        },
        'testCases': [
            {
                'inputs': {'chf': False, 'hypertension': False, 'age_75_plus': False, 'diabetes': False,
                          'stroke_tia': False, 'vascular_disease': False, 'age_65_74': False, 'female': False},
                'expectedOutput': {'score': 0, 'category': 'Low risk'},
                'description': 'Score 0 - all negative',
            },
            {
                'inputs': {'chf': True, 'hypertension': True, 'age_75_plus': False, 'diabetes': False,
                          'stroke_tia': False, 'vascular_disease': False, 'age_65_74': False, 'female': False},
                'expectedOutput': {'score': 2, 'category': 'Moderate-high risk'},
                'description': 'Score 2 - CHF + Hypertension',
            },
        ],
    }
    return RuleCalculator(rule_spec)


def create_child_pugh_calculator() -> RuleCalculator:
    """
    Create a Child-Pugh calculator for liver disease severity.

    Parameters:
    - Bilirubin (mg/dL): <2=1pt, 2-3=2pt, >3=3pt
    - Albumin (g/dL): >3.5=1pt, 2.8-3.5=2pt, <2.8=3pt
    - INR: <1.7=1pt, 1.7-2.3=2pt, >2.3=3pt
    - Ascites: None=1pt, Mild=2pt, Moderate-Severe=3pt
    - Encephalopathy: None=1pt, Grade 1-2=2pt, Grade 3-4=3pt

    Returns:
        Configured RuleCalculator for Child-Pugh
    """
    rule_spec = {
        'ruleType': 'threshold',
        'ruleDefinition': {
            'criteria': [
                # Bilirubin
                {'variable': 'bilirubin', 'condition': 'lt', 'threshold': 2, 'points': 1, 'name': 'Bilirubin <2'},
                {'variable': 'bilirubin', 'condition': 'between', 'value': {'min': 2, 'max': 3}, 'points': 2, 'name': 'Bilirubin 2-3'},
                {'variable': 'bilirubin', 'condition': 'gt', 'threshold': 3, 'points': 3, 'name': 'Bilirubin >3'},
                # Albumin
                {'variable': 'albumin', 'condition': 'gt', 'threshold': 3.5, 'points': 1, 'name': 'Albumin >3.5'},
                {'variable': 'albumin', 'condition': 'between', 'value': {'min': 2.8, 'max': 3.5}, 'points': 2, 'name': 'Albumin 2.8-3.5'},
                {'variable': 'albumin', 'condition': 'lt', 'threshold': 2.8, 'points': 3, 'name': 'Albumin <2.8'},
                # INR
                {'variable': 'inr', 'condition': 'lt', 'threshold': 1.7, 'points': 1, 'name': 'INR <1.7'},
                {'variable': 'inr', 'condition': 'between', 'value': {'min': 1.7, 'max': 2.3}, 'points': 2, 'name': 'INR 1.7-2.3'},
                {'variable': 'inr', 'condition': 'gt', 'threshold': 2.3, 'points': 3, 'name': 'INR >2.3'},
                # Ascites
                {'variable': 'ascites', 'condition': 'equals', 'value': 'none', 'points': 1, 'name': 'No ascites'},
                {'variable': 'ascites', 'condition': 'equals', 'value': 'mild', 'points': 2, 'name': 'Mild ascites'},
                {'variable': 'ascites', 'condition': 'in', 'value': ['moderate', 'severe'], 'points': 3, 'name': 'Moderate-severe ascites'},
                # Encephalopathy
                {'variable': 'encephalopathy', 'condition': 'equals', 'value': 'none', 'points': 1, 'name': 'No encephalopathy'},
                {'variable': 'encephalopathy', 'condition': 'in', 'value': ['grade1', 'grade2'], 'points': 2, 'name': 'Grade 1-2 encephalopathy'},
                {'variable': 'encephalopathy', 'condition': 'in', 'value': ['grade3', 'grade4'], 'points': 3, 'name': 'Grade 3-4 encephalopathy'},
            ],
            'categories': [
                {'min': 5, 'max': 6, 'label': 'Class A'},
                {'min': 7, 'max': 9, 'label': 'Class B'},
                {'min': 10, 'max': 15, 'label': 'Class C'},
            ],
            'interpretations': {
                'Class A': '1-year survival ~100%. 2-year survival ~85%. Well-compensated disease.',
                'Class B': '1-year survival ~80%. 2-year survival ~60%. Significant functional compromise.',
                'Class C': '1-year survival ~45%. 2-year survival ~35%. Decompensated disease.',
            },
        },
        'testCases': [
            {
                'inputs': {'bilirubin': 1.5, 'albumin': 4.0, 'inr': 1.2, 'ascites': 'none', 'encephalopathy': 'none'},
                'expectedOutput': {'score': 5, 'category': 'Class A'},
                'description': 'Class A - minimal disease',
            },
        ],
    }
    return RuleCalculator(rule_spec)
