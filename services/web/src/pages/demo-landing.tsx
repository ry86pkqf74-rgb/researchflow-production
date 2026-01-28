/**
 * Demo Landing Page
 * 
 * Public landing page for DEMO mode.
 * No login required - showcases how ResearchFlow Canvas works.
 */

import { Link } from 'wouter';
import { ArrowRight, Play, Shield, FileText, BarChart3, Workflow, Brain, Lock, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export default function DemoLanding() {
  const handleLoginClick = () => {
    window.location.href = '/login';
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-800 text-white" data-testid="demo-landing-page">
      {/* Hero Section */}
      <div className="max-w-6xl mx-auto px-6 py-16">
        <div className="text-center mb-12">
          <Badge variant="outline" className="mb-4 text-amber-400 border-amber-400" data-testid="badge-demo-mode">
            DEMO MODE
          </Badge>
          <h1 className="text-5xl font-bold mb-4 bg-gradient-to-r from-white to-slate-300 bg-clip-text text-transparent" data-testid="text-page-title">
            ResearchFlow Canvas
          </h1>
          <p className="text-xl text-slate-300 mb-2" data-testid="text-page-subtitle">
            20-Stage Research Workflow Management System
          </p>
          <p className="text-slate-400 max-w-2xl mx-auto" data-testid="text-page-description">
            From topic declaration to publication - governed, audited, and AI-enhanced at every step.
          </p>
        </div>
        
        {/* Demo Mode Notice */}
        <Card className="bg-amber-500/10 border-amber-500/50 mb-12" data-testid="card-demo-notice">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-500/20">
                <Play className="h-5 w-5 text-amber-400" aria-hidden="true" />
              </div>
              <CardTitle className="text-amber-400 text-lg" data-testid="text-demo-notice-title">
                You're in DEMO Mode
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-slate-300 mb-4" data-testid="text-demo-notice-description">
              Explore the complete research workflow without logging in. 
              All AI responses are simulated to show you how the system works.
              Data uploads and exports are disabled in demo mode.
            </p>
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary" className="bg-slate-700 text-slate-300" data-testid="badge-no-login">
                <CheckCircle className="h-3 w-3 mr-1" aria-hidden="true" /> No login required
              </Badge>
              <Badge variant="secondary" className="bg-slate-700 text-slate-300" data-testid="badge-simulated-ai">
                <CheckCircle className="h-3 w-3 mr-1" aria-hidden="true" /> Simulated AI responses
              </Badge>
              <Badge variant="secondary" className="bg-slate-700 text-slate-300" data-testid="badge-full-explore">
                <CheckCircle className="h-3 w-3 mr-1" aria-hidden="true" /> Full feature exploration
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Feature Cards */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
          <Link href="/" data-testid="link-explore-workflow">
            <Card className="bg-slate-800/50 border-slate-700 transition-all cursor-pointer h-full" data-testid="card-explore-workflow">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-blue-500/20">
                    <Workflow className="h-5 w-5 text-blue-400" aria-hidden="true" />
                  </div>
                  <CardTitle className="text-white text-lg">20-Stage Workflow</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-slate-400">
                  See how research flows from topic declaration through literature review, analysis, and publication.
                </CardDescription>
              </CardContent>
            </Card>
          </Link>

          <Link href="/governance-console" data-testid="link-governance-console">
            <Card className="bg-slate-800/50 border-slate-700 transition-all cursor-pointer h-full" data-testid="card-governance-console">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-green-500/20">
                    <Shield className="h-5 w-5 text-green-400" aria-hidden="true" />
                  </div>
                  <CardTitle className="text-white text-lg">Governance Console</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-slate-400">
                  Explore PHI gating, RBAC controls, approval workflows, and audit logging.
                </CardDescription>
              </CardContent>
            </Card>
          </Link>

          <Link href="/pipeline" data-testid="link-pipeline-dashboard">
            <Card className="bg-slate-800/50 border-slate-700 transition-all cursor-pointer h-full" data-testid="card-pipeline-dashboard">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-purple-500/20">
                    <BarChart3 className="h-5 w-5 text-purple-400" aria-hidden="true" />
                  </div>
                  <CardTitle className="text-white text-lg">Pipeline Dashboard</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-slate-400">
                  Monitor research pipeline status, track progress, and view analytics.
                </CardDescription>
              </CardContent>
            </Card>
          </Link>

          <Link href="/governance" data-testid="link-governance-overview">
            <Card className="bg-slate-800/50 border-slate-700 transition-all cursor-pointer h-full" data-testid="card-governance-overview">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-orange-500/20">
                    <Lock className="h-5 w-5 text-orange-400" aria-hidden="true" />
                  </div>
                  <CardTitle className="text-white text-lg">Governance Overview</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-slate-400">
                  Learn about data classification, PHI protection, and compliance controls.
                </CardDescription>
              </CardContent>
            </Card>
          </Link>

          <Card className="bg-slate-800/50 border-slate-700 h-full" data-testid="card-ai-features">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-cyan-500/20">
                  <Brain className="h-5 w-5 text-cyan-400" aria-hidden="true" />
                </div>
                <CardTitle className="text-white text-lg">AI-Powered Features</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <CardDescription className="text-slate-400">
                Literature search, manuscript drafting, statistical analysis - all with AI assistance.
              </CardDescription>
            </CardContent>
          </Card>

          <Card className="bg-slate-800/50 border-slate-700 h-full" data-testid="card-manuscript">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-pink-500/20">
                  <FileText className="h-5 w-5 text-pink-400" aria-hidden="true" />
                </div>
                <CardTitle className="text-white text-lg">Manuscript Generation</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <CardDescription className="text-slate-400">
                Generate publication-ready manuscripts with citations, figures, and tables.
              </CardDescription>
            </CardContent>
          </Card>
        </div>

        {/* CTA Section */}
        <div className="text-center bg-slate-800/30 rounded-xl p-8 border border-slate-700" data-testid="section-cta">
          <h2 className="text-2xl font-bold mb-4" data-testid="text-cta-title">Ready for Full Functionality?</h2>
          <p className="text-slate-400 mb-6 max-w-xl mx-auto" data-testid="text-cta-description">
            LIVE mode enables real AI calls, data processing, and export capabilities.
            Login to unlock the complete ResearchFlow Canvas experience.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button 
              size="lg" 
              className="bg-green-600 text-white font-bold gap-2"
              onClick={handleLoginClick}
              data-testid="button-login-live-mode"
            >
              Login for LIVE Mode
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Button>
            <Link href="/" data-testid="link-continue-demo">
              <Button 
                size="lg" 
                variant="outline" 
                className="border-slate-600 text-slate-300 gap-2"
                data-testid="button-continue-demo"
              >
                <Play className="h-4 w-4" aria-hidden="true" />
                Continue Exploring Demo
              </Button>
            </Link>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-12 pt-8 border-t border-slate-800 text-center text-slate-500 text-sm" data-testid="section-footer">
          <p data-testid="text-footer-title">ResearchFlow Canvas - Governed Research Workflow Platform</p>
          <p className="mt-2" data-testid="text-footer-disclaimer">
            DEMO mode provides simulated responses. No data is processed or stored.
          </p>
        </div>
      </div>
    </div>
  );
}
