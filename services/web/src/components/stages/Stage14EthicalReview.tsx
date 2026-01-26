/**
 * Stage 14 - Ethical Review
 * Verify compliance and ethical standards
 * Features: Compliance checklist (IRB, HIPAA, GDPR, institutional policies),
 *           Evidence attachment, Remediation task tracker, PHI handling verification,
 *           Consent documentation tracking, Audit trail viewer, Export compliance report
 */

import * as React from 'react';
import { useState, useCallback, useMemo } from 'react';
import {
  Scale,
  Shield,
  CheckCircle,
  XCircle,
  AlertTriangle,
  FileText,
  Upload,
  Download,
  Plus,
  Trash2,
  Edit3,
  Check,
  X,
  ChevronDown,
  ChevronRight,
  Clock,
  User,
  Eye,
  Paperclip,
  ListTodo,
  History,
  FileCheck,
  AlertCircle,
  RefreshCcw,
  ExternalLink,
  Filter,
  Search,
  Calendar,
  Building2,
  Lock,
  Globe,
  ClipboardList,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from '@/components/ui/alert';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from '@/components/ui/avatar';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';

// ==================== Types ====================

export type ComplianceFramework = 'IRB' | 'HIPAA' | 'GDPR' | 'INSTITUTIONAL' | 'FDA' | 'OTHER';

export type ComplianceItemStatus = 'pending' | 'in_progress' | 'compliant' | 'non_compliant' | 'not_applicable' | 'waived';

export type RemediationPriority = 'critical' | 'high' | 'medium' | 'low';

export type RemediationStatus = 'open' | 'in_progress' | 'resolved' | 'deferred';

export type AuditEventType =
  | 'compliance_check'
  | 'evidence_upload'
  | 'evidence_delete'
  | 'remediation_created'
  | 'remediation_updated'
  | 'remediation_resolved'
  | 'phi_scan'
  | 'consent_updated'
  | 'report_generated'
  | 'review_submitted'
  | 'review_approved'
  | 'review_rejected';

export type ConsentStatus = 'obtained' | 'pending' | 'expired' | 'withdrawn' | 'not_required';

export type PhiScanStatus = 'not_started' | 'in_progress' | 'passed' | 'failed' | 'needs_review';

export interface EvidenceAttachment {
  id: string;
  name: string;
  type: string;
  size: number;
  uploadedAt: Date;
  uploadedBy: string;
  url?: string;
  description?: string;
}

export interface ComplianceRequirement {
  id: string;
  framework: ComplianceFramework;
  code: string;
  name: string;
  description: string;
  status: ComplianceItemStatus;
  evidence: EvidenceAttachment[];
  notes?: string;
  dueDate?: Date;
  completedAt?: Date;
  completedBy?: string;
  waiverReason?: string;
}

export interface RemediationTask {
  id: string;
  title: string;
  description: string;
  relatedRequirementIds: string[];
  priority: RemediationPriority;
  status: RemediationStatus;
  assignedTo?: string;
  dueDate?: Date;
  createdAt: Date;
  createdBy: string;
  resolvedAt?: Date;
  resolutionNotes?: string;
}

export interface ConsentRecord {
  id: string;
  participantId: string;
  participantName?: string;
  consentType: string;
  status: ConsentStatus;
  obtainedDate?: Date;
  expirationDate?: Date;
  documentId?: string;
  version: string;
  notes?: string;
}

export interface AuditEvent {
  id: string;
  eventType: AuditEventType;
  timestamp: Date;
  userId: string;
  userName: string;
  description: string;
  metadata?: Record<string, unknown>;
  relatedEntityId?: string;
  relatedEntityType?: string;
}

export interface PhiScanResult {
  id: string;
  scanDate: Date;
  status: PhiScanStatus;
  totalItems: number;
  itemsScanned: number;
  phiDetected: number;
  findings: Array<{
    id: string;
    location: string;
    type: string;
    severity: 'high' | 'medium' | 'low';
    remediated: boolean;
  }>;
  scanConfig?: Record<string, unknown>;
}

export interface ComplianceReport {
  id: string;
  title: string;
  generatedAt: Date;
  generatedBy: string;
  overallStatus: 'compliant' | 'partially_compliant' | 'non_compliant' | 'pending_review';
  frameworkResults: Record<ComplianceFramework, {
    compliant: number;
    nonCompliant: number;
    pending: number;
    notApplicable: number;
    waived: number;
  }>;
  openRemediations: number;
  phiStatus: PhiScanStatus;
  consentCoverage: number;
  recommendations: string[];
  summary: string;
}

export interface EthicalReviewState {
  requirements: ComplianceRequirement[];
  remediationTasks: RemediationTask[];
  consentRecords: ConsentRecord[];
  auditEvents: AuditEvent[];
  phiScanResult?: PhiScanResult;
  report?: ComplianceReport;
}

interface Stage14Props {
  requirements: ComplianceRequirement[];
  remediationTasks: RemediationTask[];
  consentRecords: ConsentRecord[];
  auditEvents: AuditEvent[];
  phiScanResult?: PhiScanResult;
  report?: ComplianceReport;
  currentUserId: string;
  currentUserName: string;
  onRequirementsChange: (requirements: ComplianceRequirement[]) => void;
  onRemediationTasksChange: (tasks: RemediationTask[]) => void;
  onConsentRecordsChange: (records: ConsentRecord[]) => void;
  onAddAuditEvent: (event: Omit<AuditEvent, 'id' | 'timestamp'>) => void;
  onRunPhiScan?: () => Promise<PhiScanResult>;
  onGenerateReport?: () => Promise<ComplianceReport>;
  onExportReport?: (format: 'json' | 'md' | 'pdf') => Promise<void>;
  onUploadEvidence?: (requirementId: string, file: File) => Promise<EvidenceAttachment>;
  onDeleteEvidence?: (requirementId: string, evidenceId: string) => Promise<void>;
  isProcessing?: boolean;
  className?: string;
}

// ==================== Framework Configuration ====================

const FRAMEWORK_CONFIG: Record<ComplianceFramework, {
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
}> = {
  IRB: {
    label: 'IRB',
    description: 'Institutional Review Board requirements',
    icon: Building2,
    color: 'bg-purple-100 text-purple-700 border-purple-200',
  },
  HIPAA: {
    label: 'HIPAA',
    description: 'Health Insurance Portability and Accountability Act',
    icon: Lock,
    color: 'bg-blue-100 text-blue-700 border-blue-200',
  },
  GDPR: {
    label: 'GDPR',
    description: 'General Data Protection Regulation',
    icon: Globe,
    color: 'bg-green-100 text-green-700 border-green-200',
  },
  INSTITUTIONAL: {
    label: 'Institutional',
    description: 'Institutional policies and guidelines',
    icon: Building2,
    color: 'bg-orange-100 text-orange-700 border-orange-200',
  },
  FDA: {
    label: 'FDA',
    description: 'Food and Drug Administration regulations',
    icon: Shield,
    color: 'bg-red-100 text-red-700 border-red-200',
  },
  OTHER: {
    label: 'Other',
    description: 'Other compliance frameworks',
    icon: ClipboardList,
    color: 'bg-gray-100 text-gray-700 border-gray-200',
  },
};

const STATUS_CONFIG: Record<ComplianceItemStatus, {
  label: string;
  color: string;
  icon: React.ComponentType<{ className?: string }>;
}> = {
  pending: { label: 'Pending', color: 'bg-gray-100 text-gray-700', icon: Clock },
  in_progress: { label: 'In Progress', color: 'bg-blue-100 text-blue-700', icon: RefreshCcw },
  compliant: { label: 'Compliant', color: 'bg-green-100 text-green-700', icon: CheckCircle },
  non_compliant: { label: 'Non-Compliant', color: 'bg-red-100 text-red-700', icon: XCircle },
  not_applicable: { label: 'N/A', color: 'bg-gray-100 text-gray-500', icon: X },
  waived: { label: 'Waived', color: 'bg-yellow-100 text-yellow-700', icon: AlertCircle },
};

const PRIORITY_CONFIG: Record<RemediationPriority, {
  label: string;
  color: string;
}> = {
  critical: { label: 'Critical', color: 'bg-red-100 text-red-700 border-red-200' },
  high: { label: 'High', color: 'bg-orange-100 text-orange-700 border-orange-200' },
  medium: { label: 'Medium', color: 'bg-yellow-100 text-yellow-700 border-yellow-200' },
  low: { label: 'Low', color: 'bg-gray-100 text-gray-700 border-gray-200' },
};

const REMEDIATION_STATUS_CONFIG: Record<RemediationStatus, {
  label: string;
  color: string;
}> = {
  open: { label: 'Open', color: 'bg-red-100 text-red-700' },
  in_progress: { label: 'In Progress', color: 'bg-blue-100 text-blue-700' },
  resolved: { label: 'Resolved', color: 'bg-green-100 text-green-700' },
  deferred: { label: 'Deferred', color: 'bg-gray-100 text-gray-700' },
};

const CONSENT_STATUS_CONFIG: Record<ConsentStatus, {
  label: string;
  color: string;
}> = {
  obtained: { label: 'Obtained', color: 'bg-green-100 text-green-700' },
  pending: { label: 'Pending', color: 'bg-yellow-100 text-yellow-700' },
  expired: { label: 'Expired', color: 'bg-red-100 text-red-700' },
  withdrawn: { label: 'Withdrawn', color: 'bg-gray-100 text-gray-700' },
  not_required: { label: 'Not Required', color: 'bg-gray-100 text-gray-500' },
};

// ==================== Main Component ====================

export function Stage14EthicalReview({
  requirements,
  remediationTasks,
  consentRecords,
  auditEvents,
  phiScanResult,
  report,
  currentUserId,
  currentUserName,
  onRequirementsChange,
  onRemediationTasksChange,
  onConsentRecordsChange,
  onAddAuditEvent,
  onRunPhiScan,
  onGenerateReport,
  onExportReport,
  onUploadEvidence,
  onDeleteEvidence,
  isProcessing = false,
  className,
}: Stage14Props) {
  const [selectedTab, setSelectedTab] = useState('compliance');
  const [expandedFrameworks, setExpandedFrameworks] = useState<Set<ComplianceFramework>>(
    new Set(['IRB', 'HIPAA', 'GDPR', 'INSTITUTIONAL'])
  );
  const [isAddingRemediation, setIsAddingRemediation] = useState(false);
  const [isAddingConsent, setIsAddingConsent] = useState(false);
  const [auditFilter, setAuditFilter] = useState<AuditEventType | 'all'>('all');
  const [evidenceDialogOpen, setEvidenceDialogOpen] = useState(false);
  const [selectedRequirementForEvidence, setSelectedRequirementForEvidence] = useState<ComplianceRequirement | null>(null);

  // Calculate compliance statistics
  const complianceStats = useMemo(() => {
    const total = requirements.length;
    const compliant = requirements.filter(r => r.status === 'compliant').length;
    const nonCompliant = requirements.filter(r => r.status === 'non_compliant').length;
    const pending = requirements.filter(r => r.status === 'pending' || r.status === 'in_progress').length;
    const notApplicable = requirements.filter(r => r.status === 'not_applicable').length;
    const waived = requirements.filter(r => r.status === 'waived').length;

    const applicable = total - notApplicable;
    const compliancePercent = applicable > 0 ? Math.round(((compliant + waived) / applicable) * 100) : 0;

    return { total, compliant, nonCompliant, pending, notApplicable, waived, applicable, compliancePercent };
  }, [requirements]);

  // Group requirements by framework
  const requirementsByFramework = useMemo(() => {
    const grouped: Record<ComplianceFramework, ComplianceRequirement[]> = {
      IRB: [],
      HIPAA: [],
      GDPR: [],
      INSTITUTIONAL: [],
      FDA: [],
      OTHER: [],
    };

    requirements.forEach(req => {
      grouped[req.framework].push(req);
    });

    return grouped;
  }, [requirements]);

  // Framework progress
  const frameworkProgress = useMemo(() => {
    const progress: Record<ComplianceFramework, { compliant: number; total: number; percent: number }> = {
      IRB: { compliant: 0, total: 0, percent: 0 },
      HIPAA: { compliant: 0, total: 0, percent: 0 },
      GDPR: { compliant: 0, total: 0, percent: 0 },
      INSTITUTIONAL: { compliant: 0, total: 0, percent: 0 },
      FDA: { compliant: 0, total: 0, percent: 0 },
      OTHER: { compliant: 0, total: 0, percent: 0 },
    };

    (Object.keys(requirementsByFramework) as ComplianceFramework[]).forEach(framework => {
      const reqs = requirementsByFramework[framework];
      const applicable = reqs.filter(r => r.status !== 'not_applicable');
      const compliant = reqs.filter(r => r.status === 'compliant' || r.status === 'waived').length;
      progress[framework] = {
        compliant,
        total: applicable.length,
        percent: applicable.length > 0 ? Math.round((compliant / applicable.length) * 100) : 0,
      };
    });

    return progress;
  }, [requirementsByFramework]);

  // Remediation statistics
  const remediationStats = useMemo(() => {
    const open = remediationTasks.filter(t => t.status === 'open').length;
    const inProgress = remediationTasks.filter(t => t.status === 'in_progress').length;
    const resolved = remediationTasks.filter(t => t.status === 'resolved').length;
    const critical = remediationTasks.filter(t => t.priority === 'critical' && t.status !== 'resolved').length;
    return { open, inProgress, resolved, critical, total: remediationTasks.length };
  }, [remediationTasks]);

  // Consent statistics
  const consentStats = useMemo(() => {
    const total = consentRecords.length;
    const obtained = consentRecords.filter(c => c.status === 'obtained').length;
    const pending = consentRecords.filter(c => c.status === 'pending').length;
    const expired = consentRecords.filter(c => c.status === 'expired').length;
    const coverage = total > 0 ? Math.round((obtained / total) * 100) : 0;
    return { total, obtained, pending, expired, coverage };
  }, [consentRecords]);

  // Check if review can be completed
  const canCompleteReview = useMemo(() => {
    return complianceStats.nonCompliant === 0 &&
           remediationStats.critical === 0 &&
           phiScanResult?.status === 'passed';
  }, [complianceStats.nonCompliant, remediationStats.critical, phiScanResult?.status]);

  // Toggle framework expansion
  const toggleFramework = useCallback((framework: ComplianceFramework) => {
    setExpandedFrameworks(prev => {
      const next = new Set(prev);
      if (next.has(framework)) {
        next.delete(framework);
      } else {
        next.add(framework);
      }
      return next;
    });
  }, []);

  // Update requirement
  const updateRequirement = useCallback((reqId: string, updates: Partial<ComplianceRequirement>) => {
    const updatedRequirements = requirements.map(req =>
      req.id === reqId ? { ...req, ...updates } : req
    );
    onRequirementsChange(updatedRequirements);

    // Add audit event
    onAddAuditEvent({
      eventType: 'compliance_check',
      userId: currentUserId,
      userName: currentUserName,
      description: `Updated compliance requirement status`,
      relatedEntityId: reqId,
      relatedEntityType: 'requirement',
    });
  }, [requirements, onRequirementsChange, onAddAuditEvent, currentUserId, currentUserName]);

  // Add requirement
  const addRequirement = useCallback((framework: ComplianceFramework) => {
    const newReq: ComplianceRequirement = {
      id: crypto.randomUUID(),
      framework,
      code: '',
      name: 'New Requirement',
      description: '',
      status: 'pending',
      evidence: [],
    };
    onRequirementsChange([...requirements, newReq]);
  }, [requirements, onRequirementsChange]);

  // Delete requirement
  const deleteRequirement = useCallback((reqId: string) => {
    onRequirementsChange(requirements.filter(r => r.id !== reqId));
  }, [requirements, onRequirementsChange]);

  // Add remediation task
  const addRemediationTask = useCallback((task: Omit<RemediationTask, 'id' | 'createdAt'>) => {
    const newTask: RemediationTask = {
      ...task,
      id: crypto.randomUUID(),
      createdAt: new Date(),
    };
    onRemediationTasksChange([...remediationTasks, newTask]);
    setIsAddingRemediation(false);

    onAddAuditEvent({
      eventType: 'remediation_created',
      userId: currentUserId,
      userName: currentUserName,
      description: `Created remediation task: ${task.title}`,
      relatedEntityId: newTask.id,
      relatedEntityType: 'remediation',
    });
  }, [remediationTasks, onRemediationTasksChange, onAddAuditEvent, currentUserId, currentUserName]);

  // Update remediation task
  const updateRemediationTask = useCallback((taskId: string, updates: Partial<RemediationTask>) => {
    const updatedTasks = remediationTasks.map(task =>
      task.id === taskId ? { ...task, ...updates } : task
    );
    onRemediationTasksChange(updatedTasks);

    const eventType = updates.status === 'resolved' ? 'remediation_resolved' : 'remediation_updated';
    onAddAuditEvent({
      eventType,
      userId: currentUserId,
      userName: currentUserName,
      description: `Updated remediation task`,
      relatedEntityId: taskId,
      relatedEntityType: 'remediation',
    });
  }, [remediationTasks, onRemediationTasksChange, onAddAuditEvent, currentUserId, currentUserName]);

  // Delete remediation task
  const deleteRemediationTask = useCallback((taskId: string) => {
    onRemediationTasksChange(remediationTasks.filter(t => t.id !== taskId));
  }, [remediationTasks, onRemediationTasksChange]);

  // Add consent record
  const addConsentRecord = useCallback((record: Omit<ConsentRecord, 'id'>) => {
    const newRecord: ConsentRecord = {
      ...record,
      id: crypto.randomUUID(),
    };
    onConsentRecordsChange([...consentRecords, newRecord]);
    setIsAddingConsent(false);

    onAddAuditEvent({
      eventType: 'consent_updated',
      userId: currentUserId,
      userName: currentUserName,
      description: `Added consent record for participant`,
      relatedEntityId: newRecord.id,
      relatedEntityType: 'consent',
    });
  }, [consentRecords, onConsentRecordsChange, onAddAuditEvent, currentUserId, currentUserName]);

  // Update consent record
  const updateConsentRecord = useCallback((recordId: string, updates: Partial<ConsentRecord>) => {
    const updatedRecords = consentRecords.map(record =>
      record.id === recordId ? { ...record, ...updates } : record
    );
    onConsentRecordsChange(updatedRecords);

    onAddAuditEvent({
      eventType: 'consent_updated',
      userId: currentUserId,
      userName: currentUserName,
      description: `Updated consent record`,
      relatedEntityId: recordId,
      relatedEntityType: 'consent',
    });
  }, [consentRecords, onConsentRecordsChange, onAddAuditEvent, currentUserId, currentUserName]);

  // Delete consent record
  const deleteConsentRecord = useCallback((recordId: string) => {
    onConsentRecordsChange(consentRecords.filter(c => c.id !== recordId));
  }, [consentRecords, onConsentRecordsChange]);

  // Handle PHI scan
  const handlePhiScan = useCallback(async () => {
    if (!onRunPhiScan) return;
    await onRunPhiScan();

    onAddAuditEvent({
      eventType: 'phi_scan',
      userId: currentUserId,
      userName: currentUserName,
      description: 'Initiated PHI scan',
    });
  }, [onRunPhiScan, onAddAuditEvent, currentUserId, currentUserName]);

  // Handle generate report
  const handleGenerateReport = useCallback(async () => {
    if (!onGenerateReport) return;
    await onGenerateReport();

    onAddAuditEvent({
      eventType: 'report_generated',
      userId: currentUserId,
      userName: currentUserName,
      description: 'Generated compliance report',
    });
  }, [onGenerateReport, onAddAuditEvent, currentUserId, currentUserName]);

  // Handle evidence upload
  const handleEvidenceUpload = useCallback(async (file: File) => {
    if (!selectedRequirementForEvidence || !onUploadEvidence) return;

    const evidence = await onUploadEvidence(selectedRequirementForEvidence.id, file);

    const updatedRequirements = requirements.map(req =>
      req.id === selectedRequirementForEvidence.id
        ? { ...req, evidence: [...req.evidence, evidence] }
        : req
    );
    onRequirementsChange(updatedRequirements);

    onAddAuditEvent({
      eventType: 'evidence_upload',
      userId: currentUserId,
      userName: currentUserName,
      description: `Uploaded evidence: ${file.name}`,
      relatedEntityId: selectedRequirementForEvidence.id,
      relatedEntityType: 'requirement',
    });
  }, [selectedRequirementForEvidence, onUploadEvidence, requirements, onRequirementsChange, onAddAuditEvent, currentUserId, currentUserName]);

  // Handle evidence delete
  const handleEvidenceDelete = useCallback(async (requirementId: string, evidenceId: string) => {
    if (!onDeleteEvidence) return;

    await onDeleteEvidence(requirementId, evidenceId);

    const updatedRequirements = requirements.map(req =>
      req.id === requirementId
        ? { ...req, evidence: req.evidence.filter(e => e.id !== evidenceId) }
        : req
    );
    onRequirementsChange(updatedRequirements);

    onAddAuditEvent({
      eventType: 'evidence_delete',
      userId: currentUserId,
      userName: currentUserName,
      description: 'Deleted evidence attachment',
      relatedEntityId: requirementId,
      relatedEntityType: 'requirement',
    });
  }, [onDeleteEvidence, requirements, onRequirementsChange, onAddAuditEvent, currentUserId, currentUserName]);

  // Filter audit events
  const filteredAuditEvents = useMemo(() => {
    if (auditFilter === 'all') return auditEvents;
    return auditEvents.filter(e => e.eventType === auditFilter);
  }, [auditEvents, auditFilter]);

  return (
    <div className={cn('space-y-6', className)}>
      {/* Critical Alerts */}
      {remediationStats.critical > 0 && (
        <Alert variant="destructive">
          <XCircle className="h-4 w-4" />
          <AlertTitle>Critical Issues Require Attention</AlertTitle>
          <AlertDescription>
            There are {remediationStats.critical} critical remediation task(s) that must be resolved before the ethical review can be completed.
          </AlertDescription>
        </Alert>
      )}

      {phiScanResult?.status === 'failed' && (
        <Alert variant="destructive">
          <Shield className="h-4 w-4" />
          <AlertTitle>PHI Detected</AlertTitle>
          <AlertDescription>
            PHI scan detected {phiScanResult.phiDetected} potential PHI finding(s). Please review and remediate before proceeding.
          </AlertDescription>
        </Alert>
      )}

      {/* Overall Progress Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Scale className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle>Ethical Review Progress</CardTitle>
                <CardDescription>
                  {complianceStats.compliant + complianceStats.waived} of {complianceStats.applicable} applicable requirements met
                </CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={canCompleteReview ? 'default' : 'secondary'}>
                {canCompleteReview ? 'Ready for Approval' : 'In Progress'}
              </Badge>
              {phiScanResult?.status === 'passed' && (
                <Badge className="bg-green-100 text-green-700">
                  <Shield className="mr-1 h-3 w-3" />
                  PHI Cleared
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span>Overall Compliance</span>
              <span className="font-mono font-medium">{complianceStats.compliancePercent}%</span>
            </div>
            <Progress value={complianceStats.compliancePercent} className="h-3" />
          </div>

          {/* Framework Progress Grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {(Object.keys(FRAMEWORK_CONFIG) as ComplianceFramework[]).map(framework => {
              const config = FRAMEWORK_CONFIG[framework];
              const progress = frameworkProgress[framework];
              const Icon = config.icon;

              if (progress.total === 0) return null;

              return (
                <div
                  key={framework}
                  className={cn('p-3 rounded-lg border', config.color)}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <Icon className="h-4 w-4" />
                    <span className="text-xs font-medium">{config.label}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-lg font-bold">{progress.percent}%</span>
                    <span className="text-xs">
                      {progress.compliant}/{progress.total}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-5 gap-2">
            <QuickStat label="Compliant" value={complianceStats.compliant} color="text-green-600" />
            <QuickStat label="Non-Compliant" value={complianceStats.nonCompliant} color="text-red-600" />
            <QuickStat label="Pending" value={complianceStats.pending} color="text-gray-600" />
            <QuickStat label="Waived" value={complianceStats.waived} color="text-yellow-600" />
            <QuickStat label="N/A" value={complianceStats.notApplicable} color="text-gray-400" />
          </div>
        </CardContent>
      </Card>

      {/* Main Tabs */}
      <Tabs value={selectedTab} onValueChange={setSelectedTab}>
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="compliance">
            <ClipboardList className="mr-2 h-4 w-4" />
            Compliance
          </TabsTrigger>
          <TabsTrigger value="remediation">
            <ListTodo className="mr-2 h-4 w-4" />
            Remediation ({remediationStats.open})
          </TabsTrigger>
          <TabsTrigger value="phi">
            <Shield className="mr-2 h-4 w-4" />
            PHI
          </TabsTrigger>
          <TabsTrigger value="consent">
            <FileCheck className="mr-2 h-4 w-4" />
            Consent ({consentStats.obtained}/{consentStats.total})
          </TabsTrigger>
          <TabsTrigger value="audit">
            <History className="mr-2 h-4 w-4" />
            Audit Trail
          </TabsTrigger>
          <TabsTrigger value="report">
            <FileText className="mr-2 h-4 w-4" />
            Report
          </TabsTrigger>
        </TabsList>

        {/* Compliance Tab */}
        <TabsContent value="compliance" className="mt-4">
          <ComplianceChecklistPanel
            requirementsByFramework={requirementsByFramework}
            expandedFrameworks={expandedFrameworks}
            onToggleFramework={toggleFramework}
            onUpdateRequirement={updateRequirement}
            onAddRequirement={addRequirement}
            onDeleteRequirement={deleteRequirement}
            onOpenEvidenceDialog={(req) => {
              setSelectedRequirementForEvidence(req);
              setEvidenceDialogOpen(true);
            }}
          />
        </TabsContent>

        {/* Remediation Tab */}
        <TabsContent value="remediation" className="mt-4">
          <RemediationPanel
            tasks={remediationTasks}
            requirements={requirements}
            stats={remediationStats}
            onAddTask={() => setIsAddingRemediation(true)}
            onUpdateTask={updateRemediationTask}
            onDeleteTask={deleteRemediationTask}
          />
        </TabsContent>

        {/* PHI Tab */}
        <TabsContent value="phi" className="mt-4">
          <PhiVerificationPanel
            scanResult={phiScanResult}
            onRunScan={handlePhiScan}
            isProcessing={isProcessing}
          />
        </TabsContent>

        {/* Consent Tab */}
        <TabsContent value="consent" className="mt-4">
          <ConsentTrackingPanel
            records={consentRecords}
            stats={consentStats}
            onAddRecord={() => setIsAddingConsent(true)}
            onUpdateRecord={updateConsentRecord}
            onDeleteRecord={deleteConsentRecord}
          />
        </TabsContent>

        {/* Audit Trail Tab */}
        <TabsContent value="audit" className="mt-4">
          <AuditTrailPanel
            events={filteredAuditEvents}
            filter={auditFilter}
            onFilterChange={setAuditFilter}
          />
        </TabsContent>

        {/* Report Tab */}
        <TabsContent value="report" className="mt-4">
          <ReportPanel
            report={report}
            complianceStats={complianceStats}
            remediationStats={remediationStats}
            consentStats={consentStats}
            phiStatus={phiScanResult?.status}
            onGenerateReport={handleGenerateReport}
            onExportReport={onExportReport}
            isProcessing={isProcessing}
          />
        </TabsContent>
      </Tabs>

      {/* Add Remediation Dialog */}
      <AddRemediationDialog
        open={isAddingRemediation}
        onOpenChange={setIsAddingRemediation}
        requirements={requirements}
        currentUserId={currentUserId}
        onAddTask={addRemediationTask}
      />

      {/* Add Consent Dialog */}
      <AddConsentDialog
        open={isAddingConsent}
        onOpenChange={setIsAddingConsent}
        onAddRecord={addConsentRecord}
      />

      {/* Evidence Upload Dialog */}
      <EvidenceUploadDialog
        open={evidenceDialogOpen}
        onOpenChange={setEvidenceDialogOpen}
        requirement={selectedRequirementForEvidence}
        onUpload={handleEvidenceUpload}
        onDelete={(evidenceId) => {
          if (selectedRequirementForEvidence) {
            handleEvidenceDelete(selectedRequirementForEvidence.id, evidenceId);
          }
        }}
      />
    </div>
  );
}

// ==================== Sub-Components ====================

// Quick Stat Display
function QuickStat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="text-center p-2 bg-muted/50 rounded-lg">
      <p className={cn('text-lg font-bold', color)}>{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

// Compliance Checklist Panel
function ComplianceChecklistPanel({
  requirementsByFramework,
  expandedFrameworks,
  onToggleFramework,
  onUpdateRequirement,
  onAddRequirement,
  onDeleteRequirement,
  onOpenEvidenceDialog,
}: {
  requirementsByFramework: Record<ComplianceFramework, ComplianceRequirement[]>;
  expandedFrameworks: Set<ComplianceFramework>;
  onToggleFramework: (framework: ComplianceFramework) => void;
  onUpdateRequirement: (reqId: string, updates: Partial<ComplianceRequirement>) => void;
  onAddRequirement: (framework: ComplianceFramework) => void;
  onDeleteRequirement: (reqId: string) => void;
  onOpenEvidenceDialog: (requirement: ComplianceRequirement) => void;
}) {
  return (
    <div className="space-y-4">
      {(Object.keys(FRAMEWORK_CONFIG) as ComplianceFramework[]).map(framework => {
        const config = FRAMEWORK_CONFIG[framework];
        const requirements = requirementsByFramework[framework];
        const isExpanded = expandedFrameworks.has(framework);
        const Icon = config.icon;

        if (requirements.length === 0 && framework !== 'OTHER') return null;

        const compliantCount = requirements.filter(r =>
          r.status === 'compliant' || r.status === 'waived'
        ).length;

        return (
          <Collapsible
            key={framework}
            open={isExpanded}
            onOpenChange={() => onToggleFramework(framework)}
          >
            <Card>
              <CollapsibleTrigger asChild>
                <CardHeader className="cursor-pointer hover:bg-muted/50">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={cn('p-2 rounded-lg', config.color)}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <div>
                        <CardTitle className="text-base">{config.label}</CardTitle>
                        <CardDescription>{config.description}</CardDescription>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge variant="outline">
                        {compliantCount}/{requirements.length} compliant
                      </Badge>
                      {isExpanded ? (
                        <ChevronDown className="h-5 w-5 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="h-5 w-5 text-muted-foreground" />
                      )}
                    </div>
                  </div>
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="pt-0">
                  <ScrollArea className="max-h-[400px]">
                    <div className="space-y-2">
                      {requirements.map(req => (
                        <ComplianceRequirementCard
                          key={req.id}
                          requirement={req}
                          onUpdate={(updates) => onUpdateRequirement(req.id, updates)}
                          onDelete={() => onDeleteRequirement(req.id)}
                          onOpenEvidence={() => onOpenEvidenceDialog(req)}
                        />
                      ))}
                    </div>
                  </ScrollArea>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-3 w-full"
                    onClick={() => onAddRequirement(framework)}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Add Requirement
                  </Button>
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>
        );
      })}
    </div>
  );
}

// Compliance Requirement Card
function ComplianceRequirementCard({
  requirement,
  onUpdate,
  onDelete,
  onOpenEvidence,
}: {
  requirement: ComplianceRequirement;
  onUpdate: (updates: Partial<ComplianceRequirement>) => void;
  onDelete: () => void;
  onOpenEvidence: () => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(requirement.name);
  const [editCode, setEditCode] = useState(requirement.code);
  const [editDescription, setEditDescription] = useState(requirement.description);
  const [showNotes, setShowNotes] = useState(false);

  const statusConfig = STATUS_CONFIG[requirement.status];
  const StatusIcon = statusConfig.icon;

  const handleSave = () => {
    onUpdate({ name: editName, code: editCode, description: editDescription });
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditName(requirement.name);
    setEditCode(requirement.code);
    setEditDescription(requirement.description);
    setIsEditing(false);
  };

  return (
    <Card className={cn(
      'transition-colors',
      requirement.status === 'compliant' && 'border-green-200 bg-green-50/30',
      requirement.status === 'non_compliant' && 'border-red-200 bg-red-50/30'
    )}>
      <CardContent className="py-3">
        {isEditing ? (
          <div className="space-y-3">
            <div className="grid grid-cols-4 gap-2">
              <Input
                value={editCode}
                onChange={(e) => setEditCode(e.target.value)}
                placeholder="Code"
                className="col-span-1"
              />
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="Requirement name"
                className="col-span-3"
              />
            </div>
            <Textarea
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value)}
              placeholder="Description"
              rows={2}
            />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={handleCancel}>
                <X className="mr-1 h-4 w-4" />
                Cancel
              </Button>
              <Button size="sm" onClick={handleSave}>
                <Check className="mr-1 h-4 w-4" />
                Save
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex items-start gap-3">
              <div className={cn('p-1.5 rounded-full mt-0.5', statusConfig.color)}>
                <StatusIcon className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  {requirement.code && (
                    <Badge variant="outline" className="text-xs font-mono">
                      {requirement.code}
                    </Badge>
                  )}
                  <p className="font-medium">{requirement.name}</p>
                </div>
                {requirement.description && (
                  <p className="text-sm text-muted-foreground">{requirement.description}</p>
                )}
              </div>
              <div className="flex items-center gap-1">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={onOpenEvidence}
                      >
                        <Paperclip className="h-4 w-4" />
                        {requirement.evidence.length > 0 && (
                          <span className="absolute -top-1 -right-1 h-4 w-4 text-xs bg-primary text-primary-foreground rounded-full flex items-center justify-center">
                            {requirement.evidence.length}
                          </span>
                        )}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Evidence ({requirement.evidence.length})</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setIsEditing(true)}
                >
                  <Edit3 className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive"
                  onClick={onDelete}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Select
                  value={requirement.status}
                  onValueChange={(v) => onUpdate({
                    status: v as ComplianceItemStatus,
                    completedAt: ['compliant', 'non_compliant', 'not_applicable', 'waived'].includes(v) ? new Date() : undefined,
                  })}
                >
                  <SelectTrigger className="h-8 w-36">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="in_progress">In Progress</SelectItem>
                    <SelectItem value="compliant">Compliant</SelectItem>
                    <SelectItem value="non_compliant">Non-Compliant</SelectItem>
                    <SelectItem value="not_applicable">N/A</SelectItem>
                    <SelectItem value="waived">Waived</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowNotes(!showNotes)}
              >
                <FileText className="mr-1 h-4 w-4" />
                Notes
              </Button>
            </div>

            {showNotes && (
              <div className="pt-2 space-y-2">
                <Label className="text-xs">Notes</Label>
                <Textarea
                  value={requirement.notes || ''}
                  onChange={(e) => onUpdate({ notes: e.target.value })}
                  placeholder="Add notes about this requirement..."
                  rows={2}
                />
                {requirement.status === 'waived' && (
                  <>
                    <Label className="text-xs">Waiver Reason</Label>
                    <Textarea
                      value={requirement.waiverReason || ''}
                      onChange={(e) => onUpdate({ waiverReason: e.target.value })}
                      placeholder="Document the reason for this waiver..."
                      rows={2}
                    />
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Remediation Panel
function RemediationPanel({
  tasks,
  requirements,
  stats,
  onAddTask,
  onUpdateTask,
  onDeleteTask,
}: {
  tasks: RemediationTask[];
  requirements: ComplianceRequirement[];
  stats: { open: number; inProgress: number; resolved: number; critical: number; total: number };
  onAddTask: () => void;
  onUpdateTask: (taskId: string, updates: Partial<RemediationTask>) => void;
  onDeleteTask: (taskId: string) => void;
}) {
  const [filterPriority, setFilterPriority] = useState<RemediationPriority | 'all'>('all');
  const [filterStatus, setFilterStatus] = useState<RemediationStatus | 'all'>('all');

  const filteredTasks = useMemo(() => {
    return tasks.filter(task => {
      if (filterPriority !== 'all' && task.priority !== filterPriority) return false;
      if (filterStatus !== 'all' && task.status !== filterStatus) return false;
      return true;
    });
  }, [tasks, filterPriority, filterStatus]);

  return (
    <div className="space-y-4">
      {/* Summary Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ListTodo className="h-5 w-5" />
            Remediation Tasks
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-5 gap-4">
            <div className="text-center p-4 bg-muted rounded-lg">
              <p className="text-2xl font-bold">{stats.total}</p>
              <p className="text-xs text-muted-foreground">Total</p>
            </div>
            <div className="text-center p-4 bg-red-50 rounded-lg">
              <p className="text-2xl font-bold text-red-600">{stats.critical}</p>
              <p className="text-xs text-muted-foreground">Critical</p>
            </div>
            <div className="text-center p-4 bg-orange-50 rounded-lg">
              <p className="text-2xl font-bold text-orange-600">{stats.open}</p>
              <p className="text-xs text-muted-foreground">Open</p>
            </div>
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <p className="text-2xl font-bold text-blue-600">{stats.inProgress}</p>
              <p className="text-xs text-muted-foreground">In Progress</p>
            </div>
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <p className="text-2xl font-bold text-green-600">{stats.resolved}</p>
              <p className="text-xs text-muted-foreground">Resolved</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Filters */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Select
            value={filterPriority}
            onValueChange={(v) => setFilterPriority(v as RemediationPriority | 'all')}
          >
            <SelectTrigger className="w-32">
              <SelectValue placeholder="Priority" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Priority</SelectItem>
              <SelectItem value="critical">Critical</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="low">Low</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={filterStatus}
            onValueChange={(v) => setFilterStatus(v as RemediationStatus | 'all')}
          >
            <SelectTrigger className="w-32">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="open">Open</SelectItem>
              <SelectItem value="in_progress">In Progress</SelectItem>
              <SelectItem value="resolved">Resolved</SelectItem>
              <SelectItem value="deferred">Deferred</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Button onClick={onAddTask}>
          <Plus className="mr-2 h-4 w-4" />
          Add Task
        </Button>
      </div>

      {/* Tasks List */}
      <ScrollArea className="h-[500px]">
        <div className="space-y-3">
          {filteredTasks.map(task => {
            const priorityConfig = PRIORITY_CONFIG[task.priority];
            const statusConfig = REMEDIATION_STATUS_CONFIG[task.status];

            return (
              <Card key={task.id} className={cn(
                task.priority === 'critical' && task.status !== 'resolved' && 'border-red-300',
                task.status === 'resolved' && 'opacity-75'
              )}>
                <CardContent className="py-3">
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium">{task.title}</span>
                        <Badge className={cn('text-xs', priorityConfig.color)}>
                          {priorityConfig.label}
                        </Badge>
                        <Badge className={cn('text-xs', statusConfig.color)}>
                          {statusConfig.label}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{task.description}</p>

                      <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                        <span>Created: {task.createdAt.toLocaleDateString()}</span>
                        {task.dueDate && (
                          <span className={cn(
                            task.dueDate < new Date() && task.status !== 'resolved' && 'text-red-600'
                          )}>
                            Due: {task.dueDate.toLocaleDateString()}
                          </span>
                        )}
                        {task.assignedTo && <span>Assigned: {task.assignedTo}</span>}
                      </div>

                      {task.resolutionNotes && (
                        <div className="mt-2 p-2 bg-green-50 rounded text-sm">
                          <span className="font-medium">Resolution:</span> {task.resolutionNotes}
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col gap-1">
                      <Select
                        value={task.status}
                        onValueChange={(v) => onUpdateTask(task.id, {
                          status: v as RemediationStatus,
                          resolvedAt: v === 'resolved' ? new Date() : undefined,
                        })}
                      >
                        <SelectTrigger className="h-8 w-28">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="open">Open</SelectItem>
                          <SelectItem value="in_progress">In Progress</SelectItem>
                          <SelectItem value="resolved">Resolved</SelectItem>
                          <SelectItem value="deferred">Deferred</SelectItem>
                        </SelectContent>
                      </Select>

                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive"
                        onClick={() => onDeleteTask(task.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}

          {filteredTasks.length === 0 && (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <CheckCircle className="h-12 w-12 text-green-500 mb-4" />
                <p className="text-muted-foreground text-center">
                  {tasks.length === 0
                    ? 'No remediation tasks'
                    : 'No tasks match the current filters'}
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

// PHI Verification Panel
function PhiVerificationPanel({
  scanResult,
  onRunScan,
  isProcessing,
}: {
  scanResult?: PhiScanResult;
  onRunScan?: () => Promise<void>;
  isProcessing: boolean;
}) {
  const statusColors: Record<PhiScanStatus, string> = {
    not_started: 'bg-gray-100 text-gray-700',
    in_progress: 'bg-blue-100 text-blue-700',
    passed: 'bg-green-100 text-green-700',
    failed: 'bg-red-100 text-red-700',
    needs_review: 'bg-yellow-100 text-yellow-700',
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                PHI Handling Verification
              </CardTitle>
              <CardDescription>
                Scan research data for Protected Health Information
              </CardDescription>
            </div>
            <Button
              onClick={onRunScan}
              disabled={isProcessing || !onRunScan}
            >
              {isProcessing ? (
                <>
                  <RefreshCcw className="mr-2 h-4 w-4 animate-spin" />
                  Scanning...
                </>
              ) : (
                <>
                  <Shield className="mr-2 h-4 w-4" />
                  Run PHI Scan
                </>
              )}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {scanResult ? (
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <Badge className={cn('text-lg px-4 py-1', statusColors[scanResult.status])}>
                  {scanResult.status === 'passed' && <CheckCircle className="mr-2 h-4 w-4" />}
                  {scanResult.status === 'failed' && <XCircle className="mr-2 h-4 w-4" />}
                  {scanResult.status.replace('_', ' ').toUpperCase()}
                </Badge>
                <span className="text-sm text-muted-foreground">
                  Last scan: {scanResult.scanDate.toLocaleString()}
                </span>
              </div>

              <div className="grid grid-cols-4 gap-4">
                <div className="p-4 bg-muted rounded-lg text-center">
                  <p className="text-2xl font-bold">{scanResult.totalItems}</p>
                  <p className="text-xs text-muted-foreground">Total Items</p>
                </div>
                <div className="p-4 bg-muted rounded-lg text-center">
                  <p className="text-2xl font-bold">{scanResult.itemsScanned}</p>
                  <p className="text-xs text-muted-foreground">Items Scanned</p>
                </div>
                <div className={cn(
                  'p-4 rounded-lg text-center',
                  scanResult.phiDetected > 0 ? 'bg-red-50' : 'bg-green-50'
                )}>
                  <p className={cn(
                    'text-2xl font-bold',
                    scanResult.phiDetected > 0 ? 'text-red-600' : 'text-green-600'
                  )}>
                    {scanResult.phiDetected}
                  </p>
                  <p className="text-xs text-muted-foreground">PHI Detected</p>
                </div>
                <div className="p-4 bg-muted rounded-lg text-center">
                  <p className="text-2xl font-bold">
                    {scanResult.findings.filter(f => f.remediated).length}/{scanResult.findings.length}
                  </p>
                  <p className="text-xs text-muted-foreground">Remediated</p>
                </div>
              </div>

              {scanResult.findings.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">PHI Findings</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Location</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead>Severity</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {scanResult.findings.map(finding => (
                          <TableRow key={finding.id}>
                            <TableCell className="font-mono text-sm">{finding.location}</TableCell>
                            <TableCell>{finding.type}</TableCell>
                            <TableCell>
                              <Badge className={cn(
                                'text-xs',
                                finding.severity === 'high' && 'bg-red-100 text-red-700',
                                finding.severity === 'medium' && 'bg-yellow-100 text-yellow-700',
                                finding.severity === 'low' && 'bg-gray-100 text-gray-700'
                              )}>
                                {finding.severity}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge className={cn(
                                'text-xs',
                                finding.remediated ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                              )}>
                                {finding.remediated ? 'Remediated' : 'Pending'}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12">
              <Shield className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground text-center">
                No PHI scan has been performed yet
              </p>
              <p className="text-sm text-muted-foreground text-center">
                Run a scan to verify PHI handling compliance
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// Consent Tracking Panel
function ConsentTrackingPanel({
  records,
  stats,
  onAddRecord,
  onUpdateRecord,
  onDeleteRecord,
}: {
  records: ConsentRecord[];
  stats: { total: number; obtained: number; pending: number; expired: number; coverage: number };
  onAddRecord: () => void;
  onUpdateRecord: (recordId: string, updates: Partial<ConsentRecord>) => void;
  onDeleteRecord: (recordId: string) => void;
}) {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredRecords = useMemo(() => {
    if (!searchTerm) return records;
    const term = searchTerm.toLowerCase();
    return records.filter(r =>
      r.participantId.toLowerCase().includes(term) ||
      r.participantName?.toLowerCase().includes(term) ||
      r.consentType.toLowerCase().includes(term)
    );
  }, [records, searchTerm]);

  return (
    <div className="space-y-4">
      {/* Summary Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileCheck className="h-5 w-5" />
            Consent Documentation
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-5 gap-4">
            <div className="text-center p-4 bg-muted rounded-lg">
              <p className="text-2xl font-bold">{stats.total}</p>
              <p className="text-xs text-muted-foreground">Total</p>
            </div>
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <p className="text-2xl font-bold text-green-600">{stats.obtained}</p>
              <p className="text-xs text-muted-foreground">Obtained</p>
            </div>
            <div className="text-center p-4 bg-yellow-50 rounded-lg">
              <p className="text-2xl font-bold text-yellow-600">{stats.pending}</p>
              <p className="text-xs text-muted-foreground">Pending</p>
            </div>
            <div className="text-center p-4 bg-red-50 rounded-lg">
              <p className="text-2xl font-bold text-red-600">{stats.expired}</p>
              <p className="text-xs text-muted-foreground">Expired</p>
            </div>
            <div className="text-center p-4 bg-primary/10 rounded-lg">
              <p className="text-2xl font-bold text-primary">{stats.coverage}%</p>
              <p className="text-xs text-muted-foreground">Coverage</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Search and Add */}
      <div className="flex items-center justify-between">
        <div className="relative w-64">
          <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search participants..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-8"
          />
        </div>
        <Button onClick={onAddRecord}>
          <Plus className="mr-2 h-4 w-4" />
          Add Record
        </Button>
      </div>

      {/* Records Table */}
      <Card>
        <CardContent className="pt-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Participant ID</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Consent Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Obtained</TableHead>
                <TableHead>Expires</TableHead>
                <TableHead>Version</TableHead>
                <TableHead className="w-[100px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRecords.map(record => {
                const statusConfig = CONSENT_STATUS_CONFIG[record.status];

                return (
                  <TableRow key={record.id}>
                    <TableCell className="font-mono text-sm">{record.participantId}</TableCell>
                    <TableCell>{record.participantName || '-'}</TableCell>
                    <TableCell>{record.consentType}</TableCell>
                    <TableCell>
                      <Select
                        value={record.status}
                        onValueChange={(v) => onUpdateRecord(record.id, { status: v as ConsentStatus })}
                      >
                        <SelectTrigger className="h-8 w-28">
                          <Badge className={cn('text-xs', statusConfig.color)}>
                            {statusConfig.label}
                          </Badge>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="obtained">Obtained</SelectItem>
                          <SelectItem value="pending">Pending</SelectItem>
                          <SelectItem value="expired">Expired</SelectItem>
                          <SelectItem value="withdrawn">Withdrawn</SelectItem>
                          <SelectItem value="not_required">Not Required</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      {record.obtainedDate ? record.obtainedDate.toLocaleDateString() : '-'}
                    </TableCell>
                    <TableCell className={cn(
                      record.expirationDate && record.expirationDate < new Date() && 'text-red-600'
                    )}>
                      {record.expirationDate ? record.expirationDate.toLocaleDateString() : '-'}
                    </TableCell>
                    <TableCell>{record.version}</TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive"
                        onClick={() => onDeleteRecord(record.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
              {filteredRecords.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8">
                    <p className="text-muted-foreground">
                      {records.length === 0 ? 'No consent records' : 'No records match search'}
                    </p>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

// Audit Trail Panel
function AuditTrailPanel({
  events,
  filter,
  onFilterChange,
}: {
  events: AuditEvent[];
  filter: AuditEventType | 'all';
  onFilterChange: (filter: AuditEventType | 'all') => void;
}) {
  const eventTypeLabels: Record<AuditEventType, string> = {
    compliance_check: 'Compliance Check',
    evidence_upload: 'Evidence Upload',
    evidence_delete: 'Evidence Delete',
    remediation_created: 'Remediation Created',
    remediation_updated: 'Remediation Updated',
    remediation_resolved: 'Remediation Resolved',
    phi_scan: 'PHI Scan',
    consent_updated: 'Consent Updated',
    report_generated: 'Report Generated',
    review_submitted: 'Review Submitted',
    review_approved: 'Review Approved',
    review_rejected: 'Review Rejected',
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <History className="h-5 w-5" />
                Audit Trail
              </CardTitle>
              <CardDescription>
                Complete history of all ethical review actions
              </CardDescription>
            </div>
            <Select
              value={filter}
              onValueChange={(v) => onFilterChange(v as AuditEventType | 'all')}
            >
              <SelectTrigger className="w-48">
                <Filter className="mr-2 h-4 w-4" />
                <SelectValue placeholder="Filter events" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Events</SelectItem>
                {(Object.keys(eventTypeLabels) as AuditEventType[]).map(type => (
                  <SelectItem key={type} value={type}>
                    {eventTypeLabels[type]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[500px]">
            <div className="space-y-3">
              {events.map(event => (
                <div
                  key={event.id}
                  className="flex items-start gap-3 p-3 rounded-lg border bg-card"
                >
                  <div className="p-2 rounded-full bg-muted">
                    <History className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="outline" className="text-xs">
                        {eventTypeLabels[event.eventType]}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {event.timestamp.toLocaleString()}
                      </span>
                    </div>
                    <p className="text-sm">{event.description}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      By: {event.userName}
                    </p>
                  </div>
                </div>
              ))}

              {events.length === 0 && (
                <div className="flex flex-col items-center justify-center py-12">
                  <History className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground text-center">
                    No audit events recorded
                  </p>
                </div>
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}

// Report Panel
function ReportPanel({
  report,
  complianceStats,
  remediationStats,
  consentStats,
  phiStatus,
  onGenerateReport,
  onExportReport,
  isProcessing,
}: {
  report?: ComplianceReport;
  complianceStats: { total: number; compliant: number; nonCompliant: number; pending: number; compliancePercent: number };
  remediationStats: { open: number; critical: number; total: number };
  consentStats: { coverage: number };
  phiStatus?: PhiScanStatus;
  onGenerateReport?: () => Promise<void>;
  onExportReport?: (format: 'json' | 'md' | 'pdf') => Promise<void>;
  isProcessing: boolean;
}) {
  const overallStatusColors: Record<string, string> = {
    compliant: 'bg-green-100 text-green-700',
    partially_compliant: 'bg-yellow-100 text-yellow-700',
    non_compliant: 'bg-red-100 text-red-700',
    pending_review: 'bg-gray-100 text-gray-700',
  };

  return (
    <div className="space-y-4">
      {/* Generate Report Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Compliance Report
              </CardTitle>
              <CardDescription>
                Generate and export the compliance report
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={onGenerateReport}
                disabled={isProcessing}
              >
                {isProcessing ? (
                  <>
                    <RefreshCcw className="mr-2 h-4 w-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <RefreshCcw className="mr-2 h-4 w-4" />
                    Generate Report
                  </>
                )}
              </Button>
              {report && (
                <Select onValueChange={(v) => onExportReport?.(v as 'json' | 'md' | 'pdf')}>
                  <SelectTrigger className="w-32">
                    <Download className="mr-2 h-4 w-4" />
                    Export
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="json">JSON</SelectItem>
                    <SelectItem value="md">Markdown</SelectItem>
                    <SelectItem value="pdf">PDF</SelectItem>
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Report Content */}
      {report ? (
        <div className="space-y-4">
          {/* Report Header */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-xl font-bold">{report.title}</h3>
                  <p className="text-sm text-muted-foreground">
                    Generated: {report.generatedAt.toLocaleString()} by {report.generatedBy}
                  </p>
                </div>
                <Badge className={cn('text-lg px-4 py-1', overallStatusColors[report.overallStatus])}>
                  {report.overallStatus.replace(/_/g, ' ').toUpperCase()}
                </Badge>
              </div>
              <p className="text-muted-foreground">{report.summary}</p>
            </CardContent>
          </Card>

          {/* Framework Results */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Framework Results</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {(Object.keys(FRAMEWORK_CONFIG) as ComplianceFramework[]).map(framework => {
                  const config = FRAMEWORK_CONFIG[framework];
                  const results = report.frameworkResults[framework];
                  const Icon = config.icon;

                  if (!results || (results.compliant + results.nonCompliant + results.pending + results.waived) === 0) return null;

                  return (
                    <Card key={framework} className={cn('border', config.color)}>
                      <CardContent className="pt-4">
                        <div className="flex items-center gap-2 mb-3">
                          <Icon className="h-4 w-4" />
                          <span className="text-sm font-medium">{config.label}</span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-center text-xs">
                          <div>
                            <p className="font-bold text-green-600">{results.compliant}</p>
                            <p className="text-muted-foreground">Compliant</p>
                          </div>
                          <div>
                            <p className="font-bold text-red-600">{results.nonCompliant}</p>
                            <p className="text-muted-foreground">Non-Compliant</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Recommendations */}
          {report.recommendations.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Recommendations</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {report.recommendations.map((rec, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-sm">
                      <AlertCircle className="h-4 w-4 text-primary mt-0.5" />
                      {rec}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </div>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FileText className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground text-center">
              No report generated yet
            </p>
            <p className="text-sm text-muted-foreground text-center">
              Complete the compliance checklist and generate a report
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ==================== Dialogs ====================

// Add Remediation Dialog
function AddRemediationDialog({
  open,
  onOpenChange,
  requirements,
  currentUserId,
  onAddTask,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  requirements: ComplianceRequirement[];
  currentUserId: string;
  onAddTask: (task: Omit<RemediationTask, 'id' | 'createdAt'>) => void;
}) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<RemediationPriority>('medium');
  const [relatedRequirementIds, setRelatedRequirementIds] = useState<string[]>([]);
  const [assignedTo, setAssignedTo] = useState('');
  const [dueDate, setDueDate] = useState('');

  const handleSubmit = () => {
    onAddTask({
      title,
      description,
      relatedRequirementIds,
      priority,
      status: 'open',
      assignedTo: assignedTo || undefined,
      dueDate: dueDate ? new Date(dueDate) : undefined,
      createdBy: currentUserId,
    });
    // Reset form
    setTitle('');
    setDescription('');
    setPriority('medium');
    setRelatedRequirementIds([]);
    setAssignedTo('');
    setDueDate('');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Remediation Task</DialogTitle>
          <DialogDescription>
            Create a task to address compliance issues
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Title</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Task title"
            />
          </div>

          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the remediation task..."
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Priority</Label>
              <Select
                value={priority}
                onValueChange={(v) => setPriority(v as RemediationPriority)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="critical">Critical</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Due Date (optional)</Label>
              <Input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Assigned To (optional)</Label>
            <Input
              value={assignedTo}
              onChange={(e) => setAssignedTo(e.target.value)}
              placeholder="Assignee name or email"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!title.trim()}>
            <Plus className="mr-2 h-4 w-4" />
            Add Task
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Add Consent Dialog
function AddConsentDialog({
  open,
  onOpenChange,
  onAddRecord,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAddRecord: (record: Omit<ConsentRecord, 'id'>) => void;
}) {
  const [participantId, setParticipantId] = useState('');
  const [participantName, setParticipantName] = useState('');
  const [consentType, setConsentType] = useState('');
  const [status, setStatus] = useState<ConsentStatus>('pending');
  const [version, setVersion] = useState('1.0');
  const [obtainedDate, setObtainedDate] = useState('');
  const [expirationDate, setExpirationDate] = useState('');

  const handleSubmit = () => {
    onAddRecord({
      participantId,
      participantName: participantName || undefined,
      consentType,
      status,
      version,
      obtainedDate: obtainedDate ? new Date(obtainedDate) : undefined,
      expirationDate: expirationDate ? new Date(expirationDate) : undefined,
    });
    // Reset form
    setParticipantId('');
    setParticipantName('');
    setConsentType('');
    setStatus('pending');
    setVersion('1.0');
    setObtainedDate('');
    setExpirationDate('');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Consent Record</DialogTitle>
          <DialogDescription>
            Track participant consent documentation
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Participant ID</Label>
              <Input
                value={participantId}
                onChange={(e) => setParticipantId(e.target.value)}
                placeholder="P001"
              />
            </div>
            <div className="space-y-2">
              <Label>Name (optional)</Label>
              <Input
                value={participantName}
                onChange={(e) => setParticipantName(e.target.value)}
                placeholder="Participant name"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Consent Type</Label>
              <Input
                value={consentType}
                onChange={(e) => setConsentType(e.target.value)}
                placeholder="e.g., Informed Consent"
              />
            </div>
            <div className="space-y-2">
              <Label>Version</Label>
              <Input
                value={version}
                onChange={(e) => setVersion(e.target.value)}
                placeholder="1.0"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Status</Label>
            <Select
              value={status}
              onValueChange={(v) => setStatus(v as ConsentStatus)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="obtained">Obtained</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="expired">Expired</SelectItem>
                <SelectItem value="withdrawn">Withdrawn</SelectItem>
                <SelectItem value="not_required">Not Required</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Obtained Date (optional)</Label>
              <Input
                type="date"
                value={obtainedDate}
                onChange={(e) => setObtainedDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Expiration Date (optional)</Label>
              <Input
                type="date"
                value={expirationDate}
                onChange={(e) => setExpirationDate(e.target.value)}
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!participantId.trim() || !consentType.trim()}>
            <Plus className="mr-2 h-4 w-4" />
            Add Record
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Evidence Upload Dialog
function EvidenceUploadDialog({
  open,
  onOpenChange,
  requirement,
  onUpload,
  onDelete,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  requirement: ComplianceRequirement | null;
  onUpload: (file: File) => Promise<void>;
  onDelete: (evidenceId: string) => void;
}) {
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      await onUpload(file);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  if (!requirement) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Evidence Attachments</DialogTitle>
          <DialogDescription>
            Upload and manage evidence for: {requirement.name}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Upload Area */}
          <div
            className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:bg-muted/50 transition-colors"
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              onChange={handleFileChange}
              disabled={isUploading}
            />
            {isUploading ? (
              <>
                <RefreshCcw className="h-8 w-8 mx-auto mb-2 animate-spin text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Uploading...</p>
              </>
            ) : (
              <>
                <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Click to upload evidence</p>
                <p className="text-xs text-muted-foreground mt-1">PDF, DOC, XLS, images</p>
              </>
            )}
          </div>

          {/* Evidence List */}
          {requirement.evidence.length > 0 && (
            <div className="space-y-2">
              <Label>Attached Evidence</Label>
              <ScrollArea className="max-h-[200px]">
                <div className="space-y-2">
                  {requirement.evidence.map(ev => (
                    <div
                      key={ev.id}
                      className="flex items-center justify-between p-2 rounded border bg-muted/50"
                    >
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="text-sm font-medium">{ev.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {(ev.size / 1024).toFixed(1)} KB - Uploaded {ev.uploadedAt.toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        {ev.url && (
                          <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
                            <a href={ev.url} target="_blank" rel="noopener noreferrer">
                              <ExternalLink className="h-4 w-4" />
                            </a>
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive"
                          onClick={() => onDelete(ev.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}

          {requirement.evidence.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">
              No evidence attached yet
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default Stage14EthicalReview;
