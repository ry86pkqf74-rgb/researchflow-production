/**
 * Timeline Projections Page
 *
 * Page wrapper for the HubTimeline component.
 */

import { useParams } from 'wouter';
import { HubTimeline } from '@/components/hub';

export default function TimelinePage() {
  const params = useParams<{ projectId?: string }>();

  return (
    <div className="min-h-screen bg-background">
      <HubTimeline projectId={params.projectId} />
    </div>
  );
}
