"""
Hub Timeline Projection API Routes

FastAPI router for timeline projection computation.
Handles async projection jobs and provides quick synchronous projections.
"""

from fastapi import APIRouter, HTTPException, Query, BackgroundTasks
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime, timedelta
from enum import Enum
import uuid
import asyncio
import httpx
import os

router = APIRouter(prefix="/projections", tags=["projections"])

# Orchestrator URL for callbacks
ORCHESTRATOR_URL = os.getenv("ORCHESTRATOR_URL", "http://localhost:3001")


class ScenarioType(str, Enum):
    OPTIMISTIC = "optimistic"
    REALISTIC = "realistic"
    PESSIMISTIC = "pessimistic"


class ProjectionRequest(BaseModel):
    """Request for timeline projection."""
    run_id: str = Field(..., description="Projection run ID from orchestrator")
    project_id: str = Field(..., description="Project UUID")
    goals: List[Dict[str, Any]] = Field(default_factory=list)
    tasks: List[Dict[str, Any]] = Field(default_factory=list)
    workflow_stages: List[Dict[str, Any]] = Field(default_factory=list)
    scenario_type: ScenarioType = ScenarioType.REALISTIC
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    custom_params: Optional[Dict[str, Any]] = None


class ProjectionSummary(BaseModel):
    """Summary statistics for a projection."""
    total_tasks: int
    completed_tasks: int
    overdue_tasks: int
    at_risk_tasks: int
    total_goals: int
    goals_on_track: int
    goals_at_risk: int
    projected_completion_date: Optional[str]
    confidence_score: float


class TaskProjection(BaseModel):
    """Projected timeline for a single task."""
    task_id: str
    title: str
    status: str
    priority: int
    estimated_hours: Optional[float]
    adjusted_hours: float
    start_date: str
    projected_end_date: str
    due_date: Optional[str]
    is_overdue: bool
    will_be_overdue: bool
    dependencies: List[str] = []
    blocking_tasks: List[str] = []


class GoalProjection(BaseModel):
    """Projected timeline for a goal."""
    goal_id: str
    title: str
    status: str
    progress: int
    target_date: str
    projected_completion: Optional[str]
    is_at_risk: bool
    milestone_progress: Dict[str, Any]
    linked_task_count: int
    blocking_factors: List[str] = []


class ProjectionResult(BaseModel):
    """Full projection result."""
    run_id: str
    project_id: str
    generated_at: str
    scenario_type: ScenarioType
    summary: ProjectionSummary
    task_timeline: List[TaskProjection]
    goal_timeline: List[GoalProjection]
    workflow_timeline: List[Dict[str, Any]] = []
    recommendations: List[str] = []


# Scenario multipliers for time estimates
SCENARIO_MULTIPLIERS = {
    ScenarioType.OPTIMISTIC: 0.75,
    ScenarioType.REALISTIC: 1.0,
    ScenarioType.PESSIMISTIC: 1.5,
}


def calculate_task_timeline(
    tasks: List[Dict[str, Any]],
    scenario_type: ScenarioType,
    now: datetime,
) -> List[TaskProjection]:
    """Calculate projected timeline for tasks."""
    multiplier = SCENARIO_MULTIPLIERS[scenario_type]
    projections = []

    for task in tasks:
        estimated_hours = task.get("estimated_hours") or 4  # Default 4 hours
        adjusted_hours = estimated_hours * multiplier

        # Determine start date
        start_date_str = task.get("start_date")
        if start_date_str:
            try:
                start_date = datetime.fromisoformat(start_date_str.replace("Z", "+00:00"))
            except ValueError:
                start_date = now
        else:
            start_date = now

        # Calculate projected end date
        projected_end = start_date + timedelta(hours=adjusted_hours)

        # Check due date
        due_date_str = task.get("due_date")
        is_overdue = False
        will_be_overdue = False

        if due_date_str:
            try:
                due_date = datetime.fromisoformat(due_date_str.replace("Z", "+00:00"))
                is_overdue = due_date < now and task.get("status") not in ("done", "cancelled")
                will_be_overdue = projected_end > due_date and not is_overdue
            except ValueError:
                pass

        projections.append(TaskProjection(
            task_id=task.get("id", str(uuid.uuid4())),
            title=task.get("title", "Untitled Task"),
            status=task.get("status", "todo"),
            priority=task.get("priority", 0),
            estimated_hours=task.get("estimated_hours"),
            adjusted_hours=adjusted_hours,
            start_date=start_date.isoformat(),
            projected_end_date=projected_end.isoformat(),
            due_date=due_date_str,
            is_overdue=is_overdue,
            will_be_overdue=will_be_overdue,
            dependencies=task.get("dependencies", []),
            blocking_tasks=[],  # Would be populated from task relationships
        ))

    return projections


def calculate_goal_timeline(
    goals: List[Dict[str, Any]],
    task_projections: List[TaskProjection],
    now: datetime,
) -> List[GoalProjection]:
    """Calculate projected timeline for goals."""
    # Index tasks by ID for quick lookup
    task_map = {tp.task_id: tp for tp in task_projections}
    projections = []

    for goal in goals:
        linked_task_ids = goal.get("linked_task_ids", [])
        linked_tasks = [task_map[tid] for tid in linked_task_ids if tid in task_map]

        # Calculate milestone progress
        milestones = goal.get("milestones", [])
        completed_milestones = len([m for m in milestones if m.get("completed")])
        total_milestones = len(milestones)

        milestone_progress = {
            "completed": completed_milestones,
            "total": total_milestones,
            "percentage": round((completed_milestones / total_milestones * 100) if total_milestones > 0 else 0),
        }

        # Calculate projected completion based on linked tasks
        projected_completion = None
        if linked_tasks:
            latest_end = max(
                datetime.fromisoformat(t.projected_end_date.replace("Z", "+00:00"))
                for t in linked_tasks
            )
            projected_completion = latest_end.isoformat()

        # Check if at risk
        target_date_str = goal.get("target_date")
        is_at_risk = False
        blocking_factors = []

        if target_date_str and projected_completion:
            try:
                target_date = datetime.fromisoformat(target_date_str.replace("Z", "+00:00"))
                projected_date = datetime.fromisoformat(projected_completion.replace("Z", "+00:00"))
                is_at_risk = projected_date > target_date

                if is_at_risk:
                    days_over = (projected_date - target_date).days
                    blocking_factors.append(f"Projected {days_over} days past target")
            except ValueError:
                pass

        # Check for overdue tasks
        overdue_linked = [t for t in linked_tasks if t.is_overdue]
        if overdue_linked:
            blocking_factors.append(f"{len(overdue_linked)} linked tasks overdue")

        projections.append(GoalProjection(
            goal_id=goal.get("id", str(uuid.uuid4())),
            title=goal.get("title", "Untitled Goal"),
            status=goal.get("status", "on_track"),
            progress=goal.get("progress", 0),
            target_date=target_date_str or now.isoformat(),
            projected_completion=projected_completion,
            is_at_risk=is_at_risk,
            milestone_progress=milestone_progress,
            linked_task_count=len(linked_tasks),
            blocking_factors=blocking_factors,
        ))

    return projections


def generate_recommendations(
    task_projections: List[TaskProjection],
    goal_projections: List[GoalProjection],
) -> List[str]:
    """Generate actionable recommendations based on projections."""
    recommendations = []

    # Check for overdue tasks
    overdue = [t for t in task_projections if t.is_overdue]
    if overdue:
        recommendations.append(
            f"⚠️ {len(overdue)} task(s) are overdue. Consider reprioritizing or extending deadlines."
        )

    # Check for at-risk tasks
    at_risk = [t for t in task_projections if t.will_be_overdue]
    if at_risk:
        recommendations.append(
            f"📊 {len(at_risk)} task(s) projected to miss deadlines. Review estimates or add resources."
        )

    # Check for at-risk goals
    goals_at_risk = [g for g in goal_projections if g.is_at_risk]
    if goals_at_risk:
        recommendations.append(
            f"🎯 {len(goals_at_risk)} goal(s) at risk of missing target dates. Consider scope adjustment."
        )

    # Check for goals with no linked tasks
    unlinked_goals = [g for g in goal_projections if g.linked_task_count == 0]
    if unlinked_goals:
        recommendations.append(
            f"🔗 {len(unlinked_goals)} goal(s) have no linked tasks. Link tasks to track progress accurately."
        )

    # Check for high-priority tasks without estimates
    unestimated = [t for t in task_projections if t.priority >= 3 and t.estimated_hours is None]
    if unestimated:
        recommendations.append(
            f"⏱️ {len(unestimated)} high-priority task(s) lack time estimates. Add estimates for better planning."
        )

    # Positive feedback if everything looks good
    if not recommendations:
        recommendations.append(
            "✅ Project timeline looks healthy. All tasks and goals are on track."
        )

    return recommendations


def compute_projection(request: ProjectionRequest) -> ProjectionResult:
    """Compute full timeline projection."""
    now = datetime.utcnow()

    # Calculate task projections
    task_projections = calculate_task_timeline(
        request.tasks,
        request.scenario_type,
        now,
    )

    # Calculate goal projections
    goal_projections = calculate_goal_timeline(
        request.goals,
        task_projections,
        now,
    )

    # Calculate summary statistics
    total_tasks = len(task_projections)
    completed_tasks = len([t for t in task_projections if t.status == "done"])
    overdue_tasks = len([t for t in task_projections if t.is_overdue])
    at_risk_tasks = len([t for t in task_projections if t.will_be_overdue])

    total_goals = len(goal_projections)
    goals_on_track = len([g for g in goal_projections if not g.is_at_risk])
    goals_at_risk = len([g for g in goal_projections if g.is_at_risk])

    # Calculate overall projected completion
    projected_completion_date = None
    if task_projections:
        latest = max(
            datetime.fromisoformat(t.projected_end_date.replace("Z", "+00:00"))
            for t in task_projections
            if t.status not in ("done", "cancelled")
        ) if any(t.status not in ("done", "cancelled") for t in task_projections) else None
        if latest:
            projected_completion_date = latest.isoformat()

    # Calculate confidence score (simple heuristic)
    estimated_count = len([t for t in request.tasks if t.get("estimated_hours")])
    confidence = min(1.0, 0.5 + (estimated_count / max(len(request.tasks), 1)) * 0.5)

    summary = ProjectionSummary(
        total_tasks=total_tasks,
        completed_tasks=completed_tasks,
        overdue_tasks=overdue_tasks,
        at_risk_tasks=at_risk_tasks,
        total_goals=total_goals,
        goals_on_track=goals_on_track,
        goals_at_risk=goals_at_risk,
        projected_completion_date=projected_completion_date,
        confidence_score=round(confidence, 2),
    )

    # Generate recommendations
    recommendations = generate_recommendations(task_projections, goal_projections)

    return ProjectionResult(
        run_id=request.run_id,
        project_id=request.project_id,
        generated_at=now.isoformat(),
        scenario_type=request.scenario_type,
        summary=summary,
        task_timeline=[tp.model_dump() for tp in task_projections],
        goal_timeline=[gp.model_dump() for gp in goal_projections],
        workflow_timeline=[],  # Future: integrate with ROS workflow stages
        recommendations=recommendations,
    )


async def run_projection_async(request: ProjectionRequest):
    """Run projection computation and callback to orchestrator."""
    try:
        result = compute_projection(request)

        # Callback to orchestrator with results
        async with httpx.AsyncClient(timeout=30.0) as client:
            await client.post(
                f"{ORCHESTRATOR_URL}/api/hub/projections/{request.run_id}/output",
                json={"results": result.model_dump()},
            )
    except Exception as e:
        # Callback with error
        async with httpx.AsyncClient(timeout=30.0) as client:
            await client.post(
                f"{ORCHESTRATOR_URL}/api/hub/projections/{request.run_id}/output",
                json={"error": str(e)},
            )


@router.post("/compute", response_model=dict)
async def start_projection(
    request: ProjectionRequest,
    background_tasks: BackgroundTasks,
):
    """
    Start an async projection computation.

    The projection will run in the background and callback to the
    orchestrator with results when complete.
    """
    # Queue the projection computation
    background_tasks.add_task(run_projection_async, request)

    return {
        "status": "started",
        "run_id": request.run_id,
        "message": "Projection computation started. Results will be sent to orchestrator.",
    }


@router.post("/compute/sync", response_model=ProjectionResult)
async def compute_projection_sync(request: ProjectionRequest):
    """
    Compute projection synchronously and return results immediately.

    Use this for quick projections where immediate results are needed.
    Note: For large projects, use the async endpoint instead.
    """
    return compute_projection(request)


@router.get("/scenarios")
async def list_scenarios():
    """List available projection scenarios with their multipliers."""
    return {
        "scenarios": [
            {
                "type": ScenarioType.OPTIMISTIC,
                "multiplier": SCENARIO_MULTIPLIERS[ScenarioType.OPTIMISTIC],
                "description": "Best-case scenario with efficient task completion",
            },
            {
                "type": ScenarioType.REALISTIC,
                "multiplier": SCENARIO_MULTIPLIERS[ScenarioType.REALISTIC],
                "description": "Standard estimates based on historical patterns",
            },
            {
                "type": ScenarioType.PESSIMISTIC,
                "multiplier": SCENARIO_MULTIPLIERS[ScenarioType.PESSIMISTIC],
                "description": "Worst-case scenario accounting for delays and blockers",
            },
        ]
    }


@router.get("/health")
async def projection_health():
    """Health check for projection service."""
    return {
        "status": "healthy",
        "service": "hub-projections",
        "orchestrator_url": ORCHESTRATOR_URL,
    }
