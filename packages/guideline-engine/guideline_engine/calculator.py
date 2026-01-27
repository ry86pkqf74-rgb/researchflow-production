"""
Deterministic Rule Calculator

CRITICAL: This module executes clinical scoring rules WITHOUT ANY LLM INVOLVEMENT.
All computation is based strictly on the RuleSpec definition.

Supported rule types:
- THRESHOLD: Points-based scoring (e.g., CHA2DS2-VASc, Child-Pugh)
- LOOKUP_TABLE: Key-based lookup (e.g., TNM staging)
- FORMULA: Mathematical expressions (e.g., MELD score)
"""
from typing import Dict, Any, List, Optional, Tuple
from dataclasses import dataclass, field
import math

from .models import RuleSpec, RuleType


@dataclass
class CalculationResult:
    """Result of a rule calculation."""
    outputs: Dict[str, Any]
    interpretation: Optional[str] = None
    matched_criteria: List[str] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)
    rule_type: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "outputs": self.outputs,
            "interpretation": self.interpretation,
            "matched_criteria": self.matched_criteria,
            "warnings": self.warnings,
            "rule_type": self.rule_type,
        }


class RuleCalculator:
    """
    Executes deterministic rules from a RuleSpec.

    NEVER involves LLM - all computation is strictly defined by the rule_definition.
    """

    def __init__(self, rule_spec: RuleSpec):
        self.rule_spec = rule_spec
        self.definition = rule_spec.rule_definition

    def calculate(self, inputs: Dict[str, Any]) -> CalculationResult:
        """Execute the rule with given inputs."""
        warnings: List[str] = []
        matched: List[str] = []

        rule_type = self.rule_spec.rule_type
        if isinstance(rule_type, str):
            rule_type = RuleType(rule_type)

        if rule_type == RuleType.THRESHOLD:
            outputs = self._calc_threshold(inputs, warnings, matched)
        elif rule_type == RuleType.LOOKUP_TABLE:
            outputs = self._calc_lookup(inputs, warnings)
        elif rule_type == RuleType.FORMULA:
            outputs = self._calc_formula(inputs, warnings)
        elif rule_type == RuleType.DECISION_TREE:
            outputs = self._calc_decision_tree(inputs, warnings, matched)
        else:
            raise ValueError(f"Unsupported rule type: {rule_type}")

        interpretation = self._get_interpretation(outputs)

        return CalculationResult(
            outputs=outputs,
            interpretation=interpretation,
            matched_criteria=matched,
            warnings=warnings,
            rule_type=str(rule_type.value) if isinstance(rule_type, RuleType) else str(rule_type),
        )

    def _calc_threshold(
        self, inputs: Dict[str, Any], warnings: List[str], matched: List[str]
    ) -> Dict[str, Any]:
        """Calculate threshold/points-based score (e.g., CHA2DS2-VASc)."""
        criteria = self.definition.get("criteria", [])
        categories = self.definition.get("categories", [])
        score = 0

        # Track which criteria have been applied to handle mutual exclusions
        applied_vars: Dict[str, bool] = {}

        for criterion in criteria:
            var = criterion.get("variable")
            val = inputs.get(var)

            if val is None:
                if criterion.get("required", True):
                    warnings.append(f"Missing required variable: {var}")
                continue

            condition = criterion.get("condition", "equals")
            target = criterion.get("value") if criterion.get("value") is not None else criterion.get("threshold")
            points = criterion.get("points", 1)
            name = criterion.get("name", var)

            # Check exclude_if condition
            exclude_if = criterion.get("exclude_if") or criterion.get("excludeIf")
            if exclude_if:
                exclude_var = exclude_if.get("variable")
                exclude_cond = exclude_if.get("condition")
                exclude_threshold = exclude_if.get("threshold")
                exclude_val = inputs.get(exclude_var)
                if exclude_val is not None and self._check_condition(exclude_val, exclude_cond, exclude_threshold):
                    continue  # Skip this criterion

            if self._check_condition(val, condition, target):
                # For age-based criteria, only apply the highest applicable
                if var == "age" and var in applied_vars:
                    # Skip lower-point age criteria if higher already applied
                    continue

                score += points
                matched.append(name)
                applied_vars[var] = True

        category = self._categorize(score, categories)
        return {"score": score, "category": category}

    def _calc_lookup(self, inputs: Dict[str, Any], warnings: List[str]) -> Dict[str, Any]:
        """Calculate lookup table result (e.g., TNM staging)."""
        keys = self.definition.get("keys", [])
        table = self.definition.get("table", {})

        # Build lookup key from input values
        key_parts = []
        for k in keys:
            val = inputs.get(k)
            if val is not None:
                key_parts.append(f"{k}:{val}")
            else:
                warnings.append(f"Missing lookup key: {k}")

        lookup_key = "|".join(sorted(key_parts))

        # Try exact match first
        if lookup_key in table:
            return dict(table[lookup_key])

        # Try partial matches
        for table_key, result in table.items():
            if all(part in table_key for part in key_parts):
                return dict(result)

        warnings.append(f"No lookup match for: {lookup_key}")
        return {"error": "No matching entry", "key": lookup_key}

    def _calc_formula(self, inputs: Dict[str, Any], warnings: List[str]) -> Dict[str, Any]:
        """Calculate formula-based score (e.g., MELD)."""
        formula = self.definition.get("formula", "0")
        variables = self.definition.get("variables", [])
        categories = self.definition.get("categories", [])

        # Build context with safe math functions
        context: Dict[str, Any] = {
            "math": math,
            "log": math.log,
            "ln": math.log,
            "log10": math.log10,
            "exp": math.exp,
            "sqrt": math.sqrt,
            "pow": pow,
            "abs": abs,
            "min": min,
            "max": max,
            "round": round,
        }

        # Add input values with defaults
        for var_def in variables:
            var_name = var_def.get("name")
            default = var_def.get("default")
            min_val = var_def.get("min")
            max_val = var_def.get("max")

            val = inputs.get(var_name, default)
            if val is None:
                if var_def.get("required", True):
                    warnings.append(f"Missing required variable: {var_name}")
                val = default or 0

            # Apply min/max constraints
            if min_val is not None and val < min_val:
                val = min_val
            if max_val is not None and val > max_val:
                val = max_val

            context[var_name] = val

        # Add remaining inputs
        for key, val in inputs.items():
            if key not in context:
                context[key] = val

        try:
            # Safe eval with restricted builtins
            result = eval(formula, {"__builtins__": {}}, context)
            result = round(float(result), 2)

            outputs: Dict[str, Any] = {"value": result}

            # Apply categories if defined
            if categories:
                category = self._categorize(result, categories)
                outputs["category"] = category

            return outputs

        except Exception as e:
            warnings.append(f"Formula error: {str(e)}")
            return {"error": str(e)}

    def _calc_decision_tree(
        self, inputs: Dict[str, Any], warnings: List[str], matched: List[str]
    ) -> Dict[str, Any]:
        """Calculate decision tree result."""
        tree = self.definition.get("tree", {})
        return self._traverse_tree(tree, inputs, warnings, matched)

    def _traverse_tree(
        self,
        node: Dict[str, Any],
        inputs: Dict[str, Any],
        warnings: List[str],
        matched: List[str],
    ) -> Dict[str, Any]:
        """Recursively traverse a decision tree."""
        if "result" in node:
            return dict(node["result"])

        var = node.get("variable")
        val = inputs.get(var)

        if val is None:
            warnings.append(f"Missing decision variable: {var}")
            return {"error": f"Missing: {var}"}

        branches = node.get("branches", [])
        for branch in branches:
            condition = branch.get("condition")
            target = branch.get("value")

            if self._check_condition(val, condition, target):
                matched.append(f"{var}={val}")
                return self._traverse_tree(branch.get("then", {}), inputs, warnings, matched)

        # Default branch
        default = node.get("default", {})
        if default:
            return self._traverse_tree(default, inputs, warnings, matched)

        return {"error": "No matching branch"}

    def _check_condition(self, val: Any, condition: str, target: Any) -> bool:
        """Check if a value meets a condition."""
        try:
            if condition == "equals" or condition == "eq":
                return val == target
            elif condition == "gte" or condition == ">=":
                return float(val) >= float(target)
            elif condition == "gt" or condition == ">":
                return float(val) > float(target)
            elif condition == "lte" or condition == "<=":
                return float(val) <= float(target)
            elif condition == "lt" or condition == "<":
                return float(val) < float(target)
            elif condition == "boolean":
                return bool(val)
            elif condition == "in":
                return val in target
            elif condition == "not_in":
                return val not in target
            elif condition == "between":
                low, high = target
                return low <= float(val) <= high
            else:
                return False
        except (ValueError, TypeError):
            return False

    def _categorize(self, score: float, categories: List[Dict[str, Any]]) -> str:
        """Assign a category based on score."""
        for cat in categories:
            min_val = cat.get("min", float("-inf"))
            max_val = cat.get("max", float("inf"))
            if min_val <= score <= max_val:
                return cat.get("label", "Unknown")
        return "Unknown"

    def _get_interpretation(self, outputs: Dict[str, Any]) -> Optional[str]:
        """Get interpretation text for the result."""
        interpretations = self.definition.get("interpretations", {})

        # Try category-based interpretation
        category = outputs.get("category")
        if category and category in interpretations:
            return interpretations[category]

        # Try score-based interpretation
        score = outputs.get("score") or outputs.get("value")
        if score is not None:
            score_str = str(int(score)) if isinstance(score, (int, float)) else str(score)
            if score_str in interpretations:
                return interpretations[score_str]

        return None

    def validate(self) -> List[Dict[str, Any]]:
        """Run all test cases and return results."""
        results: List[Dict[str, Any]] = []

        for i, test in enumerate(self.rule_spec.test_cases):
            try:
                actual = self.calculate(test.inputs)
                expected = test.expected_output

                # Check if all expected outputs match
                passed = all(
                    actual.outputs.get(k) == v
                    for k, v in expected.items()
                )

                results.append({
                    "test": i,
                    "passed": passed,
                    "description": test.description,
                    "expected": expected,
                    "actual": actual.outputs,
                })
            except Exception as e:
                results.append({
                    "test": i,
                    "passed": False,
                    "description": test.description,
                    "error": str(e),
                })

        return results


# Pre-built calculator factories for common systems
def create_cha2ds2vasc_calculator() -> Tuple[RuleSpec, RuleCalculator]:
    """Create a CHA2DS2-VASc calculator."""
    from .models import RuleTestCase

    spec = RuleSpec(
        system_card_id="",
        name="CHA2DS2-VASc Calculator",
        rule_type=RuleType.THRESHOLD,
        rule_definition={
            "criteria": [
                {"variable": "chf", "condition": "boolean", "points": 1, "name": "CHF/LV dysfunction"},
                {"variable": "hypertension", "condition": "boolean", "points": 1, "name": "Hypertension"},
                {"variable": "age", "condition": "gte", "threshold": 75, "points": 2, "name": "Age ≥75"},
                {"variable": "age", "condition": "gte", "threshold": 65, "points": 1, "name": "Age 65-74",
                 "excludeIf": {"variable": "age", "condition": "gte", "threshold": 75}},
                {"variable": "diabetes", "condition": "boolean", "points": 1, "name": "Diabetes"},
                {"variable": "stroke_tia", "condition": "boolean", "points": 2, "name": "Stroke/TIA/TE"},
                {"variable": "vascular_disease", "condition": "boolean", "points": 1, "name": "Vascular disease"},
                {"variable": "sex", "condition": "equals", "value": "female", "points": 1, "name": "Female"},
            ],
            "categories": [
                {"min": 0, "max": 0, "label": "Low"},
                {"min": 1, "max": 1, "label": "Moderate"},
                {"min": 2, "max": 9, "label": "High"},
            ],
            "interpretations": {
                "Low": "Low risk (~0.2%/year) - anticoagulation not recommended for men",
                "Moderate": "Moderate risk (~1.3%/year) - consider anticoagulation",
                "High": "High risk (≥2.2%/year) - anticoagulation recommended",
            },
        },
        test_cases=[
            RuleTestCase(
                inputs={"chf": False, "hypertension": False, "age": 50, "diabetes": False,
                        "stroke_tia": False, "vascular_disease": False, "sex": "male"},
                expected_output={"score": 0, "category": "Low"},
                description="Healthy 50yo male",
            ),
            RuleTestCase(
                inputs={"chf": True, "hypertension": True, "age": 70, "diabetes": True,
                        "stroke_tia": False, "vascular_disease": False, "sex": "female"},
                expected_output={"score": 5, "category": "High"},
                description="High-risk 70yo female",
            ),
        ],
    )
    return spec, RuleCalculator(spec)


def create_meld_calculator() -> Tuple[RuleSpec, RuleCalculator]:
    """Create a MELD score calculator."""
    from .models import RuleTestCase

    spec = RuleSpec(
        system_card_id="",
        name="MELD Score Calculator",
        rule_type=RuleType.FORMULA,
        rule_definition={
            "formula": "round(10 * (0.957 * ln(max(creatinine, 1)) + 0.378 * ln(max(bilirubin, 1)) + 1.120 * ln(max(inr, 1)) + 0.643))",
            "variables": [
                {"name": "creatinine", "required": True, "min": 1, "max": 4, "default": 1},
                {"name": "bilirubin", "required": True, "min": 1, "default": 1},
                {"name": "inr", "required": True, "min": 1, "default": 1},
            ],
            "categories": [
                {"min": 6, "max": 9, "label": "Low"},
                {"min": 10, "max": 19, "label": "Moderate"},
                {"min": 20, "max": 29, "label": "High"},
                {"min": 30, "max": 40, "label": "Very High"},
            ],
            "interpretations": {
                "Low": "3-month mortality ~2%",
                "Moderate": "3-month mortality ~6%",
                "High": "3-month mortality ~20%",
                "Very High": "3-month mortality ~50%+",
            },
        },
        test_cases=[
            RuleTestCase(
                inputs={"creatinine": 1.0, "bilirubin": 1.0, "inr": 1.0},
                expected_output={"value": 6.0, "category": "Low"},
                description="Normal labs",
            ),
        ],
    )
    return spec, RuleCalculator(spec)
