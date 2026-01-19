import { 
  users,
  type UpsertUser,
  type Artifact,
  type InsertArtifact,
  type ArtifactVersion,
  type InsertArtifactVersion,
  type ArtifactComparison,
  type InsertArtifactComparison,
  type ResearchProject,
  type InsertResearchProject,
  type UserRoleRecord,
  type InsertUserRole,
  type ApprovalGateRecord,
  type InsertApprovalGate,
  type ApprovalAuditEntryRecord,
  type InsertApprovalAuditEntry,
  type AuditLog,
  type InsertAuditLog,
  type PhiIncident,
  type InsertPhiIncident,
  type HandoffPackRecord,
  type InsertHandoffPack,
  type Conversation,
  type InsertConversation,
  type Message,
  type InsertMessage,
  type FileUpload,
  type InsertFileUpload,
  type ResearchSession,
  type InsertResearchSession,
  researchProjects,
  userRoles,
  approvalGates,
  approvalAuditEntries,
  auditLogs,
  phiIncidents,
  handoffPacks,
  conversations,
  messages,
  artifacts,
  artifactVersions,
  artifactComparisons,
  fileUploads,
  researchSessions,
} from "@researchflow/core/schema";
import { db } from "./db";
import { eq, and, desc, type SQL } from "drizzle-orm";
import { createHash } from "crypto";

// Infer User type from the users table
type User = typeof users.$inferSelect;

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;

  createArtifact(artifact: InsertArtifact): Promise<Artifact>;
  getArtifact(id: string): Promise<Artifact | undefined>;
  listArtifacts(researchId: string): Promise<Artifact[]>;
  listArtifactsByStage(researchId: string, stageId: string): Promise<Artifact[]>;
  updateArtifact(id: string, updates: Partial<InsertArtifact>): Promise<Artifact | undefined>;
  deleteArtifact(id: string): Promise<boolean>;

  createArtifactVersion(version: InsertArtifactVersion): Promise<ArtifactVersion>;
  getArtifactVersions(artifactId: string): Promise<ArtifactVersion[]>;
  getArtifactVersion(id: string): Promise<ArtifactVersion | undefined>;

  createArtifactComparison(comparison: InsertArtifactComparison): Promise<ArtifactComparison>;
  getArtifactComparison(id: string): Promise<ArtifactComparison | undefined>;

  createResearchProject(project: InsertResearchProject): Promise<ResearchProject>;
  getResearchProject(id: string): Promise<ResearchProject | undefined>;
  getResearchProjectByResearchId(researchId: string): Promise<ResearchProject | undefined>;
  listResearchProjects(ownerId?: string): Promise<ResearchProject[]>;
  updateResearchProject(id: string, updates: Partial<InsertResearchProject>): Promise<ResearchProject | undefined>;

  createUserRole(role: InsertUserRole): Promise<UserRoleRecord>;
  getUserRoles(userId: string): Promise<UserRoleRecord[]>;
  deleteUserRole(id: number): Promise<boolean>;

  createApprovalGate(gate: InsertApprovalGate): Promise<ApprovalGateRecord>;
  getApprovalGate(id: string): Promise<ApprovalGateRecord | undefined>;
  listApprovalGates(filters?: { resourceId?: string; status?: string; requestedById?: string }): Promise<ApprovalGateRecord[]>;
  updateApprovalGate(id: string, updates: Partial<InsertApprovalGate>): Promise<ApprovalGateRecord | undefined>;

  createApprovalAuditEntry(entry: InsertApprovalAuditEntry): Promise<ApprovalAuditEntryRecord>;
  getApprovalAuditEntries(gateId: string): Promise<ApprovalAuditEntryRecord[]>;

  createAuditLog(log: InsertAuditLog): Promise<AuditLog>;
  listAuditLogs(filters?: { userId?: string; action?: string; resourceType?: string; researchId?: string }): Promise<AuditLog[]>;

  createPhiIncident(incident: InsertPhiIncident): Promise<PhiIncident>;
  getPhiIncident(id: number): Promise<PhiIncident | undefined>;
  listPhiIncidents(): Promise<PhiIncident[]>;
  updatePhiIncident(id: number, updates: Partial<InsertPhiIncident>): Promise<PhiIncident | undefined>;

  createHandoffPack(pack: InsertHandoffPack): Promise<HandoffPackRecord>;
  getHandoffPack(id: string): Promise<HandoffPackRecord | undefined>;
  getHandoffPackByPackId(packId: string): Promise<HandoffPackRecord | undefined>;
  listHandoffPacks(researchId: string): Promise<HandoffPackRecord[]>;

  createConversation(conversation: InsertConversation): Promise<Conversation>;
  getConversation(id: number): Promise<Conversation | undefined>;
  listConversations(): Promise<Conversation[]>;
  updateConversation(id: number, updates: Partial<InsertConversation>): Promise<Conversation | undefined>;

  createMessage(message: InsertMessage): Promise<Message>;
  getMessages(conversationId: number): Promise<Message[]>;

  createFileUpload(upload: InsertFileUpload): Promise<FileUpload>;
  getFileUpload(id: string): Promise<FileUpload | undefined>;
  listFileUploads(researchId?: string): Promise<FileUpload[]>;
  updateFileUpload(id: string, updates: Partial<InsertFileUpload>): Promise<FileUpload | undefined>;

  createResearchSession(session: InsertResearchSession): Promise<ResearchSession>;
  getResearchSession(id: string): Promise<ResearchSession | undefined>;
  getResearchSessionByResearchId(researchId: string): Promise<ResearchSession | undefined>;
  updateResearchSession(id: string, updates: Partial<InsertResearchSession>): Promise<ResearchSession | undefined>;
}

function calculateSha256(content: string): string {
  return createHash('sha256').update(content).digest('hex');
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    if (!db) {
      throw new Error('Database not initialized');
    }
    const [user] = await db.select().from(users).where(eq(users.id, id)).limit(1);
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    if (!db) {
      throw new Error('Database not initialized');
    }
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  async createArtifact(insertArtifact: InsertArtifact): Promise<Artifact> {
    if (!db) {
      throw new Error('Database not initialized');
    }
    const sha256Hash = calculateSha256(insertArtifact.content);
    const sizeBytes = Buffer.byteLength(insertArtifact.content, 'utf8');
    
    const [artifact] = await db.insert(artifacts).values({
      ...insertArtifact,
      sha256Hash,
      sizeBytes,
    }).returning();
    
    return artifact;
  }

  async getArtifact(id: string): Promise<Artifact | undefined> {
    if (!db) {
      throw new Error('Database not initialized');
    }
    const [artifact] = await db.select().from(artifacts).where(eq(artifacts.id, id)).limit(1);
    return artifact;
  }

  async listArtifacts(researchId: string): Promise<Artifact[]> {
    if (!db) {
      throw new Error('Database not initialized');
    }
    return db.select().from(artifacts).where(eq(artifacts.researchId, researchId)).orderBy(desc(artifacts.createdAt));
  }

  async listArtifactsByStage(researchId: string, stageId: string): Promise<Artifact[]> {
    if (!db) {
      throw new Error('Database not initialized');
    }
    return db.select().from(artifacts)
      .where(and(eq(artifacts.researchId, researchId), eq(artifacts.stageId, stageId)))
      .orderBy(desc(artifacts.createdAt));
  }

  async updateArtifact(id: string, updates: Partial<InsertArtifact>): Promise<Artifact | undefined> {
    if (!db) {
      throw new Error('Database not initialized');
    }
    const updateData: any = { ...updates };
    
    if (updates.content !== undefined) {
      updateData.sha256Hash = calculateSha256(updates.content);
      updateData.sizeBytes = Buffer.byteLength(updates.content, 'utf8');
    }

    const [artifact] = await db.update(artifacts).set(updateData).where(eq(artifacts.id, id)).returning();
    return artifact;
  }

  async deleteArtifact(id: string): Promise<boolean> {
    if (!db) {
      throw new Error('Database not initialized');
    }
    const result = await db.delete(artifacts).where(eq(artifacts.id, id)).returning();
    return result.length > 0;
  }

  async createArtifactVersion(insertVersion: InsertArtifactVersion): Promise<ArtifactVersion> {
    if (!db) {
      throw new Error('Database not initialized');
    }
    const sha256Hash = calculateSha256(insertVersion.content);
    const sizeBytes = Buffer.byteLength(insertVersion.content, 'utf8');
    
    const [version] = await db.insert(artifactVersions).values({
      ...insertVersion,
      sha256Hash,
      sizeBytes,
    }).returning();

    await db.update(artifacts)
      .set({ currentVersionId: version.id })
      .where(eq(artifacts.id, insertVersion.artifactId));

    return version;
  }

  async getArtifactVersions(artifactId: string): Promise<ArtifactVersion[]> {
    if (!db) {
      throw new Error('Database not initialized');
    }
    return db.select().from(artifactVersions)
      .where(eq(artifactVersions.artifactId, artifactId))
      .orderBy(desc(artifactVersions.versionNumber));
  }

  async getArtifactVersion(id: string): Promise<ArtifactVersion | undefined> {
    if (!db) {
      throw new Error('Database not initialized');
    }
    const [version] = await db.select().from(artifactVersions).where(eq(artifactVersions.id, id)).limit(1);
    return version;
  }

  async createArtifactComparison(insertComparison: InsertArtifactComparison): Promise<ArtifactComparison> {
    if (!db) {
      throw new Error('Database not initialized');
    }
    const [comparison] = await db.insert(artifactComparisons).values(insertComparison).returning();
    return comparison;
  }

  async getArtifactComparison(id: string): Promise<ArtifactComparison | undefined> {
    if (!db) {
      throw new Error('Database not initialized');
    }
    const [comparison] = await db.select().from(artifactComparisons).where(eq(artifactComparisons.id, id)).limit(1);
    return comparison;
  }

  async createResearchProject(project: InsertResearchProject): Promise<ResearchProject> {
    if (!db) {
      throw new Error('Database not initialized');
    }
    const [result] = await db.insert(researchProjects).values(project).returning();
    return result;
  }

  async getResearchProject(id: string): Promise<ResearchProject | undefined> {
    if (!db) {
      throw new Error('Database not initialized');
    }
    const [project] = await db.select().from(researchProjects).where(eq(researchProjects.id, id)).limit(1);
    return project;
  }

  async getResearchProjectByResearchId(researchId: string): Promise<ResearchProject | undefined> {
    if (!db) {
      throw new Error('Database not initialized');
    }
    const [project] = await db.select().from(researchProjects).where(eq(researchProjects.researchId, researchId)).limit(1);
    return project;
  }

  async listResearchProjects(ownerId?: string): Promise<ResearchProject[]> {
    if (!db) {
      throw new Error('Database not initialized');
    }
    if (ownerId) {
      return db.select().from(researchProjects).where(eq(researchProjects.ownerId, ownerId)).orderBy(desc(researchProjects.createdAt));
    }
    return db.select().from(researchProjects).orderBy(desc(researchProjects.createdAt));
  }

  async updateResearchProject(id: string, updates: Partial<InsertResearchProject>): Promise<ResearchProject | undefined> {
    if (!db) {
      throw new Error('Database not initialized');
    }
    const [project] = await db.update(researchProjects).set(updates).where(eq(researchProjects.id, id)).returning();
    return project;
  }

  async createUserRole(role: InsertUserRole): Promise<UserRoleRecord> {
    if (!db) {
      throw new Error('Database not initialized');
    }
    const [result] = await db.insert(userRoles).values(role).returning();
    return result;
  }

  async getUserRoles(userId: string): Promise<UserRoleRecord[]> {
    if (!db) {
      throw new Error('Database not initialized');
    }
    return db.select().from(userRoles).where(eq(userRoles.userId, userId));
  }

  async deleteUserRole(id: number): Promise<boolean> {
    if (!db) {
      throw new Error('Database not initialized');
    }
    const result = await db.delete(userRoles).where(eq(userRoles.id, id)).returning();
    return result.length > 0;
  }

  async createApprovalGate(gate: InsertApprovalGate): Promise<ApprovalGateRecord> {
    if (!db) {
      throw new Error('Database not initialized');
    }
    const [result] = await db.insert(approvalGates).values(gate).returning();
    return result;
  }

  async getApprovalGate(id: string): Promise<ApprovalGateRecord | undefined> {
    if (!db) {
      throw new Error('Database not initialized');
    }
    const [gate] = await db.select().from(approvalGates).where(eq(approvalGates.id, id)).limit(1);
    return gate;
  }

  async listApprovalGates(filters?: { resourceId?: string; status?: string; requestedById?: string }): Promise<ApprovalGateRecord[]> {
    if (!db) {
      throw new Error('Database not initialized');
    }
    const conditions: SQL<unknown>[] = [];
    if (filters?.resourceId) conditions.push(eq(approvalGates.resourceId, filters.resourceId));
    if (filters?.status) conditions.push(eq(approvalGates.status, filters.status));
    if (filters?.requestedById) conditions.push(eq(approvalGates.requestedById, filters.requestedById));
    
    if (conditions.length > 0) {
      return db.select().from(approvalGates).where(and(...conditions)).orderBy(desc(approvalGates.requestedAt));
    }
    
    return db.select().from(approvalGates).orderBy(desc(approvalGates.requestedAt));
  }

  async updateApprovalGate(id: string, updates: Partial<InsertApprovalGate>): Promise<ApprovalGateRecord | undefined> {
    if (!db) {
      throw new Error('Database not initialized');
    }
    const [gate] = await db.update(approvalGates).set(updates).where(eq(approvalGates.id, id)).returning();
    return gate;
  }

  async createApprovalAuditEntry(entry: InsertApprovalAuditEntry): Promise<ApprovalAuditEntryRecord> {
    if (!db) {
      throw new Error('Database not initialized');
    }
    const [result] = await db.insert(approvalAuditEntries).values(entry).returning();
    return result;
  }

  async getApprovalAuditEntries(gateId: string): Promise<ApprovalAuditEntryRecord[]> {
    if (!db) {
      throw new Error('Database not initialized');
    }
    return db.select().from(approvalAuditEntries).where(eq(approvalAuditEntries.gateId, gateId)).orderBy(desc(approvalAuditEntries.performedAt));
  }

  async createAuditLog(log: InsertAuditLog): Promise<AuditLog> {
    if (!db) {
      throw new Error('Database not initialized');
    }
    const [result] = await db.insert(auditLogs).values(log).returning();
    return result;
  }

  async listAuditLogs(filters?: { userId?: string; action?: string; resourceType?: string; researchId?: string }): Promise<AuditLog[]> {
    if (!db) {
      throw new Error('Database not initialized');
    }
    const conditions: SQL<unknown>[] = [];
    if (filters?.userId) conditions.push(eq(auditLogs.userId, filters.userId));
    if (filters?.action) conditions.push(eq(auditLogs.action, filters.action));
    if (filters?.resourceType) conditions.push(eq(auditLogs.resourceType, filters.resourceType));
    if (filters?.researchId) conditions.push(eq(auditLogs.researchId, filters.researchId));
    
    if (conditions.length > 0) {
      return db.select().from(auditLogs).where(and(...conditions)).orderBy(desc(auditLogs.createdAt));
    }
    
    return db.select().from(auditLogs).orderBy(desc(auditLogs.createdAt));
  }

  async createPhiIncident(incident: InsertPhiIncident): Promise<PhiIncident> {
    if (!db) {
      throw new Error('Database not initialized');
    }
    const [result] = await db.insert(phiIncidents).values(incident).returning();
    return result;
  }

  async getPhiIncident(id: number): Promise<PhiIncident | undefined> {
    if (!db) {
      throw new Error('Database not initialized');
    }
    const [incident] = await db.select().from(phiIncidents).where(eq(phiIncidents.id, id)).limit(1);
    return incident;
  }

  async listPhiIncidents(): Promise<PhiIncident[]> {
    if (!db) {
      throw new Error('Database not initialized');
    }
    return db.select().from(phiIncidents).orderBy(desc(phiIncidents.createdAt));
  }

  async updatePhiIncident(id: number, updates: Partial<InsertPhiIncident>): Promise<PhiIncident | undefined> {
    if (!db) {
      throw new Error('Database not initialized');
    }
    const [incident] = await db.update(phiIncidents).set(updates).where(eq(phiIncidents.id, id)).returning();
    return incident;
  }

  async createHandoffPack(pack: InsertHandoffPack): Promise<HandoffPackRecord> {
    if (!db) {
      throw new Error('Database not initialized');
    }
    const [result] = await db.insert(handoffPacks).values(pack).returning();
    return result;
  }

  async getHandoffPack(id: string): Promise<HandoffPackRecord | undefined> {
    if (!db) {
      throw new Error('Database not initialized');
    }
    const [pack] = await db.select().from(handoffPacks).where(eq(handoffPacks.id, id)).limit(1);
    return pack;
  }

  async getHandoffPackByPackId(packId: string): Promise<HandoffPackRecord | undefined> {
    if (!db) {
      throw new Error('Database not initialized');
    }
    const [pack] = await db.select().from(handoffPacks).where(eq(handoffPacks.packId, packId)).limit(1);
    return pack;
  }

  async listHandoffPacks(researchId: string): Promise<HandoffPackRecord[]> {
    if (!db) {
      throw new Error('Database not initialized');
    }
    return db.select().from(handoffPacks).where(eq(handoffPacks.researchId, researchId)).orderBy(desc(handoffPacks.createdAt));
  }

  async createConversation(conversation: InsertConversation): Promise<Conversation> {
    if (!db) {
      throw new Error('Database not initialized');
    }
    const [result] = await db.insert(conversations).values(conversation).returning();
    return result;
  }

  async getConversation(id: number): Promise<Conversation | undefined> {
    if (!db) {
      throw new Error('Database not initialized');
    }
    const [conv] = await db.select().from(conversations).where(eq(conversations.id, id)).limit(1);
    return conv;
  }

  async listConversations(): Promise<Conversation[]> {
    if (!db) {
      throw new Error('Database not initialized');
    }
    return db.select().from(conversations).orderBy(desc(conversations.createdAt));
  }

  async updateConversation(id: number, updates: Partial<InsertConversation>): Promise<Conversation | undefined> {
    if (!db) {
      throw new Error('Database not initialized');
    }
    const [conv] = await db.update(conversations).set(updates).where(eq(conversations.id, id)).returning();
    return conv;
  }

  async createMessage(message: InsertMessage): Promise<Message> {
    if (!db) {
      throw new Error('Database not initialized');
    }
    const [result] = await db.insert(messages).values(message).returning();
    return result;
  }

  async getMessages(conversationId: number): Promise<Message[]> {
    if (!db) {
      throw new Error('Database not initialized');
    }
    return db.select().from(messages).where(eq(messages.conversationId, conversationId)).orderBy(messages.createdAt);
  }

  async createFileUpload(upload: InsertFileUpload): Promise<FileUpload> {
    if (!db) {
      throw new Error('Database not initialized');
    }
    const [result] = await db.insert(fileUploads).values(upload).returning();
    return result;
  }

  async getFileUpload(id: string): Promise<FileUpload | undefined> {
    if (!db) {
      throw new Error('Database not initialized');
    }
    const [upload] = await db.select().from(fileUploads).where(eq(fileUploads.id, id)).limit(1);
    return upload;
  }

  async listFileUploads(researchId?: string): Promise<FileUpload[]> {
    if (!db) {
      throw new Error('Database not initialized');
    }
    if (researchId) {
      return db.select().from(fileUploads).where(eq(fileUploads.researchId, researchId)).orderBy(desc(fileUploads.createdAt));
    }
    return db.select().from(fileUploads).orderBy(desc(fileUploads.createdAt));
  }

  async updateFileUpload(id: string, updates: Partial<InsertFileUpload>): Promise<FileUpload | undefined> {
    if (!db) {
      throw new Error('Database not initialized');
    }
    const [upload] = await db.update(fileUploads).set(updates).where(eq(fileUploads.id, id)).returning();
    return upload;
  }

  async createResearchSession(session: InsertResearchSession): Promise<ResearchSession> {
    if (!db) {
      throw new Error('Database not initialized');
    }
    const [result] = await db.insert(researchSessions).values(session).returning();
    return result;
  }

  async getResearchSession(id: string): Promise<ResearchSession | undefined> {
    if (!db) {
      throw new Error('Database not initialized');
    }
    const [session] = await db.select().from(researchSessions).where(eq(researchSessions.id, id)).limit(1);
    return session;
  }

  async getResearchSessionByResearchId(researchId: string): Promise<ResearchSession | undefined> {
    if (!db) {
      throw new Error('Database not initialized');
    }
    const [session] = await db.select().from(researchSessions).where(eq(researchSessions.researchId, researchId)).limit(1);
    return session;
  }

  async updateResearchSession(id: string, updates: Partial<InsertResearchSession>): Promise<ResearchSession | undefined> {
    if (!db) {
      throw new Error('Database not initialized');
    }
    const [session] = await db.update(researchSessions)
      .set({ ...updates, lastActiveAt: new Date() })
      .where(eq(researchSessions.id, id))
      .returning();
    return session;
  }
}

export const storage = new DatabaseStorage();
