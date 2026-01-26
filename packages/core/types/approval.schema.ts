import { z } from "zod";

export const ApprovalStatus = z.enum([
  "PENDING",
  "APPROVED",
  "REJECTED",
  "EXPIRED",
  "ESCALATED"
]);
export type ApprovalStatus = z.infer<typeof ApprovalStatus>;

export const OperationType = z.enum([
  "AI_GENERATION",
  "DATA_EXPORT",
  "PHI_ACCESS",
  "MANUSCRIPT_PUBLISH",
  "DATASET_MODIFICATION",
  "IRB_SUBMISSION",
  "EXTERNAL_SHARE",
  "BULK_OPERATION"
]);
export type OperationType = z.infer<typeof OperationType>;

export const ApprovalGateSchema = z.object({
  id: z.string().uuid(),
  operationType: OperationType,
  resourceId: z.string(),
  resourceType: z.string(),
  requestedBy: z.object({
    userId: z.string(),
    role: z.string(),
    email: z.string().email().optional(),
    name: z.string().optional()
  }),
  approvedBy: z.object({
    userId: z.string(),
    role: z.string(),
    email: z.string().email().optional(),
    name: z.string().optional()
  }).nullable(),
  status: ApprovalStatus,
  reason: z.string().nullable(),
  rejectionReason: z.string().nullable(),
  metadata: z.record(z.unknown()).optional(),
  expiresAt: z.string().datetime().nullable(),
  requestedAt: z.string().datetime(),
  reviewedAt: z.string().datetime().nullable(),
  completedAt: z.string().datetime().nullable()
});

export type ApprovalGate = z.infer<typeof ApprovalGateSchema>;

export const CreateApprovalRequestSchema = z.object({
  operationType: OperationType,
  resourceId: z.string(),
  resourceType: z.string(),
  reason: z.string().min(10, "Reason must be at least 10 characters"),
  metadata: z.record(z.unknown()).optional(),
  expiresInHours: z.number().min(1).max(168).optional()
});

export type CreateApprovalRequest = z.infer<typeof CreateApprovalRequestSchema>;

export const ApprovalDecisionSchema = z.object({
  gateId: z.string().uuid(),
  decision: z.enum(["APPROVED", "REJECTED", "ESCALATED"]),
  reason: z.string().optional(),
  conditions: z.array(z.string()).optional()
});

export type ApprovalDecision = z.infer<typeof ApprovalDecisionSchema>;

export const ApprovalAuditEntrySchema = z.object({
  id: z.string().uuid(),
  gateId: z.string().uuid(),
  action: z.enum(["CREATED", "APPROVED", "REJECTED", "ESCALATED", "EXPIRED", "VIEWED"]),
  performedBy: z.string(),
  performedAt: z.string().datetime(),
  details: z.record(z.unknown()).optional(),
  ipAddress: z.string().optional(),
  userAgent: z.string().optional()
});

export type ApprovalAuditEntry = z.infer<typeof ApprovalAuditEntrySchema>;

export const PendingApprovalsResponseSchema = z.object({
  approvals: z.array(ApprovalGateSchema),
  totalCount: z.number(),
  pendingCount: z.number(),
  expiringSoonCount: z.number()
});

export type PendingApprovalsResponse = z.infer<typeof PendingApprovalsResponseSchema>;
