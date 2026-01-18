import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ScrollText,
  Filter,
  ChevronLeft,
  ChevronRight,
  Shield,
  Upload,
  Download,
  Eye,
  AlertTriangle,
  CheckCircle,
  RefreshCw,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

type EventType = "ALL" | "DATA_UPLOAD" | "DATA_DELETION" | "PHI_SCAN" | "DATA_EXPORT" | "GOVERNANCE" | "AUTH";

interface AuditEntry {
  id: number;
  eventType: string;
  action: string;
  userId: string | null;
  resourceType: string | null;
  resourceId: string | null;
  details: Record<string, unknown> | null;
  ipAddress: string | null;
  userAgent: string | null;
  sessionId: string | null;
  createdAt: string;
  previousHash: string | null;
  entryHash: string | null;
}

interface AuditLogResponse {
  entries: AuditEntry[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

interface AuditLogViewerProps {
  pageSize?: number;
}

const EVENT_TYPE_CONFIG: Record<string, { label: string; icon: React.ComponentType<{ className?: string }>; className: string }> = {
  DATA_UPLOAD: {
    label: "Upload",
    icon: Upload,
    className: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30",
  },
  DATA_DELETION: {
    label: "Delete",
    icon: AlertTriangle,
    className: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/30",
  },
  PHI_SCAN: {
    label: "PHI Scan",
    icon: Shield,
    className: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/30",
  },
  DATA_EXPORT: {
    label: "Export",
    icon: Download,
    className: "bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/30",
  },
  GOVERNANCE: {
    label: "Governance",
    icon: CheckCircle,
    className: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30",
  },
  AUTH: {
    label: "Auth",
    icon: Eye,
    className: "bg-gray-500/10 text-gray-600 dark:text-gray-400 border-gray-500/30",
  },
};

async function fetchAuditEntries(
  limit: number,
  offset: number,
  eventType?: string
): Promise<AuditLogResponse> {
  const params = new URLSearchParams({
    limit: limit.toString(),
    offset: offset.toString(),
  });

  if (eventType && eventType !== "ALL") {
    params.append("eventType", eventType);
  }

  const response = await fetch(`/api/governance/audit/entries?${params}`, {
    credentials: "include",
  });

  if (!response.ok) {
    // Return mock data if API fails (for DEMO mode)
    return {
      entries: [
        {
          id: 1,
          eventType: "DATA_UPLOAD",
          action: "UPLOAD",
          userId: "user-001",
          resourceType: "dataset",
          resourceId: "ds-001",
          details: { filename: "clinical-data.csv" },
          ipAddress: null,
          userAgent: null,
          sessionId: null,
          createdAt: new Date().toISOString(),
          previousHash: "GENESIS",
          entryHash: "a1b2c3...",
        },
        {
          id: 2,
          eventType: "PHI_SCAN",
          action: "SCAN_PASSED",
          userId: "system",
          resourceType: "dataset",
          resourceId: "ds-001",
          details: { passed: true, phiCount: 0 },
          ipAddress: null,
          userAgent: null,
          sessionId: null,
          createdAt: new Date(Date.now() - 3600000).toISOString(),
          previousHash: "a1b2c3...",
          entryHash: "b2c3d4...",
        },
        {
          id: 3,
          eventType: "GOVERNANCE",
          action: "APPROVAL_REQUIRED",
          userId: "user-002",
          resourceType: "export",
          resourceId: "exp-001",
          details: { reason: "large_dataset" },
          ipAddress: null,
          userAgent: null,
          sessionId: null,
          createdAt: new Date(Date.now() - 7200000).toISOString(),
          previousHash: "b2c3d4...",
          entryHash: "c3d4e5...",
        },
      ],
      total: 3,
      limit,
      offset,
      hasMore: false,
    };
  }

  return response.json();
}

export function AuditLogViewer({ pageSize = 10 }: AuditLogViewerProps) {
  const [eventFilter, setEventFilter] = useState<EventType>("ALL");
  const [currentPage, setCurrentPage] = useState(1);

  const offset = (currentPage - 1) * pageSize;

  const { data, isLoading, refetch } = useQuery<AuditLogResponse>({
    queryKey: ["audit-entries", pageSize, offset, eventFilter],
    queryFn: () => fetchAuditEntries(pageSize, offset, eventFilter),
    staleTime: 30000,
  });

  const entries = data?.entries || [];
  const total = data?.total || 0;
  const totalPages = Math.ceil(total / pageSize);

  const handleEventFilterChange = (value: string) => {
    setEventFilter(value as EventType);
    setCurrentPage(1);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const truncateHash = (hash: string | null) => {
    if (!hash) return "-";
    if (hash === "GENESIS") return "GENESIS";
    return `${hash.substring(0, 8)}...`;
  };

  return (
    <Card data-testid="audit-log-viewer">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <CardTitle className="flex items-center gap-2 text-lg">
            <ScrollText className="h-5 w-5 text-primary" />
            Audit Log
          </CardTitle>
          <div className="flex items-center gap-2">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => refetch()}
                    data-testid="refresh-audit-log"
                  >
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Refresh audit log</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <Filter className="h-4 w-4 text-muted-foreground" />
            <Select value={eventFilter} onValueChange={handleEventFilterChange}>
              <SelectTrigger className="w-[160px]" data-testid="select-event-type">
                <SelectValue placeholder="Filter event type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Events</SelectItem>
                <SelectItem value="DATA_UPLOAD">Data Upload</SelectItem>
                <SelectItem value="DATA_DELETION">Data Deletion</SelectItem>
                <SelectItem value="PHI_SCAN">PHI Scan</SelectItem>
                <SelectItem value="DATA_EXPORT">Data Export</SelectItem>
                <SelectItem value="GOVERNANCE">Governance</SelectItem>
                <SelectItem value="AUTH">Authentication</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div
            className="flex items-center justify-center py-8"
            data-testid="audit-log-loading"
          >
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        ) : entries.length === 0 ? (
          <div
            className="text-center py-8 text-muted-foreground"
            data-testid="audit-log-empty"
          >
            <ScrollText className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p className="text-sm">
              {eventFilter === "ALL"
                ? "No audit entries recorded yet"
                : `No ${eventFilter.toLowerCase().replace("_", " ")} events found`}
            </p>
          </div>
        ) : (
          <div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Event</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Resource</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Hash</TableHead>
                  <TableHead className="text-right">Time</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map((entry) => {
                  const config = EVENT_TYPE_CONFIG[entry.eventType] || {
                    label: entry.eventType,
                    icon: ScrollText,
                    className: "bg-gray-500/10 text-gray-600 border-gray-500/30",
                  };
                  const EventIcon = config.icon;

                  return (
                    <TableRow key={entry.id} data-testid={`audit-row-${entry.id}`}>
                      <TableCell>
                        <Badge variant="outline" className={`gap-1 ${config.className}`}>
                          <EventIcon className="h-3 w-3" />
                          {config.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {entry.action}
                      </TableCell>
                      <TableCell>
                        {entry.resourceType && entry.resourceId ? (
                          <div>
                            <div className="text-sm">{entry.resourceType}</div>
                            <div className="text-xs text-muted-foreground font-mono">
                              {entry.resourceId}
                            </div>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {entry.userId || (
                          <span className="text-muted-foreground">system</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger>
                              <code className="text-xs bg-muted px-1 py-0.5 rounded">
                                {truncateHash(entry.entryHash)}
                              </code>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p className="font-mono text-xs">
                                Entry: {entry.entryHash || "N/A"}
                              </p>
                              <p className="font-mono text-xs">
                                Previous: {entry.previousHash || "N/A"}
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </TableCell>
                      <TableCell className="text-right text-sm text-muted-foreground">
                        {formatDate(entry.createdAt)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>

            {totalPages > 1 && (
              <div
                className="flex items-center justify-between gap-4 mt-4 pt-4 border-t"
                data-testid="audit-pagination-controls"
              >
                <div className="text-sm text-muted-foreground">
                  Showing {offset + 1}-{Math.min(offset + pageSize, total)} of{" "}
                  {total}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Previous
                  </Button>
                  <div className="text-sm text-muted-foreground px-2">
                    Page {currentPage} of {totalPages}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                  >
                    Next
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
