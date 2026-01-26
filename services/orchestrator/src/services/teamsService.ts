/**
 * Microsoft Teams Integration Service
 * Task: Teams Webhook Notifications
 *
 * Provides:
 * - Webhook message delivery to Microsoft Teams
 * - Adaptive Card formatting
 * - Generic webhook support for other platforms
 */

import { z } from 'zod';

// ─────────────────────────────────────────────────────────────
// Types & Schemas
// ─────────────────────────────────────────────────────────────

export const TeamsWebhookConfigSchema = z.object({
  webhookUrl: z.string().url(),
  channelName: z.string().optional(),
});

export type TeamsWebhookConfig = z.infer<typeof TeamsWebhookConfigSchema>;

export interface TeamsMessage {
  title?: string;
  text: string;
  themeColor?: string;
  sections?: TeamsSection[];
  potentialAction?: TeamsAction[];
}

export interface TeamsSection {
  activityTitle?: string;
  activitySubtitle?: string;
  activityText?: string;
  facts?: Array<{ name: string; value: string }>;
  markdown?: boolean;
}

export interface TeamsAction {
  '@type': 'OpenUri' | 'HttpPOST' | 'ActionCard';
  name: string;
  targets?: Array<{ os: string; uri: string }>;
}
etype