/**
 * HubDashboard Component
 *
 * Main Planning Hub dashboard showing summary cards, pages, tasks, and goals.
 * Provides a central view for project planning activities.
 */

import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'wouter';
import {
  Plus,
  FileText,
  Database,
  CheckSquare,
  Target,
  Clock,
  Activity,
  Loader2,
  ChevronRight,
  Calendar,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { HubTaskBoard } from './HubTaskBoard';
import { HubGoalTracker } from './HubGoalTracker';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

interface HubPage {
  id: string;
  title: string;
  icon?: string;
  created_at: string;
  updated_at: string;
}

interface HubTask {
  id: string;
  title: string;
  status: string;
  due_date?: string;
  priority: number;
}

interface HubGoal {
  id: string;
  title: string;
  status: string;
  progress: number;
  target_date?: string;
}

interface DashboardStats {
  pages: number;
  databases: number;
  tasks: {
    total: number;
    completed: number;
    overdue: number;
  };
  goals: {
    total: number;
    onTrack: number;
    atRisk: number;
  };
}

interface HubDashboardProps {
  projectId?: string;
  className?: string;
}

export function HubDashboard({ projectId: propProjectId, className = '' }: HubDashboardProps) {
  const params = useParams<{ projectId?: string }>();
  const projectId = propProjectId || params.projectId;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pages, setPages] = useState<HubPage[]>([]);
  const [tasks, setTasks] = useState<HubTask[]>([]);
  const [goals, setGoals] = useState<HubGoal[]>([]);
  const [stats, setStats] = useState<DashboardStats>({
    pages: 0,
    databases: 0,
    tasks: { total: 0, completed: 0, overdue: 0 },
    goals: { total: 0, onTrack: 0, atRisk: 0 },
  });
  const [activeView, setActiveView] = useState<'overview' | 'tasks' | 'goals'>('overview');

  // Fetch data
  useEffect(() => {
    if (!projectId) {
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      setLoading(true);
      setError(null);

      try {
        const token = localStorage.getItem('jwt_token');
        const headers: HeadersInit = {
          'Content-Type': 'application/json',
        };
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }

        // Fetch pages
        const pagesRes = await fetch(`${API_BASE}/api/hub/pages?projectId=${projectId}`, { headers });
        if (pagesRes.ok) {
          const pagesData = await pagesRes.json();
          setPages(pagesData);
        }

        // Fetch tasks
        const tasksRes = await fetch(`${API_BASE}/api/hub/tasks?projectId=${projectId}`, { headers });
        if (tasksRes.ok) {
          const tasksData = await tasksRes.json();
          setTasks(tasksData);

          // Calculate task stats
          const completed = tasksData.filter((t: HubTask) => t.status === 'done').length;
          const overdue = tasksData.filter((t: HubTask) => {
            if (!t.due_date || t.status === 'done') return false;
            return new Date(t.due_date) < new Date();
          }).length;

          setStats(prev => ({
            ...prev,
            tasks: { total: tasksData.length, completed, overdue },
          }));
        }

        // Fetch goals
        const goalsRes = await fetch(`${API_BASE}/api/hub/goals?projectId=${projectId}`, { headers });
        if (goalsRes.ok) {
          const goalsData = await goalsRes.json();
          setGoals(goalsData);

          // Calculate goal stats
          const onTrack = goalsData.filter((g: HubGoal) => g.status === 'on_track').length;
          const atRisk = goalsData.filter((g: HubGoal) =>
            g.status === 'at_risk' || g.status === 'behind'
          ).length;

          setStats(prev => ({
            ...prev,
            goals: { total: goalsData.length, onTrack, atRisk },
          }));
        }

        // Update pages count
        setStats(prev => ({
          ...prev,
          pages: pages.length,
        }));

      } catch (err) {
        console.error('Failed to fetch hub data:', err);
        setError('Failed to load planning hub data');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [projectId]);

  // Create new page
  const handleCreatePage = async () => {
    if (!projectId) return;

    try {
      const token = localStorage.getItem('jwt_token');
      const res = await fetch(`${API_BASE}/api/hub/pages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token && { Authorization: `Bearer ${token}` }),
        },
        body: JSON.stringify({
          projectId,
          title: 'Untitled Page',
        }),
      });

      if (res.ok) {
        const newPage = await res.json();
        setPages(prev => [newPage, ...prev]);
        setStats(prev => ({ ...prev, pages: prev.pages + 1 }));
      }
    } catch (err) {
      console.error('Failed to create page:', err);
    }
  };

  if (!projectId) {
    return (
      <div className={`p-6 ${className}`}>
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FileText className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Project Selected</h3>
            <p className="text-muted-foreground text-center mb-4">
              Select or create a project to access the Planning Hub.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (loading) {
    return (
      <div className={`p-6 space-y-6 ${className}`}>
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <Skeleton className="h-4 w-20" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-16" />
              </CardContent>
            </Card>
          ))}
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className={`p-6 ${className}`}>
        <Card className="border-destructive">
          <CardContent className="flex items-center gap-2 py-6">
            <span className="text-destructive">{error}</span>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className={`p-6 space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Planning Hub</h1>
          <p className="text-muted-foreground">
            Organize your research with pages, tasks, and goals
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleCreatePage}>
            <Plus className="w-4 h-4 mr-2" /> New Page
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Pages</CardTitle>
            <FileText className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.pages}</div>
            <p className="text-xs text-muted-foreground">documentation pages</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Tasks</CardTitle>
            <CheckSquare className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats.tasks.completed}/{stats.tasks.total}
            </div>
            <p className="text-xs text-muted-foreground">
              {stats.tasks.overdue > 0 && (
                <span className="text-destructive">{stats.tasks.overdue} overdue</span>
              )}
              {stats.tasks.overdue === 0 && 'completed'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Goals</CardTitle>
            <Target className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.goals.total}</div>
            <p className="text-xs text-muted-foreground">
              {stats.goals.atRisk > 0 ? (
                <span className="text-yellow-600">{stats.goals.atRisk} at risk</span>
              ) : (
                `${stats.goals.onTrack} on track`
              )}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Timeline</CardTitle>
            <Clock className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <Link href={`/project/${projectId}/timeline`}>
              <Button variant="ghost" className="p-0 h-auto text-sm">
                View Projections <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>

      {/* View Tabs */}
      <div className="flex gap-2 border-b pb-2">
        <Button
          variant={activeView === 'overview' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => setActiveView('overview')}
        >
          <Activity className="w-4 h-4 mr-2" /> Overview
        </Button>
        <Button
          variant={activeView === 'tasks' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => setActiveView('tasks')}
        >
          <CheckSquare className="w-4 h-4 mr-2" /> Tasks
        </Button>
        <Button
          variant={activeView === 'goals' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => setActiveView('goals')}
        >
          <Target className="w-4 h-4 mr-2" /> Goals
        </Button>
      </div>

      {/* Content based on active view */}
      {activeView === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recent Pages */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Recent Pages</CardTitle>
              <CardDescription>Your documentation pages</CardDescription>
            </CardHeader>
            <CardContent>
              {pages.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p>No pages yet</p>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleCreatePage}
                    className="mt-2"
                  >
                    Create your first page
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  {pages.slice(0, 5).map(page => (
                    <Link key={page.id} href={`/hub/page/${page.id}`}>
                      <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-accent cursor-pointer">
                        <span className="text-lg">{page.icon || '📄'}</span>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{page.title}</p>
                          <p className="text-xs text-muted-foreground">
                            Updated {new Date(page.updated_at).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Upcoming Tasks */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Upcoming Tasks</CardTitle>
              <CardDescription>Tasks due soon</CardDescription>
            </CardHeader>
            <CardContent>
              {tasks.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <CheckSquare className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p>No tasks yet</p>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setActiveView('tasks')}
                    className="mt-2"
                  >
                    Create your first task
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  {tasks
                    .filter(t => t.status !== 'done')
                    .slice(0, 5)
                    .map(task => (
                      <div
                        key={task.id}
                        className="flex items-center gap-3 p-2 rounded-lg hover:bg-accent"
                      >
                        <div
                          className={`w-3 h-3 rounded-full ${
                            task.priority >= 4
                              ? 'bg-red-500'
                              : task.priority >= 2
                              ? 'bg-yellow-500'
                              : 'bg-gray-300'
                          }`}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{task.title}</p>
                          {task.due_date && (
                            <p className="text-xs text-muted-foreground flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              {new Date(task.due_date).toLocaleDateString()}
                            </p>
                          )}
                        </div>
                        <Badge variant="secondary" className="text-xs">
                          {task.status.replace('_', ' ')}
                        </Badge>
                      </div>
                    ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Goals Progress */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-base">Goals Progress</CardTitle>
              <CardDescription>Track your project goals</CardDescription>
            </CardHeader>
            <CardContent>
              {goals.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Target className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p>No goals yet</p>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setActiveView('goals')}
                    className="mt-2"
                  >
                    Set your first goal
                  </Button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {goals.slice(0, 4).map(goal => (
                    <div
                      key={goal.id}
                      className="p-3 border rounded-lg"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <p className="font-medium truncate">{goal.title}</p>
                        <Badge
                          variant={
                            goal.status === 'on_track'
                              ? 'default'
                              : goal.status === 'at_risk'
                              ? 'secondary'
                              : 'destructive'
                          }
                          className="text-xs"
                        >
                          {goal.status.replace('_', ' ')}
                        </Badge>
                      </div>
                      <div className="h-2 bg-secondary rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary transition-all"
                          style={{ width: `${goal.progress}%` }}
                        />
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {goal.progress}% complete
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {activeView === 'tasks' && (
        <HubTaskBoard projectId={projectId} />
      )}

      {activeView === 'goals' && (
        <HubGoalTracker projectId={projectId} />
      )}
    </div>
  );
}

export default HubDashboard;
