/**
 * HubGoalTracker Component
 *
 * Displays goals with milestones and progress tracking.
 * Integrates with timeline projections.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Target,
  Plus,
  ChevronDown,
  ChevronRight,
  CheckCircle,
  Circle,
  AlertTriangle,
  Calendar,
  BarChart2,
  Loader2,
  Edit2,
  Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';

type GoalStatus = 'on_track' | 'at_risk' | 'behind' | 'completed' | 'cancelled';

interface Milestone {
  id: string;
  title: string;
  targetDate: string;
  completed: boolean;
  completedAt?: string;
}

interface HubGoal {
  id: string;
  project_id: string;
  title: string;
  description?: string;
  target_date: string;
  status: GoalStatus;
  progress: number;
  milestones: Milestone[];
  linked_task_ids: string[];
  created_at: string;
  updated_at: string;
}

interface HubGoalTrackerProps {
  projectId: string;
  onGoalSelect?: (goal: HubGoal) => void;
  className?: string;
}

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const STATUS_CONFIG: Record<GoalStatus, { label: string; color: string; icon: React.ReactNode }> = {
  on_track: { label: 'On Track', color: 'bg-green-100 text-green-700', icon: <CheckCircle className="h-4 w-4" /> },
  at_risk: { label: 'At Risk', color: 'bg-yellow-100 text-yellow-700', icon: <AlertTriangle className="h-4 w-4" /> },
  behind: { label: 'Behind', color: 'bg-red-100 text-red-700', icon: <AlertTriangle className="h-4 w-4" /> },
  completed: { label: 'Completed', color: 'bg-blue-100 text-blue-700', icon: <CheckCircle className="h-4 w-4" /> },
  cancelled: { label: 'Cancelled', color: 'bg-gray-100 text-gray-700', icon: <Circle className="h-4 w-4" /> },
};

export function HubGoalTracker({ projectId, onGoalSelect, className = '' }: HubGoalTrackerProps) {
  const [goals, setGoals] = useState<HubGoal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedGoals, setExpandedGoals] = useState<Set<string>>(new Set());
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newGoal, setNewGoal] = useState({
    title: '',
    description: '',
    targetDate: '',
  });

  // Fetch goals
  const fetchGoals = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/api/hub/goals?projectId=${projectId}`);
      if (!response.ok) throw new Error('Failed to fetch goals');
      const data = await response.json();
      setGoals(data.goals || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchGoals();
  }, [fetchGoals]);

  // Create goal
  const handleCreateGoal = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/hub/goals`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          title: newGoal.title,
          description: newGoal.description,
          targetDate: new Date(newGoal.targetDate).toISOString(),
        }),
      });

      if (!response.ok) throw new Error('Failed to create goal');

      setShowCreateDialog(false);
      setNewGoal({ title: '', description: '', targetDate: '' });
      fetchGoals();
    } catch (err: any) {
      setError(err.message);
    }
  };

  // Update milestone
  const handleMilestoneToggle = async (goalId: string, milestoneId: string, completed: boolean) => {
    try {
      const response = await fetch(`${API_BASE}/api/hub/goals/${goalId}/milestones/${milestoneId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ completed }),
      });

      if (!response.ok) throw new Error('Failed to update milestone');
      fetchGoals();
    } catch (err: any) {
      setError(err.message);
    }
  };

  // Delete goal
  const handleDeleteGoal = async (goalId: string) => {
    if (!confirm('Are you sure you want to delete this goal?')) return;

    try {
      const response = await fetch(`${API_BASE}/api/hub/goals/${goalId}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Failed to delete goal');
      fetchGoals();
    } catch (err: any) {
      setError(err.message);
    }
  };

  // Toggle goal expansion
  const toggleGoal = (goalId: string) => {
    setExpandedGoals(prev => {
      const next = new Set(prev);
      if (next.has(goalId)) {
        next.delete(goalId);
      } else {
        next.add(goalId);
      }
      return next;
    });
  };

  // Calculate days remaining
  const getDaysRemaining = (targetDate: string) => {
    const diff = new Date(targetDate).getTime() - Date.now();
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
    return days;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Target className="h-5 w-5" />
            Goals
          </h2>
          <p className="text-sm text-muted-foreground">{goals.length} goals tracked</p>
        </div>
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              New Goal
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Goal</DialogTitle>
              <DialogDescription>Set a goal with a target date to track progress.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Title</label>
                <Input
                  placeholder="Goal title"
                  value={newGoal.title}
                  onChange={e => setNewGoal(prev => ({ ...prev, title: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Description</label>
                <Textarea
                  placeholder="Goal description (optional)"
                  value={newGoal.description}
                  onChange={e => setNewGoal(prev => ({ ...prev, description: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Target Date</label>
                <Input
                  type="date"
                  value={newGoal.targetDate}
                  onChange={e => setNewGoal(prev => ({ ...prev, targetDate: e.target.value }))}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleCreateGoal}
                disabled={!newGoal.title.trim() || !newGoal.targetDate}
              >
                Create Goal
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Error Display */}
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {error}
        </div>
      )}

      {/* Goals List */}
      <div className="space-y-3">
        {goals.map(goal => {
          const isExpanded = expandedGoals.has(goal.id);
          const daysRemaining = getDaysRemaining(goal.target_date);
          const statusConfig = STATUS_CONFIG[goal.status];
          const completedMilestones = goal.milestones?.filter(m => m.completed).length || 0;
          const totalMilestones = goal.milestones?.length || 0;

          return (
            <Card key={goal.id}>
              <Collapsible open={isExpanded} onOpenChange={() => toggleGoal(goal.id)}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <CollapsibleTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                            {isExpanded ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <ChevronRight className="h-4 w-4" />
                            )}
                          </Button>
                        </CollapsibleTrigger>
                        <CardTitle
                          className="text-base cursor-pointer hover:text-primary"
                          onClick={() => onGoalSelect?.(goal)}
                        >
                          {goal.title}
                        </CardTitle>
                      </div>
                      {goal.description && (
                        <p className="text-sm text-muted-foreground mt-1 ml-8">
                          {goal.description}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className={statusConfig.color}>
                        {statusConfig.icon}
                        <span className="ml-1">{statusConfig.label}</span>
                      </Badge>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 text-red-500 hover:text-red-700"
                        onClick={() => handleDeleteGoal(goal.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="ml-8 mt-3">
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="text-muted-foreground">Progress</span>
                      <span className="font-medium">{goal.progress}%</span>
                    </div>
                    <Progress value={goal.progress} className="h-2" />
                  </div>

                  {/* Meta Info */}
                  <div className="ml-8 mt-3 flex items-center gap-4 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Calendar className="h-4 w-4" />
                      {new Date(goal.target_date).toLocaleDateString()}
                      <span className={daysRemaining < 0 ? 'text-red-500' : daysRemaining < 7 ? 'text-yellow-500' : ''}>
                        ({daysRemaining < 0 ? `${Math.abs(daysRemaining)}d overdue` : `${daysRemaining}d left`})
                      </span>
                    </div>
                    {totalMilestones > 0 && (
                      <div className="flex items-center gap-1">
                        <CheckCircle className="h-4 w-4" />
                        {completedMilestones}/{totalMilestones} milestones
                      </div>
                    )}
                    {goal.linked_task_ids?.length > 0 && (
                      <div className="flex items-center gap-1">
                        <BarChart2 className="h-4 w-4" />
                        {goal.linked_task_ids.length} linked tasks
                      </div>
                    )}
                  </div>
                </CardHeader>

                <CollapsibleContent>
                  <CardContent className="pt-0">
                    {/* Milestones */}
                    {goal.milestones?.length > 0 && (
                      <div className="ml-8 border-t pt-4">
                        <h4 className="text-sm font-medium mb-2">Milestones</h4>
                        <div className="space-y-2">
                          {goal.milestones.map(milestone => (
                            <div
                              key={milestone.id}
                              className="flex items-center gap-3 p-2 hover:bg-muted rounded-lg"
                            >
                              <button
                                onClick={() => handleMilestoneToggle(goal.id, milestone.id, !milestone.completed)}
                                className="flex-shrink-0"
                              >
                                {milestone.completed ? (
                                  <CheckCircle className="h-5 w-5 text-green-500" />
                                ) : (
                                  <Circle className="h-5 w-5 text-gray-300" />
                                )}
                              </button>
                              <div className="flex-1">
                                <span className={milestone.completed ? 'line-through text-muted-foreground' : ''}>
                                  {milestone.title}
                                </span>
                                <div className="text-xs text-muted-foreground">
                                  Target: {new Date(milestone.targetDate).toLocaleDateString()}
                                  {milestone.completedAt && (
                                    <span className="ml-2 text-green-600">
                                      ✓ Completed {new Date(milestone.completedAt).toLocaleDateString()}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </CollapsibleContent>
              </Collapsible>
            </Card>
          );
        })}

        {goals.length === 0 && (
          <Card>
            <CardContent className="py-8 text-center">
              <Target className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
              <p className="text-muted-foreground">No goals yet. Create one to start tracking progress.</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

export default HubGoalTracker;
