import crypto from "crypto";
import { db } from "../../db";
import { topics, Topic, InsertTopic } from "@researchflow/core/schema";
import { eq, desc, and, ne } from "drizzle-orm";
import { createAuditEntry } from "./auditService";

interface TopicContentForHash {
  title: string;
  description?: string | null;
  picoElements?: unknown;
  keywords?: unknown;
}

export function calculateTopicHash(content: TopicContentForHash): string {
  const payload = {
    title: content.title,
    description: content.description || null,
    picoElements: content.picoElements || null,
    keywords: content.keywords || null,
  };
  
  const jsonString = JSON.stringify(payload, Object.keys(payload).sort());
  return crypto.createHash("sha256").update(jsonString).digest("hex");
}

export async function createTopic(data: {
  researchId: string;
  title: string;
  description?: string;
  picoElements?: unknown;
  keywords?: unknown;
  createdBy: string;
}): Promise<Topic> {
  if (!db) {
    throw new Error('Database not initialized');
  }

  const versionHash = calculateTopicHash({
    title: data.title,
    description: data.description,
    picoElements: data.picoElements,
    keywords: data.keywords,
  });

  const result = await db
    .insert(topics)
    .values({
      researchId: data.researchId,
      version: 1,
      title: data.title,
      description: data.description,
      picoElements: data.picoElements,
      keywords: data.keywords,
      versionHash,
      createdBy: data.createdBy,
      status: "DRAFT",
    })
    .returning();

  const topic = result[0];

  try {
    await createAuditEntry({
      eventType: "TOPIC_CREATED",
      userId: data.createdBy !== "anonymous" ? data.createdBy : null,
      action: "CREATE",
      resourceType: "topic",
      resourceId: topic.id,
      researchId: data.researchId,
      details: {
        version: 1,
        versionHash,
        title: data.title,
      },
    });
  } catch (auditError) {
    console.warn("Failed to create audit entry for topic creation:", auditError);
  }

  return topic;
}

export async function updateTopic(
  id: string,
  data: {
    title?: string;
    description?: string;
    picoElements?: unknown;
    keywords?: unknown;
  },
  userId: string
): Promise<Topic> {
  if (!db) {
    throw new Error('Database not initialized');
  }

  const existing = await db
    .select()
    .from(topics)
    .where(eq(topics.id, id))
    .limit(1);

  if (existing.length === 0) {
    throw new Error("Topic not found");
  }

  const currentTopic = existing[0];

  if (currentTopic.status === "LOCKED") {
    throw new Error("Cannot update a locked topic");
  }

  if (currentTopic.status === "SUPERSEDED") {
    throw new Error("Cannot update a superseded topic");
  }

  const newTitle = data.title ?? currentTopic.title;
  const newDescription = data.description ?? currentTopic.description;
  const newPicoElements = data.picoElements ?? currentTopic.picoElements;
  const newKeywords = data.keywords ?? currentTopic.keywords;

  const versionHash = calculateTopicHash({
    title: newTitle,
    description: newDescription,
    picoElements: newPicoElements,
    keywords: newKeywords,
  });

  await db
    .update(topics)
    .set({
      status: "SUPERSEDED",
      updatedAt: new Date(),
    })
    .where(eq(topics.id, id));

  const result = await db
    .insert(topics)
    .values({
      researchId: currentTopic.researchId,
      version: currentTopic.version + 1,
      title: newTitle,
      description: newDescription,
      picoElements: newPicoElements,
      keywords: newKeywords,
      versionHash,
      previousVersionId: currentTopic.id,
      createdBy: userId,
      status: "DRAFT",
    })
    .returning();

  const newTopic = result[0];

  try {
    await createAuditEntry({
      eventType: "TOPIC_UPDATED",
      userId: userId !== "anonymous" ? userId : null,
      action: "UPDATE",
      resourceType: "topic",
      resourceId: newTopic.id,
      researchId: currentTopic.researchId,
      details: {
        previousVersionId: currentTopic.id,
        previousVersion: currentTopic.version,
        newVersion: newTopic.version,
        versionHash,
      },
    });
  } catch (auditError) {
    console.warn("Failed to create audit entry for topic update:", auditError);
  }

  return newTopic;
}

export async function lockTopic(id: string, userId: string): Promise<Topic> {
  if (!db) {
    throw new Error('Database not initialized');
  }

  const existing = await db
    .select()
    .from(topics)
    .where(eq(topics.id, id))
    .limit(1);

  if (existing.length === 0) {
    throw new Error("Topic not found");
  }

  const currentTopic = existing[0];

  if (currentTopic.status === "LOCKED") {
    throw new Error("Topic is already locked");
  }

  if (currentTopic.status === "SUPERSEDED") {
    throw new Error("Cannot lock a superseded topic");
  }

  const now = new Date();

  const result = await db
    .update(topics)
    .set({
      status: "LOCKED",
      lockedAt: now,
      lockedBy: userId,
      updatedAt: now,
    })
    .where(eq(topics.id, id))
    .returning();

  try {
    await createAuditEntry({
      eventType: "TOPIC_LOCKED",
      userId: userId !== "anonymous" ? userId : null,
      action: "LOCK",
      resourceType: "topic",
      resourceId: id,
      researchId: currentTopic.researchId,
      details: {
        version: currentTopic.version,
        lockedAt: now.toISOString(),
      },
    });
  } catch (auditError) {
    console.warn("Failed to create audit entry for topic lock:", auditError);
  }

  return result[0];
}

export async function getTopicVersionHistory(researchId: string): Promise<Topic[]> {
  if (!db) {
    throw new Error('Database not initialized');
  }

  return await db
    .select()
    .from(topics)
    .where(eq(topics.researchId, researchId))
    .orderBy(desc(topics.version));
}

export async function getCurrentTopic(researchId: string): Promise<Topic | null> {
  if (!db) {
    throw new Error('Database not initialized');
  }

  const result = await db
    .select()
    .from(topics)
    .where(
      and(
        eq(topics.researchId, researchId),
        ne(topics.status, "SUPERSEDED")
      )
    )
    .orderBy(desc(topics.version))
    .limit(1);

  return result.length > 0 ? result[0] : null;
}

export async function getTopicById(id: string): Promise<Topic | null> {
  if (!db) {
    throw new Error('Database not initialized');
  }

  const result = await db
    .select()
    .from(topics)
    .where(eq(topics.id, id))
    .limit(1);

  return result.length > 0 ? result[0] : null;
}
