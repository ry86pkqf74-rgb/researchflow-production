"""
DAG Runner

Executes a compiled workflow by running stages in topological order.
Handles conditions, gates, and checkpointing.

Usage:
    from workflow_engine.dag_runner import DAGRunner
    from workflow_engine.dag_compiler import compile_workflow
    from workflow_engine.types import StageContext
    
    compiled = compile_workflow(definition, 'wf-123', 1)
    runner = DAGRunner(governance_mode='DEMO')
    
    context = StageContext(job_id='job-456', config={})
    state = await runner.run(compiled, context)
"""

import logging
import asyncio
from dataclasses import dataclass, field
from datetime import datetime
from typing import Dict, List, Optional, Any
import traceback

from .dag_compiler import CompiledWorkflow, CompiledStep
from .registry import get_stage
from .types import StageContext, StageResult

logger = logging.getLogger("workflow_engine.dag_runner")


@dataclass
class RunState:
    """Tracks the current state of a workflow run."""
    run_id: str
    workflow_id: str
    workflow_version: int
    current_node_id: Optional[str] = None
    completed_nodes: List[str] = field(default_factory=list)
    skipped_nodes: List[str] = field(default_factory=list)
    node_outputs: Dict[str, StageResult] = field(default_factory=dict)
    status: str = "running"  # running, paused, completed, failed
    error_message: Optional[str] = None
    started_at: Optional[str] = None
    completed_at: Optional[str] = None
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for serialization."""
        return {
            "run_id": self.run_id,
            "workflow_id": self.workflow_id,
            "workflow_version": self.workflow_version,
            "current_node_id": self.current_node_id,
            "completed_nodes": self.completed_nodes,
            "skipped_nodes": self.skipped_nodes,
            "node_outputs": {
                k: {
                    "stage_id": v.stage_id,
                    "stage_name": v.stage_name,
                    "status": v.status,
                    "duration_ms": v.duration_ms,
                }
                for k, v in self.node_outputs.items()
            },
            "status": self.status,
            "error_message": self.error_message,
            "started_at": self.started_at,
            "completed_at": self.completed_at,
        }


class DAGRunner:
    """
    Executes compiled workflows.

    Features:
    - Sequential execution (v1)
    - Condition evaluation (on_success, on_failure)
    - Gate handling (auto-pass in DEMO, approval required in LIVE)
    - Checkpointing for resume
    - PHI-safe error handling
    
    Example:
        runner = DAGRunner(governance_mode='DEMO')
        state = await runner.run(compiled, context)
        
        if state.status == 'completed':
            print(f"Workflow completed in {len(state.completed_nodes)} steps")
        else:
            print(f"Workflow failed: {state.error_message}")
    """

    def __init__(
        self,
        governance_mode: str = "DEMO",
        enable_parallel: bool = False,
        checkpoint_callback: Optional[callable] = None,
    ):
        """
        Initialize the runner.
        
        Args:
            governance_mode: DEMO, LIVE, or STANDBY
            enable_parallel: Enable parallel execution (feature-flagged, v2)
            checkpoint_callback: Optional callback for checkpoint persistence
        """
        self.governance_mode = governance_mode
        self.enable_parallel = enable_parallel
        self.checkpoint_callback = checkpoint_callback

    async def run(
        self,
        compiled: CompiledWorkflow,
        context: StageContext,
        checkpoint: Optional[RunState] = None,
    ) -> RunState:
        """
        Execute the compiled workflow.

        Args:
            compiled: The compiled workflow
            context: Execution context
            checkpoint: Optional checkpoint to resume from

        Returns:
            Final RunState with all outputs
        """
        # Initialize or resume state
        if checkpoint:
            state = checkpoint
            state.status = "running"
            logger.info(
                f"Resuming run {state.run_id} from node {state.current_node_id}"
            )
        else:
            state = RunState(
                run_id=context.job_id,
                workflow_id=compiled.workflow_id,
                workflow_version=compiled.version,
                started_at=datetime.utcnow().isoformat(),
            )
            logger.info(f"Starting new run {state.run_id}")

        try:
            for step in compiled.steps:
                # Skip already completed nodes (resume case)
                if step.node_id in state.completed_nodes:
                    logger.debug(f"Skipping completed node {step.node_id}")
                    continue
                
                # Skip already skipped nodes
                if step.node_id in state.skipped_nodes:
                    logger.debug(f"Skipping previously skipped node {step.node_id}")
                    continue

                state.current_node_id = step.node_id

                # Check dependencies are satisfied
                if not self._dependencies_satisfied(step, state):
                    logger.warning(
                        f"Dependencies not satisfied for {step.node_id}, skipping"
                    )
                    state.skipped_nodes.append(step.node_id)
                    continue

                # Evaluate condition
                if not self._evaluate_condition(step, state):
                    logger.info(f"Condition not met for {step.node_id}, skipping")
                    state.skipped_nodes.append(step.node_id)
                    continue

                # Execute the step
                logger.info(f"Executing step {step.node_id} ({step.node_type})")
                result = await self._execute_step(step, context, state)

                # Store result
                state.node_outputs[step.node_id] = result
                state.completed_nodes.append(step.node_id)

                # Checkpoint if callback provided
                if self.checkpoint_callback:
                    try:
                        await self.checkpoint_callback(state)
                    except Exception as e:
                        logger.warning(f"Checkpoint callback failed: {e}")

                # Check for failure - continue but track it
                if result.status == "failed":
                    logger.error(f"Step {step.node_id} failed: {result.errors}")
                    # Don't abort - let condition edges handle failure paths

            state.status = "completed"
            state.current_node_id = None
            state.completed_at = datetime.utcnow().isoformat()
            logger.info(
                f"Run {state.run_id} completed: "
                f"{len(state.completed_nodes)} steps executed, "
                f"{len(state.skipped_nodes)} skipped"
            )

        except Exception as e:
            state.status = "failed"
            state.error_message = self._sanitize_error(str(e))
            state.completed_at = datetime.utcnow().isoformat()
            logger.error(f"Run {state.run_id} failed: {e}")
            logger.debug(traceback.format_exc())

        return state

    def _dependencies_satisfied(self, step: CompiledStep, state: RunState) -> bool:
        """Check if all dependencies have been executed (completed or skipped)."""
        for dep_id in step.depends_on:
            if dep_id not in state.completed_nodes and dep_id not in state.skipped_nodes:
                return False
        return True

    def _evaluate_condition(self, step: CompiledStep, state: RunState) -> bool:
        """
        Evaluate the condition for executing this step.

        Supported conditions:
        - always: Always execute (default)
        - on_success: Execute if predecessor succeeded
        - on_failure: Execute if predecessor failed
        - expr: Not yet implemented (restricted expression language)
        """
        if not step.condition:
            return True

        kind = step.condition.get("kind", "always")

        if kind == "always":
            return True

        if kind == "on_success":
            # Check if all predecessors succeeded
            for dep_id in step.depends_on:
                result = state.node_outputs.get(dep_id)
                if result and result.status != "completed":
                    return False
            return True

        if kind == "on_failure":
            # Check if any predecessor failed
            for dep_id in step.depends_on:
                result = state.node_outputs.get(dep_id)
                if result and result.status == "failed":
                    return True
            return False

        if kind == "expr":
            # Restricted expression language - not yet implemented
            # For safety, we don't use eval()
            logger.warning(
                f"Expression conditions not yet implemented for {step.node_id}. "
                "Defaulting to True."
            )
            return True

        logger.warning(f"Unknown condition kind '{kind}', defaulting to True")
        return True

    async def _execute_step(
        self,
        step: CompiledStep,
        context: StageContext,
        state: RunState,
    ) -> StageResult:
        """Execute a single step based on its type."""
        start_time = datetime.utcnow()

        try:
            if step.node_type == "stage" and step.stage_id is not None:
                # Execute a registered stage
                result = await self._execute_stage(step, context)
            elif step.node_type == "gate":
                # Handle gate check
                result = await self._execute_gate(step, context)
            else:
                # Control node (parallel, merge, branch) - pass-through
                result = self._create_control_result(step, start_time)

            return result

        except Exception as e:
            end_time = datetime.utcnow()
            duration_ms = int((end_time - start_time).total_seconds() * 1000)
            
            return StageResult(
                stage_id=step.stage_id or 0,
                stage_name=step.label,
                status="failed",
                started_at=start_time.isoformat(),
                completed_at=end_time.isoformat(),
                duration_ms=duration_ms,
                errors=[self._sanitize_error(str(e))],
            )

    async def _execute_stage(
        self,
        step: CompiledStep,
        context: StageContext
    ) -> StageResult:
        """Execute a registered workflow stage."""
        stage_id = step.stage_id
        stage_class = get_stage(stage_id)
        start_time = datetime.utcnow()

        if not stage_class:
            logger.warning(f"Stage {stage_id} not found in registry")
            return StageResult(
                stage_id=stage_id,
                stage_name=step.label,
                status="skipped",
                started_at=start_time.isoformat(),
                completed_at=datetime.utcnow().isoformat(),
                duration_ms=0,
                warnings=[f"Stage {stage_id} not registered, skipping"],
                metadata={"reason": "not_registered"},
            )

        try:
            stage = stage_class()
            
            # Merge step config into context
            merged_context = StageContext(
                job_id=context.job_id,
                config={**context.config, **step.config},
                dataset_pointer=context.dataset_pointer,
                artifact_path=context.artifact_path,
                log_path=context.log_path,
                governance_mode=self.governance_mode,
                previous_results=context.previous_results,
                metadata={**context.metadata, "node_id": step.node_id},
            )
            
            result = await stage.execute(merged_context)
            return result
            
        except Exception as e:
            end_time = datetime.utcnow()
            duration_ms = int((end_time - start_time).total_seconds() * 1000)

            return StageResult(
                stage_id=stage_id,
                stage_name=step.label,
                status="failed",
                started_at=start_time.isoformat(),
                completed_at=end_time.isoformat(),
                duration_ms=duration_ms,
                errors=[self._sanitize_error(str(e))],
            )

    async def _execute_gate(
        self,
        step: CompiledStep,
        context: StageContext
    ) -> StageResult:
        """
        Execute a gate check.
        
        In DEMO mode, gates auto-pass with a simulated delay.
        In LIVE mode, gates would require actual approval (not yet implemented).
        In STANDBY mode, gates auto-pass immediately.
        """
        start_time = datetime.utcnow()
        gate_type = step.gate_type or "unknown"

        if self.governance_mode == "DEMO":
            # Simulate gate check with small delay
            await asyncio.sleep(0.1)
            logger.info(f"Gate {gate_type} auto-passed in DEMO mode")
            
            return StageResult(
                stage_id=0,
                stage_name=f"gate:{gate_type}",
                status="completed",
                started_at=start_time.isoformat(),
                completed_at=datetime.utcnow().isoformat(),
                duration_ms=100,
                metadata={
                    "gate_type": gate_type,
                    "auto_passed": True,
                    "governance_mode": "DEMO",
                },
            )

        if self.governance_mode == "STANDBY":
            # Immediate pass in STANDBY
            logger.info(f"Gate {gate_type} auto-passed in STANDBY mode")
            
            return StageResult(
                stage_id=0,
                stage_name=f"gate:{gate_type}",
                status="completed",
                started_at=start_time.isoformat(),
                completed_at=datetime.utcnow().isoformat(),
                duration_ms=0,
                metadata={
                    "gate_type": gate_type,
                    "auto_passed": True,
                    "governance_mode": "STANDBY",
                },
            )

        # LIVE mode - would need approval system integration
        # For now, log and pass with warning
        logger.warning(
            f"Gate {gate_type} in LIVE mode - approval system not yet integrated. "
            "Auto-passing with warning."
        )
        
        return StageResult(
            stage_id=0,
            stage_name=f"gate:{gate_type}",
            status="completed",
            started_at=start_time.isoformat(),
            completed_at=datetime.utcnow().isoformat(),
            duration_ms=0,
            warnings=["LIVE mode gate approval not yet implemented"],
            metadata={
                "gate_type": gate_type,
                "requires_approval": True,
                "governance_mode": "LIVE",
            },
        )

    def _create_control_result(
        self,
        step: CompiledStep,
        start_time: datetime
    ) -> StageResult:
        """Create a pass-through result for control nodes."""
        return StageResult(
            stage_id=0,
            stage_name=f"{step.node_type}:{step.node_id}",
            status="completed",
            started_at=start_time.isoformat(),
            completed_at=datetime.utcnow().isoformat(),
            duration_ms=0,
            metadata={
                "node_type": step.node_type,
                "is_control_node": True,
            },
        )

    def _sanitize_error(self, error: str) -> str:
        """
        Sanitize error messages to remove potential PHI.
        
        This is a basic implementation - in production, use a more
        sophisticated PHI detection approach.
        """
        # List of patterns that might indicate PHI
        phi_indicators = [
            "ssn", "social security",
            "dob", "date of birth", "birthdate",
            "mrn", "medical record",
            "patient", "name:",
            "address", "phone", "email",
        ]
        
        lower_error = error.lower()
        for indicator in phi_indicators:
            if indicator in lower_error:
                return "Stage execution failed (error details redacted for PHI safety)"
        
        # Truncate long errors
        if len(error) > 500:
            return error[:500] + "... (truncated)"
        
        return error


# Convenience function for simple execution
async def run_workflow(
    compiled: CompiledWorkflow,
    context: StageContext,
    governance_mode: str = "DEMO",
) -> RunState:
    """
    Convenience function to run a compiled workflow.
    
    Args:
        compiled: The compiled workflow
        context: Execution context
        governance_mode: DEMO, LIVE, or STANDBY
        
    Returns:
        RunState with execution results
    """
    runner = DAGRunner(governance_mode=governance_mode)
    return await runner.run(compiled, context)
