/**
 * Stage 16 - Collaboration Handoff
 * Transfer ownership and provide access to collaborators
 * Features: Collaborator management, role-based permissions, handoff packages,
 *           ownership transfer workflow, PHI access agreements, activity audit trail,
 *           AI-assisted collaborator suggestions based on research domain
 */

import * as React from 'react';
import { useState, useCallback, useMemo } from 'react';
import {
  Users,
  UserPlus,
  UserMinus,
  UserCheck,
  Mail,
  Search,
  Shield,
  ShieldCheck,
  ShieldAlert,
  Package,
  PackagePlus,
  PackageCheck,
  Send,
  Download,
  Upload,
  Plus,
  Trash2,
  Edit3,
  Check,
  X,
  ChevronDown,
  ChevronRight,
  Clock,
  Eye,
  EyeOff,
  Lock,
  Unlock,
  Key,
  FileText,
  FolderOpen,
  History,
  AlertTriangle,
  AlertCircle,
  CheckCircle,
  XCircle,
  RefreshCcw,
  ExternalLink,
  Copy,
  Sparkles,
  Crown,
  ArrowRight,
  ArrowRightLeft,
  Settings,
  Filter,
  Calendar,
  Building2,
  Globe,
  Handshake,
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
import { Switch } from '@/components/ui/switch';
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

export type CollaboratorRole = 'viewer' | 'editor' | 'admin' | 'owner';

export type InvitationStatus = 'pending' | 'accepted' | 'declined' | 'expired' | 'revoked';

export type HandoffPackageStatus = 'draft' | 'pending_review' | 'approved' | 'delivered' | 'archived';

export type AccessGrantStatus = 'active' | 'pending' | 'revoked' | 'expired';

export type AgreementStatus = 'pending' | 'signed' | 'declined' | 'expired';

export type AuditActionType =
  | 'collaborator_invited'
  | 'collaborator_added'
  | 'collaborator_removed'
  | 'role_changed'
  | 'permission_granted'
  | 'permission_revoked'
  | 'package_created'
  | 'package_updated'
  | 'package_delivered'
  | 'ownership_transferred'
  | 'agreement_signed'
  | 'agreement_declined'
  | 'phi_access_granted'
  | 'phi_access_revoked';

export interface Collaborator {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string;
  role: CollaboratorRole;
  institution?: string;
  department?: string;
  invitationStatus: InvitationStatus;
  invitedAt: Date;
  invitedBy: string;
  joinedAt?: Date;
  lastActiveAt?: Date;
  phiAccessGranted: boolean;
  phiAgreementSigned: boolean;
  phiAgreementSignedAt?: Date;
  notes?: string;
}

export interface PermissionMatrix {
  collaboratorId: string;
  permissions: {
    viewResearch: boolean;
    editResearch: boolean;
    viewData: boolean;
    editData: boolean;
    viewAnalysis: boolean;
    editAnalysis: boolean;
    viewDocuments: boolean;
    editDocuments: boolean;
    exportData: boolean;
    manageCollaborators: boolean;
    deleteContent: boolean;
    transferOwnership: boolean;
  };
}

export interface HandoffArtifact {
  id: string;
  type: 'dataset' | 'analysis' | 'document' | 'visualization' | 'code' | 'model' | 'other';
  name: string;
  description?: string;
  size?: number;
  version?: string;
  included: boolean;
  phiContained: boolean;
  lastModified: Date;
}

export interface HandoffPackage {
  id: string;
  name: string;
  description: string;
  status: HandoffPackageStatus;
  artifacts: HandoffArtifact[];
  recipients: string[]; // collaborator IDs
  createdAt: Date;
  createdBy: string;
  updatedAt: Date;
  deliveredAt?: Date;
  expiresAt?: Date;
  accessUrl?: string;
  accessPassword?: string;
  downloadCount: number;
  notes?: string;
}

export interface AccessGrant {
  id: string;
  collaboratorId: string;
  packageId?: string;
  resourceType: 'full' | 'package' | 'artifact';
  resourceId?: string;
  status: AccessGrantStatus;
  grantedAt: Date;
  grantedBy: string;
  expiresAt?: Date;
  revokedAt?: Date;
  revokedBy?: string;
  revokeReason?: string;
}

export interface PhiAgreement {
  id: string;
  collaboratorId: string;
  version: string;
  content: string;
  status: AgreementStatus;
  sentAt: Date;
  signedAt?: Date;
  declinedAt?: Date;
  expiresAt?: Date;
  ipAddress?: string;
  signatureData?: string;
}

export interface AuditLogEntry {
  id: string;
  actionType: AuditActionType;
  timestamp: Date;
  userId: string;
  userName: string;
  targetUserId?: string;
  targetUserName?: string;
  description: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
}

export interface CollaboratorSuggestion {
  id: string;
  email: string;
  name: string;
  institution?: string;
  expertise: string[];
  matchScore: number;
  matchReason: string;
  source: 'network' | 'coauthor' | 'citation' | 'domain_expert';
}

export interface OwnershipTransfer {
  id: string;
  fromUserId: string;
  fromUserName: string;
  toUserId: string;
  toUserName: string;
  status: 'pending' | 'accepted' | 'declined' | 'cancelled';
  initiatedAt: Date;
  completedAt?: Date;
  reason?: string;
  acknowledgements: {
    dataResponsibility: boolean;
    complianceResponsibility: boolean;
    irrevocable: boolean;
  };
}

// ==================== Props Interface ====================

export interface StageComponentProps {
  topicId: string;
  researchId: string;
  stageData?: CollaborationHandoffState;
  onComplete?: (data: CollaborationHandoffState) => void;
  onSave?: (data: CollaborationHandoffState) => void;
  isReadOnly?: boolean;
}

export interface CollaborationHandoffState {
  collaborators: Collaborator[];
  permissionMatrix: PermissionMatrix[];
  handoffPackages: HandoffPackage[];
  accessGrants: AccessGrant[];
  phiAgreements: PhiAgreement[];
  auditLog: AuditLogEntry[];
  pendingTransfer?: OwnershipTransfer;
  availableArtifacts: HandoffArtifact[];
}

interface Stage16Props extends StageComponentProps {
  currentUserId: string;
  currentUserName: string;
  currentUserRole: CollaboratorRole;
  onSearchUsers?: (query: string) => Promise<Array<{ id: string; email: string; name: string; institution?: string }>>;
  onGetSuggestions?: (researchDomain: string) => Promise<CollaboratorSuggestion[]>;
  onSendInvitation?: (email: string, role: CollaboratorRole, message?: string) => Promise<void>;
  onUploadPackage?: (packageId: string) => Promise<string>;
  onSendPhiAgreement?: (collaboratorId: string) => Promise<void>;
  isProcessing?: boolean;
  className?: string;
}

// ==================== Configuration ====================

const ROLE_CONFIG: Record<CollaboratorRole, {
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  priority: number;
}> = {
  owner: {
    label: 'Owner',
    description: 'Full control including ownership transfer',
    icon: Crown,
    color: 'bg-amber-100 text-amber-700 border-amber-200',
    priority: 1,
  },
  admin: {
    label: 'Admin',
    description: 'Full access except ownership transfer',
    icon: ShieldCheck,
    color: 'bg-purple-100 text-purple-700 border-purple-200',
    priority: 2,
  },
  editor: {
    label: 'Editor',
    description: 'Can view and edit content',
    icon: Edit3,
    color: 'bg-blue-100 text-blue-700 border-blue-200',
    priority: 3,
  },
  viewer: {
    label: 'Viewer',
    description: 'Read-only access',
    icon: Eye,
    color: 'bg-gray-100 text-gray-700 border-gray-200',
    priority: 4,
  },
};

const INVITATION_STATUS_CONFIG: Record<InvitationStatus, {
  label: string;
  color: string;
  icon: React.ComponentType<{ className?: string }>;
}> = {
  pending: { label: 'Pending', color: 'bg-yellow-100 text-yellow-700', icon: Clock },
  accepted: { label: 'Accepted', color: 'bg-green-100 text-green-700', icon: CheckCircle },
  declined: { label: 'Declined', color: 'bg-red-100 text-red-700', icon: XCircle },
  expired: { label: 'Expired', color: 'bg-gray-100 text-gray-700', icon: AlertCircle },
  revoked: { label: 'Revoked', color: 'bg-orange-100 text-orange-700', icon: XCircle },
};

const PACKAGE_STATUS_CONFIG: Record<HandoffPackageStatus, {
  label: string;
  color: string;
  icon: React.ComponentType<{ className?: string }>;
}> = {
  draft: { label: 'Draft', color: 'bg-gray-100 text-gray-700', icon: Edit3 },
  pending_review: { label: 'Pending Review', color: 'bg-yellow-100 text-yellow-700', icon: Clock },
  approved: { label: 'Approved', color: 'bg-blue-100 text-blue-700', icon: CheckCircle },
  delivered: { label: 'Delivered', color: 'bg-green-100 text-green-700', icon: PackageCheck },
  archived: { label: 'Archived', color: 'bg-gray-100 text-gray-700', icon: FolderOpen },
};

const ARTIFACT_TYPE_CONFIG: Record<string, {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
}> = {
  dataset: { label: 'Dataset', icon: FolderOpen, color: 'text-blue-600' },
  analysis: { label: 'Analysis', icon: RefreshCcw, color: 'text-purple-600' },
  document: { label: 'Document', icon: FileText, color: 'text-green-600' },
  visualization: { label: 'Visualization', icon: Eye, color: 'text-orange-600' },
  code: { label: 'Code', icon: Settings, color: 'text-gray-600' },
  model: { label: 'Model', icon: Package, color: 'text-pink-600' },
  other: { label: 'Other', icon: FileText, color: 'text-gray-500' },
};

const AUDIT_ACTION_CONFIG: Record<AuditActionType, {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
}> = {
  collaborator_invited: { label: 'Invited collaborator', icon: UserPlus, color: 'text-blue-600' },
  collaborator_added: { label: 'Collaborator joined', icon: UserCheck, color: 'text-green-600' },
  collaborator_removed: { label: 'Removed collaborator', icon: UserMinus, color: 'text-red-600' },
  role_changed: { label: 'Role changed', icon: Shield, color: 'text-purple-600' },
  permission_granted: { label: 'Permission granted', icon: Unlock, color: 'text-green-600' },
  permission_revoked: { label: 'Permission revoked', icon: Lock, color: 'text-orange-600' },
  package_created: { label: 'Package created', icon: PackagePlus, color: 'text-blue-600' },
  package_updated: { label: 'Package updated', icon: Package, color: 'text-blue-600' },
  package_delivered: { label: 'Package delivered', icon: PackageCheck, color: 'text-green-600' },
  ownership_transferred: { label: 'Ownership transferred', icon: ArrowRightLeft, color: 'text-amber-600' },
  agreement_signed: { label: 'Agreement signed', icon: FileText, color: 'text-green-600' },
  agreement_declined: { label: 'Agreement declined', icon: XCircle, color: 'text-red-600' },
  phi_access_granted: { label: 'PHI access granted', icon: ShieldCheck, color: 'text-green-600' },
  phi_access_revoked: { label: 'PHI access revoked', icon: ShieldAlert, color: 'text-red-600' },
};

const DEFAULT_PERMISSIONS: PermissionMatrix['permissions'] = {
  viewResearch: true,
  editResearch: false,
  viewData: false,
  editData: false,
  viewAnalysis: true,
  editAnalysis: false,
  viewDocuments: true,
  editDocuments: false,
  exportData: false,
  manageCollaborators: false,
  deleteContent: false,
  transferOwnership: false,
};

const ROLE_DEFAULT_PERMISSIONS: Record<CollaboratorRole, PermissionMatrix['permissions']> = {
  owner: {
    viewResearch: true,
    editResearch: true,
    viewData: true,
    editData: true,
    viewAnalysis: true,
    editAnalysis: true,
    viewDocuments: true,
    editDocuments: true,
    exportData: true,
    manageCollaborators: true,
    deleteContent: true,
    transferOwnership: true,
  },
  admin: {
    viewResearch: true,
    editResearch: true,
    viewData: true,
    editData: true,
    viewAnalysis: true,
    editAnalysis: true,
    viewDocuments: true,
    editDocuments: true,
    exportData: true,
    manageCollaborators: true,
    deleteContent: true,
    transferOwnership: false,
  },
  editor: {
    viewResearch: true,
    editResearch: true,
    viewData: true,
    editData: true,
    viewAnalysis: true,
    editAnalysis: true,
    viewDocuments: true,
    editDocuments: true,
    exportData: false,
    manageCollaborators: false,
    deleteContent: false,
    transferOwnership: false,
  },
  viewer: {
    viewResearch: true,
    editResearch: false,
    viewData: true,
    editData: false,
    viewAnalysis: true,
    editAnalysis: false,
    viewDocuments: true,
    editDocuments: false,
    exportData: false,
    manageCollaborators: false,
    deleteContent: false,
    transferOwnership: false,
  },
};

// ==================== Main Component ====================

export function Stage16CollaborationHandoff({
  topicId,
  researchId,
  stageData,
  onComplete,
  onSave,
  isReadOnly = false,
  currentUserId,
  currentUserName,
  currentUserRole,
  onSearchUsers,
  onGetSuggestions,
  onSendInvitation,
  onUploadPackage,
  onSendPhiAgreement,
  isProcessing = false,
  className,
}: Stage16Props) {
  // State initialization
  const [collaborators, setCollaborators] = useState<Collaborator[]>(stageData?.collaborators || []);
  const [permissionMatrix, setPermissionMatrix] = useState<PermissionMatrix[]>(stageData?.permissionMatrix || []);
  const [handoffPackages, setHandoffPackages] = useState<HandoffPackage[]>(stageData?.handoffPackages || []);
  const [accessGrants, setAccessGrants] = useState<AccessGrant[]>(stageData?.accessGrants || []);
  const [phiAgreements, setPhiAgreements] = useState<PhiAgreement[]>(stageData?.phiAgreements || []);
  const [auditLog, setAuditLog] = useState<AuditLogEntry[]>(stageData?.auditLog || []);
  const [pendingTransfer, setPendingTransfer] = useState<OwnershipTransfer | undefined>(stageData?.pendingTransfer);
  const [availableArtifacts, setAvailableArtifacts] = useState<HandoffArtifact[]>(stageData?.availableArtifacts || []);

  // UI State
  const [selectedTab, setSelectedTab] = useState('collaborators');
  const [isInviteDialogOpen, setIsInviteDialogOpen] = useState(false);
  const [isPackageDialogOpen, setIsPackageDialogOpen] = useState(false);
  const [isTransferDialogOpen, setIsTransferDialogOpen] = useState(false);
  const [isAgreementDialogOpen, setIsAgreementDialogOpen] = useState(false);
  const [selectedCollaborator, setSelectedCollaborator] = useState<Collaborator | null>(null);
  const [selectedPackage, setSelectedPackage] = useState<HandoffPackage | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState<CollaboratorSuggestion[]>([]);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);

  // Computed values
  const activeCollaborators = useMemo(() => {
    return collaborators.filter(c => c.invitationStatus === 'accepted');
  }, [collaborators]);

  const pendingInvitations = useMemo(() => {
    return collaborators.filter(c => c.invitationStatus === 'pending');
  }, [collaborators]);

  const collaboratorStats = useMemo(() => {
    return {
      total: collaborators.length,
      active: activeCollaborators.length,
      pending: pendingInvitations.length,
      withPhiAccess: collaborators.filter(c => c.phiAccessGranted).length,
      owners: collaborators.filter(c => c.role === 'owner').length,
      admins: collaborators.filter(c => c.role === 'admin').length,
      editors: collaborators.filter(c => c.role === 'editor').length,
      viewers: collaborators.filter(c => c.role === 'viewer').length,
    };
  }, [collaborators, activeCollaborators, pendingInvitations]);

  const packageStats = useMemo(() => {
    return {
      total: handoffPackages.length,
      draft: handoffPackages.filter(p => p.status === 'draft').length,
      delivered: handoffPackages.filter(p => p.status === 'delivered').length,
      totalDownloads: handoffPackages.reduce((sum, p) => sum + p.downloadCount, 0),
    };
  }, [handoffPackages]);

  // Helper to add audit log entry
  const addAuditEntry = useCallback((
    actionType: AuditActionType,
    description: string,
    targetUserId?: string,
    targetUserName?: string,
    metadata?: Record<string, unknown>
  ) => {
    const entry: AuditLogEntry = {
      id: crypto.randomUUID(),
      actionType,
      timestamp: new Date(),
      userId: currentUserId,
      userName: currentUserName,
      targetUserId,
      targetUserName,
      description,
      metadata,
    };
    setAuditLog(prev => [entry, ...prev]);
  }, [currentUserId, currentUserName]);

  // Save state helper
  const saveState = useCallback(() => {
    if (onSave) {
      onSave({
        collaborators,
        permissionMatrix,
        handoffPackages,
        accessGrants,
        phiAgreements,
        auditLog,
        pendingTransfer,
        availableArtifacts,
      });
    }
  }, [collaborators, permissionMatrix, handoffPackages, accessGrants, phiAgreements, auditLog, pendingTransfer, availableArtifacts, onSave]);

  // Collaborator management
  const inviteCollaborator = useCallback(async (
    email: string,
    name: string,
    role: CollaboratorRole,
    message?: string
  ) => {
    const newCollaborator: Collaborator = {
      id: crypto.randomUUID(),
      email,
      name,
      role,
      invitationStatus: 'pending',
      invitedAt: new Date(),
      invitedBy: currentUserId,
      phiAccessGranted: false,
      phiAgreementSigned: false,
    };

    setCollaborators(prev => [...prev, newCollaborator]);

    // Create default permissions based on role
    const newPermission: PermissionMatrix = {
      collaboratorId: newCollaborator.id,
      permissions: { ...ROLE_DEFAULT_PERMISSIONS[role] },
    };
    setPermissionMatrix(prev => [...prev, newPermission]);

    addAuditEntry(
      'collaborator_invited',
      `Invited ${name} (${email}) as ${ROLE_CONFIG[role].label}`,
      newCollaborator.id,
      name
    );

    if (onSendInvitation) {
      await onSendInvitation(email, role, message);
    }

    saveState();
  }, [currentUserId, addAuditEntry, onSendInvitation, saveState]);

  const removeCollaborator = useCallback((collaboratorId: string) => {
    const collaborator = collaborators.find(c => c.id === collaboratorId);
    if (!collaborator) return;

    setCollaborators(prev => prev.filter(c => c.id !== collaboratorId));
    setPermissionMatrix(prev => prev.filter(p => p.collaboratorId !== collaboratorId));
    setAccessGrants(prev => prev.map(g =>
      g.collaboratorId === collaboratorId ? { ...g, status: 'revoked' as AccessGrantStatus, revokedAt: new Date(), revokedBy: currentUserId } : g
    ));

    addAuditEntry(
      'collaborator_removed',
      `Removed ${collaborator.name} (${collaborator.email})`,
      collaboratorId,
      collaborator.name
    );

    saveState();
  }, [collaborators, currentUserId, addAuditEntry, saveState]);

  const updateCollaboratorRole = useCallback((collaboratorId: string, newRole: CollaboratorRole) => {
    const collaborator = collaborators.find(c => c.id === collaboratorId);
    if (!collaborator) return;

    const oldRole = collaborator.role;
    setCollaborators(prev => prev.map(c =>
      c.id === collaboratorId ? { ...c, role: newRole } : c
    ));

    // Update permissions based on new role
    setPermissionMatrix(prev => prev.map(p =>
      p.collaboratorId === collaboratorId
        ? { ...p, permissions: { ...ROLE_DEFAULT_PERMISSIONS[newRole] } }
        : p
    ));

    addAuditEntry(
      'role_changed',
      `Changed ${collaborator.name}'s role from ${ROLE_CONFIG[oldRole].label} to ${ROLE_CONFIG[newRole].label}`,
      collaboratorId,
      collaborator.name,
      { oldRole, newRole }
    );

    saveState();
  }, [collaborators, addAuditEntry, saveState]);

  // Permission management
  const updatePermission = useCallback((
    collaboratorId: string,
    permissionKey: keyof PermissionMatrix['permissions'],
    value: boolean
  ) => {
    setPermissionMatrix(prev => prev.map(p =>
      p.collaboratorId === collaboratorId
        ? { ...p, permissions: { ...p.permissions, [permissionKey]: value } }
        : p
    ));

    const collaborator = collaborators.find(c => c.id === collaboratorId);
    if (collaborator) {
      addAuditEntry(
        value ? 'permission_granted' : 'permission_revoked',
        `${value ? 'Granted' : 'Revoked'} ${permissionKey} permission for ${collaborator.name}`,
        collaboratorId,
        collaborator.name,
        { permission: permissionKey, value }
      );
    }

    saveState();
  }, [collaborators, addAuditEntry, saveState]);

  // Handoff package management
  const createPackage = useCallback((
    name: string,
    description: string,
    artifactIds: string[],
    recipientIds: string[]
  ) => {
    const selectedArtifacts = availableArtifacts.filter(a => artifactIds.includes(a.id));

    const newPackage: HandoffPackage = {
      id: crypto.randomUUID(),
      name,
      description,
      status: 'draft',
      artifacts: selectedArtifacts.map(a => ({ ...a, included: true })),
      recipients: recipientIds,
      createdAt: new Date(),
      createdBy: currentUserId,
      updatedAt: new Date(),
      downloadCount: 0,
    };

    setHandoffPackages(prev => [...prev, newPackage]);

    addAuditEntry(
      'package_created',
      `Created handoff package "${name}" with ${selectedArtifacts.length} artifacts`,
      undefined,
      undefined,
      { packageId: newPackage.id, artifactCount: selectedArtifacts.length }
    );

    saveState();
    return newPackage;
  }, [availableArtifacts, currentUserId, addAuditEntry, saveState]);

  const updatePackageStatus = useCallback((packageId: string, status: HandoffPackageStatus) => {
    const pkg = handoffPackages.find(p => p.id === packageId);
    if (!pkg) return;

    setHandoffPackages(prev => prev.map(p =>
      p.id === packageId
        ? { ...p, status, updatedAt: new Date(), deliveredAt: status === 'delivered' ? new Date() : p.deliveredAt }
        : p
    ));

    if (status === 'delivered') {
      // Create access grants for recipients
      pkg.recipients.forEach(recipientId => {
        const grant: AccessGrant = {
          id: crypto.randomUUID(),
          collaboratorId: recipientId,
          packageId,
          resourceType: 'package',
          status: 'active',
          grantedAt: new Date(),
          grantedBy: currentUserId,
        };
        setAccessGrants(prev => [...prev, grant]);
      });

      addAuditEntry(
        'package_delivered',
        `Delivered handoff package "${pkg.name}" to ${pkg.recipients.length} recipient(s)`,
        undefined,
        undefined,
        { packageId, recipientCount: pkg.recipients.length }
      );
    } else {
      addAuditEntry(
        'package_updated',
        `Updated package "${pkg.name}" status to ${PACKAGE_STATUS_CONFIG[status].label}`,
        undefined,
        undefined,
        { packageId, status }
      );
    }

    saveState();
  }, [handoffPackages, currentUserId, addAuditEntry, saveState]);

  // PHI access management
  const grantPhiAccess = useCallback(async (collaboratorId: string) => {
    const collaborator = collaborators.find(c => c.id === collaboratorId);
    if (!collaborator) return;

    // Check if agreement is signed
    const agreement = phiAgreements.find(a => a.collaboratorId === collaboratorId && a.status === 'signed');
    if (!agreement) {
      // Need to send agreement first
      if (onSendPhiAgreement) {
        await onSendPhiAgreement(collaboratorId);
      }
      return;
    }

    setCollaborators(prev => prev.map(c =>
      c.id === collaboratorId ? { ...c, phiAccessGranted: true } : c
    ));

    addAuditEntry(
      'phi_access_granted',
      `Granted PHI access to ${collaborator.name}`,
      collaboratorId,
      collaborator.name
    );

    saveState();
  }, [collaborators, phiAgreements, onSendPhiAgreement, addAuditEntry, saveState]);

  const revokePhiAccess = useCallback((collaboratorId: string) => {
    const collaborator = collaborators.find(c => c.id === collaboratorId);
    if (!collaborator) return;

    setCollaborators(prev => prev.map(c =>
      c.id === collaboratorId ? { ...c, phiAccessGranted: false } : c
    ));

    addAuditEntry(
      'phi_access_revoked',
      `Revoked PHI access from ${collaborator.name}`,
      collaboratorId,
      collaborator.name
    );

    saveState();
  }, [collaborators, addAuditEntry, saveState]);

  // Ownership transfer
  const initiateTransfer = useCallback((toCollaboratorId: string) => {
    const toCollaborator = collaborators.find(c => c.id === toCollaboratorId);
    if (!toCollaborator) return;

    const transfer: OwnershipTransfer = {
      id: crypto.randomUUID(),
      fromUserId: currentUserId,
      fromUserName: currentUserName,
      toUserId: toCollaboratorId,
      toUserName: toCollaborator.name,
      status: 'pending',
      initiatedAt: new Date(),
      acknowledgements: {
        dataResponsibility: false,
        complianceResponsibility: false,
        irrevocable: false,
      },
    };

    setPendingTransfer(transfer);
    saveState();
  }, [collaborators, currentUserId, currentUserName, saveState]);

  const completeTransfer = useCallback(() => {
    if (!pendingTransfer || pendingTransfer.status !== 'pending') return;

    // Update roles
    setCollaborators(prev => prev.map(c => {
      if (c.id === pendingTransfer.fromUserId || c.email === currentUserId) {
        return { ...c, role: 'admin' as CollaboratorRole };
      }
      if (c.id === pendingTransfer.toUserId) {
        return { ...c, role: 'owner' as CollaboratorRole };
      }
      return c;
    }));

    // Update permissions
    setPermissionMatrix(prev => prev.map(p => {
      if (p.collaboratorId === pendingTransfer.toUserId) {
        return { ...p, permissions: { ...ROLE_DEFAULT_PERMISSIONS.owner } };
      }
      if (p.collaboratorId === pendingTransfer.fromUserId) {
        return { ...p, permissions: { ...ROLE_DEFAULT_PERMISSIONS.admin } };
      }
      return p;
    }));

    setPendingTransfer({
      ...pendingTransfer,
      status: 'accepted',
      completedAt: new Date(),
    });

    addAuditEntry(
      'ownership_transferred',
      `Transferred ownership from ${pendingTransfer.fromUserName} to ${pendingTransfer.toUserName}`,
      pendingTransfer.toUserId,
      pendingTransfer.toUserName,
      { transferId: pendingTransfer.id }
    );

    saveState();
  }, [pendingTransfer, currentUserId, addAuditEntry, saveState]);

  // AI suggestions
  const loadSuggestions = useCallback(async (domain: string) => {
    if (!onGetSuggestions) return;

    setIsLoadingSuggestions(true);
    try {
      const results = await onGetSuggestions(domain);
      setSuggestions(results);
    } finally {
      setIsLoadingSuggestions(false);
    }
  }, [onGetSuggestions]);

  // Get permissions for a collaborator
  const getPermissions = useCallback((collaboratorId: string): PermissionMatrix['permissions'] => {
    const matrix = permissionMatrix.find(p => p.collaboratorId === collaboratorId);
    return matrix?.permissions || { ...DEFAULT_PERMISSIONS };
  }, [permissionMatrix]);

  const canManageCollaborators = currentUserRole === 'owner' || currentUserRole === 'admin';
  const canTransferOwnership = currentUserRole === 'owner';

  return (
    <div className={cn('space-y-6', className)}>
      {/* PHI Warning Alert */}
      {collaboratorStats.withPhiAccess > 0 && (
        <Alert>
          <ShieldAlert className="h-4 w-4" />
          <AlertTitle>PHI Access Active</AlertTitle>
          <AlertDescription>
            {collaboratorStats.withPhiAccess} collaborator(s) have PHI access. Ensure all PHI agreements are current and access is appropriate.
          </AlertDescription>
        </Alert>
      )}

      {/* Pending Transfer Alert */}
      {pendingTransfer && pendingTransfer.status === 'pending' && (
        <Alert variant="destructive">
          <ArrowRightLeft className="h-4 w-4" />
          <AlertTitle>Ownership Transfer Pending</AlertTitle>
          <AlertDescription>
            Transfer from {pendingTransfer.fromUserName} to {pendingTransfer.toUserName} is awaiting completion.
          </AlertDescription>
        </Alert>
      )}

      {/* Header Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Users className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle>Collaboration Handoff</CardTitle>
                <CardDescription>
                  Transfer ownership and provide access to collaborators
                </CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="flex items-center gap-1">
                <Users className="h-3 w-3" />
                {collaboratorStats.active} Active
              </Badge>
              {collaboratorStats.pending > 0 && (
                <Badge className="bg-yellow-100 text-yellow-700">
                  <Clock className="mr-1 h-3 w-3" />
                  {collaboratorStats.pending} Pending
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Quick Stats */}
          <div className="grid grid-cols-4 gap-4">
            <QuickStat
              label="Collaborators"
              value={collaboratorStats.active}
              total={collaboratorStats.total}
              icon={Users}
              color="text-blue-600"
            />
            <QuickStat
              label="PHI Access"
              value={collaboratorStats.withPhiAccess}
              icon={ShieldCheck}
              color="text-green-600"
            />
            <QuickStat
              label="Packages"
              value={packageStats.delivered}
              total={packageStats.total}
              icon={Package}
              color="text-purple-600"
            />
            <QuickStat
              label="Downloads"
              value={packageStats.totalDownloads}
              icon={Download}
              color="text-orange-600"
            />
          </div>

          {/* Action Buttons */}
          {!isReadOnly && canManageCollaborators && (
            <div className="flex items-center gap-2 mt-4">
              <Button onClick={() => setIsInviteDialogOpen(true)}>
                <UserPlus className="mr-2 h-4 w-4" />
                Invite Collaborator
              </Button>
              <Button variant="outline" onClick={() => setIsPackageDialogOpen(true)}>
                <PackagePlus className="mr-2 h-4 w-4" />
                Create Package
              </Button>
              {canTransferOwnership && (
                <Button variant="outline" onClick={() => setIsTransferDialogOpen(true)}>
                  <ArrowRightLeft className="mr-2 h-4 w-4" />
                  Transfer Ownership
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Main Tabs */}
      <Tabs value={selectedTab} onValueChange={setSelectedTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="collaborators">
            <Users className="mr-2 h-4 w-4" />
            Collaborators
          </TabsTrigger>
          <TabsTrigger value="permissions">
            <Shield className="mr-2 h-4 w-4" />
            Permissions
          </TabsTrigger>
          <TabsTrigger value="packages">
            <Package className="mr-2 h-4 w-4" />
            Packages
          </TabsTrigger>
          <TabsTrigger value="activity">
            <History className="mr-2 h-4 w-4" />
            Activity
          </TabsTrigger>
        </TabsList>

        {/* Collaborators Tab */}
        <TabsContent value="collaborators" className="mt-4">
          <CollaboratorsPanel
            collaborators={collaborators}
            pendingInvitations={pendingInvitations}
            suggestions={suggestions}
            isLoadingSuggestions={isLoadingSuggestions}
            onLoadSuggestions={loadSuggestions}
            onInvite={inviteCollaborator}
            onRemove={removeCollaborator}
            onUpdateRole={updateCollaboratorRole}
            onGrantPhiAccess={grantPhiAccess}
            onRevokePhiAccess={revokePhiAccess}
            onOpenAgreement={(c) => {
              setSelectedCollaborator(c);
              setIsAgreementDialogOpen(true);
            }}
            canManage={canManageCollaborators && !isReadOnly}
            isReadOnly={isReadOnly}
          />
        </TabsContent>

        {/* Permissions Tab */}
        <TabsContent value="permissions" className="mt-4">
          <PermissionsPanel
            collaborators={activeCollaborators}
            permissionMatrix={permissionMatrix}
            onUpdatePermission={updatePermission}
            canManage={canManageCollaborators && !isReadOnly}
            isReadOnly={isReadOnly}
          />
        </TabsContent>

        {/* Packages Tab */}
        <TabsContent value="packages" className="mt-4">
          <PackagesPanel
            packages={handoffPackages}
            collaborators={activeCollaborators}
            availableArtifacts={availableArtifacts}
            onCreatePackage={createPackage}
            onUpdateStatus={updatePackageStatus}
            onSelectPackage={(p) => {
              setSelectedPackage(p);
              setIsPackageDialogOpen(true);
            }}
            canManage={canManageCollaborators && !isReadOnly}
            isReadOnly={isReadOnly}
          />
        </TabsContent>

        {/* Activity Tab */}
        <TabsContent value="activity" className="mt-4">
          <ActivityPanel auditLog={auditLog} collaborators={collaborators} />
        </TabsContent>
      </Tabs>

      {/* Invite Dialog */}
      <InviteCollaboratorDialog
        open={isInviteDialogOpen}
        onOpenChange={setIsInviteDialogOpen}
        onInvite={inviteCollaborator}
        onSearch={onSearchUsers}
        suggestions={suggestions}
        existingEmails={collaborators.map(c => c.email)}
      />

      {/* Package Dialog */}
      <CreatePackageDialog
        open={isPackageDialogOpen}
        onOpenChange={setIsPackageDialogOpen}
        selectedPackage={selectedPackage}
        onClearSelection={() => setSelectedPackage(null)}
        availableArtifacts={availableArtifacts}
        collaborators={activeCollaborators}
        onCreate={createPackage}
        onUpdateStatus={updatePackageStatus}
      />

      {/* Transfer Dialog */}
      <TransferOwnershipDialog
        open={isTransferDialogOpen}
        onOpenChange={setIsTransferDialogOpen}
        collaborators={activeCollaborators.filter(c => c.role !== 'owner')}
        pendingTransfer={pendingTransfer}
        onInitiate={initiateTransfer}
        onComplete={completeTransfer}
        onCancel={() => setPendingTransfer(undefined)}
      />

      {/* PHI Agreement Dialog */}
      <PhiAgreementDialog
        open={isAgreementDialogOpen}
        onOpenChange={setIsAgreementDialogOpen}
        collaborator={selectedCollaborator}
        agreement={selectedCollaborator ? phiAgreements.find(a => a.collaboratorId === selectedCollaborator.id) : undefined}
        onSend={onSendPhiAgreement}
      />
    </div>
  );
}

// ==================== Sub-Components ====================

// Quick Stat Display
function QuickStat({
  label,
  value,
  total,
  icon: Icon,
  color,
}: {
  label: string;
  value: number;
  total?: number;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
}) {
  return (
    <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
      <div className={cn('p-2 rounded-lg bg-background', color)}>
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <p className={cn('text-2xl font-bold', color)}>
          {value}
          {total !== undefined && <span className="text-sm text-muted-foreground font-normal">/{total}</span>}
        </p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

// Collaborators Panel
function CollaboratorsPanel({
  collaborators,
  pendingInvitations,
  suggestions,
  isLoadingSuggestions,
  onLoadSuggestions,
  onInvite,
  onRemove,
  onUpdateRole,
  onGrantPhiAccess,
  onRevokePhiAccess,
  onOpenAgreement,
  canManage,
  isReadOnly,
}: {
  collaborators: Collaborator[];
  pendingInvitations: Collaborator[];
  suggestions: CollaboratorSuggestion[];
  isLoadingSuggestions: boolean;
  onLoadSuggestions: (domain: string) => void;
  onInvite: (email: string, name: string, role: CollaboratorRole, message?: string) => void;
  onRemove: (collaboratorId: string) => void;
  onUpdateRole: (collaboratorId: string, role: CollaboratorRole) => void;
  onGrantPhiAccess: (collaboratorId: string) => void;
  onRevokePhiAccess: (collaboratorId: string) => void;
  onOpenAgreement: (collaborator: Collaborator) => void;
  canManage: boolean;
  isReadOnly: boolean;
}) {
  const activeCollaborators = collaborators.filter(c => c.invitationStatus === 'accepted');

  return (
    <div className="space-y-4">
      {/* AI Suggestions Section */}
      {canManage && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-purple-600" />
                <CardTitle className="text-base">AI-Suggested Collaborators</CardTitle>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onLoadSuggestions('biomedical research')}
                disabled={isLoadingSuggestions}
              >
                {isLoadingSuggestions ? (
                  <RefreshCcw className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="mr-2 h-4 w-4" />
                )}
                Get Suggestions
              </Button>
            </div>
            <CardDescription>
              Based on your research domain and existing collaboration network
            </CardDescription>
          </CardHeader>
          {suggestions.length > 0 && (
            <CardContent>
              <ScrollArea className="max-h-48">
                <div className="space-y-2">
                  {suggestions.map(suggestion => (
                    <div
                      key={suggestion.id}
                      className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10">
                          <AvatarFallback>{suggestion.name.substring(0, 2).toUpperCase()}</AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium">{suggestion.name}</p>
                          <p className="text-sm text-muted-foreground">{suggestion.email}</p>
                          {suggestion.institution && (
                            <p className="text-xs text-muted-foreground">{suggestion.institution}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">
                          {Math.round(suggestion.matchScore * 100)}% match
                        </Badge>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                size="sm"
                                onClick={() => onInvite(suggestion.email, suggestion.name, 'viewer')}
                              >
                                <UserPlus className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>{suggestion.matchReason}</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          )}
        </Card>
      )}

      {/* Pending Invitations */}
      {pendingInvitations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="h-5 w-5 text-yellow-600" />
              Pending Invitations ({pendingInvitations.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {pendingInvitations.map(collaborator => (
                <CollaboratorCard
                  key={collaborator.id}
                  collaborator={collaborator}
                  onRemove={onRemove}
                  onUpdateRole={onUpdateRole}
                  canManage={canManage}
                  isPending
                />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Active Collaborators */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-5 w-5" />
            Active Collaborators ({activeCollaborators.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="max-h-[400px]">
            <div className="space-y-3">
              {activeCollaborators.map(collaborator => (
                <CollaboratorCard
                  key={collaborator.id}
                  collaborator={collaborator}
                  onRemove={onRemove}
                  onUpdateRole={onUpdateRole}
                  onGrantPhiAccess={onGrantPhiAccess}
                  onRevokePhiAccess={onRevokePhiAccess}
                  onOpenAgreement={onOpenAgreement}
                  canManage={canManage}
                />
              ))}
              {activeCollaborators.length === 0 && (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <Users className="h-12 w-12 mb-4 opacity-50" />
                  <p>No active collaborators</p>
                  <p className="text-sm">Invite collaborators to get started</p>
                </div>
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}

// Collaborator Card
function CollaboratorCard({
  collaborator,
  onRemove,
  onUpdateRole,
  onGrantPhiAccess,
  onRevokePhiAccess,
  onOpenAgreement,
  canManage,
  isPending = false,
}: {
  collaborator: Collaborator;
  onRemove: (id: string) => void;
  onUpdateRole: (id: string, role: CollaboratorRole) => void;
  onGrantPhiAccess?: (id: string) => void;
  onRevokePhiAccess?: (id: string) => void;
  onOpenAgreement?: (c: Collaborator) => void;
  canManage: boolean;
  isPending?: boolean;
}) {
  const roleConfig = ROLE_CONFIG[collaborator.role];
  const statusConfig = INVITATION_STATUS_CONFIG[collaborator.invitationStatus];
  const RoleIcon = roleConfig.icon;
  const StatusIcon = statusConfig.icon;

  return (
    <Card className={cn(isPending && 'border-dashed')}>
      <CardContent className="py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Avatar className="h-10 w-10">
              <AvatarImage src={collaborator.avatarUrl} />
              <AvatarFallback className={cn(roleConfig.color)}>
                {collaborator.name.substring(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div>
              <div className="flex items-center gap-2">
                <p className="font-medium">{collaborator.name}</p>
                <Badge className={cn('text-xs', roleConfig.color)}>
                  <RoleIcon className="mr-1 h-3 w-3" />
                  {roleConfig.label}
                </Badge>
                {isPending && (
                  <Badge className={cn('text-xs', statusConfig.color)}>
                    <StatusIcon className="mr-1 h-3 w-3" />
                    {statusConfig.label}
                  </Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground">{collaborator.email}</p>
              {collaborator.institution && (
                <p className="text-xs text-muted-foreground">{collaborator.institution}</p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {!isPending && (
              <>
                {collaborator.phiAccessGranted ? (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Badge className="bg-green-100 text-green-700">
                          <ShieldCheck className="mr-1 h-3 w-3" />
                          PHI Access
                        </Badge>
                      </TooltipTrigger>
                      <TooltipContent>Has signed PHI agreement and been granted access</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                ) : collaborator.phiAgreementSigned ? (
                  <Badge className="bg-yellow-100 text-yellow-700">
                    <FileText className="mr-1 h-3 w-3" />
                    Agreement Signed
                  </Badge>
                ) : null}
              </>
            )}

            {canManage && collaborator.role !== 'owner' && (
              <div className="flex items-center gap-1">
                {!isPending && onGrantPhiAccess && onRevokePhiAccess && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() =>
                            collaborator.phiAccessGranted
                              ? onRevokePhiAccess(collaborator.id)
                              : onOpenAgreement?.(collaborator)
                          }
                        >
                          {collaborator.phiAccessGranted ? (
                            <ShieldAlert className="h-4 w-4 text-orange-600" />
                          ) : (
                            <Shield className="h-4 w-4" />
                          )}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        {collaborator.phiAccessGranted ? 'Revoke PHI Access' : 'Manage PHI Access'}
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}

                <Select
                  value={collaborator.role}
                  onValueChange={(v) => onUpdateRole(collaborator.id, v as CollaboratorRole)}
                >
                  <SelectTrigger className="h-8 w-24">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="viewer">Viewer</SelectItem>
                    <SelectItem value="editor">Editor</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>

                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive"
                        onClick={() => onRemove(collaborator.id)}
                      >
                        <UserMinus className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Remove collaborator</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Permissions Panel
function PermissionsPanel({
  collaborators,
  permissionMatrix,
  onUpdatePermission,
  canManage,
  isReadOnly,
}: {
  collaborators: Collaborator[];
  permissionMatrix: PermissionMatrix[];
  onUpdatePermission: (collaboratorId: string, key: keyof PermissionMatrix['permissions'], value: boolean) => void;
  canManage: boolean;
  isReadOnly: boolean;
}) {
  const permissionKeys: Array<{ key: keyof PermissionMatrix['permissions']; label: string; category: string }> = [
    { key: 'viewResearch', label: 'View Research', category: 'Research' },
    { key: 'editResearch', label: 'Edit Research', category: 'Research' },
    { key: 'viewData', label: 'View Data', category: 'Data' },
    { key: 'editData', label: 'Edit Data', category: 'Data' },
    { key: 'viewAnalysis', label: 'View Analysis', category: 'Analysis' },
    { key: 'editAnalysis', label: 'Edit Analysis', category: 'Analysis' },
    { key: 'viewDocuments', label: 'View Documents', category: 'Documents' },
    { key: 'editDocuments', label: 'Edit Documents', category: 'Documents' },
    { key: 'exportData', label: 'Export Data', category: 'Admin' },
    { key: 'manageCollaborators', label: 'Manage Collaborators', category: 'Admin' },
    { key: 'deleteContent', label: 'Delete Content', category: 'Admin' },
    { key: 'transferOwnership', label: 'Transfer Ownership', category: 'Admin' },
  ];

  const getPermissions = (collaboratorId: string) => {
    const matrix = permissionMatrix.find(p => p.collaboratorId === collaboratorId);
    return matrix?.permissions || { ...DEFAULT_PERMISSIONS };
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Shield className="h-5 w-5" />
          Permission Matrix
        </CardTitle>
        <CardDescription>
          Configure granular permissions for each collaborator
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ScrollArea className="w-full">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-48">Collaborator</TableHead>
                {permissionKeys.map(({ key, label }) => (
                  <TableHead key={key} className="text-center w-24">
                    <span className="text-xs">{label}</span>
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {collaborators.map(collaborator => {
                const permissions = getPermissions(collaborator.id);
                const roleConfig = ROLE_CONFIG[collaborator.role];

                return (
                  <TableRow key={collaborator.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className={cn('text-xs', roleConfig.color)}>
                            {collaborator.name.substring(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="text-sm font-medium">{collaborator.name}</p>
                          <Badge className={cn('text-xs', roleConfig.color)}>
                            {roleConfig.label}
                          </Badge>
                        </div>
                      </div>
                    </TableCell>
                    {permissionKeys.map(({ key }) => (
                      <TableCell key={key} className="text-center">
                        <Checkbox
                          checked={permissions[key]}
                          onCheckedChange={(checked) =>
                            onUpdatePermission(collaborator.id, key, !!checked)
                          }
                          disabled={!canManage || isReadOnly || collaborator.role === 'owner'}
                        />
                      </TableCell>
                    ))}
                  </TableRow>
                );
              })}
              {collaborators.length === 0 && (
                <TableRow>
                  <TableCell colSpan={permissionKeys.length + 1} className="text-center py-8 text-muted-foreground">
                    No collaborators to configure
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

// Packages Panel
function PackagesPanel({
  packages,
  collaborators,
  availableArtifacts,
  onCreatePackage,
  onUpdateStatus,
  onSelectPackage,
  canManage,
  isReadOnly,
}: {
  packages: HandoffPackage[];
  collaborators: Collaborator[];
  availableArtifacts: HandoffArtifact[];
  onCreatePackage: (name: string, description: string, artifactIds: string[], recipientIds: string[]) => HandoffPackage;
  onUpdateStatus: (packageId: string, status: HandoffPackageStatus) => void;
  onSelectPackage: (pkg: HandoffPackage) => void;
  canManage: boolean;
  isReadOnly: boolean;
}) {
  return (
    <div className="space-y-4">
      {/* Package List */}
      <div className="grid gap-4 md:grid-cols-2">
        {packages.map(pkg => {
          const statusConfig = PACKAGE_STATUS_CONFIG[pkg.status];
          const StatusIcon = statusConfig.icon;
          const recipientNames = pkg.recipients
            .map(id => collaborators.find(c => c.id === id)?.name || 'Unknown')
            .join(', ');

          return (
            <Card key={pkg.id} className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => onSelectPackage(pkg)}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Package className="h-5 w-5 text-primary" />
                    <CardTitle className="text-base">{pkg.name}</CardTitle>
                  </div>
                  <Badge className={cn('text-xs', statusConfig.color)}>
                    <StatusIcon className="mr-1 h-3 w-3" />
                    {statusConfig.label}
                  </Badge>
                </div>
                <CardDescription>{pkg.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Artifacts</span>
                    <span className="font-medium">{pkg.artifacts.length}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Recipients</span>
                    <span className="font-medium">{pkg.recipients.length}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Downloads</span>
                    <span className="font-medium">{pkg.downloadCount}</span>
                  </div>
                  {recipientNames && (
                    <p className="text-xs text-muted-foreground truncate">
                      To: {recipientNames}
                    </p>
                  )}
                </div>
              </CardContent>
              {canManage && !isReadOnly && pkg.status !== 'delivered' && pkg.status !== 'archived' && (
                <CardFooter className="pt-0">
                  <div className="flex gap-2 w-full">
                    {pkg.status === 'draft' && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1"
                        onClick={(e) => {
                          e.stopPropagation();
                          onUpdateStatus(pkg.id, 'pending_review');
                        }}
                      >
                        Submit for Review
                      </Button>
                    )}
                    {pkg.status === 'pending_review' && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1"
                        onClick={(e) => {
                          e.stopPropagation();
                          onUpdateStatus(pkg.id, 'approved');
                        }}
                      >
                        Approve
                      </Button>
                    )}
                    {pkg.status === 'approved' && (
                      <Button
                        size="sm"
                        className="flex-1"
                        onClick={(e) => {
                          e.stopPropagation();
                          onUpdateStatus(pkg.id, 'delivered');
                        }}
                      >
                        <Send className="mr-2 h-4 w-4" />
                        Deliver
                      </Button>
                    )}
                  </div>
                </CardFooter>
              )}
            </Card>
          );
        })}

        {packages.length === 0 && (
          <Card className="md:col-span-2 border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Package className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No handoff packages created</p>
              <p className="text-sm text-muted-foreground">Create a package to share artifacts with collaborators</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

// Activity Panel
function ActivityPanel({
  auditLog,
  collaborators,
}: {
  auditLog: AuditLogEntry[];
  collaborators: Collaborator[];
}) {
  const [filter, setFilter] = useState<string>('all');

  const filteredLog = useMemo(() => {
    if (filter === 'all') return auditLog;
    return auditLog.filter(entry => entry.actionType === filter);
  }, [auditLog, filter]);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <History className="h-5 w-5" />
            <CardTitle className="text-base">Activity Log</CardTitle>
          </div>
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-48">
              <Filter className="mr-2 h-4 w-4" />
              <SelectValue placeholder="Filter actions" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Actions</SelectItem>
              <SelectItem value="collaborator_invited">Invitations</SelectItem>
              <SelectItem value="role_changed">Role Changes</SelectItem>
              <SelectItem value="permission_granted">Permission Changes</SelectItem>
              <SelectItem value="package_delivered">Package Deliveries</SelectItem>
              <SelectItem value="ownership_transferred">Ownership Transfers</SelectItem>
              <SelectItem value="phi_access_granted">PHI Access</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <CardDescription>
          Audit trail of all collaboration and handoff actions
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[500px]">
          <div className="space-y-3">
            {filteredLog.map(entry => {
              const config = AUDIT_ACTION_CONFIG[entry.actionType];
              const ActionIcon = config.icon;

              return (
                <div key={entry.id} className="flex items-start gap-3 p-3 bg-muted/30 rounded-lg">
                  <div className={cn('p-2 rounded-full bg-background', config.color)}>
                    <ActionIcon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{config.label}</p>
                    <p className="text-sm text-muted-foreground">{entry.description}</p>
                    <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                      <span>by {entry.userName}</span>
                      <span>-</span>
                      <span>{entry.timestamp.toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              );
            })}

            {filteredLog.length === 0 && (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <History className="h-12 w-12 mb-4 opacity-50" />
                <p>No activity recorded</p>
              </div>
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

// ==================== Dialogs ====================

// Invite Collaborator Dialog
function InviteCollaboratorDialog({
  open,
  onOpenChange,
  onInvite,
  onSearch,
  suggestions,
  existingEmails,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onInvite: (email: string, name: string, role: CollaboratorRole, message?: string) => void;
  onSearch?: (query: string) => Promise<Array<{ id: string; email: string; name: string; institution?: string }>>;
  suggestions: CollaboratorSuggestion[];
  existingEmails: string[];
}) {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<CollaboratorRole>('viewer');
  const [message, setMessage] = useState('');
  const [searchResults, setSearchResults] = useState<Array<{ id: string; email: string; name: string; institution?: string }>>([]);
  const [isSearching, setIsSearching] = useState(false);

  const handleSearch = async (query: string) => {
    setEmail(query);
    if (query.length < 3 || !onSearch) return;

    setIsSearching(true);
    try {
      const results = await onSearch(query);
      setSearchResults(results.filter(r => !existingEmails.includes(r.email)));
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelectUser = (user: { email: string; name: string }) => {
    setEmail(user.email);
    setName(user.name);
    setSearchResults([]);
  };

  const handleInvite = () => {
    if (!email || !name) return;
    onInvite(email, name, role, message || undefined);
    setEmail('');
    setName('');
    setRole('viewer');
    setMessage('');
    onOpenChange(false);
  };

  const isEmailValid = email.includes('@') && !existingEmails.includes(email);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Invite Collaborator
          </DialogTitle>
          <DialogDescription>
            Send an invitation to join this research project
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Email Address</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="email"
                placeholder="collaborator@institution.edu"
                value={email}
                onChange={(e) => handleSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            {searchResults.length > 0 && (
              <div className="border rounded-lg p-2 space-y-1 max-h-32 overflow-y-auto">
                {searchResults.map(user => (
                  <button
                    key={user.id}
                    className="w-full flex items-center gap-2 p-2 hover:bg-muted rounded text-left"
                    onClick={() => handleSelectUser(user)}
                  >
                    <Avatar className="h-8 w-8">
                      <AvatarFallback>{user.name.substring(0, 2).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-sm font-medium">{user.name}</p>
                      <p className="text-xs text-muted-foreground">{user.email}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
            {existingEmails.includes(email) && (
              <p className="text-sm text-destructive">This email is already a collaborator</p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Name</Label>
            <Input
              placeholder="Full name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Role</Label>
            <Select value={role} onValueChange={(v) => setRole(v as CollaboratorRole)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(ROLE_CONFIG) as CollaboratorRole[])
                  .filter(r => r !== 'owner')
                  .map(r => {
                    const config = ROLE_CONFIG[r];
                    const Icon = config.icon;
                    return (
                      <SelectItem key={r} value={r}>
                        <div className="flex items-center gap-2">
                          <Icon className="h-4 w-4" />
                          <span>{config.label}</span>
                          <span className="text-muted-foreground text-xs">- {config.description}</span>
                        </div>
                      </SelectItem>
                    );
                  })}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Personal Message (optional)</Label>
            <Textarea
              placeholder="Add a personal message to the invitation..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleInvite} disabled={!isEmailValid || !name}>
            <Send className="mr-2 h-4 w-4" />
            Send Invitation
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Create Package Dialog
function CreatePackageDialog({
  open,
  onOpenChange,
  selectedPackage,
  onClearSelection,
  availableArtifacts,
  collaborators,
  onCreate,
  onUpdateStatus,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedPackage: HandoffPackage | null;
  onClearSelection: () => void;
  availableArtifacts: HandoffArtifact[];
  collaborators: Collaborator[];
  onCreate: (name: string, description: string, artifactIds: string[], recipientIds: string[]) => HandoffPackage;
  onUpdateStatus: (packageId: string, status: HandoffPackageStatus) => void;
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedArtifacts, setSelectedArtifacts] = useState<Set<string>>(new Set());
  const [selectedRecipients, setSelectedRecipients] = useState<Set<string>>(new Set());

  React.useEffect(() => {
    if (selectedPackage) {
      setName(selectedPackage.name);
      setDescription(selectedPackage.description);
      setSelectedArtifacts(new Set(selectedPackage.artifacts.filter(a => a.included).map(a => a.id)));
      setSelectedRecipients(new Set(selectedPackage.recipients));
    } else {
      setName('');
      setDescription('');
      setSelectedArtifacts(new Set());
      setSelectedRecipients(new Set());
    }
  }, [selectedPackage]);

  const toggleArtifact = (artifactId: string) => {
    setSelectedArtifacts(prev => {
      const next = new Set(prev);
      if (next.has(artifactId)) {
        next.delete(artifactId);
      } else {
        next.add(artifactId);
      }
      return next;
    });
  };

  const toggleRecipient = (recipientId: string) => {
    setSelectedRecipients(prev => {
      const next = new Set(prev);
      if (next.has(recipientId)) {
        next.delete(recipientId);
      } else {
        next.add(recipientId);
      }
      return next;
    });
  };

  const handleCreate = () => {
    if (!name || selectedArtifacts.size === 0 || selectedRecipients.size === 0) return;
    onCreate(name, description, Array.from(selectedArtifacts), Array.from(selectedRecipients));
    onOpenChange(false);
    onClearSelection();
  };

  const handleClose = () => {
    onOpenChange(false);
    onClearSelection();
  };

  const phiArtifactsSelected = availableArtifacts.filter(a => selectedArtifacts.has(a.id) && a.phiContained).length;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            {selectedPackage ? 'View Package' : 'Create Handoff Package'}
          </DialogTitle>
          <DialogDescription>
            {selectedPackage
              ? 'View package details and manage delivery'
              : 'Select artifacts and recipients for the handoff package'}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh]">
          <div className="space-y-4 pr-4">
            {/* Package Details */}
            <div className="space-y-2">
              <Label>Package Name</Label>
              <Input
                placeholder="e.g., Final Research Package v1.0"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={!!selectedPackage}
              />
            </div>

            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                placeholder="Describe the contents and purpose of this package..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                disabled={!!selectedPackage}
              />
            </div>

            {/* PHI Warning */}
            {phiArtifactsSelected > 0 && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>PHI Content Detected</AlertTitle>
                <AlertDescription>
                  {phiArtifactsSelected} selected artifact(s) contain PHI. Recipients must have signed PHI agreements.
                </AlertDescription>
              </Alert>
            )}

            {/* Artifact Selection */}
            <div className="space-y-2">
              <Label>Select Artifacts ({selectedArtifacts.size} selected)</Label>
              <div className="border rounded-lg p-2 space-y-2 max-h-48 overflow-y-auto">
                {availableArtifacts.length > 0 ? availableArtifacts.map(artifact => {
                  const typeConfig = ARTIFACT_TYPE_CONFIG[artifact.type] || ARTIFACT_TYPE_CONFIG.other;
                  const TypeIcon = typeConfig.icon;

                  return (
                    <div
                      key={artifact.id}
                      className={cn(
                        'flex items-center gap-3 p-2 rounded cursor-pointer hover:bg-muted',
                        selectedArtifacts.has(artifact.id) && 'bg-primary/10'
                      )}
                      onClick={() => !selectedPackage && toggleArtifact(artifact.id)}
                    >
                      <Checkbox
                        checked={selectedArtifacts.has(artifact.id)}
                        disabled={!!selectedPackage}
                      />
                      <div className={cn('p-1.5 rounded', typeConfig.color)}>
                        <TypeIcon className="h-4 w-4" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium">{artifact.name}</p>
                        <p className="text-xs text-muted-foreground">{typeConfig.label}</p>
                      </div>
                      {artifact.phiContained && (
                        <Badge variant="destructive" className="text-xs">
                          <ShieldAlert className="mr-1 h-3 w-3" />
                          PHI
                        </Badge>
                      )}
                    </div>
                  );
                }) : (
                  <p className="text-sm text-muted-foreground text-center py-4">No artifacts available</p>
                )}
              </div>
            </div>

            {/* Recipient Selection */}
            <div className="space-y-2">
              <Label>Select Recipients ({selectedRecipients.size} selected)</Label>
              <div className="border rounded-lg p-2 space-y-2 max-h-48 overflow-y-auto">
                {collaborators.length > 0 ? collaborators.map(collaborator => {
                  const roleConfig = ROLE_CONFIG[collaborator.role];

                  return (
                    <div
                      key={collaborator.id}
                      className={cn(
                        'flex items-center gap-3 p-2 rounded cursor-pointer hover:bg-muted',
                        selectedRecipients.has(collaborator.id) && 'bg-primary/10'
                      )}
                      onClick={() => !selectedPackage && toggleRecipient(collaborator.id)}
                    >
                      <Checkbox
                        checked={selectedRecipients.has(collaborator.id)}
                        disabled={!!selectedPackage}
                      />
                      <Avatar className="h-8 w-8">
                        <AvatarFallback className={cn('text-xs', roleConfig.color)}>
                          {collaborator.name.substring(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <p className="text-sm font-medium">{collaborator.name}</p>
                        <p className="text-xs text-muted-foreground">{collaborator.email}</p>
                      </div>
                      {phiArtifactsSelected > 0 && !collaborator.phiAccessGranted && (
                        <Badge variant="outline" className="text-xs text-orange-600">
                          No PHI Access
                        </Badge>
                      )}
                    </div>
                  );
                }) : (
                  <p className="text-sm text-muted-foreground text-center py-4">No collaborators available</p>
                )}
              </div>
            </div>
          </div>
        </ScrollArea>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            {selectedPackage ? 'Close' : 'Cancel'}
          </Button>
          {!selectedPackage && (
            <Button
              onClick={handleCreate}
              disabled={!name || selectedArtifacts.size === 0 || selectedRecipients.size === 0}
            >
              <PackagePlus className="mr-2 h-4 w-4" />
              Create Package
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Transfer Ownership Dialog
function TransferOwnershipDialog({
  open,
  onOpenChange,
  collaborators,
  pendingTransfer,
  onInitiate,
  onComplete,
  onCancel,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  collaborators: Collaborator[];
  pendingTransfer?: OwnershipTransfer;
  onInitiate: (toCollaboratorId: string) => void;
  onComplete: () => void;
  onCancel: () => void;
}) {
  const [selectedId, setSelectedId] = useState<string>('');
  const [acknowledgements, setAcknowledgements] = useState({
    dataResponsibility: false,
    complianceResponsibility: false,
    irrevocable: false,
  });

  const allAcknowledged = acknowledgements.dataResponsibility &&
    acknowledgements.complianceResponsibility &&
    acknowledgements.irrevocable;

  const handleInitiate = () => {
    if (!selectedId || !allAcknowledged) return;
    onInitiate(selectedId);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowRightLeft className="h-5 w-5 text-amber-600" />
            Transfer Ownership
          </DialogTitle>
          <DialogDescription>
            This action will transfer full ownership of this research project to another collaborator
          </DialogDescription>
        </DialogHeader>

        {pendingTransfer && pendingTransfer.status === 'pending' ? (
          <div className="space-y-4">
            <Alert>
              <Clock className="h-4 w-4" />
              <AlertTitle>Transfer Pending</AlertTitle>
              <AlertDescription>
                Ownership transfer to {pendingTransfer.toUserName} is awaiting completion.
              </AlertDescription>
            </Alert>

            <div className="flex gap-2">
              <Button variant="destructive" onClick={onCancel} className="flex-1">
                Cancel Transfer
              </Button>
              <Button onClick={onComplete} className="flex-1">
                Complete Transfer
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Select New Owner</Label>
              <Select value={selectedId} onValueChange={setSelectedId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a collaborator" />
                </SelectTrigger>
                <SelectContent>
                  {collaborators.map(c => (
                    <SelectItem key={c.id} value={c.id}>
                      <div className="flex items-center gap-2">
                        <span>{c.name}</span>
                        <Badge variant="outline" className="text-xs">
                          {ROLE_CONFIG[c.role].label}
                        </Badge>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>This action is irreversible</AlertTitle>
              <AlertDescription>
                Once transferred, you will become an Admin and cannot reverse this action.
              </AlertDescription>
            </Alert>

            <div className="space-y-3">
              <Label>Acknowledgements</Label>

              <div className="flex items-start gap-2">
                <Checkbox
                  checked={acknowledgements.dataResponsibility}
                  onCheckedChange={(checked) =>
                    setAcknowledgements(prev => ({ ...prev, dataResponsibility: !!checked }))
                  }
                />
                <Label className="text-sm font-normal">
                  I understand the new owner will have full responsibility for all data and content
                </Label>
              </div>

              <div className="flex items-start gap-2">
                <Checkbox
                  checked={acknowledgements.complianceResponsibility}
                  onCheckedChange={(checked) =>
                    setAcknowledgements(prev => ({ ...prev, complianceResponsibility: !!checked }))
                  }
                />
                <Label className="text-sm font-normal">
                  I understand the new owner will be responsible for all compliance and regulatory requirements
                </Label>
              </div>

              <div className="flex items-start gap-2">
                <Checkbox
                  checked={acknowledgements.irrevocable}
                  onCheckedChange={(checked) =>
                    setAcknowledgements(prev => ({ ...prev, irrevocable: !!checked }))
                  }
                />
                <Label className="text-sm font-normal">
                  I understand this transfer is permanent and cannot be undone
                </Label>
              </div>
            </div>
          </div>
        )}

        {!pendingTransfer && (
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleInitiate}
              disabled={!selectedId || !allAcknowledged}
            >
              <ArrowRightLeft className="mr-2 h-4 w-4" />
              Initiate Transfer
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}

// PHI Agreement Dialog
function PhiAgreementDialog({
  open,
  onOpenChange,
  collaborator,
  agreement,
  onSend,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  collaborator: Collaborator | null;
  agreement?: PhiAgreement;
  onSend?: (collaboratorId: string) => Promise<void>;
}) {
  const [isSending, setIsSending] = useState(false);

  const handleSend = async () => {
    if (!collaborator || !onSend) return;
    setIsSending(true);
    try {
      await onSend(collaborator.id);
      onOpenChange(false);
    } finally {
      setIsSending(false);
    }
  };

  if (!collaborator) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            PHI Access Agreement
          </DialogTitle>
          <DialogDescription>
            Manage PHI access for {collaborator.name}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Collaborator Info */}
          <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
            <Avatar className="h-10 w-10">
              <AvatarFallback>{collaborator.name.substring(0, 2).toUpperCase()}</AvatarFallback>
            </Avatar>
            <div>
              <p className="font-medium">{collaborator.name}</p>
              <p className="text-sm text-muted-foreground">{collaborator.email}</p>
            </div>
          </div>

          {/* Agreement Status */}
          {agreement ? (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">Agreement Status</CardTitle>
                  <Badge className={cn(
                    agreement.status === 'signed' && 'bg-green-100 text-green-700',
                    agreement.status === 'pending' && 'bg-yellow-100 text-yellow-700',
                    agreement.status === 'declined' && 'bg-red-100 text-red-700',
                    agreement.status === 'expired' && 'bg-gray-100 text-gray-700'
                  )}>
                    {agreement.status.charAt(0).toUpperCase() + agreement.status.slice(1)}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="text-sm space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Sent</span>
                  <span>{agreement.sentAt.toLocaleDateString()}</span>
                </div>
                {agreement.signedAt && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Signed</span>
                    <span>{agreement.signedAt.toLocaleDateString()}</span>
                  </div>
                )}
                {agreement.expiresAt && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Expires</span>
                    <span>{agreement.expiresAt.toLocaleDateString()}</span>
                  </div>
                )}
              </CardContent>
            </Card>
          ) : (
            <Alert>
              <FileText className="h-4 w-4" />
              <AlertTitle>No Agreement Sent</AlertTitle>
              <AlertDescription>
                Send a PHI access agreement to this collaborator before granting access to protected health information.
              </AlertDescription>
            </Alert>
          )}

          {/* PHI Access Status */}
          <div className="flex items-center justify-between p-3 border rounded-lg">
            <div className="flex items-center gap-2">
              {collaborator.phiAccessGranted ? (
                <ShieldCheck className="h-5 w-5 text-green-600" />
              ) : (
                <Shield className="h-5 w-5 text-muted-foreground" />
              )}
              <span>PHI Access</span>
            </div>
            <Badge className={cn(
              collaborator.phiAccessGranted ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
            )}>
              {collaborator.phiAccessGranted ? 'Granted' : 'Not Granted'}
            </Badge>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          {!agreement && onSend && (
            <Button onClick={handleSend} disabled={isSending}>
              {isSending ? (
                <RefreshCcw className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Send className="mr-2 h-4 w-4" />
              )}
              Send Agreement
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default Stage16CollaborationHandoff;
