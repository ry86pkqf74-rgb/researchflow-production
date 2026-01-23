"""
Refinement Engine (Phase 8)

Generates refined prompts based on failed quality checks.
Python implementation that mirrors the TypeScript PromptRefinementService.

SAFETY INVARIANTS:
- No PHI in refinement prompts
- Original content not stored, only checksums
- Refinement history tracked for analytics

Last Updated: 2026-01-23
"""

from __future__ import annotations

import hashlib
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Dict, List, Literal, Optional, Tuple

from .quality_checks import QualityCheck
from .feedback_types import ModelTier, CheckCategory


# =============================================================================
# Refinement Rules
# =============================================================================

@dataclass
class RefinementRule:
    """Rule for refining prompts based on failed checks.
    
    Attributes:
        check_name: Name of the quality check this rule applies to
        category: Category of the check
        priority: Priority for ordering (higher = first)
        instruction_template: Template with {placeholders}
        combinable: Whether this rule can combine with others
        max_applications: Maximum times this rule can be applied
    """
    check_name: str
    category: CheckCategory
    priority: int
    instruction_template: str
    combinable: bool = True
    max_applications: int = 2


# Default refinement rules
DEFAULT_REFINEMENT_RULES: List[RefinementRule] = [
    # Citations
    RefinementRule(
        check_name="citations_present",
        category="citations",
        priority=90,
        instruction_template=(
            "Include at least {min_count} relevant references from the literature. "
            "Use standard citation formats like [1], [2] or (Author, Year). "
            "Ensure citations support key claims."
        ),
    ),
    
    # Coverage
    RefinementRule(
        check_name="key_points_covered",
        category="coverage",
        priority=95,
        instruction_template=(
            "Ensure you thoroughly discuss the following required topics: {missing_points}. "
            "Each topic should be addressed with sufficient detail."
        ),
    ),
    
    # Confidence
    RefinementRule(
        check_name="no_question_marks",
        category="confidence",
        priority=50,
        instruction_template=(
            "Remove uncertain language. Replace any questions with definitive statements. "
            "If information is uncertain, qualify it with phrases like 'evidence suggests' "
            "rather than asking questions."
        ),
        max_applications=1,
    ),
    
    # Length - too short
    RefinementRule(
        check_name="length_within_bounds_short",
        category="length",
        priority=70,
        instruction_template=(
            "Expand your response to approximately {target_words} words. "
            "Add more detail, examples, or supporting evidence where appropriate."
        ),
    ),
    
    # Length - too long
    RefinementRule(
        check_name="length_within_bounds_long",
        category="length",
        priority=70,
        instruction_template=(
            "Condense your response to approximately {target_words} words. "
            "Focus on the most important points and remove redundant information."
        ),
    ),
    
    # Completeness
    RefinementRule(
        check_name="no_placeholders",
        category="completeness",
        priority=100,
        instruction_template=(
            "Replace all placeholder text (such as [TODO], TBD, XXX, or bracketed instructions) "
            "with actual content. Ensure every section is fully completed."
        ),
        max_applications=1,
    ),
]


def get_rule_by_check_name(check_name: str) -> Optional[RefinementRule]:
    """Get refinement rule by check name."""
    for rule in DEFAULT_REFINEMENT_RULES:
        if rule.check_name == check_name:
            return rule
    return None


def get_applicable_rules(
    failed_checks: List[QualityCheck],
    applied_rules: Optional[List[str]] = None,
) -> List[RefinementRule]:
    """Get applicable rules for failed checks, sorted by priority.
    
    Args:
        failed_checks: List of failed quality checks
        applied_rules: List of already-applied rule names
        
    Returns:
        List of applicable rules, sorted by priority (descending)
    """
    applied_rules = applied_rules or []
    rules: List[RefinementRule] = []
    
    for check in failed_checks:
        if check.passed:
            continue
        
        rule = get_rule_by_check_name(check.name)
        
        # Handle length_within_bounds special case
        if not rule and check.name == "length_within_bounds" and check.details:
            expected = check.details.get("expected", {})
            actual = check.details.get("actual", 0)
            
            if isinstance(expected, dict):
                min_val = expected.get("min", 0)
                max_val = expected.get("max", float("inf"))
                
                if actual < min_val:
                    rule = get_rule_by_check_name("length_within_bounds_short")
                elif actual > max_val:
                    rule = get_rule_by_check_name("length_within_bounds_long")
        
        if rule:
            # Check if rule has been applied too many times
            application_count = applied_rules.count(rule.check_name)
            if application_count < rule.max_applications:
                rules.append(rule)
    
    # Sort by priority (descending)
    rules.sort(key=lambda r: r.priority, reverse=True)
    return rules


def format_instruction(rule: RefinementRule, check: QualityCheck) -> str:
    """Format instruction template with values from check details.
    
    Args:
        rule: The refinement rule
        check: The failed quality check
        
    Returns:
        Formatted instruction string
    """
    instruction = rule.instruction_template
    details = check.details or {}
    
    # Build replacements dictionary
    replacements: Dict[str, str] = {}
    
    # Handle expected value
    expected = details.get("expected")
    if isinstance(expected, dict):
        replacements["min_count"] = str(expected.get("min", "several"))
        replacements["max_count"] = str(expected.get("max", "fewer"))
        min_val = expected.get("min") or 0
        max_val = expected.get("max") or 1000
        replacements["target_words"] = str(int((min_val + max_val) / 2))
        replacements["min_words"] = str(min_val)
        replacements["max_words"] = str(max_val)
    else:
        replacements["min_count"] = str(expected or "several")
        replacements["target_words"] = str(expected or "appropriate")
    
    # Handle missing points
    missing = details.get("missing", [])
    if isinstance(missing, list):
        replacements["missing_points"] = ", ".join(missing) if missing else "the required topics"
    else:
        replacements["missing_points"] = str(missing or "the required topics")
    
    # Handle actual value
    replacements["found_count"] = str(details.get("actual", 0))
    
    # Apply replacements
    for key, value in replacements.items():
        instruction = instruction.replace(f"{{{key}}}", value)
    
    return instruction


# =============================================================================
# Refinement Context and Results
# =============================================================================

@dataclass
class RefinementContext:
    """Context for tracking refinement attempts.
    
    Attributes:
        original_prompt: The original prompt (for reference)
        task_type: Type of AI task being refined
        current_tier: Current model tier
        attempt_count: Number of attempts so far
        max_attempts: Maximum allowed attempts
        applied_rules: Rules already applied
    """
    original_prompt: str
    task_type: str = "draft_section"
    current_tier: ModelTier = "MINI"
    attempt_count: int = 0
    max_attempts: int = 3
    applied_rules: List[str] = field(default_factory=list)


@dataclass
class RefinementSummary:
    """Anonymized refinement summary for logging.
    
    CRITICAL: Contains no PHI, only hashes and counts.
    """
    prompt_hash: str
    failed_check_count: int
    failed_categories: List[str]
    rules_applied: List[str]
    attempt_number: int
    escalation_recommended: bool
    timestamp: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            "promptHash": self.prompt_hash,
            "failedCheckCount": self.failed_check_count,
            "failedCategories": self.failed_categories,
            "rulesApplied": self.rules_applied,
            "attemptNumber": self.attempt_number,
            "escalationRecommended": self.escalation_recommended,
            "timestamp": self.timestamp,
        }


@dataclass
class RefinementResult:
    """Result of prompt refinement.
    
    Attributes:
        refined: Whether refinement was applied
        prompt: Refined prompt (or original if not refined)
        instructions: Instructions added to the prompt
        applied_rules: Rules that were applied
        skip_reason: Reason if refinement was not possible
        should_escalate: Whether to escalate to higher tier
        suggested_tier: Suggested target tier for escalation
        summary: Anonymized summary for logging
    """
    refined: bool
    prompt: str
    instructions: List[str] = field(default_factory=list)
    applied_rules: List[RefinementRule] = field(default_factory=list)
    skip_reason: Optional[str] = None
    should_escalate: bool = False
    suggested_tier: Optional[ModelTier] = None
    summary: Optional[RefinementSummary] = None
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            "refined": self.refined,
            "instructions": self.instructions,
            "appliedRules": [r.check_name for r in self.applied_rules],
            "skipReason": self.skip_reason,
            "shouldEscalate": self.should_escalate,
            "suggestedTier": self.suggested_tier,
            "summary": self.summary.to_dict() if self.summary else None,
        }


# =============================================================================
# Refinement Engine
# =============================================================================

class RefinementEngine:
    """Engine for generating refined prompts based on quality check failures.
    
    Analyzes failed quality checks and generates enhanced prompts
    with additional instructions to address the failures.
    """
    
    def __init__(
        self,
        max_attempts: int = 3,
        escalation_threshold: int = 2,
    ):
        """Initialize refinement engine.
        
        Args:
            max_attempts: Maximum refinement attempts per prompt
            escalation_threshold: Attempts before recommending escalation
        """
        self.max_attempts = max_attempts
        self.escalation_threshold = escalation_threshold
    
    def refine(
        self,
        original_prompt: str,
        failed_checks: List[QualityCheck],
        context: Optional[RefinementContext] = None,
    ) -> RefinementResult:
        """Generate a refined prompt based on failed quality checks.
        
        Args:
            original_prompt: The original prompt
            failed_checks: List of failed quality checks
            context: Optional refinement context
            
        Returns:
            RefinementResult with refined prompt and metadata
        """
        # Build full context
        if context is None:
            context = RefinementContext(original_prompt=original_prompt)
        
        # Check if we've exceeded max attempts
        if context.attempt_count >= context.max_attempts:
            return self._create_skip_result(
                original_prompt,
                failed_checks,
                context,
                "Maximum refinement attempts exceeded",
            )
        
        # Get applicable rules
        applicable_rules = get_applicable_rules(
            failed_checks,
            context.applied_rules,
        )
        
        # If no rules can be applied, consider escalation
        if not applicable_rules:
            return self._create_escalation_result(
                original_prompt,
                failed_checks,
                context,
                "No applicable refinement rules remaining",
            )
        
        # Generate instructions from rules
        instructions = self._generate_instructions(applicable_rules, failed_checks)
        
        # Build refined prompt
        refined_prompt = self._build_refined_prompt(
            original_prompt,
            instructions,
            context,
        )
        
        # Determine if escalation should also be recommended
        should_escalate = (
            context.attempt_count >= self.escalation_threshold
            and context.current_tier != "FRONTIER"
        )
        
        # Create summary
        summary = self._create_summary(
            original_prompt,
            failed_checks,
            applicable_rules,
            context,
            should_escalate,
        )
        
        return RefinementResult(
            refined=True,
            prompt=refined_prompt,
            instructions=instructions,
            applied_rules=applicable_rules,
            should_escalate=should_escalate,
            suggested_tier=self._get_next_tier(context.current_tier) if should_escalate else None,
            summary=summary,
        )
    
    def _generate_instructions(
        self,
        rules: List[RefinementRule],
        failed_checks: List[QualityCheck],
    ) -> List[str]:
        """Generate refinement instructions from rules and checks."""
        instructions: List[str] = []
        
        for rule in rules:
            # Find corresponding failed check
            check = None
            for c in failed_checks:
                if c.name == rule.check_name or (
                    c.name == "length_within_bounds" 
                    and rule.check_name.startswith("length_within_bounds")
                ):
                    check = c
                    break
            
            if check:
                instruction = format_instruction(rule, check)
                instructions.append(instruction)
        
        return instructions
    
    def _build_refined_prompt(
        self,
        original_prompt: str,
        instructions: List[str],
        context: RefinementContext,
    ) -> str:
        """Build the refined prompt with instructions."""
        if not instructions:
            return original_prompt
        
        # Format instructions as a refinement block
        refinement_lines = [
            "",
            "---",
            f"REFINEMENT INSTRUCTIONS (Attempt {context.attempt_count + 1}/{context.max_attempts}):",
            "Please address the following issues in your response:",
            "",
        ]
        
        for i, inst in enumerate(instructions, 1):
            refinement_lines.append(f"{i}. {inst}")
        
        refinement_lines.extend(["", "---", ""])
        
        return original_prompt + "\n".join(refinement_lines)
    
    def _create_skip_result(
        self,
        original_prompt: str,
        failed_checks: List[QualityCheck],
        context: RefinementContext,
        reason: str,
    ) -> RefinementResult:
        """Create result when refinement is skipped."""
        should_escalate = context.current_tier != "FRONTIER"
        
        return RefinementResult(
            refined=False,
            prompt=original_prompt,
            skip_reason=reason,
            should_escalate=should_escalate,
            suggested_tier=self._get_next_tier(context.current_tier) if should_escalate else None,
            summary=self._create_summary(
                original_prompt, failed_checks, [], context, should_escalate
            ),
        )
    
    def _create_escalation_result(
        self,
        original_prompt: str,
        failed_checks: List[QualityCheck],
        context: RefinementContext,
        reason: str,
    ) -> RefinementResult:
        """Create result when escalation is recommended."""
        should_escalate = context.current_tier != "FRONTIER"
        
        return RefinementResult(
            refined=False,
            prompt=original_prompt,
            skip_reason=reason,
            should_escalate=should_escalate,
            suggested_tier=self._get_next_tier(context.current_tier) if should_escalate else None,
            summary=self._create_summary(
                original_prompt, failed_checks, [], context, should_escalate
            ),
        )
    
    def _create_summary(
        self,
        original_prompt: str,
        failed_checks: List[QualityCheck],
        applied_rules: List[RefinementRule],
        context: RefinementContext,
        escalation_recommended: bool,
    ) -> RefinementSummary:
        """Create anonymized summary for logging."""
        # Hash the prompt (no PHI stored)
        prompt_hash = hashlib.sha256(original_prompt.encode()).hexdigest()[:16]
        
        # Extract unique categories
        failed_categories = list(set(
            c.category for c in failed_checks
            if not c.passed and c.category
        ))
        
        return RefinementSummary(
            prompt_hash=prompt_hash,
            failed_check_count=sum(1 for c in failed_checks if not c.passed),
            failed_categories=failed_categories,
            rules_applied=[r.check_name for r in applied_rules],
            attempt_number=context.attempt_count + 1,
            escalation_recommended=escalation_recommended,
        )
    
    def _get_next_tier(self, current_tier: ModelTier) -> ModelTier:
        """Get the next tier for escalation."""
        tier_order: List[ModelTier] = ["NANO", "MINI", "FRONTIER"]
        try:
            current_index = tier_order.index(current_tier)
            return tier_order[min(current_index + 1, len(tier_order) - 1)]
        except ValueError:
            return "FRONTIER"
    
    def can_refine(
        self,
        failed_checks: List[QualityCheck],
        context: Optional[RefinementContext] = None,
    ) -> bool:
        """Check if refinement is possible for given checks."""
        attempt_count = context.attempt_count if context else 0
        max_attempts = context.max_attempts if context else self.max_attempts
        applied_rules = context.applied_rules if context else []
        
        if attempt_count >= max_attempts:
            return False
        
        applicable_rules = get_applicable_rules(failed_checks, applied_rules)
        return len(applicable_rules) > 0
    
    def get_recommendation(
        self,
        failed_checks: List[QualityCheck],
        context: Optional[RefinementContext] = None,
    ) -> Dict[str, Any]:
        """Get refinement recommendation without generating prompt."""
        attempt_count = context.attempt_count if context else 0
        current_tier = context.current_tier if context else "MINI"
        applied_rules = context.applied_rules if context else []
        
        can_refine = self.can_refine(failed_checks, context)
        applicable_rules = get_applicable_rules(failed_checks, applied_rules)
        
        should_escalate = (
            not can_refine
            or (attempt_count >= self.escalation_threshold and current_tier != "FRONTIER")
        )
        
        return {
            "can_refine": can_refine,
            "should_escalate": should_escalate,
            "suggested_tier": self._get_next_tier(current_tier) if should_escalate else None,
            "applicable_rules": [r.check_name for r in applicable_rules],
        }


# =============================================================================
# Module-level convenience functions
# =============================================================================

_default_engine: Optional[RefinementEngine] = None


def get_refinement_engine() -> RefinementEngine:
    """Get the default refinement engine instance."""
    global _default_engine
    if _default_engine is None:
        _default_engine = RefinementEngine()
    return _default_engine


def refine_prompt(
    original_prompt: str,
    failed_checks: List[QualityCheck],
    context: Optional[RefinementContext] = None,
) -> RefinementResult:
    """Convenience function for one-off refinement."""
    return get_refinement_engine().refine(original_prompt, failed_checks, context)
