/**
 * Projects Dashboard with Active Runs (Phase 4C - RUN-009)
 *
 * Enhanced projects dashboard showing:
 * - List of projects with active run counts
 * - Recent artifacts from projects
 * - Quick access to create new runs
 * - Run status indicators
 *
 * Features:
 * - Real-time active run count
 * - Recent artifact preview
 * - New Run button per project
 * - Project filtering and search
 */

import React, { useState } from 'react';
import { Link, useLocation } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { NewRunWizard } from '@/components/runs/NewRunWizard';
import { cn } from '@/lib/utils';
import {
  Plus,
  Search,
  FolderOpen,
  Play,
  Loader2,
  AlertCircle,
  FileText,
  Zap,
} from 'lucide-react';
import type { Project } from '@/types/project';

interface ProjectWithRuns extends Project {
  activeRuns: number;
  recentArtifacts: Array<{
    name: string;
    createdAt: string;
    stageId: number;
  }>;
}

interface ProjectRunsPageProps {}

export default function ProjectsRunsPage() {
  const [, navigate] = useLocation();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [showNewRunDialog, setShowNewRunDialog] = useState(false);

  // Fetch projects with active runs
  const { data: projects, isLoading } = useQuery<ProjectWithRuns[]>({
    queryKey: ['projects-with-runs'],
    queryFn: async () => {
      const response = await fetch('/api/projects?includeRuns=true', {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch projects');
      return response.json();
    },
  });

  // Filter projects by search query
  const filteredProjects = React.useMemo(() => {
    if (!projects) return [];
    return projects.filter((p) =>
      p.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [projects, searchQuery]);

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto p-6">
        <div className="flex items-center justify-center h-96">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">Projects</h1>
              <p className="text-gray-600 mt-1">
                Manage your research projects and runs
              </p>
            </div>
            <Dialog open={showNewRunDialog} onOpenChange={setShowNewRunDialog}>
              <DialogTrigger asChild>
                <Button className="flex items-center gap-2">
                  <Plus className="h-4 w-4" />
                  New Run
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-4xl">
                <DialogHeader>
                  <DialogTitle>Create New Run</DialogTitle>
                  <DialogDescription>
                    Follow the steps to configure and start a new research run
                  </DialogDescription>
                </DialogHeader>
                <NewRunWizard
                  projects={projects || []}
                  workflows={{}}
                  onComplete={(config) => {
                    console.log('Run created:', config);
                    setShowNewRunDialog(false);
                  }}
                  onCancel={() => setShowNewRunDialog(false)}
                />
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto p-6">
        {/* Search Bar */}
        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search projects..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        {/* Projects Grid */}
        {filteredProjects.length === 0 ? (
          <div className="text-center py-12">
            <FolderOpen className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">
              {projects && projects.length === 0
                ? 'No projects yet. Create one to get started.'
                : 'No projects match your search'}
            </p>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {filteredProjects.map((project) => (
              <Card
                key={project.id}
                className="hover:shadow-lg transition-shadow cursor-pointer overflow-hidden"
                onClick={() => navigate(`/projects/${project.id}`)}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-lg">{project.name}</CardTitle>
                      {project.description && (
                        <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                          {project.description}
                        </p>
                      )}
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="space-y-4">
                  {/* Active Runs Badge */}
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={
                        project.activeRuns > 0 ? 'default' : 'secondary'
                      }
                      className={cn(
                        'flex items-center gap-1',
                        project.activeRuns > 0 &&
                        'bg-blue-100 text-blue-700 border-blue-300'
                      )}
                    >
                      <Zap className="h-3 w-3" />
                      {project.activeRuns} active run
                      {project.activeRuns !== 1 ? 's' : ''}
                    </Badge>

                    {project.status && (
                      <Badge variant="outline" className="text-xs">
                        {project.status.charAt(0).toUpperCase() +
                          project.status.slice(1)}
                      </Badge>
                    )}
                  </div>

                  {/* Recent Artifacts */}
                  {project.recentArtifacts &&
                    project.recentArtifacts.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-gray-600 mb-2">
                          Recent Artifacts
                        </p>
                        <div className="space-y-1">
                          {project.recentArtifacts.slice(0, 3).map((artifact, idx) => (
                            <div
                              key={idx}
                              className="flex items-center gap-2 text-xs text-gray-600 px-2 py-1 bg-gray-50 rounded"
                            >
                              <FileText className="h-3 w-3" />
                              <span className="truncate flex-1">
                                {artifact.name}
                              </span>
                              <span className="text-gray-500">
                                (Stage {artifact.stageId})
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                  {/* Actions */}
                  <div className="flex gap-2 pt-2 border-t">
                    <Link href={`/projects/${project.id}`}>
                      <a className="flex-1">
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full"
                          onClick={(e) => e.stopPropagation()}
                        >
                          View Project
                        </Button>
                      </a>
                    </Link>

                    <Dialog>
                      <DialogTrigger asChild>
                        <Button
                          size="sm"
                          className="flex items-center gap-1"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedProject(project);
                          }}
                        >
                          <Play className="h-3.5 w-3.5" />
                          New Run
                        </Button>
                      </DialogTrigger>
                      {selectedProject?.id === project.id && (
                        <DialogContent className="max-w-4xl">
                          <DialogHeader>
                            <DialogTitle>Create New Run</DialogTitle>
                            <DialogDescription>
                              Configure a new run for {project.name}
                            </DialogDescription>
                          </DialogHeader>
                          <NewRunWizard
                            projects={projects || []}
                            workflows={{}}
                            onComplete={(config) => {
                              console.log('Run created:', config);
                              setSelectedProject(null);
                            }}
                            onCancel={() => setSelectedProject(null)}
                          />
                        </DialogContent>
                      )}
                    </Dialog>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
