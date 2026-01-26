/**
 * Workflow Page
 *
 * The main workflow interface for authenticated users in LIVE mode.
 * Shows the full 19-stage research workflow with sidebar navigation.
 */

import { Header } from "@/components/header";
import { WorkflowPipeline } from "@/components/sections/workflow-pipeline";

export default function WorkflowPage() {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="pt-4">
        <WorkflowPipeline />
      </main>
    </div>
  );
}
