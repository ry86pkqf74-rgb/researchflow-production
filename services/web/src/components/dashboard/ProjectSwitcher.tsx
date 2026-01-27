/**
 * Project Switcher Component
 *
 * Dropdown component for switching between projects in the header/sidebar.
 * Shows current project, recent projects, and allows searching for projects.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { projectsApi, type Project } from '@/api';

interface ProjectSwitcherProps {
  currentProjectId?: string;
  onProjectChange: (projectId: string) => void;
  className?: string;
}

export function ProjectSwitcher({
  currentProjectId,
  onProjectChange,
  className = '',
}: ProjectSwitcherProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const currentProject = projects.find(p => p.id === currentProjectId);

  // Fetch projects
  const fetchProjects = useCallback(async () => {
    setLoading(true);
    const result = await projectsApi.list({ status: 'active', limit: 50 });
    if (result.data) {
      setProjects(result.data.projects);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearchQuery('');
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Focus input when dropdown opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  // Filter projects by search query
  const filteredProjects = searchQuery
    ? projects.filter(p =>
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.description?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : projects;

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setIsOpen(false);
      setSearchQuery('');
    }
  };

  const handleProjectSelect = (projectId: string) => {
    onProjectChange(projectId);
    setIsOpen(false);
    setSearchQuery('');
  };

  return (
    <div ref={dropdownRef} className={`relative ${className}`}>
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 hover:border-gray-300 hover:bg-gray-50 transition-colors min-w-[200px]"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
      >
        <div className="w-6 h-6 rounded bg-blue-100 flex items-center justify-center text-blue-600 text-sm font-medium">
          {currentProject?.name?.[0]?.toUpperCase() || 'P'}
        </div>
        <span className="flex-1 text-left truncate text-sm font-medium text-gray-900">
          {currentProject?.name || 'Select Project'}
        </span>
        <svg
          className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div
          className="absolute top-full left-0 mt-1 w-72 bg-white rounded-lg shadow-lg border border-gray-200 z-50"
          onKeyDown={handleKeyDown}
        >
          {/* Search Input */}
          <div className="p-2 border-b border-gray-100">
            <input
              ref={inputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search projects..."
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Projects List */}
          <div className="max-h-64 overflow-y-auto">
            {loading ? (
              <div className="p-4 text-center text-gray-500 text-sm">Loading...</div>
            ) : filteredProjects.length === 0 ? (
              <div className="p-4 text-center text-gray-500 text-sm">
                {searchQuery ? 'No projects found' : 'No projects yet'}
              </div>
            ) : (
              <ul role="listbox" className="py-1">
                {filteredProjects.map((project) => (
                  <li key={project.id}>
                    <button
                      onClick={() => handleProjectSelect(project.id)}
                      className={`w-full flex items-center gap-3 px-3 py-2 hover:bg-gray-50 transition-colors ${
                        project.id === currentProjectId ? 'bg-blue-50' : ''
                      }`}
                      role="option"
                      aria-selected={project.id === currentProjectId}
                    >
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-medium ${
                        project.id === currentProjectId
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 text-gray-600'
                      }`}>
                        {project.name[0]?.toUpperCase() || 'P'}
                      </div>
                      <div className="flex-1 text-left min-w-0">
                        <div className="text-sm font-medium text-gray-900 truncate">
                          {project.name}
                        </div>
                        {project.description && (
                          <div className="text-xs text-gray-500 truncate">
                            {project.description}
                          </div>
                        )}
                      </div>
                      {project.id === currentProjectId && (
                        <svg className="w-4 h-4 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Create New Project */}
          <div className="p-2 border-t border-gray-100">
            <button
              onClick={() => {
                setIsOpen(false);
                // Navigate to create project page or open modal
                window.location.href = '/projects/new';
              }}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Create New Project
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default ProjectSwitcher;
