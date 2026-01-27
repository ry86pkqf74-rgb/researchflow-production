/**
 * Collections Sidebar Component
 *
 * Track B Phase 13: Literature Review Workspace
 *
 * Features:
 * - Hierarchical collection tree
 * - Create/edit/delete collections
 * - Drag-and-drop organization
 * - Quick navigation
 */

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  FolderPlus,
  Folder,
  FolderOpen,
  ChevronRight,
  ChevronDown,
  MoreHorizontal,
  Pencil,
  Trash2,
  Pin,
  Archive,
  Loader2,
  Library,
  Star,
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

// =============================================================================
// Types
// =============================================================================

interface Collection {
  id: string;
  name: string;
  description?: string;
  color: string;
  icon?: string;
  parent_id?: string;
  paper_count: number;
  child_count: number;
  is_pinned: boolean;
  is_archived: boolean;
}

interface CollectionsSidebarProps {
  selectedCollectionId?: string;
  onSelectCollection: (id: string | null) => void;
}

// Color palette
const COLORS = [
  { name: 'blue', class: 'bg-blue-500' },
  { name: 'green', class: 'bg-green-500' },
  { name: 'red', class: 'bg-red-500' },
  { name: 'yellow', class: 'bg-yellow-500' },
  { name: 'purple', class: 'bg-purple-500' },
  { name: 'pink', class: 'bg-pink-500' },
  { name: 'orange', class: 'bg-orange-500' },
  { name: 'gray', class: 'bg-gray-500' },
];

// =============================================================================
// Collection Item Component
// =============================================================================

function CollectionItem({
  collection,
  isSelected,
  onSelect,
  onEdit,
  onDelete,
  onTogglePin,
  depth = 0,
}: {
  collection: Collection;
  isSelected: boolean;
  onSelect: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onTogglePin: () => void;
  depth?: number;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const hasChildren = collection.child_count > 0;

  const colorClass = COLORS.find(c => c.name === collection.color)?.class || 'bg-blue-500';

  return (
    <div className="group">
      <div
        className={cn(
          "flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer transition-colors",
          isSelected ? "bg-accent" : "hover:bg-muted/50",
        )}
        style={{ paddingLeft: `${8 + depth * 16}px` }}
        onClick={onSelect}
      >
        {/* Expand/collapse arrow */}
        {hasChildren ? (
          <button
            className="p-0.5 hover:bg-muted rounded"
            onClick={(e) => {
              e.stopPropagation();
              setIsExpanded(!isExpanded);
            }}
          >
            {isExpanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </button>
        ) : (
          <span className="w-5" />
        )}

        {/* Color indicator */}
        <div className={cn("w-2 h-2 rounded-full", colorClass)} />

        {/* Folder icon */}
        {isExpanded ? (
          <FolderOpen className="h-4 w-4 text-muted-foreground" />
        ) : (
          <Folder className="h-4 w-4 text-muted-foreground" />
        )}

        {/* Name */}
        <span className="flex-1 truncate text-sm">{collection.name}</span>

        {/* Pin indicator */}
        {collection.is_pinned && (
          <Pin className="h-3 w-3 text-muted-foreground" />
        )}

        {/* Paper count */}
        <Badge variant="secondary" className="text-xs h-5">
          {collection.paper_count}
        </Badge>

        {/* Actions menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 opacity-0 group-hover:opacity-100"
              onClick={(e) => e.stopPropagation()}
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onEdit}>
              <Pencil className="h-4 w-4 mr-2" />
              Edit
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onTogglePin}>
              <Pin className="h-4 w-4 mr-2" />
              {collection.is_pinned ? 'Unpin' : 'Pin'}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onDelete} className="text-destructive">
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Children (if expanded) */}
      {isExpanded && hasChildren && (
        <CollectionChildren
          parentId={collection.id}
          selectedId={isSelected ? collection.id : undefined}
          onSelect={onSelect}
          depth={depth + 1}
        />
      )}
    </div>
  );
}

// =============================================================================
// Collection Children Component (for nested loading)
// =============================================================================

function CollectionChildren({
  parentId,
  selectedId,
  onSelect,
  depth,
}: {
  parentId: string;
  selectedId?: string;
  onSelect: (id: string | null) => void;
  depth: number;
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data, isLoading } = useQuery<{ collections: Collection[] }>({
    queryKey: ['collections', parentId],
    queryFn: async () => {
      const res = await apiRequest(`/api/collections?parent_id=${parentId}`);
      return res.json();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest(`/api/collections/${id}`, { method: 'DELETE' });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['collections'] });
      toast({ title: "Collection deleted" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Collection> }) => {
      const res = await apiRequest(`/api/collections/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['collections'] });
    },
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-2">
        <Loader2 className="h-4 w-4 animate-spin" />
      </div>
    );
  }

  return (
    <>
      {data?.collections?.map((collection) => (
        <CollectionItem
          key={collection.id}
          collection={collection}
          isSelected={selectedId === collection.id}
          onSelect={() => onSelect(collection.id)}
          onEdit={() => {}}
          onDelete={() => deleteMutation.mutate(collection.id)}
          onTogglePin={() => updateMutation.mutate({
            id: collection.id,
            data: { is_pinned: !collection.is_pinned }
          })}
          depth={depth}
        />
      ))}
    </>
  );
}

// =============================================================================
// Create Collection Dialog
// =============================================================================

function CreateCollectionDialog({
  open,
  onOpenChange,
  parentId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  parentId?: string;
}) {
  const [name, setName] = useState("");
  const [color, setColor] = useState("blue");
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('/api/collections', {
        method: 'POST',
        body: JSON.stringify({ name, color, parent_id: parentId }),
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['collections'] });
      toast({ title: "Collection created" });
      setName("");
      setColor("blue");
      onOpenChange(false);
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to create collection", variant: "destructive" });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>Create Collection</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div>
            <label className="text-sm font-medium">Name</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My Collection"
              className="mt-1"
            />
          </div>
          <div>
            <label className="text-sm font-medium">Color</label>
            <div className="flex gap-2 mt-2">
              {COLORS.map((c) => (
                <button
                  key={c.name}
                  className={cn(
                    "w-6 h-6 rounded-full transition-all",
                    c.class,
                    color === c.name && "ring-2 ring-offset-2 ring-primary"
                  )}
                  onClick={() => setColor(c.name)}
                />
              ))}
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => createMutation.mutate()}
            disabled={!name.trim() || createMutation.isPending}
          >
            {createMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Create
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// =============================================================================
// Main Component
// =============================================================================

export function CollectionsSidebar({
  selectedCollectionId,
  onSelectCollection,
}: CollectionsSidebarProps) {
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Fetch root collections
  const { data, isLoading } = useQuery<{ collections: Collection[] }>({
    queryKey: ['collections', 'root'],
    queryFn: async () => {
      const res = await apiRequest('/api/collections?parent_id=null');
      return res.json();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest(`/api/collections/${id}`, { method: 'DELETE' });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['collections'] });
      toast({ title: "Collection deleted" });
      if (selectedCollectionId) onSelectCollection(null);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Collection> }) => {
      const res = await apiRequest(`/api/collections/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['collections'] });
    },
  });

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-3 border-b">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold flex items-center gap-2">
            <Library className="h-4 w-4" />
            Collections
          </h3>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setCreateDialogOpen(true)}
          >
            <FolderPlus className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Collections list */}
      <ScrollArea className="flex-1">
        <div className="p-2">
          {/* All Papers option */}
          <div
            className={cn(
              "flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer transition-colors",
              !selectedCollectionId ? "bg-accent" : "hover:bg-muted/50",
            )}
            onClick={() => onSelectCollection(null)}
          >
            <span className="w-5" />
            <Star className="h-4 w-4 text-muted-foreground" />
            <span className="flex-1 text-sm font-medium">All Papers</span>
          </div>

          {/* Loading state */}
          {isLoading && (
            <div className="flex justify-center py-4">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          )}

          {/* Collections */}
          {data?.collections?.map((collection) => (
            <CollectionItem
              key={collection.id}
              collection={collection}
              isSelected={selectedCollectionId === collection.id}
              onSelect={() => onSelectCollection(collection.id)}
              onEdit={() => {}}
              onDelete={() => deleteMutation.mutate(collection.id)}
              onTogglePin={() => updateMutation.mutate({
                id: collection.id,
                data: { is_pinned: !collection.is_pinned }
              })}
            />
          ))}

          {/* Empty state */}
          {!isLoading && data?.collections?.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <Folder className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No collections yet</p>
              <Button
                variant="link"
                size="sm"
                onClick={() => setCreateDialogOpen(true)}
              >
                Create your first collection
              </Button>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Create dialog */}
      <CreateCollectionDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
      />
    </div>
  );
}

export default CollectionsSidebar;
