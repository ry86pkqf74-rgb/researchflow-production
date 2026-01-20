/**
 * Sustainability Metrics Service
 *
 * Tasks 171, 193: Track and optimize AI carbon footprint
 * Provides green mode recommendations for eco-conscious AI routing.
 */

import type { ModelTier, AITaskType } from './types';

/**
 * Carbon intensity estimates per model tier (gCO2e per 1M tokens)
 * Based on publicly available estimates for cloud GPU inference
 */
export const CARBON_INTENSITY: Record<ModelTier, number> = {
  NANO: 5,      // Smallest models, lowest energy
  MINI: 15,     // Medium models
  FRONTIER: 50, // Large models, highest energy
};

/**
 * Energy efficiency ratings (tokens per watt-hour, estimated)
 */
export const ENERGY_EFFICIENCY: Record<ModelTier, number> = {
  NANO: 10000,
  MINI: 3000,
  FRONTIER: 500,
};

/**
 * Sustainability metrics for a single AI invocation
 */
export interface SustainabilityMetrics {
  /** Estimated carbon emissions in grams CO2 equivalent */
  carbonGrams: number;
  /** Estimated energy consumption in watt-hours */
  energyWh: number;
  /** Model tier used */
  tier: ModelTier;
  /** Total tokens processed */
  totalTokens: number;
  /** Whether green mode was active */
  greenModeActive: boolean;
  /** Potential savings if green mode had been used */
  potentialSavings?: {
    carbonGrams: number;
    tier: ModelTier;
  };
}

/**
 * Aggregated sustainability report
 */
export interface SustainabilityReport {
  /** Total carbon emissions in grams CO2e */
  totalCarbonGrams: number;
  /** Total energy consumption in watt-hours */
  totalEnergyWh: number;
  /** Total tokens processed */
  totalTokens: number;
  /** Breakdown by tier */
  byTier: Record<ModelTier, {
    invocations: number;
    tokens: number;
    carbonGrams: number;
    energyWh: number;
  }>;
  /** Carbon saved by using green mode */
  carbonSaved: number;
  /** Equivalent metrics */
  equivalents: {
    /** Miles driven in average car */
    carMiles: number;
    /** Smartphone charges */
    phoneCharges: number;
    /** Hours of LED bulb usage */
    ledHours: number;
  };
}

/**
 * Green mode recommendation
 */
export interface GreenModeRecommendation {
  /** Whether to use a lower tier */
  shouldDowngrade: boolean;
  /** Recommended tier */
  recommendedTier: ModelTier;
  /** Original tier requested */
  originalTier: ModelTier;
  /** Estimated carbon savings in grams */
  carbonSavingsGrams: number;
  /** Quality trade-off description */
  qualityImpact: 'none' | 'minimal' | 'moderate' | 'significant';
  /** Reason for recommendation */
  reason: string;
}

/**
 * Task types that can safely use lower tiers
 */
const GREEN_MODE_ELIGIBLE_TASKS: Set<AITaskType> = new Set([
  'classify',
  'extract_metadata',
  'format_validate',
  'summarize',
  'template_fill',
] as AITaskType[]);

/**
 * Sustainability Service
 *
 * Tracks carbon footprint and provides green mode recommendations
 */
export class SustainabilityService {
  private invocationLog: SustainabilityMetrics[] = [];
  private greenModeEnabled: boolean = false;

  /**
   * Enable or disable green mode globally
   */
  setGreenMode(enabled: boolean): void {
    this.greenModeEnabled = enabled;
  }

  /**
   * Check if green mode is enabled
   */
  isGreenModeEnabled(): boolean {
    return this.greenModeEnabled;
  }

  /**
   * Calculate sustainability metrics for an AI invocation
   */
  calculateMetrics(
    tier: ModelTier,
    inputTokens: number,
    outputTokens: number,
    greenModeActive: boolean = this.greenModeEnabled
  ): SustainabilityMetrics {
    const totalTokens = inputTokens + outputTokens;
    const carbonPerMToken = CARBON_INTENSITY[tier];
    const efficiency = ENERGY_EFFICIENCY[tier];

    const carbonGrams = (totalTokens / 1_000_000) * carbonPerMToken;
    const energyWh = totalTokens / efficiency;

    const metrics: SustainabilityMetrics = {
      carbonGrams,
      energyWh,
      tier,
      totalTokens,
      greenModeActive,
    };

    // Calculate potential savings if a lower tier could have been used
    if (tier !== 'NANO') {
      const lowerTier: ModelTier = tier === 'FRONTIER' ? 'MINI' : 'NANO';
      const lowerCarbon = (totalTokens / 1_000_000) * CARBON_INTENSITY[lowerTier];
      metrics.potentialSavings = {
        carbonGrams: carbonGrams - lowerCarbon,
        tier: lowerTier,
      };
    }

    // Log for reporting
    this.invocationLog.push(metrics);

    return metrics;
  }

  /**
   * Get green mode recommendation for a task
   */
  getGreenRecommendation(
    taskType: AITaskType,
    requestedTier: ModelTier
  ): GreenModeRecommendation {
    const isEligible = GREEN_MODE_ELIGIBLE_TASKS.has(taskType);

    if (!isEligible || requestedTier === 'NANO') {
      return {
        shouldDowngrade: false,
        recommendedTier: requestedTier,
        originalTier: requestedTier,
        carbonSavingsGrams: 0,
        qualityImpact: 'none',
        reason: requestedTier === 'NANO'
          ? 'Already using lowest tier'
          : 'Task requires higher capability tier',
      };
    }

    // Recommend one tier lower
    const recommendedTier: ModelTier = requestedTier === 'FRONTIER' ? 'MINI' : 'NANO';

    // Estimate savings based on average invocation (1000 tokens)
    const avgTokens = 1000;
    const originalCarbon = (avgTokens / 1_000_000) * CARBON_INTENSITY[requestedTier];
    const newCarbon = (avgTokens / 1_000_000) * CARBON_INTENSITY[recommendedTier];

    return {
      shouldDowngrade: true,
      recommendedTier,
      originalTier: requestedTier,
      carbonSavingsGrams: originalCarbon - newCarbon,
      qualityImpact: requestedTier === 'FRONTIER' ? 'minimal' : 'moderate',
      reason: `Task type "${taskType}" can use ${recommendedTier} tier with acceptable quality`,
    };
  }

  /**
   * Generate sustainability report from logged invocations
   */
  generateReport(): SustainabilityReport {
    const byTier: SustainabilityReport['byTier'] = {
      NANO: { invocations: 0, tokens: 0, carbonGrams: 0, energyWh: 0 },
      MINI: { invocations: 0, tokens: 0, carbonGrams: 0, energyWh: 0 },
      FRONTIER: { invocations: 0, tokens: 0, carbonGrams: 0, energyWh: 0 },
    };

    let totalCarbonGrams = 0;
    let totalEnergyWh = 0;
    let totalTokens = 0;
    let carbonSaved = 0;

    for (const metrics of this.invocationLog) {
      byTier[metrics.tier].invocations++;
      byTier[metrics.tier].tokens += metrics.totalTokens;
      byTier[metrics.tier].carbonGrams += metrics.carbonGrams;
      byTier[metrics.tier].energyWh += metrics.energyWh;

      totalCarbonGrams += metrics.carbonGrams;
      totalEnergyWh += metrics.energyWh;
      totalTokens += metrics.totalTokens;

      if (metrics.greenModeActive && metrics.potentialSavings) {
        carbonSaved += metrics.potentialSavings.carbonGrams;
      }
    }

    // Calculate equivalents
    // 1 gram CO2e ≈ 0.002 miles driven
    // 1 phone charge ≈ 8.22 grams CO2e
    // 1 hour LED ≈ 0.6 grams CO2e
    const equivalents = {
      carMiles: totalCarbonGrams * 0.002,
      phoneCharges: totalCarbonGrams / 8.22,
      ledHours: totalCarbonGrams / 0.6,
    };

    return {
      totalCarbonGrams,
      totalEnergyWh,
      totalTokens,
      byTier,
      carbonSaved,
      equivalents,
    };
  }

  /**
   * Clear the invocation log
   */
  clearLog(): void {
    this.invocationLog = [];
  }

  /**
   * Get the current invocation count
   */
  getInvocationCount(): number {
    return this.invocationLog.length;
  }
}

/**
 * Singleton instance
 */
let instance: SustainabilityService | null = null;

export function getSustainabilityService(): SustainabilityService {
  if (!instance) {
    instance = new SustainabilityService();
  }
  return instance;
}

/**
 * Format carbon emissions for display
 */
export function formatCarbonEmissions(grams: number): string {
  if (grams < 1) {
    return `${(grams * 1000).toFixed(2)} mg CO₂e`;
  }
  if (grams < 1000) {
    return `${grams.toFixed(2)} g CO₂e`;
  }
  return `${(grams / 1000).toFixed(2)} kg CO₂e`;
}

/**
 * Format energy consumption for display
 */
export function formatEnergyConsumption(wh: number): string {
  if (wh < 1) {
    return `${(wh * 1000).toFixed(2)} mWh`;
  }
  if (wh < 1000) {
    return `${wh.toFixed(2)} Wh`;
  }
  return `${(wh / 1000).toFixed(2)} kWh`;
}
