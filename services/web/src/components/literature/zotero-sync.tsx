/**
 * Zotero Sync Component
 *
 * Provides UI for connecting to Zotero, importing/exporting
 * items, and managing collections.
 */

import { useState, useCallback, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Cloud,
  CloudOff,
  RefreshCw,
  Download,
  Upload,
  FolderTree,
  FileText,
  Settings,
  Loader2,
  Check,
  AlertCircle,
  ExternalLink,
  Trash2,
  Search,
  ChevronRight,
} from "lucide-react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { queryClient } from "@/lib/queryClient";
import type {
  ZoteroItem,
  ZoteroCollection,
  ZoteroSyncResult,
  ZoteroSyncProps,
} from "./types";

function CollectionTree({
  collections,
  selectedKey,
  onSelect,
}: {
  collections: ZoteroCollection[];
  selectedKey: string | null;
  onSelect: (key: string | null) => void;
}) {
  const rootCollections = collections.filter((c) => !c.parentKey);

  const getChildren = (parentKey: string) =>
    collections.filter((c) => c.parentKey === parentKey);

  const renderCollection = (collection: ZoteroCollection, depth: number = 0) => {
    const children = getChildren(collection.key);
    const isSelected = selectedKey === collection.key;

    return (
      <div key={collection.key}>
        <button
          className={`w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded-md hover:bg-muted transition-colors ${isSelected ? "bg-muted font-medium" : ""}`}
          style={{ paddingLeft: `${depth * 16 + 8}px` }}
          onClick={() => onSelect(isSelected ? null : collection.key)}
        >
          {children.length > 0 && (
            <ChevronRight className="h-3 w-3 text-muted-foreground" />
          )}
          <FolderTree className="h-4 w-4 text-muted-foreground" />
          <span className="flex-1 text-left truncate">{collection.name}</span>
          <Badge variant="secondary" className="text-xs">
            {collection.itemCount}
          </Badge>
        </button>
        {children.map((child) => renderCollection(child, depth + 1))}
      </div>
    );
  };

  return (
    <div className="space-y-0.5">
      <button
        className={`w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded-md hover:bg-muted transition-colors ${selectedKey === null ? "bg-muted font-medium" : ""}`}
        onClick={() => onSelect(null)}
      >
        <Cloud className="h-4 w-4 text-muted-foreground" />
        <span className="flex-1 text-left">All Items</span>
      </button>
      {rootCollections.map((c) => renderCollection(c))}
    </div>
  );
}

function ItemRow({
  item,
  selected,
  onSelect,
}: {
  item: ZoteroItem;
  selected: boolean;
  onSelect: (selected: boolean) => void;
}) {
  const authors =
    item.creators
      ?.filter((c) => c.creatorType === "author")
      .map((c) => c.lastName)
      .slice(0, 3)
      .join(", ") || "Unknown";

  return (
    <div className="flex items-start gap-3 p-3 border-b border-border/50 hover:bg-muted/50 transition-colors">
      <Checkbox
        checked={selected}
        onCheckedChange={onSelect}
        className="mt-1"
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <Badge variant="outline" className="text-xs capitalize">
            {item.itemType}
          </Badge>
          {item.date && (
            <span className="text-xs text-muted-foreground">{item.date}</span>
          )}
        </div>
        <h4 className="text-sm font-medium leading-tight truncate">
          {item.title}
        </h4>
        <p className="text-xs text-muted-foreground">{authors}</p>
        <div className="flex items-center gap-2 mt-1">
          {item.doi && (
            <a
              href={`https://doi.org/${item.doi}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-primary hover:underline flex items-center gap-1"
            >
              DOI <ExternalLink className="h-3 w-3" />
            </a>
          )}
          {item.tags.length > 0 && (
            <div className="flex gap-1">
              {item.tags.slice(0, 3).map((tag, i) => (
                <Badge key={i} variant="secondary" className="text-[10px] px-1 py-0">
                  {tag}
                </Badge>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function ZoteroSyncPanel({
  apiKey: initialApiKey,
  userId: initialUserId,
  onSyncComplete,
}: ZoteroSyncProps) {
  const [apiKey, setApiKey] = useState(initialApiKey || "");
  const [userId, setUserId] = useState(initialUserId || "");
  const [isConnected, setIsConnected] = useState(false);
  const [selectedCollection, setSelectedCollection] = useState<string | null>(null);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [showSettings, setShowSettings] = useState(!initialApiKey);

  // Check connection status
  const connectionQuery = useQuery({
    queryKey: ["zotero", "connection", apiKey, userId],
    queryFn: async () => {
      if (!apiKey || !userId) return { connected: false };
      const response = await apiRequest("POST", "/api/zotero/test-connection", {
        apiKey,
        userId,
      });
      return response.json();
    },
    enabled: !!apiKey && !!userId,
    retry: false,
  });

  useEffect(() => {
    if (connectionQuery.data?.connected) {
      setIsConnected(true);
    }
  }, [connectionQuery.data]);

  // Fetch collections
  const collectionsQuery = useQuery({
    queryKey: ["zotero", "collections", apiKey, userId],
    queryFn: async () => {
      const response = await apiRequest("POST", "/api/zotero/collections", {
        apiKey,
        userId,
      });
      return response.json();
    },
    enabled: isConnected,
  });

  // Fetch items
  const itemsQuery = useQuery({
    queryKey: ["zotero", "items", apiKey, userId, selectedCollection],
    queryFn: async () => {
      const response = await apiRequest("POST", "/api/zotero/items", {
        apiKey,
        userId,
        collectionKey: selectedCollection,
      });
      return response.json();
    },
    enabled: isConnected,
  });

  // Import mutation
  const importMutation = useMutation({
    mutationFn: async (data: { apiKey: string; userId: string; collectionKey?: string }) => {
      const response = await apiRequest("POST", "/api/zotero/import", data);
      return response.json();
    },
    onSuccess: (data) => {
      onSyncComplete?.(data);
      queryClient.invalidateQueries({ queryKey: ["zotero", "items"] });
    },
  });

  // Export mutation
  const exportMutation = useMutation({
    mutationFn: async (data: { items: ZoteroItem[]; collectionName?: string }) => {
      const response = await apiRequest("POST", "/api/zotero/export", {
        apiKey,
        userId,
        ...data,
      });
      return response.json();
    },
    onSuccess: (data) => {
      onSyncComplete?.(data);
      queryClient.invalidateQueries({ queryKey: ["zotero", "items"] });
    },
  });

  // Sync mutation
  const syncMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/zotero/sync", {
        apiKey,
        userId,
      });
      return response.json();
    },
    onSuccess: (data) => {
      onSyncComplete?.(data);
      queryClient.invalidateQueries({ queryKey: ["zotero"] });
    },
  });

  const handleConnect = useCallback(() => {
    connectionQuery.refetch();
  }, [connectionQuery]);

  const handleDisconnect = () => {
    setIsConnected(false);
    setApiKey("");
    setUserId("");
  };

  const handleSelectAll = (selected: boolean) => {
    if (selected && itemsQuery.data?.items) {
      setSelectedItems(new Set(itemsQuery.data.items.map((i: ZoteroItem) => i.key)));
    } else {
      setSelectedItems(new Set());
    }
  };

  const handleItemSelect = (key: string, selected: boolean) => {
    const newSet = new Set(selectedItems);
    if (selected) {
      newSet.add(key);
    } else {
      newSet.delete(key);
    }
    setSelectedItems(newSet);
  };

  const filteredItems = (itemsQuery.data?.items || []).filter((item: ZoteroItem) =>
    searchQuery
      ? item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.creators?.some((c) =>
          `${c.firstName} ${c.lastName}`.toLowerCase().includes(searchQuery.toLowerCase())
        )
      : true
  );

  const collections: ZoteroCollection[] = collectionsQuery.data?.collections || [];
  const syncResult = syncMutation.data as ZoteroSyncResult | undefined;

  return (
    <Card className="w-full">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          {isConnected ? (
            <Cloud className="h-5 w-5 text-green-500" />
          ) : (
            <CloudOff className="h-5 w-5 text-muted-foreground" />
          )}
          Zotero Sync
        </CardTitle>
        <div className="flex gap-2">
          {isConnected && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => syncMutation.mutate()}
                disabled={syncMutation.isPending}
              >
                {syncMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4 mr-2" />
                )}
                Sync
              </Button>
              <Dialog open={showSettings} onOpenChange={setShowSettings}>
                <DialogTrigger asChild>
                  <Button variant="ghost" size="icon">
                    <Settings className="h-4 w-4" />
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Zotero Settings</DialogTitle>
                    <DialogDescription>
                      Configure your Zotero API connection
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label>API Key</Label>
                      <Input
                        type="password"
                        value={apiKey}
                        onChange={(e) => setApiKey(e.target.value)}
                        placeholder="Enter your Zotero API key"
                      />
                      <p className="text-xs text-muted-foreground">
                        Get your API key at{" "}
                        <a
                          href="https://www.zotero.org/settings/keys"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline"
                        >
                          zotero.org/settings/keys
                        </a>
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label>User ID</Label>
                      <Input
                        value={userId}
                        onChange={(e) => setUserId(e.target.value)}
                        placeholder="Enter your Zotero user ID"
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={handleDisconnect}>
                      Disconnect
                    </Button>
                    <Button onClick={handleConnect}>
                      {connectionQuery.isLoading ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : null}
                      Test Connection
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {!isConnected ? (
          <div className="space-y-4 text-center py-8">
            <CloudOff className="h-12 w-12 mx-auto text-muted-foreground" />
            <div>
              <h3 className="font-medium">Connect to Zotero</h3>
              <p className="text-sm text-muted-foreground">
                Enter your API credentials to sync with your Zotero library
              </p>
            </div>
            <div className="max-w-sm mx-auto space-y-4">
              <div className="space-y-2">
                <Label>API Key</Label>
                <Input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="Enter your Zotero API key"
                />
              </div>
              <div className="space-y-2">
                <Label>User ID</Label>
                <Input
                  value={userId}
                  onChange={(e) => setUserId(e.target.value)}
                  placeholder="Enter your Zotero user ID"
                />
              </div>
              <Button
                onClick={handleConnect}
                disabled={!apiKey || !userId || connectionQuery.isLoading}
                className="w-full"
              >
                {connectionQuery.isLoading ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Cloud className="h-4 w-4 mr-2" />
                )}
                Connect
              </Button>
              {connectionQuery.isError && (
                <div className="flex items-center gap-2 text-sm text-destructive">
                  <AlertCircle className="h-4 w-4" />
                  Failed to connect. Check your credentials.
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Sync Status */}
            {syncResult && (
              <div className={`p-3 rounded-lg flex items-center gap-3 ${syncResult.success ? "bg-green-500/10" : "bg-destructive/10"}`}>
                {syncResult.success ? (
                  <Check className="h-5 w-5 text-green-500" />
                ) : (
                  <AlertCircle className="h-5 w-5 text-destructive" />
                )}
                <div className="flex-1">
                  <p className="text-sm font-medium">
                    {syncResult.success ? "Sync completed" : "Sync failed"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Imported: {syncResult.itemsImported} | Exported:{" "}
                    {syncResult.itemsExported} | Updated: {syncResult.itemsUpdated}
                  </p>
                </div>
              </div>
            )}

            <div className="grid grid-cols-3 gap-4">
              {/* Collections Sidebar */}
              <Card className="col-span-1 p-0">
                <div className="p-3 border-b border-border">
                  <h4 className="text-sm font-medium">Collections</h4>
                </div>
                <ScrollArea className="h-[400px]">
                  <div className="p-2">
                    {collectionsQuery.isLoading ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                      </div>
                    ) : (
                      <CollectionTree
                        collections={collections}
                        selectedKey={selectedCollection}
                        onSelect={setSelectedCollection}
                      />
                    )}
                  </div>
                </ScrollArea>
              </Card>

              {/* Items List */}
              <Card className="col-span-2 p-0">
                <div className="p-3 border-b border-border flex items-center gap-3">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search items..."
                      className="pl-9"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      checked={selectedItems.size === filteredItems.length && filteredItems.length > 0}
                      onCheckedChange={handleSelectAll}
                    />
                    <span className="text-xs text-muted-foreground">
                      {selectedItems.size} selected
                    </span>
                  </div>
                </div>
                <ScrollArea className="h-[400px]">
                  {itemsQuery.isLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : filteredItems.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                      <FileText className="h-8 w-8 mb-2" />
                      <p className="text-sm">No items found</p>
                    </div>
                  ) : (
                    filteredItems.map((item: ZoteroItem) => (
                      <ItemRow
                        key={item.key}
                        item={item}
                        selected={selectedItems.has(item.key)}
                        onSelect={(selected) => handleItemSelect(item.key, selected)}
                      />
                    ))
                  )}
                </ScrollArea>
                <div className="p-3 border-t border-border flex justify-between">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      importMutation.mutate({
                        apiKey,
                        userId,
                        collectionKey: selectedCollection || undefined,
                      })
                    }
                    disabled={importMutation.isPending}
                  >
                    {importMutation.isPending ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Download className="h-4 w-4 mr-2" />
                    )}
                    Import Selected
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const itemsToExport = filteredItems.filter((i: ZoteroItem) =>
                        selectedItems.has(i.key)
                      );
                      exportMutation.mutate({ items: itemsToExport });
                    }}
                    disabled={exportMutation.isPending || selectedItems.size === 0}
                  >
                    {exportMutation.isPending ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Upload className="h-4 w-4 mr-2" />
                    )}
                    Export to Zotero
                  </Button>
                </div>
              </Card>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default ZoteroSyncPanel;
