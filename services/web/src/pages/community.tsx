/**
 * Community Forum Page
 * Task 172: Community forum stub (Discourse embed or coming soon)
 */

import { useState, useEffect } from 'react';
import { MessageSquare, ExternalLink, Users } from 'lucide-react';

// Feature flag for Discourse URL
const FORUM_URL = import.meta.env.VITE_FORUM_URL;

export default function CommunityPage() {
  const [useEmbed, setUseEmbed] = useState(!!FORUM_URL);

  if (useEmbed && FORUM_URL) {
    return (
      <div className="h-screen flex flex-col">
        <div className="p-4 border-b flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5" />
            <h1 className="font-semibold">Community Forum</h1>
          </div>
          <a
            href={FORUM_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
          >
            Open in new tab
            <ExternalLink className="w-4 h-4" />
          </a>
        </div>
        <iframe
          src={FORUM_URL}
          className="flex-1 w-full border-0"
          title="Community Forum"
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="max-w-lg w-full text-center space-y-6">
        <div className="p-6 bg-primary/10 rounded-full inline-block">
          <Users className="w-16 h-16 text-primary" />
        </div>

        <div>
          <h1 className="text-3xl font-bold mb-2">Community Forum</h1>
          <p className="text-muted-foreground text-lg">
            Connect with researchers, share findings, and collaborate on projects.
          </p>
        </div>

        <div className="bg-card border rounded-lg p-6 text-left space-y-4">
          <h2 className="font-semibold text-lg">Coming Soon</h2>
          <p className="text-muted-foreground">
            We're building a community space where you can:
          </p>
          <ul className="space-y-2 text-sm">
            <li className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-primary" />
              Discuss research methodologies
            </li>
            <li className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-primary" />
              Share best practices
            </li>
            <li className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-primary" />
              Find collaborators
            </li>
            <li className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-primary" />
              Get help with ResearchFlow
            </li>
          </ul>
        </div>

        <p className="text-sm text-muted-foreground">
          Want to be notified when the community launches?{' '}
          <a href="/profile" className="text-primary hover:underline">
            Update your notification preferences
          </a>
        </p>
      </div>
    </div>
  );
}
