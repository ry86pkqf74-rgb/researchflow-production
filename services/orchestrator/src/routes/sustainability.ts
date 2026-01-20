/**
 * Sustainability Routes (Task 95)
 *
 * CO2 tracking and sustainability metrics for research operations.
 * Tracks environmental impact of AI usage and computing resources.
 */

import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/governance';
import { resolveOrgContext, requireOrgMember } from '../middleware/org-context';

const router = Router();
const FEATURE_SUSTAINABILITY = process.env.FEATURE_SUSTAINABILITY !== 'false';

// CO2 emission estimates (kg CO2 per unit)
const EMISSION_FACTORS = {
  // Per 1000 API tokens (approximate)
  aiTokens: 0.0004,
  // Per GB of storage per month
  storage: 0.02,
  // Per hour of compute
  compute: 0.05,
  // Per GB of data transfer
  dataTransfer: 0.01,
};

interface SustainabilityMetrics {
  period: string;
  totalCO2Kg: number;
  breakdown: {
    aiUsage: number;
    storage: number;
    compute: number;
    dataTransfer: number;
  };
  equivalents: {
    carMiles: number;
    treesNeeded: number;
    smartphoneCharges: number;
  };
  comparison: {
    previousPeriod: number;
    percentChange: number;
  };
}

router.use(requireAuth);
router.use(resolveOrgContext);
router.use(requireOrgMember);

/**
 * GET /sustainability
 * Get sustainability overview for the organization
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    if (!FEATURE_SUSTAINABILITY) {
      return res.json({
        enabled: false,
        message: 'Sustainability tracking is disabled',
      });
    }

    const orgId = (req as any).orgId;
    const { period = 'month' } = req.query;

    // In production, this would aggregate actual usage data
    // For now, return mock data
    const metrics = generateMockMetrics(period as string);

    res.json({
      enabled: true,
      orgId,
      metrics,
      tips: getSustainabilityTips(metrics),
    });
  } catch (error: any) {
    console.error('[Sustainability] Error getting metrics:', error);
    res.status(500).json({ error: 'Failed to get sustainability metrics' });
  }
});

/**
 * GET /sustainability/history
 * Get historical sustainability data
 */
router.get('/history', async (req: Request, res: Response) => {
  try {
    if (!FEATURE_SUSTAINABILITY) {
      return res.json({ history: [] });
    }

    const { months = '6' } = req.query;
    const numMonths = parseInt(months as string, 10);

    // Generate mock historical data
    const history = [];
    const now = new Date();

    for (let i = numMonths - 1; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthName = date.toLocaleString('en-US', { month: 'short', year: 'numeric' });

      // Random but trending data
      const baseCO2 = 5 + Math.random() * 3;
      const trend = (numMonths - i) * 0.1; // Slight upward trend

      history.push({
        period: monthName,
        totalCO2Kg: parseFloat((baseCO2 + trend).toFixed(2)),
        aiUsage: parseFloat((baseCO2 * 0.6 + trend * 0.5).toFixed(2)),
        storage: parseFloat((baseCO2 * 0.2).toFixed(2)),
        compute: parseFloat((baseCO2 * 0.15).toFixed(2)),
        dataTransfer: parseFloat((baseCO2 * 0.05).toFixed(2)),
      });
    }

    res.json({ history });
  } catch (error: any) {
    console.error('[Sustainability] Error getting history:', error);
    res.status(500).json({ error: 'Failed to get history' });
  }
});

/**
 * GET /sustainability/comparison
 * Compare with similar organizations
 */
router.get('/comparison', async (req: Request, res: Response) => {
  try {
    if (!FEATURE_SUSTAINABILITY) {
      return res.json({ comparison: null });
    }

    // Mock comparison data
    res.json({
      comparison: {
        yourOrg: 7.5,
        industryAverage: 12.3,
        topPerformers: 4.2,
        percentile: 35, // Better than 65% of orgs
        ranking: 'Above Average',
      },
    });
  } catch (error: any) {
    console.error('[Sustainability] Error getting comparison:', error);
    res.status(500).json({ error: 'Failed to get comparison' });
  }
});

/**
 * POST /sustainability/offset
 * Record carbon offset purchase
 */
router.post('/offset', async (req: Request, res: Response) => {
  try {
    if (!FEATURE_SUSTAINABILITY) {
      return res.status(400).json({ error: 'Feature disabled' });
    }

    const { amount, provider, certificateId } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({ error: 'Valid amount required' });
    }

    // In production, this would record the offset
    console.log(`[Sustainability] Recorded offset: ${amount}kg CO2 via ${provider}`);

    res.json({
      success: true,
      offset: {
        amount,
        provider: provider || 'ResearchFlow Green',
        certificateId: certificateId || `RFC-${Date.now()}`,
        date: new Date().toISOString(),
      },
    });
  } catch (error: any) {
    console.error('[Sustainability] Error recording offset:', error);
    res.status(500).json({ error: 'Failed to record offset' });
  }
});

/**
 * GET /sustainability/goals
 * Get sustainability goals and progress
 */
router.get('/goals', async (req: Request, res: Response) => {
  try {
    if (!FEATURE_SUSTAINABILITY) {
      return res.json({ goals: [] });
    }

    // Mock goals
    res.json({
      goals: [
        {
          id: 'reduce_ai_usage',
          title: 'Reduce AI Usage by 10%',
          target: 10,
          current: 7,
          unit: 'percent',
          deadline: '2024-12-31',
          status: 'on_track',
        },
        {
          id: 'carbon_neutral',
          title: 'Carbon Neutral Operations',
          target: 100,
          current: 45,
          unit: 'percent_offset',
          deadline: '2025-06-30',
          status: 'in_progress',
        },
      ],
    });
  } catch (error: any) {
    console.error('[Sustainability] Error getting goals:', error);
    res.status(500).json({ error: 'Failed to get goals' });
  }
});

/**
 * Generate mock metrics for a period
 */
function generateMockMetrics(period: string): SustainabilityMetrics {
  const multiplier = period === 'year' ? 12 : period === 'week' ? 0.25 : 1;

  const aiUsage = parseFloat((3.5 * multiplier + Math.random()).toFixed(2));
  const storage = parseFloat((1.2 * multiplier + Math.random() * 0.3).toFixed(2));
  const compute = parseFloat((1.8 * multiplier + Math.random() * 0.5).toFixed(2));
  const dataTransfer = parseFloat((0.5 * multiplier + Math.random() * 0.2).toFixed(2));
  const totalCO2Kg = parseFloat((aiUsage + storage + compute + dataTransfer).toFixed(2));

  return {
    period,
    totalCO2Kg,
    breakdown: {
      aiUsage,
      storage,
      compute,
      dataTransfer,
    },
    equivalents: {
      // 1 mile driven = ~0.4 kg CO2
      carMiles: Math.round(totalCO2Kg / 0.4),
      // 1 tree absorbs ~22 kg CO2/year
      treesNeeded: parseFloat((totalCO2Kg / 22 * 12).toFixed(2)),
      // 1 smartphone charge = ~0.008 kg CO2
      smartphoneCharges: Math.round(totalCO2Kg / 0.008),
    },
    comparison: {
      previousPeriod: parseFloat((totalCO2Kg * (0.9 + Math.random() * 0.2)).toFixed(2)),
      percentChange: parseFloat((Math.random() * 20 - 10).toFixed(1)),
    },
  };
}

/**
 * Generate sustainability tips based on metrics
 */
function getSustainabilityTips(metrics: SustainabilityMetrics): string[] {
  const tips: string[] = [];

  if (metrics.breakdown.aiUsage > 3) {
    tips.push('Consider batching AI requests to reduce API calls');
  }
  if (metrics.breakdown.storage > 1.5) {
    tips.push('Archive unused datasets to reduce storage footprint');
  }
  if (metrics.breakdown.compute > 2) {
    tips.push('Schedule compute-intensive tasks during off-peak hours');
  }
  if (metrics.comparison.percentChange > 5) {
    tips.push('Your carbon footprint increased this period - review usage patterns');
  }

  if (tips.length === 0) {
    tips.push('Great job! Your sustainability metrics are within optimal range');
  }

  return tips;
}

export default router;
