/**
 * Doc Kits Service
 *
 * Manages venue-specific document preparation kits.
 * Auto-generates required documents based on venue type.
 */

import { db } from '../../lib/db.js';
import { docKits, docKitItems, venues, type DocKit, type DocKitItem } from '@researchflow/core/schema';
import { eq, and, sql } from 'drizzle-orm';
import { createAuditEntry } from '../auditService.js';

export class DocKitsService {
  /**
   * Auto-generate doc kit items based on venue type
   */
  private generateKitItems(venueType: string): Array<{
    itemType: string;
    title: string;
    description: string;
    required: boolean;
    displayOrder: number;
  }> {
    const baseItems = [
      {
        itemType: 'ABSTRACT',
        title: 'Abstract',
        description: 'Structured abstract following venue guidelines',
        required: true,
        displayOrder: 1,
      },
      {
        itemType: 'CHECKLIST',
        title: 'Submission Checklist',
        description: 'Venue-specific submission requirements',
        required: true,
        displayOrder: 2,
      },
    ];

    if (venueType === 'JOURNAL') {
      return [
        ...baseItems,
        {
          itemType: 'COVER_LETTER',
          title: 'Cover Letter',
          description: 'Cover letter to editor',
          required: true,
          displayOrder: 3,
        },
        {
          itemType: 'FIGURES_LIST',
          title: 'Figures List',
          description: 'List of all figures with captions',
          required: true,
          displayOrder: 4,
        },
        {
          itemType: 'TABLES_LIST',
          title: 'Tables List',
          description: 'List of all tables with captions',
          required: false,
          displayOrder: 5,
        },
        {
          itemType: 'HIGHLIGHTS',
          title: 'Research Highlights',
          description: '3-5 bullet points highlighting key findings',
          required: false,
          displayOrder: 6,
        },
      ];
    } else if (venueType === 'CONFERENCE') {
      return [
        ...baseItems,
        {
          itemType: 'BIO',
          title: 'Speaker Biography',
          description: 'Short biography for conference program',
          required: true,
          displayOrder: 3,
        },
        {
          itemType: 'POSTER_OUTLINE',
          title: 'Poster Outline',
          description: 'Layout plan for poster presentation',
          required: false,
          displayOrder: 4,
        },
      ];
    }

    return baseItems;
  }

  /**
   * Create doc kit with auto-generated items
   */
  async createKit(
    topicBriefId: string,
    venueId: string,
    userId: string
  ): Promise<{ kit: DocKit; items: DocKitItem[] }> {
    // Get venue to determine type
    const venueResult = await db.select()
      .from(venues)
      .where(eq(venues.id, venueId))
      .limit(1);

    if (venueResult.length === 0) {
      throw new Error('Venue not found');
    }

    const venue = venueResult[0];

    // Create kit
    const [kit] = await db.insert(docKits).values({
      topicBriefId,
      venueId,
      createdBy: userId,
      status: 'IN_PROGRESS',
    }).returning();

    // Auto-generate items
    const itemTemplates = this.generateKitItems(venue.type);

    const items = await Promise.all(
      itemTemplates.map(async (template) => {
        const [item] = await db.insert(docKitItems).values({
          docKitId: kit.id,
          ...template,
        }).returning();
        return item;
      })
    );

    await createAuditEntry({
      eventType: 'DOCS_FIRST',
      action: 'CREATE_DOC_KIT',
      userId,
      resourceType: 'doc_kit',
      resourceId: kit.id,
      details: {
        topicBriefId,
        venueId,
        venueType: venue.type,
        itemCount: items.length
      }
    });

    return { kit, items };
  }

  /**
   * Get kit with items and completion percentage
   */
  async getKitWithItems(kitId: string): Promise<{
    kit: DocKit;
    items: DocKitItem[];
    completionPercentage: number;
  }> {
    const kitResult = await db.select()
      .from(docKits)
      .where(eq(docKits.id, kitId))
      .limit(1);

    if (kitResult.length === 0) {
      throw new Error('Doc Kit not found');
    }

    const items = await db.select()
      .from(docKitItems)
      .where(and(eq(docKitItems.docKitId, kitId), eq(docKitItems.deletedAt, null)))
      .orderBy(docKitItems.displayOrder);

    // Calculate completion
    const requiredItems = items.filter(i => i.required);
    const completedRequired = requiredItems.filter(i => i.status === 'COMPLETE');
    const completionPercentage = requiredItems.length > 0
      ? Math.round((completedRequired.length / requiredItems.length) * 100)
      : 0;

    return {
      kit: kitResult[0],
      items,
      completionPercentage
    };
  }

  /**
   * Update doc kit item status
   */
  async updateItemStatus(
    itemId: string,
    status: string,
    content: string | null,
    userId: string
  ): Promise<DocKitItem> {
    const [item] = await db.update(docKitItems)
      .set({
        status,
        ...(content !== null && { content }),
        updatedAt: new Date(),
      })
      .where(eq(docKitItems.id, itemId))
      .returning();

    await createAuditEntry({
      eventType: 'DOCS_FIRST',
      action: 'UPDATE_DOC_KIT_ITEM',
      userId,
      resourceType: 'doc_kit_item',
      resourceId: itemId,
      details: { status, hasContent: !!content }
    });

    return item;
  }
}

export const docKitsService = new DocKitsService();
