import { useState, useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandSeparator,
} from "@/components/ui/command";
import { Button } from "@/components/ui/button";
import {
  Compass,
  FileText,
  FolderOpen,
  Zap,
  Settings,
  HelpCircle,
  Clock,
  Search,
  Home,
  BarChart3,
  Shield,
  Mail,
  Plus,
} from "lucide-react";
import { useLocation } from "wouter";
import { Badge } from "@/components/ui/badge";

interface CommandPaletteItem {
  id: string;
  title: string;
  description?: string;
  category: string;
  icon: React.ComponentType<{ className?: string }>;
  action: () => void;
  shortcut?: string;
  metadata?: Record<string, unknown>;
}

interface Project {
  id: string;
  name: string;
  description?: string;
}

interface Run {
  id: string;
  projectId: string;
  name: string;
  status: string;
}

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [, setLocation] = useLocation();
  const [recentItems, setRecentItems] = useState<CommandPaletteItem[]>([]);

  // Fetch projects
  const { data: projects = [] } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
    enabled: open,
  });

  // Fetch runs
  const { data: runs = [] } = useQuery<Run[]>({
    queryKey: ["/api/runs"],
    enabled: open,
  });

  // Handle keyboard shortcut
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };

    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  // Load recent items from localStorage
  useEffect(() => {
    if (open) {
      try {
        const stored = localStorage.getItem("command_palette_recent");
        if (stored) {
          // Parse stored recent items (just IDs for now)
          const recentIds = JSON.parse(stored) as string[];
          // Recent items will be reconstructed from projects/runs
          setRecentItems([]);
        }
      } catch {
        setRecentItems([]);
      }
    }
  }, [open]);

  const saveRecentItem = useCallback((itemId: string) => {
    try {
      const stored = localStorage.getItem("command_palette_recent");
      let recentIds = stored ? (JSON.parse(stored) as string[]) : [];

      // Keep this item at the top and limit to 10 recent items
      recentIds = [itemId, ...recentIds.filter((id) => id !== itemId)].slice(
        0,
        10
      );

      localStorage.setItem("command_palette_recent", JSON.stringify(recentIds));
    } catch {
      // Silently fail if localStorage is unavailable
    }
  }, []);

  const navigateTo = useCallback(
    (path: string, itemId?: string) => {
      if (itemId) {
        saveRecentItem(itemId);
      }
      setLocation(path);
      setOpen(false);
    },
    [setLocation, saveRecentItem]
  );

  // Build command items
  const navigationItems: CommandPaletteItem[] = [
    {
      id: "home",
      title: "Home",
      description: "Go to dashboard",
      category: "Navigation",
      icon: Home,
      action: () => navigateTo("/"),
    },
    {
      id: "projects",
      title: "All Projects",
      description: "View all research projects",
      category: "Navigation",
      icon: FolderOpen,
      action: () => navigateTo("/projects"),
    },
    {
      id: "governance",
      title: "Governance & Compliance",
      description: "View governance settings and audit logs",
      category: "Navigation",
      icon: Shield,
      action: () => navigateTo("/governance"),
    },
    {
      id: "analytics",
      title: "Analytics",
      description: "View system analytics",
      category: "Navigation",
      icon: BarChart3,
      action: () => navigateTo("/analytics"),
    },
    {
      id: "settings",
      title: "Settings",
      description: "Manage your settings",
      category: "Navigation",
      icon: Settings,
      action: () => navigateTo("/settings"),
    },
  ];

  const actionItems: CommandPaletteItem[] = [
    {
      id: "new-project",
      title: "New Project",
      description: "Create a new research project",
      category: "Quick Actions",
      icon: Plus,
      action: () => navigateTo("/projects?new=true"),
      shortcut: "⌘N",
    },
    {
      id: "new-run",
      title: "New Run",
      description: "Start a new research run",
      category: "Quick Actions",
      icon: Zap,
      action: () => navigateTo("/projects?new_run=true"),
      shortcut: "⌘⇧N",
    },
  ];

  const projectItems: CommandPaletteItem[] = projects.map((project) => ({
    id: `project-${project.id}`,
    title: project.name,
    description: project.description || "Project",
    category: "Projects",
    icon: FolderOpen,
    action: () => navigateTo(`/projects/${project.id}`, `project-${project.id}`),
    metadata: { projectId: project.id },
  }));

  const runItems: CommandPaletteItem[] = runs.slice(0, 5).map((run) => ({
    id: `run-${run.id}`,
    title: run.name,
    description: `Status: ${run.status}`,
    category: "Recent Runs",
    icon: Clock,
    action: () => navigateTo(`/projects/${run.projectId}?run=${run.id}`, `run-${run.id}`),
    metadata: { runId: run.id },
  }));

  const helpItems: CommandPaletteItem[] = [
    {
      id: "help",
      title: "Help & Documentation",
      description: "View documentation and guides",
      category: "Help",
      icon: HelpCircle,
      action: () => window.open("/docs", "_blank"),
    },
    {
      id: "feedback",
      title: "Send Feedback",
      description: "Share feedback or report issues",
      category: "Help",
      icon: Mail,
      action: () => window.open("mailto:feedback@researchflow.app", "_self"),
    },
  ];

  const allItems = [
    ...navigationItems,
    ...actionItems,
    ...projectItems,
    ...runItems,
    ...helpItems,
  ];

  return (
    <>
      <Button
        variant="outline"
        className="w-full justify-start text-muted-foreground"
        onClick={() => setOpen(true)}
        data-testid="button-command-palette"
      >
        <Search className="h-4 w-4 mr-2" />
        <span className="hidden md:inline-flex">Search anything...</span>
        <span className="inline-flex md:hidden">Search...</span>
        <Badge variant="secondary" className="ml-auto text-xs">
          <span className="hidden sm:inline">⌘K</span>
          <span className="inline sm:hidden">Ctrl+K</span>
        </Badge>
      </Button>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput
          placeholder="Search projects, runs, actions..."
          data-testid="command-palette-input"
        />
        <CommandList>
          <CommandEmpty data-testid="command-palette-empty">
            No results found.
          </CommandEmpty>

          <CommandGroup
            heading="Navigation"
            data-testid="command-group-navigation"
          >
            {navigationItems.map((item) => {
              const Icon = item.icon;
              return (
                <CommandItem
                  key={item.id}
                  onSelect={item.action}
                  value={item.title}
                  data-testid={`command-item-${item.id}`}
                >
                  <Icon className="mr-2 h-4 w-4" />
                  <div className="flex flex-col flex-1">
                    <span>{item.title}</span>
                    {item.description && (
                      <span className="text-xs text-muted-foreground">
                        {item.description}
                      </span>
                    )}
                  </div>
                </CommandItem>
              );
            })}
          </CommandGroup>

          <CommandSeparator />

          {projectItems.length > 0 && (
            <>
              <CommandGroup
                heading={`Projects (${projectItems.length})`}
                data-testid="command-group-projects"
              >
                {projectItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <CommandItem
                      key={item.id}
                      onSelect={item.action}
                      value={item.title}
                      data-testid={`command-item-${item.id}`}
                    >
                      <Icon className="mr-2 h-4 w-4" />
                      <div className="flex flex-col flex-1">
                        <span>{item.title}</span>
                        {item.description && (
                          <span className="text-xs text-muted-foreground">
                            {item.description}
                          </span>
                        )}
                      </div>
                    </CommandItem>
                  );
                })}
              </CommandGroup>

              <CommandSeparator />
            </>
          )}

          {runItems.length > 0 && (
            <>
              <CommandGroup
                heading="Recent Runs"
                data-testid="command-group-runs"
              >
                {runItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <CommandItem
                      key={item.id}
                      onSelect={item.action}
                      value={item.title}
                      data-testid={`command-item-${item.id}`}
                    >
                      <Icon className="mr-2 h-4 w-4" />
                      <div className="flex flex-col flex-1">
                        <span>{item.title}</span>
                        {item.description && (
                          <span className="text-xs text-muted-foreground">
                            {item.description}
                          </span>
                        )}
                      </div>
                    </CommandItem>
                  );
                })}
              </CommandGroup>

              <CommandSeparator />
            </>
          )}

          <CommandGroup
            heading="Quick Actions"
            data-testid="command-group-actions"
          >
            {actionItems.map((item) => {
              const Icon = item.icon;
              return (
                <CommandItem
                  key={item.id}
                  onSelect={item.action}
                  value={item.title}
                  data-testid={`command-item-${item.id}`}
                >
                  <Icon className="mr-2 h-4 w-4" />
                  <div className="flex flex-col flex-1">
                    <span>{item.title}</span>
                    {item.description && (
                      <span className="text-xs text-muted-foreground">
                        {item.description}
                      </span>
                    )}
                  </div>
                  {item.shortcut && (
                    <Badge variant="outline" className="text-xs ml-auto">
                      {item.shortcut}
                    </Badge>
                  )}
                </CommandItem>
              );
            })}
          </CommandGroup>

          <CommandSeparator />

          <CommandGroup heading="Help" data-testid="command-group-help">
            {helpItems.map((item) => {
              const Icon = item.icon;
              return (
                <CommandItem
                  key={item.id}
                  onSelect={item.action}
                  value={item.title}
                  data-testid={`command-item-${item.id}`}
                >
                  <Icon className="mr-2 h-4 w-4" />
                  <div className="flex flex-col flex-1">
                    <span>{item.title}</span>
                    {item.description && (
                      <span className="text-xs text-muted-foreground">
                        {item.description}
                      </span>
                    )}
                  </div>
                </CommandItem>
              );
            })}
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </>
  );
}
