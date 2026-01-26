/**
 * Collaborative Editor Types
 * Task T69: Real-time multi-user editing
 */

export interface EditorUser {
  id: string;
  name: string;
  email: string;
  color: string; // Hex color for cursor/selection
  avatar?: string;
  role: 'owner' | 'editor' | 'commenter' | 'viewer';
  lastSeen: Date;
  currentSection?: string;
  cursorPosition?: EditorPosition;
}

export interface EditorPosition {
  section: string;
  offset: number;
  length?: number; // For selections
}

export interface EditorSession {
  id: string;
  manuscriptId: string;
  activeUsers: EditorUser[];
  createdAt: Date;
  lastActivity: Date;
  lockState: LockState;
}

export interface LockState {
  lockedSections: LockedSection[];
  lockMode: 'section' | 'paragraph' | 'optimistic';
}

export interface LockedSection {
  section: string;
  lockedBy: string; // User ID
  lockedAt: Date;
  expiresAt?: Date;
}

export interface EditOperation {
  id: string;
  type: 'insert' | 'delete' | 'replace' | 'format';
  userId: string;
  timestamp: Date;
  section: string;
  position: EditorPosition;
  content?: string;
  previousContent?: string; // For undo
  metadata?: Record<string, any>;
}

export interface OperationalTransform {
  baseVersion: number;
  operations: EditOperation[];
  resultVersion: number;
  conflicts?: ConflictResolution[];
}

export interface ConflictResolution {
  operationId: string;
  conflictType: 'concurrent_edit' | 'version_mismatch' | 'lock_violation';
  resolution: 'local' | 'remote' | 'merged' | 'manual_required';
  mergedContent?: string;
}

export interface EditorComment {
  id: string;
  manuscriptId: string;
  section: string;
  position: EditorPosition;
  authorId: string;
  authorName: string;
  content: string;
  createdAt: Date;
  updatedAt?: Date;
  resolved: boolean;
  resolvedBy?: string;
  resolvedAt?: Date;
  replies: CommentReply[];
  mentions: string[]; // User IDs mentioned in comment
}

export interface CommentReply {
  id: string;
  authorId: string;
  authorName: string;
  content: string;
  createdAt: Date;
  mentions: string[];
}

export interface SuggestionMode {
  id: string;
  userId: string;
  userName: string;
  type: 'insert' | 'delete' | 'replace';
  section: string;
  position: EditorPosition;
  originalText?: string;
  suggestedText?: string;
  reason?: string;
  status: 'pending' | 'accepted' | 'rejected';
  createdAt: Date;
  reviewedBy?: string;
  reviewedAt?: Date;
}

export interface PresenceUpdate {
  userId: string;
  userName: string;
  action: 'joined' | 'left' | 'active' | 'idle' | 'typing' | 'viewing';
  section?: string;
  cursorPosition?: EditorPosition;
  timestamp: Date;
}

export interface CollaborativeEvent {
  type: 'user_joined' | 'user_left' | 'edit' | 'comment' | 'suggestion' | 'lock_acquired' | 'lock_released' | 'conflict';
  userId: string;
  data: EditOperation | EditorComment | SuggestionMode | LockedSection | ConflictResolution;
  timestamp: Date;
}

export interface SyncState {
  manuscriptId: string;
  localVersion: number;
  serverVersion: number;
  pendingOperations: EditOperation[];
  syncStatus: 'synced' | 'syncing' | 'conflict' | 'offline';
  lastSyncAt: Date;
}

export interface VersionVector {
  [userId: string]: number;
}

export interface CRDTDocument {
  manuscriptId: string;
  sections: Map<string, CRDTSection>;
  versionVector: VersionVector;
  tombstones: Set<string>; // Deleted operation IDs
}

export interface CRDTSection {
  sectionId: string;
  characters: CRDTChar[];
  operations: EditOperation[];
}

export interface CRDTChar {
  id: string;
  char: string;
  userId: string;
  timestamp: Date;
  visible: boolean;
}

export interface CollaborationPermissions {
  manuscriptId: string;
  userId: string;
  canEdit: boolean;
  canComment: boolean;
  canSuggest: boolean;
  canResolveComments: boolean;
  canAcceptSuggestions: boolean;
  canManageLocks: boolean;
  canInviteUsers: boolean;
  sectionRestrictions?: string[]; // List of sections user can access
}

export interface CollaborationSettings {
  manuscriptId: string;
  lockingEnabled: boolean;
  lockDuration: number; // Minutes
  suggestionMode: boolean; // If true, all edits are suggestions
  allowConcurrentEdits: boolean;
  autoSaveInterval: number; // Seconds
  conflictResolution: 'last_write_wins' | 'operational_transform' | 'crdt' | 'manual';
  notificationsEnabled: boolean;
}

export interface CollaborationNotification {
  id: string;
  userId: string;
  type: 'mention' | 'comment_reply' | 'suggestion_on_text' | 'conflict' | 'user_joined';
  manuscriptId: string;
  section?: string;
  message: string;
  read: boolean;
  createdAt: Date;
  relatedEntityId?: string; // Comment ID, suggestion ID, etc.
}
