import { Header } from "@/components/header";
import { HeroSection } from "@/components/sections/hero-section";
import { ProblemSection } from "@/components/sections/problem-section";
import { SolutionSection } from "@/components/sections/solution-section";
import { WorkflowPipeline } from "@/components/sections/workflow-pipeline";
import { CapabilitiesSection } from "@/components/sections/capabilities-section";
import { GovernanceSection } from "@/components/sections/governance-section";
import { DemoSection } from "@/components/sections/demo-section";
import { DatasetLibrary } from "@/components/sections/dataset-library";
import { TimelineComparison } from "@/components/sections/timeline-comparison";
import { InteractiveDemo } from "@/components/sections/interactive-demo";
import { AIInsightsSection } from "@/components/sections/ai-insights-section";
import { ManuscriptBranching } from "@/components/sections/manuscript-branching";
import { ArtifactVault } from "@/components/sections/artifact-vault";
import { AIRouter } from "@/components/sections/ai-router";
import { DeidentificationPipeline } from "@/components/sections/deidentification-pipeline";
import { CTASection } from "@/components/sections/cta-section";
import { FooterSection } from "@/components/sections/footer-section";

export default function Home() {
  return (
    <div className="min-h-screen bg-background scroll-smooth">
      <Header />
      <main>
        <HeroSection />
        <ProblemSection />
        <SolutionSection />
        <section id="workflow">
          <WorkflowPipeline />
        </section>
        <section id="ai-insights">
          <AIInsightsSection />
        </section>
        <section id="datasets">
          <DatasetLibrary />
        </section>
        <section id="timeline">
          <TimelineComparison />
        </section>
        <section id="features">
          <CapabilitiesSection />
        </section>
        <section id="compliance">
          <GovernanceSection />
        </section>
        <section id="manuscript-branching">
          <ManuscriptBranching />
        </section>
        <section id="artifact-vault">
          <ArtifactVault />
        </section>
        <section id="ai-router">
          <AIRouter />
        </section>
        <section id="deidentification">
          <DeidentificationPipeline />
        </section>
        <section id="demo">
          <DemoSection />
        </section>
        <section id="try-demo">
          <InteractiveDemo />
        </section>
        <CTASection />
      </main>
      <FooterSection />
    </div>
  );
}
