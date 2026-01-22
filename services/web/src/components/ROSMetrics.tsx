// components/ROSMetrics.tsx
import React from 'react';
import { safeFixed, formatBytes } from "@/lib/format";

/**
 * Key metrics and pricing data for ROS (Research Operating System)
 * Data sourced from ROS_Webpage_Content_Update.md and ROS_Cost_Analysis_REVISED.xlsx
 */

export const KEY_METRICS = {
  timeSaved: '9-12 months',
  costReduction: '81%',
  effortReduction: '94%',
  aiCostPerStudy: '$6.26',
  traditionalCost: '$30,133',
  rosCost: '$5,765',
  traditionalTime: '18-24 months',
  rosTime: '8-11 months',
  traditionalHours: '590 hours',
  rosHours: '35 hours',
  savingsPerStudy: '$24,368',
  hoursSavedPerStudy: '555 hours'
};

export const PRICING_TIERS = [
  {
    name: 'Researcher',
    price: 99,
    period: '/month',
    annualPrice: 1188,
    users: '1 user',
    description: 'For individual PIs',
    features: ['Unlimited studies', 'Cloud hosted', 'Email support', 'AI costs included']
  },
  {
    name: 'Lab',
    price: 299,
    period: '/month',
    annualPrice: 3588,
    users: 'Up to 5 users',
    description: 'For research teams',
    features: ['Shared workspace', 'Priority support', 'Team collaboration', 'AI costs included'],
    popular: true
  },
  {
    name: 'Department',
    price: 999,
    period: '/month',
    annualPrice: 11988,
    users: 'Up to 25 users',
    description: 'For academic departments',
    features: ['Custom integrations', 'Dedicated success manager', 'On-premise available', 'AI costs included']
  },
  {
    name: 'Enterprise',
    price: null,
    period: 'Custom',
    annualPrice: null, // $50K-$150K typical
    users: 'Unlimited',
    description: 'For institutions & AMCs',
    features: ['SSO/SAML', '24/7 support + SLA', 'Air-gapped deployment', 'Compliance packages']
  }
];

export const ALTERNATIVE_PRICING = {
  perManuscript: {
    price: 3500,
    description: 'Per-study pricing for low volume, no commitment'
  },
  baseOverage: {
    basePrice: 1500,
    overagePrice: 2000,
    includedStudies: 10,
    description: 'Base + overage for variable volume'
  },
  revenueShare: {
    percentage: '10-15%',
    description: 'Percentage of documented savings for risk-averse buyers'
  }
};

export const ROI_DEFAULTS = {
  studiesPerYear: 36,
  subjectsPerStudy: 300,
  traditionalCostPerStudy: 30133,
  rosCostPerStudy: 5765
};

export function HeroMetrics() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-6 my-8">
      <MetricCard value="9-12 mo" label="Time Saved" sublabel="per manuscript" />
      <MetricCard value="81%" label="Cost Reduction" sublabel="$30K → $5.8K" />
      <MetricCard value="94%" label="Less Effort" sublabel="590 → 35 hours" />
      <MetricCard value="~$6" label="AI Cost" sublabel="included in platform" />
    </div>
  );
}

function MetricCard({ value, label, sublabel }: { value: string; label: string; sublabel: string }) {
  return (
    <div className="text-center p-4 bg-white rounded-lg shadow">
      <div className="text-3xl font-bold text-blue-600">{value}</div>
      <div className="text-lg font-semibold text-gray-800">{label}</div>
      <div className="text-sm text-gray-500">{sublabel}</div>
    </div>
  );
}

export function ComparisonTable() {
  const rows = [
    { feature: 'Data extraction', traditional: 'Weeks of chart review', ros: 'Minutes (automated)' },
    { feature: 'PHI compliance', traditional: 'Manual review, high risk', ros: 'Automated, audit-ready' },
    { feature: 'Statistical analysis', traditional: 'Days with statistician', ros: 'Minutes (validated templates)' },
    { feature: 'Manuscript drafting', traditional: 'Weeks of writing', ros: 'Hours (AI + human review)' },
    { feature: 'Revision turnaround', traditional: 'Days to regenerate', ros: 'Minutes (reproducible)' },
    { feature: 'Time to publication', traditional: '18-24 months', ros: '8-11 months' },
    { feature: 'Cost per study', traditional: '$30,133', ros: '$5,765' },
    { feature: 'Personnel hours', traditional: '590 hours', ros: '35 hours' },
  ];

  return (
    <table className="w-full border-collapse">
      <thead>
        <tr className="bg-gray-100">
          <th className="p-3 text-left">Capability</th>
          <th className="p-3 text-left text-red-600">Traditional</th>
          <th className="p-3 text-left text-green-600">With ROS</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => (
          <tr key={i} className="border-b">
            <td className="p-3 font-medium">{row.feature}</td>
            <td className="p-3 text-gray-600">{row.traditional}</td>
            <td className="p-3 text-green-700 font-medium">{row.ros}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function PricingCards() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {PRICING_TIERS.map((tier) => (
        <div
          key={tier.name}
          className={`p-6 rounded-lg border ${
            tier.popular
              ? 'border-blue-500 ring-2 ring-blue-500 bg-blue-50'
              : 'border-gray-200 bg-white'
          }`}
        >
          {tier.popular && (
            <div className="text-xs font-semibold text-blue-600 uppercase mb-2">
              Most Popular
            </div>
          )}
          <h3 className="text-xl font-bold">{tier.name}</h3>
          <p className="text-sm text-gray-500 mb-4">{tier.description}</p>
          <div className="mb-4">
            {tier.price ? (
              <>
                <span className="text-3xl font-bold">${tier.price}</span>
                <span className="text-gray-500">{tier.period}</span>
              </>
            ) : (
              <span className="text-2xl font-bold">Contact Us</span>
            )}
          </div>
          <p className="text-sm text-gray-600 mb-4">{tier.users}</p>
          <ul className="space-y-2">
            {tier.features.map((feature, i) => (
              <li key={i} className="flex items-center text-sm">
                <svg
                  className="w-4 h-4 text-green-500 mr-2"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                    clipRule="evenodd"
                  />
                </svg>
                {feature}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

/**
 * ROI Calculator component
 * Calculates savings based on studies per year and selected tier
 */
export function ROICalculator() {
  const [studiesPerYear, setStudiesPerYear] = React.useState(ROI_DEFAULTS.studiesPerYear);
  const [selectedTier, setSelectedTier] = React.useState('Department');

  const tierFees: Record<string, number> = {
    'Researcher': 1188,
    'Lab': 3588,
    'Department': 11988,
    'Enterprise': 75000 // midpoint estimate
  };

  const traditionalAnnualCost = studiesPerYear * KEY_METRICS.traditionalCost.replace(/[$,]/g, '') as unknown as number;
  const rosStudyCost = studiesPerYear * Number(KEY_METRICS.rosCost.replace(/[$,]/g, ''));
  const platformFee = tierFees[selectedTier] || 11988;
  const totalRosCost = rosStudyCost + platformFee;
  const annualSavings = (studiesPerYear * 30133) - totalRosCost;
  const roi = safeFixed(((annualSavings / platformFee) * 100), 0);
  const monthsSavedPerStudy = 10.5; // midpoint of 9-12 months
  const totalMonthsSaved = studiesPerYear * monthsSavedPerStudy;

  return (
    <div className="bg-gray-50 p-6 rounded-lg">
      <h3 className="text-xl font-bold mb-4">ROI Calculator</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div>
          <label className="block text-sm font-medium mb-1">Studies per year</label>
          <input
            type="number"
            value={studiesPerYear}
            onChange={(e) => setStudiesPerYear(Number(e.target.value))}
            className="w-full p-2 border rounded"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">ROS Tier</label>
          <select
            value={selectedTier}
            onChange={(e) => setSelectedTier(e.target.value)}
            className="w-full p-2 border rounded"
          >
            {PRICING_TIERS.map((tier) => (
              <option key={tier.name} value={tier.name}>
                {tier.name} (${tier.annualPrice || '50K-150K'}/year)
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="text-center p-3 bg-white rounded shadow">
          <div className="text-2xl font-bold text-green-600">
            ${annualSavings.toLocaleString()}
          </div>
          <div className="text-sm text-gray-600">Annual Savings</div>
        </div>
        <div className="text-center p-3 bg-white rounded shadow">
          <div className="text-2xl font-bold text-blue-600">{roi}%</div>
          <div className="text-sm text-gray-600">ROI on Platform</div>
        </div>
        <div className="text-center p-3 bg-white rounded shadow">
          <div className="text-2xl font-bold text-purple-600">
            {Math.round(totalMonthsSaved)} mo
          </div>
          <div className="text-sm text-gray-600">Total Time Saved</div>
        </div>
        <div className="text-center p-3 bg-white rounded shadow">
          <div className="text-2xl font-bold text-orange-600">
            {Math.round(platformFee / (annualSavings / 12))} mo
          </div>
          <div className="text-sm text-gray-600">Payback Period</div>
        </div>
      </div>
    </div>
  );
}

export default {
  KEY_METRICS,
  PRICING_TIERS,
  ALTERNATIVE_PRICING,
  ROI_DEFAULTS,
  HeroMetrics,
  ComparisonTable,
  PricingCards,
  ROICalculator
};
