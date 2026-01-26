import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Clock, CheckCircle, XCircle, AlertCircle, Filter, ChevronLeft, ChevronRight } from "lucide-react";
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

type ApprovalStatus = "PENDING" | "APPROVED" | "REJECTED" | "ALL";

interface ApprovalEntry {
  id: string;
  type: string;
  artifactId: string;
  artifactName: string;
  requestorId: string;
  requestorName: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  createdAt: string;
  resolvedAt?: string;
  resolvedBy?: string;
  reason?: string;
}

interface ApprovalLogProps {
  pageSize?: number;
}

const STATUS_CONFIG = {
  PENDING: {
    label: "Pending",
    icon: AlertCircle,
    className: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30",
  },
  APPROVED: {
    label: "Approved",
    icon: CheckCircle,
    className: "bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/30",
  },
  REJECTED: {
    label: "Rejected",
    icon: XCircle,
    className: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/30",
  },
};

async function fetchApprovals(): Promise<ApprovalEntry[]> {
  const response = await fetch("/api/governance/approvals", {
    credentials: "include",
  });

  if (!response.ok) {
    return [];
  }

  const data = await response.json();
  return data.approvals || [];
}

export function ApprovalLog({ pageSize = 5 }: ApprovalLogProps) {
  const [statusFilter, setStatusFilter] = useState<ApprovalStatus>("ALL");
  const [currentPage, setCurrentPage] = useState(1);

  const { data: approvals = [], isLoading } = useQuery<ApprovalEntry[]>({
    queryKey: ["/api/governance/approvals"],
    queryFn: fetchApprovals,
    staleTime: 30000,
  });

  const filteredApprovals = approvals.filter((approval) => {
    if (statusFilter === "ALL") return true;
    return approval.status === statusFilter;
  });

  const totalPages = Math.ceil(filteredApprovals.length / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const paginatedApprovals = filteredApprovals.slice(startIndex, startIndex + pageSize);

  const handleStatusChange = (value: string) => {
    setStatusFilter(value as ApprovalStatus);
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

  return (
    <Card data-testid="approval-log">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Clock className="h-5 w-5 text-primary" />
            Approval Log
          </CardTitle>
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <Select
              value={statusFilter}
              onValueChange={handleStatusChange}
            >
              <SelectTrigger className="w-[140px]" data-testid="select-approval-status">
                <SelectValue placeholder="Filter status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL" data-testid="option-status-all">All Status</SelectItem>
                <SelectItem value="PENDING" data-testid="option-status-pending">Pending</SelectItem>
                <SelectItem value="APPROVED" data-testid="option-status-approved">Approved</SelectItem>
                <SelectItem value="REJECTED" data-testid="option-status-rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8" data-testid="approval-log-loading">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        ) : filteredApprovals.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground" data-testid="approval-log-empty">
            <Clock className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p className="text-sm">
              {statusFilter === "ALL"
                ? "No approvals recorded yet"
                : `No ${statusFilter.toLowerCase()} approvals found`}
            </p>
          </div>
        ) : (
          <div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Artifact</TableHead>
                  <TableHead>Requestor</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedApprovals.map((approval) => {
                  const statusConfig = STATUS_CONFIG[approval.status];
                  const StatusIcon = statusConfig.icon;
                  return (
                    <TableRow key={approval.id} data-testid={`approval-row-${approval.id}`}>
                      <TableCell className="font-medium">
                        <Badge variant="outline" className="text-xs">
                          {approval.type}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="max-w-[200px] truncate" title={approval.artifactName}>
                          {approval.artifactName}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {approval.artifactId}
                        </div>
                      </TableCell>
                      <TableCell>{approval.requestorName}</TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={`gap-1 ${statusConfig.className}`}
                        >
                          <StatusIcon className="h-3 w-3" />
                          {statusConfig.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right text-sm text-muted-foreground">
                        {formatDate(approval.createdAt)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            
            {totalPages > 1 && (
              <div className="flex items-center justify-between gap-4 mt-4 pt-4 border-t" data-testid="pagination-controls">
                <div className="text-sm text-muted-foreground" data-testid="pagination-info">
                  Showing {startIndex + 1}-{Math.min(startIndex + pageSize, filteredApprovals.length)} of {filteredApprovals.length}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    data-testid="button-prev-page"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Previous
                  </Button>
                  <div className="text-sm text-muted-foreground px-2" data-testid="pagination-page-info">
                    Page {currentPage} of {totalPages}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    data-testid="button-next-page"
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
