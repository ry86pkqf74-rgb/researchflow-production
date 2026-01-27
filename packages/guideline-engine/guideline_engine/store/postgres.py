"""PostgreSQL storage layer for Guideline Engine using asyncpg."""
from typing import List, Optional, Dict, Any
import uuid
import json
import asyncpg

from ..models import (
    SystemCard, SystemCardCreate, SystemCardSummary,
    RuleSpec, RuleSpecCreate,
    ValidationBlueprint, BlueprintRequest,
    SystemType, IntendedUse, RuleType, StudyIntent,
    InputVariable, OutputDefinition, InterpretationEntry,
    RuleTestCase, SourceAnchor, ConditionConcept,
    DataDictionaryEntry, OutcomeDefinition, AnalysisMethod, ValidationMetric,
)


class GuidelineStore:
    """PostgreSQL storage for guideline engine entities."""

    def __init__(self, pool: asyncpg.Pool):
        self.pool = pool

    # =========================================================================
    # SystemCard CRUD
    # =========================================================================

    async def create_system_card(self, card: SystemCardCreate) -> SystemCard:
        """Create a new SystemCard."""
        async with self.pool.acquire() as conn:
            row = await conn.fetchrow(
                """
                INSERT INTO system_cards (
                    name, type, specialty, condition_concepts, intended_use,
                    population, inputs, outputs, interpretation, limitations,
                    source_anchors, version, effective_date, non_computable_reason, status
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, 'active')
                RETURNING *
                """,
                card.name,
                card.type if isinstance(card.type, str) else card.type.value,
                card.specialty,
                json.dumps([c.model_dump() for c in card.condition_concepts]),
                card.intended_use if isinstance(card.intended_use, str) else (card.intended_use.value if card.intended_use else None),
                card.population,
                json.dumps([i.model_dump() for i in card.inputs]),
                json.dumps([o.model_dump() for o in card.outputs]),
                json.dumps([i.model_dump() for i in card.interpretation]),
                card.limitations,
                json.dumps([s.model_dump() for s in card.source_anchors]),
                card.version,
                card.effective_date,
                card.non_computable_reason,
            )
            return self._row_to_system_card(row)

    async def get_system_card(self, id: str) -> Optional[SystemCard]:
        """Get a SystemCard by ID."""
        async with self.pool.acquire() as conn:
            row = await conn.fetchrow(
                "SELECT * FROM system_cards WHERE id = $1",
                uuid.UUID(id)
            )
            return self._row_to_system_card(row) if row else None

    async def search_system_cards(
        self,
        query: Optional[str] = None,
        type: Optional[str] = None,
        specialty: Optional[str] = None,
        intended_use: Optional[str] = None,
        verified: Optional[bool] = None,
        status: str = "active",
        limit: int = 50,
        offset: int = 0,
    ) -> Dict[str, Any]:
        """Search SystemCards with filters."""
        conditions: List[str] = []
        params: List[Any] = []
        idx = 1

        if query:
            conditions.append(f"name ILIKE ${idx}")
            params.append(f"%{query}%")
            idx += 1

        if type:
            conditions.append(f"type = ${idx}")
            params.append(type)
            idx += 1

        if specialty:
            conditions.append(f"specialty ILIKE ${idx}")
            params.append(f"%{specialty}%")
            idx += 1

        if intended_use:
            conditions.append(f"intended_use = ${idx}")
            params.append(intended_use)
            idx += 1

        if verified is not None:
            conditions.append(f"verified = ${idx}")
            params.append(verified)
            idx += 1

        if status:
            conditions.append(f"status = ${idx}")
            params.append(status)
            idx += 1

        where_clause = f"WHERE {' AND '.join(conditions)}" if conditions else ""

        async with self.pool.acquire() as conn:
            count = await conn.fetchval(
                f"SELECT COUNT(*) FROM system_cards {where_clause}",
                *params
            )

            rows = await conn.fetch(
                f"""
                SELECT * FROM system_cards {where_clause}
                ORDER BY name
                LIMIT ${idx} OFFSET ${idx + 1}
                """,
                *params, limit, offset
            )

            return {
                "systems": [self._row_to_system_card(r) for r in rows],
                "total": count,
                "limit": limit,
                "offset": offset,
            }

    async def update_system_card(self, id: str, updates: Dict[str, Any]) -> Optional[SystemCard]:
        """Update a SystemCard."""
        allowed_fields = {
            "name", "type", "specialty", "condition_concepts", "intended_use",
            "population", "inputs", "outputs", "interpretation", "limitations",
            "source_anchors", "version", "effective_date", "status",
            "verified", "verified_by", "verified_at", "non_computable_reason"
        }

        set_parts = []
        params = []
        idx = 1

        for key, value in updates.items():
            if key in allowed_fields:
                set_parts.append(f"{key} = ${idx}")
                if key in ("inputs", "outputs", "interpretation", "source_anchors", "condition_concepts"):
                    params.append(json.dumps(value))
                else:
                    params.append(value)
                idx += 1

        if not set_parts:
            return await self.get_system_card(id)

        set_parts.append(f"updated_at = NOW()")

        async with self.pool.acquire() as conn:
            row = await conn.fetchrow(
                f"""
                UPDATE system_cards
                SET {', '.join(set_parts)}
                WHERE id = ${idx}
                RETURNING *
                """,
                *params, uuid.UUID(id)
            )
            return self._row_to_system_card(row) if row else None

    # =========================================================================
    # RuleSpec CRUD
    # =========================================================================

    async def create_rule_spec(self, spec: RuleSpecCreate) -> RuleSpec:
        """Create a new RuleSpec."""
        async with self.pool.acquire() as conn:
            row = await conn.fetchrow(
                """
                INSERT INTO rule_specs (system_card_id, name, description, rule_type, rule_definition, test_cases)
                VALUES ($1, $2, $3, $4, $5, $6)
                RETURNING *
                """,
                uuid.UUID(spec.system_card_id),
                spec.name,
                spec.description,
                spec.rule_type if isinstance(spec.rule_type, str) else spec.rule_type.value,
                json.dumps(spec.rule_definition),
                json.dumps([t.model_dump() for t in spec.test_cases]),
            )
            return self._row_to_rule_spec(row)

    async def get_rule_spec(self, id: str) -> Optional[RuleSpec]:
        """Get a RuleSpec by ID."""
        async with self.pool.acquire() as conn:
            row = await conn.fetchrow(
                "SELECT * FROM rule_specs WHERE id = $1",
                uuid.UUID(id)
            )
            return self._row_to_rule_spec(row) if row else None

    async def get_rule_specs_for_system(self, system_card_id: str) -> List[RuleSpec]:
        """Get all RuleSpecs for a SystemCard."""
        async with self.pool.acquire() as conn:
            rows = await conn.fetch(
                "SELECT * FROM rule_specs WHERE system_card_id = $1 ORDER BY created_at",
                uuid.UUID(system_card_id)
            )
            return [self._row_to_rule_spec(r) for r in rows]

    async def validate_rule_spec(self, id: str, validated: bool) -> Optional[RuleSpec]:
        """Update validation status of a RuleSpec."""
        async with self.pool.acquire() as conn:
            row = await conn.fetchrow(
                """
                UPDATE rule_specs
                SET validated = $1, updated_at = NOW()
                WHERE id = $2
                RETURNING *
                """,
                validated, uuid.UUID(id)
            )
            return self._row_to_rule_spec(row) if row else None

    # =========================================================================
    # ValidationBlueprint CRUD
    # =========================================================================

    async def create_blueprint(self, blueprint: ValidationBlueprint) -> ValidationBlueprint:
        """Create a new ValidationBlueprint."""
        async with self.pool.acquire() as conn:
            row = await conn.fetchrow(
                """
                INSERT INTO validation_blueprints (
                    system_card_id, user_id, study_intent, research_aims, hypotheses,
                    data_dictionary, outcomes, inclusion_criteria, exclusion_criteria,
                    analysis_plan, validation_metrics, sensitivity_analyses,
                    limitations, reporting_checklist, status
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, 'draft')
                RETURNING *
                """,
                uuid.UUID(blueprint.system_card_id),
                uuid.UUID(blueprint.user_id),
                blueprint.study_intent if isinstance(blueprint.study_intent, str) else blueprint.study_intent.value,
                json.dumps(blueprint.research_aims),
                json.dumps(blueprint.hypotheses),
                json.dumps([d.model_dump() for d in blueprint.data_dictionary]),
                json.dumps([o.model_dump() for o in blueprint.outcomes]),
                json.dumps(blueprint.inclusion_criteria),
                json.dumps(blueprint.exclusion_criteria),
                json.dumps([a.model_dump() for a in blueprint.analysis_plan]),
                json.dumps([m.model_dump() for m in blueprint.validation_metrics]),
                json.dumps(blueprint.sensitivity_analyses),
                blueprint.limitations,
                blueprint.reporting_checklist,
            )
            return self._row_to_blueprint(row)

    async def get_blueprint(self, id: str) -> Optional[ValidationBlueprint]:
        """Get a ValidationBlueprint by ID."""
        async with self.pool.acquire() as conn:
            row = await conn.fetchrow(
                "SELECT * FROM validation_blueprints WHERE id = $1",
                uuid.UUID(id)
            )
            return self._row_to_blueprint(row) if row else None

    async def get_blueprints_for_user(self, user_id: str) -> List[ValidationBlueprint]:
        """Get all ValidationBlueprints for a user."""
        async with self.pool.acquire() as conn:
            rows = await conn.fetch(
                "SELECT * FROM validation_blueprints WHERE user_id = $1 ORDER BY created_at DESC",
                uuid.UUID(user_id)
            )
            return [self._row_to_blueprint(r) for r in rows]

    async def get_blueprints_for_system(self, system_card_id: str) -> List[ValidationBlueprint]:
        """Get all ValidationBlueprints for a SystemCard."""
        async with self.pool.acquire() as conn:
            rows = await conn.fetch(
                "SELECT * FROM validation_blueprints WHERE system_card_id = $1 ORDER BY created_at DESC",
                uuid.UUID(system_card_id)
            )
            return [self._row_to_blueprint(r) for r in rows]

    async def update_blueprint(self, id: str, updates: Dict[str, Any]) -> Optional[ValidationBlueprint]:
        """Update a ValidationBlueprint."""
        allowed_fields = {
            "study_intent", "research_aims", "hypotheses", "data_dictionary",
            "outcomes", "inclusion_criteria", "exclusion_criteria",
            "analysis_plan", "validation_metrics", "sensitivity_analyses",
            "limitations", "reporting_checklist", "status"
        }

        set_parts = []
        params = []
        idx = 1

        for key, value in updates.items():
            if key in allowed_fields:
                set_parts.append(f"{key} = ${idx}")
                if key in ("research_aims", "hypotheses", "data_dictionary", "outcomes",
                           "inclusion_criteria", "exclusion_criteria", "analysis_plan",
                           "validation_metrics", "sensitivity_analyses"):
                    params.append(json.dumps(value))
                else:
                    params.append(value)
                idx += 1

        if not set_parts:
            return await self.get_blueprint(id)

        set_parts.append(f"updated_at = NOW()")

        async with self.pool.acquire() as conn:
            row = await conn.fetchrow(
                f"""
                UPDATE validation_blueprints
                SET {', '.join(set_parts)}
                WHERE id = ${idx}
                RETURNING *
                """,
                *params, uuid.UUID(id)
            )
            return self._row_to_blueprint(row) if row else None

    # =========================================================================
    # Calculator Results
    # =========================================================================

    async def save_calculation(
        self,
        system_card_id: str,
        inputs: Dict[str, Any],
        outputs: Dict[str, Any],
        interpretation: Optional[str] = None,
        rule_spec_id: Optional[str] = None,
        user_id: Optional[str] = None,
        context: str = "research",
    ) -> str:
        """Save a calculation result for audit."""
        async with self.pool.acquire() as conn:
            row = await conn.fetchrow(
                """
                INSERT INTO calculator_results (
                    system_card_id, rule_spec_id, user_id, inputs, outputs, interpretation, context
                ) VALUES ($1, $2, $3, $4, $5, $6, $7)
                RETURNING id
                """,
                uuid.UUID(system_card_id),
                uuid.UUID(rule_spec_id) if rule_spec_id else None,
                uuid.UUID(user_id) if user_id else None,
                json.dumps(inputs),
                json.dumps(outputs),
                interpretation,
                context,
            )
            return str(row["id"])

    # =========================================================================
    # Row Mappers
    # =========================================================================

    def _row_to_system_card(self, row: asyncpg.Record) -> SystemCard:
        """Convert a database row to a SystemCard."""
        inputs_data = row["inputs"] if isinstance(row["inputs"], list) else json.loads(row["inputs"] or "[]")
        outputs_data = row["outputs"] if isinstance(row["outputs"], list) else json.loads(row["outputs"] or "[]")
        interpretation_data = row["interpretation"] if isinstance(row["interpretation"], list) else json.loads(row["interpretation"] or "[]")
        source_anchors_data = row["source_anchors"] if isinstance(row["source_anchors"], list) else json.loads(row["source_anchors"] or "[]")
        condition_concepts_data = row["condition_concepts"] if isinstance(row["condition_concepts"], list) else json.loads(row["condition_concepts"] or "[]")

        return SystemCard(
            id=str(row["id"]),
            name=row["name"],
            type=SystemType(row["type"]),
            specialty=row["specialty"],
            condition_concepts=[ConditionConcept(**c) for c in condition_concepts_data],
            intended_use=IntendedUse(row["intended_use"]) if row["intended_use"] else None,
            population=row["population"],
            inputs=[InputVariable(**i) for i in inputs_data],
            outputs=[OutputDefinition(**o) for o in outputs_data],
            interpretation=[InterpretationEntry(**i) for i in interpretation_data],
            limitations=row["limitations"],
            source_anchors=[SourceAnchor(**s) for s in source_anchors_data],
            version=row["version"],
            effective_date=row["effective_date"],
            superseded_by=str(row["superseded_by"]) if row["superseded_by"] else None,
            status=row["status"],
            extraction_confidence=float(row["extraction_confidence"]) if row["extraction_confidence"] else None,
            verified=row["verified"],
            verified_by=str(row["verified_by"]) if row["verified_by"] else None,
            verified_at=row["verified_at"],
            non_computable_reason=row["non_computable_reason"],
            created_at=row["created_at"],
            updated_at=row["updated_at"],
        )

    def _row_to_rule_spec(self, row: asyncpg.Record) -> RuleSpec:
        """Convert a database row to a RuleSpec."""
        rule_def = row["rule_definition"] if isinstance(row["rule_definition"], dict) else json.loads(row["rule_definition"] or "{}")
        test_cases_data = row["test_cases"] if isinstance(row["test_cases"], list) else json.loads(row["test_cases"] or "[]")

        return RuleSpec(
            id=str(row["id"]),
            system_card_id=str(row["system_card_id"]),
            name=row["name"],
            description=row["description"],
            rule_type=RuleType(row["rule_type"]),
            rule_definition=rule_def,
            test_cases=[RuleTestCase(**t) for t in test_cases_data],
            validated=row["validated"],
            created_at=row["created_at"],
            updated_at=row["updated_at"],
        )

    def _row_to_blueprint(self, row: asyncpg.Record) -> ValidationBlueprint:
        """Convert a database row to a ValidationBlueprint."""
        return ValidationBlueprint(
            id=str(row["id"]),
            system_card_id=str(row["system_card_id"]),
            user_id=str(row["user_id"]),
            study_intent=StudyIntent(row["study_intent"]),
            research_aims=row["research_aims"] if isinstance(row["research_aims"], list) else json.loads(row["research_aims"] or "[]"),
            hypotheses=row["hypotheses"] if isinstance(row["hypotheses"], list) else json.loads(row["hypotheses"] or "[]"),
            data_dictionary=[DataDictionaryEntry(**d) for d in (row["data_dictionary"] if isinstance(row["data_dictionary"], list) else json.loads(row["data_dictionary"] or "[]"))],
            outcomes=[OutcomeDefinition(**o) for o in (row["outcomes"] if isinstance(row["outcomes"], list) else json.loads(row["outcomes"] or "[]"))],
            inclusion_criteria=row["inclusion_criteria"] if isinstance(row["inclusion_criteria"], list) else json.loads(row["inclusion_criteria"] or "[]"),
            exclusion_criteria=row["exclusion_criteria"] if isinstance(row["exclusion_criteria"], list) else json.loads(row["exclusion_criteria"] or "[]"),
            analysis_plan=[AnalysisMethod(**a) for a in (row["analysis_plan"] if isinstance(row["analysis_plan"], list) else json.loads(row["analysis_plan"] or "[]"))],
            validation_metrics=[ValidationMetric(**m) for m in (row["validation_metrics"] if isinstance(row["validation_metrics"], list) else json.loads(row["validation_metrics"] or "[]"))],
            sensitivity_analyses=row["sensitivity_analyses"] if isinstance(row["sensitivity_analyses"], list) else json.loads(row["sensitivity_analyses"] or "[]"),
            limitations=row["limitations"] or [],
            reporting_checklist=row["reporting_checklist"] or [],
            status=row["status"],
            created_at=row["created_at"],
            updated_at=row["updated_at"],
        )
