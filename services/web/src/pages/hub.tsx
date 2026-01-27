/**
 * Planning Hub Page
 *
 * Main page for the Planning Hub feature.
 * Displays hub dashboard for projects with pages, tasks, goals, and timeline.
 */

import { useParams } from 'wouter';
import { HubDashboard } from '@/components/hub';

export default function HubPage() {
  const params = useParams<{ projectId?: string }>();

  return (
    <div className="min-h-screen bg-background">
      <HubDashboard projectId={params.projectId} />
    </div>
  );
}
