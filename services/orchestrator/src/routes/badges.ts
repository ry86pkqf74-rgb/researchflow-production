/**
 * Badges Routes (Task 93)
 *
 * Gamification system with badges and achievements.
 * Awards badges for various research milestones.
 */

import { Router, Request, Response } from 'express';
import { db } from '../../db';
import { badges, userBadges, users } from '@researchflow/core/types/schema';
import { eq, and, desc } from 'drizzle-orm';
import { requireAuth } from '../middleware/governance';

const router = Router();
const FEATURE_GAMIFICATION = process.env.FEATURE_GAMIFICATION !== 'false';

// Badge definitions
const BADGE_DEFINITIONS = [
  {
    code: 'first_project',
    name: 'Pioneer',
    description: 'Created your first research project',
    icon: 'rocket',
    category: 'projects',
    points: 10,
  },
  {
    code: 'first_artifact',
    name: 'Contributor',
    description: 'Uploaded your first artifact',
    icon: 'file-plus',
    category: 'artifacts',
    points: 10,
  },
  {
    code: 'first_manuscript',
    name: 'Author',
    description: 'Created your first manuscript',
    icon: 'file-text',
    category: 'manuscripts',
    points: 20,
  },
  {
    code: 'team_player',
    name: 'Team Player',
    description: 'Invited your first team member',
    icon: 'users',
    category: 'collaboration',
    points: 15,
  },
  {
    code: 'reviewer',
    name: 'Reviewer',
    description: 'Completed your first review session',
    icon: 'check-circle',
    category: 'reviews',
    points: 25,
  },
  {
    code: 'prolific_author',
    name: 'Prolific Author',
    description: 'Created 10 manuscripts',
    icon: 'book-open',
    category: 'manuscripts',
    points: 50,
  },
  {
    code: 'data_master',
    name: 'Data Master',
    description: 'Uploaded 50 artifacts',
    icon: 'database',
    category: 'artifacts',
    points: 50,
  },
  {
    code: 'quality_champion',
    name: 'Quality Champion',
    description: 'Achieved 100% quality score on a manuscript',
    icon: 'award',
    category: 'quality',
    points: 100,
  },
  {
    code: 'published',
    name: 'Published',
    description: 'Published your first manuscript',
    icon: 'globe',
    category: 'manuscripts',
    points: 100,
  },
  {
    code: 'mentor',
    name: 'Mentor',
    description: 'Helped onboard 5 team members',
    icon: 'heart-handshake',
    category: 'collaboration',
    points: 75,
  },
];

router.use(requireAuth);

/**
 * GET /badges
 * List all available badges
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    if (!FEATURE_GAMIFICATION) {
      return res.json({ badges: [], message: 'Gamification is disabled' });
    }

    // Get badges from DB or use defaults
    let badgeList = await db.select().from(badges);

    if (badgeList.length === 0) {
      // Return predefined badges
      badgeList = BADGE_DEFINITIONS.map((b, i) => ({
        id: `badge_${i}`,
        ...b,
        createdAt: new Date(),
      })) as any;
    }

    res.json({ badges: badgeList });
  } catch (error: any) {
    console.error('[Badges] Error listing badges:', error);
    res.status(500).json({ error: 'Failed to list badges' });
  }
});

/**
 * GET /badges/user
 * Get current user's badges
 */
router.get('/user', async (req: Request, res: Response) => {
  try {
    if (!FEATURE_GAMIFICATION) {
      return res.json({ badges: [], totalPoints: 0 });
    }

    const userId = (req.user as any)?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const earned = await db
      .select({
        badge: badges,
        awardedAt: userBadges.awardedAt,
      })
      .from(userBadges)
      .innerJoin(badges, eq(userBadges.badgeId, badges.id))
      .where(eq(userBadges.userId, userId))
      .orderBy(desc(userBadges.awardedAt));

    // Calculate total points
    const totalPoints = earned.reduce((sum, e) => sum + ((e.badge as any).points || 0), 0);

    res.json({
      badges: earned.map(e => ({
        ...e.badge,
        awardedAt: e.awardedAt,
      })),
      totalPoints,
    });
  } catch (error: any) {
    console.error('[Badges] Error getting user badges:', error);
    res.status(500).json({ error: 'Failed to get user badges' });
  }
});

/**
 * GET /badges/user/:userId
 * Get another user's badges
 */
router.get('/user/:userId', async (req: Request, res: Response) => {
  try {
    if (!FEATURE_GAMIFICATION) {
      return res.json({ badges: [], totalPoints: 0 });
    }

    const { userId } = req.params;

    const earned = await db
      .select({
        badge: badges,
        awardedAt: userBadges.awardedAt,
      })
      .from(userBadges)
      .innerJoin(badges, eq(userBadges.badgeId, badges.id))
      .where(eq(userBadges.userId, userId))
      .orderBy(desc(userBadges.awardedAt));

    const totalPoints = earned.reduce((sum, e) => sum + ((e.badge as any).points || 0), 0);

    res.json({
      badges: earned.map(e => ({
        ...e.badge,
        awardedAt: e.awardedAt,
      })),
      totalPoints,
    });
  } catch (error: any) {
    console.error('[Badges] Error getting user badges:', error);
    res.status(500).json({ error: 'Failed to get user badges' });
  }
});

/**
 * GET /badges/leaderboard
 * Get top users by badge points
 */
router.get('/leaderboard', async (req: Request, res: Response) => {
  try {
    if (!FEATURE_GAMIFICATION) {
      return res.json({ leaderboard: [] });
    }

    const { limit = '10' } = req.query;

    // This would be a more complex query in production
    // For now, return a simple list
    const topUsers = await db
      .select({
        userId: userBadges.userId,
        badgeCount: userBadges.id, // Would need count() in real query
      })
      .from(userBadges)
      .limit(parseInt(limit as string, 10));

    res.json({ leaderboard: topUsers });
  } catch (error: any) {
    console.error('[Badges] Error getting leaderboard:', error);
    res.status(500).json({ error: 'Failed to get leaderboard' });
  }
});

/**
 * POST /badges/award
 * Award a badge to a user (internal use)
 */
router.post('/award', async (req: Request, res: Response) => {
  try {
    if (!FEATURE_GAMIFICATION) {
      return res.json({ success: false, message: 'Gamification is disabled' });
    }

    const { userId, badgeCode } = req.body;

    if (!userId || !badgeCode) {
      return res.status(400).json({ error: 'userId and badgeCode required' });
    }

    // Find the badge
    const [badge] = await db
      .select()
      .from(badges)
      .where(eq(badges.code, badgeCode))
      .limit(1);

    if (!badge) {
      return res.status(404).json({ error: 'Badge not found' });
    }

    // Check if already awarded
    const [existing] = await db
      .select()
      .from(userBadges)
      .where(and(
        eq(userBadges.userId, userId),
        eq(userBadges.badgeId, badge.id)
      ))
      .limit(1);

    if (existing) {
      return res.json({ success: true, alreadyAwarded: true });
    }

    // Award the badge
    await db.insert(userBadges).values({
      userId,
      badgeId: badge.id,
      awardedAt: new Date(),
    });

    res.json({
      success: true,
      badge: {
        code: badge.code,
        name: badge.name,
        description: badge.description,
      },
    });
  } catch (error: any) {
    console.error('[Badges] Error awarding badge:', error);
    res.status(500).json({ error: 'Failed to award badge' });
  }
});

/**
 * POST /badges/check
 * Check and award badges based on user activity
 */
router.post('/check', async (req: Request, res: Response) => {
  try {
    if (!FEATURE_GAMIFICATION) {
      return res.json({ awarded: [] });
    }

    const userId = (req.user as any)?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    // This would check various criteria and award badges
    // For now, return empty - actual logic would query counts
    const awarded: string[] = [];

    res.json({ awarded });
  } catch (error: any) {
    console.error('[Badges] Error checking badges:', error);
    res.status(500).json({ error: 'Failed to check badges' });
  }
});

/**
 * Seed badge definitions to database
 */
export async function seedBadges(): Promise<void> {
  if (!FEATURE_GAMIFICATION) {
    return;
  }

  try {
    for (const badge of BADGE_DEFINITIONS) {
      const [existing] = await db
        .select()
        .from(badges)
        .where(eq(badges.code, badge.code))
        .limit(1);

      if (!existing) {
        await db.insert(badges).values({
          code: badge.code,
          name: badge.name,
          description: badge.description,
          criteria: { category: badge.category, icon: badge.icon, points: badge.points },
        });
      }
    }
    console.log('[Badges] Seeded badge definitions');
  } catch (error) {
    console.error('[Badges] Error seeding badges:', error);
  }
}

export default router;
