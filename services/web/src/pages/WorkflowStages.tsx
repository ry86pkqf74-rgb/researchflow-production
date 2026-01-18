/**
 * Workflow Stages Page
 *
 * Displays all 19 research workflow stages with:
 * - Stage status indicators
 * - Governance restrictions
 * - Navigation to stage details
 *
 * Priority: P0 - CRITICAL (Phase 2 Integration)
 */

import React from 'react';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import {
  FileText,
  Database,
  Search,
  Brain,
  FileCheck,
  Eye,
  Shield,
  Lock,
  CheckCircle,
  Clock,
  AlertCircle,
  BarChart3,
  ArrowRight
} from 'lucide-react';

interface WorkflowStage {
  id: number;
  name: string;
  description: string;
  status: 'available' | 'requires-approval' | 'locked' | 'coming-soon';
  icon: React.ElementType;
  requiresDataClassification?: string[];
  phaseNumber: number;
  actionRoute?: string;
  actionLabel?: string;
}

const WORKFLOW_STAGES: WorkflowStage[] = [
  // Phase 3: Core Research Pipeline (Stages 1-8)
  {
    id: 1,
    name: 'Upload & Classify Data',
    description: 'Upload datasets with automatic PHI scanning and classification',
    status: 'available',
    icon: Database,
    requiresDataClassification: ['SYNTHETIC', 'DEIDENTIFIED'],
    phaseNumber: 3
  },
  {
    id: 2,
    name: 'Generate Research Questions',
    description: 'AI-assisted question generation from dataset analysis',
    status: 'coming-soon',
    icon: Brain,
    phaseNumber: 3
  },
  {
    id: 3,
    name: 'Literature Search',
    description: 'PubMed and Semantic Scholar integration for context',
    status: 'coming-soon',
    icon: Search,
    phaseNumber: 3
  },
  {
    id: 4,
    name: 'Draft Results',
    description: 'AI-powered draft generation with citation tracking',
    status: 'requires-approval',
    icon: FileText,
    requiresDataClassification: ['SYNTHETIC', 'DEIDENTIFIED'],
    phaseNumber: 3
  },
  {
    id: 5,
    name: 'Claim Linting',
    description: 'Automated quality checks for forbidden language and unsupported claims',
    status: 'available',
    icon: FileCheck,
    phaseNumber: 3
  },
  {
    id: 6,
    name: 'Human Review',
    description: 'Expert review with inline commenting and approval workflow',
    status: 'coming-soon',
    icon: Eye,
    phaseNumber: 3
  },
  {
    id: 7,
    name: 'Presentation Mode',
    description: 'Generate slide decks from approved drafts',
    status: 'locked',
    icon: FileText,
    requiresDataClassification: ['SYNTHETIC'],
    phaseNumber: 3
  },
  {
    id: 8,
    name: 'Export Results',
    description: 'Export approved content with governance watermarking',
    status: 'requires-approval',
    icon: Shield,
    requiresDataClassification: ['SYNTHETIC', 'DEIDENTIFIED'],
    phaseNumber: 3
  },
  // Phase 4: Advanced Features (Stages 9-14)
  {
    id: 9,
    name: 'Statistical Analysis',
    description: 'Build and manage Statistical Analysis Plans (SAP) with automated testing',
    status: 'available',
    icon: BarChart3,
    phaseNumber: 4,
    actionRoute: '/sap/demo-topic/demo-research',
    actionLabel: 'Open SAP Builder'
  },
  {
    id: 10,
    name: 'Citation Management',
    description: 'BibTeX import/export and citation validation',
    status: 'coming-soon',
    icon: FileText,
    phaseNumber: 4
  },
  {
    id: 11,
    name: 'Version Control',
    description: 'Draft versioning with diff tracking',
    status: 'coming-soon',
    icon: Clock,
    phaseNumber: 4
  },
  {
    id: 12,
    name: 'Collaboration',
    description: 'Multi-user editing with role-based access',
    status: 'coming-soon',
    icon: Eye,
    phaseNumber: 4
  },
  {
    id: 13,
    name: 'Template Library',
    description: 'Pre-built templates for common study types',
    status: 'coming-soon',
    icon: FileText,
    phaseNumber: 4
  },
  {
    id: 14,
    name: 'Quality Metrics',
    description: 'Automated quality scoring and improvement suggestions',
    status: 'coming-soon',
    icon: CheckCircle,
    phaseNumber: 4
  },
  // Phase 5: Polish & Production (Stages 15-19)
  {
    id: 15,
    name: 'Audit Trail',
    description: 'Complete audit logging with hash-chaining',
    status: 'available',
    icon: Shield,
    phaseNumber: 5
  },
  {
    id: 16,
    name: 'Compliance Dashboard',
    description: 'Real-time compliance monitoring and alerts',
    status: 'coming-soon',
    icon: AlertCircle,
    phaseNumber: 5
  },
  {
    id: 17,
    name: 'Data Steward Portal',
    description: 'Centralized approval and oversight interface',
    status: 'coming-soon',
    icon: Shield,
    phaseNumber: 5
  },
  {
    id: 18,
    name: 'Integration APIs',
    description: 'REST APIs for external tool integration',
    status: 'coming-soon',
    icon: Database,
    phaseNumber: 5
  },
  {
    id: 19,
    name: 'Production Deployment',
    description: 'HIPAA-compliant cloud deployment configuration',
    status: 'locked',
    icon: Lock,
    phaseNumber: 5
  }
];

function StageCard({ stage }: { stage: WorkflowStage }) {
  const Icon = stage.icon;
  const [, navigate] = useLocation();

  const statusConfig = {
    'available': {
      badge: 'AVAILABLE',
      badgeColor: 'bg-green-100 text-green-700 border-green-300',
      borderColor: 'border-green-300',
      bgColor: 'bg-white hover:bg-green-50'
    },
    'requires-approval': {
      badge: 'REQUIRES APPROVAL',
      badgeColor: 'bg-yellow-100 text-yellow-700 border-yellow-300',
      borderColor: 'border-yellow-300',
      bgColor: 'bg-white hover:bg-yellow-50'
    },
    'locked': {
      badge: 'LOCKED',
      badgeColor: 'bg-red-100 text-red-700 border-red-300',
      borderColor: 'border-red-300',
      bgColor: 'bg-gray-50'
    },
    'coming-soon': {
      badge: 'COMING SOON',
      badgeColor: 'bg-gray-100 text-gray-700 border-gray-300',
      borderColor: 'border-gray-300',
      bgColor: 'bg-gray-50'
    }
  };

  const config = statusConfig[stage.status];

  return (
    <div 
      className={`border-2 rounded-lg p-6 ${config.borderColor} ${config.bgColor} transition-colors`}
      data-testid={`card-stage-${stage.id}`}
    >
      <div className="flex items-start justify-between mb-3 gap-2">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-100 rounded-lg">
            <Icon className="h-6 w-6 text-blue-600" />
          </div>
          <div>
            <div className="text-xs font-semibold text-gray-500">STAGE {stage.id}</div>
            <h3 className="text-lg font-bold text-gray-900">{stage.name}</h3>
          </div>
        </div>
        <span className={`px-3 py-1 rounded-full text-xs font-semibold border-2 whitespace-nowrap ${config.badgeColor}`}>
          {config.badge}
        </span>
      </div>

      <p className="text-sm text-gray-600 mb-4">
        {stage.description}
      </p>

      {stage.requiresDataClassification && (
        <div className="text-xs text-gray-500 mt-2">
          <span className="font-semibold">Allowed for:</span>{' '}
          {stage.requiresDataClassification.join(', ')} data
        </div>
      )}

      {stage.actionRoute && stage.status === 'available' && (
        <div className="mt-4">
          <Button
            onClick={() => navigate(stage.actionRoute!)}
            className="w-full"
            data-testid={`button-stage-${stage.id}-action`}
          >
            {stage.actionLabel || 'Open'}
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        </div>
      )}

      <div className="mt-4 pt-4 border-t border-gray-200">
        <span className="text-xs font-semibold text-gray-500">
          Phase {stage.phaseNumber} Feature
        </span>
      </div>
    </div>
  );
}

function WorkflowStages() {
  const phase3Stages = WORKFLOW_STAGES.filter(s => s.phaseNumber === 3);
  const phase4Stages = WORKFLOW_STAGES.filter(s => s.phaseNumber === 4);
  const phase5Stages = WORKFLOW_STAGES.filter(s => s.phaseNumber === 5);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h1 className="text-3xl font-bold text-gray-900">
          19-Stage Research Workflow
        </h1>
        <p className="mt-2 text-gray-600">
          Governance-first research pipeline from data upload to publication
        </p>
        <div className="mt-4 flex gap-4">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-green-500"></div>
            <span className="text-sm text-gray-600">Available Now</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
            <span className="text-sm text-gray-600">Requires Approval</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-red-500"></div>
            <span className="text-sm text-gray-600">Locked</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-gray-500"></div>
            <span className="text-sm text-gray-600">Coming Soon</span>
          </div>
        </div>
      </div>

      {/* Phase 3: Core Research Pipeline */}
      <div>
        <div className="mb-4">
          <h2 className="text-2xl font-bold text-gray-900">
            Phase 3: Core Research Pipeline
          </h2>
          <p className="text-gray-600">Stages 1-8: Essential workflow functionality</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {phase3Stages.map(stage => (
            <StageCard key={stage.id} stage={stage} />
          ))}
        </div>
      </div>

      {/* Phase 4: Advanced Features */}
      <div>
        <div className="mb-4">
          <h2 className="text-2xl font-bold text-gray-900">
            Phase 4: Advanced Features
          </h2>
          <p className="text-gray-600">Stages 9-14: Enhanced capabilities and collaboration</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {phase4Stages.map(stage => (
            <StageCard key={stage.id} stage={stage} />
          ))}
        </div>
      </div>

      {/* Phase 5: Polish & Production */}
      <div>
        <div className="mb-4">
          <h2 className="text-2xl font-bold text-gray-900">
            Phase 5: Polish & Production
          </h2>
          <p className="text-gray-600">Stages 15-19: Production readiness and deployment</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {phase5Stages.map(stage => (
            <StageCard key={stage.id} stage={stage} />
          ))}
        </div>
      </div>
    </div>
  );
}

export default WorkflowStages;
