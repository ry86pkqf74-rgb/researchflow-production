/**
 * Slack Service (Task 85)
 *
 * Handles Slack integration for notifications and webhooks.
 * Sends notifications to configured Slack channels.
 */

import crypto from 'crypto';

const SLACK_SIGNING_SECRET = process.env.SLACK_SIGNING_SECRET || '';
const FEATURE_SLACK = process.env.FEATURE_SLACK !== 'false';

export interface SlackWebhookConfig {
  webhookUrl: string;
  channel?: string;
  username?: string;
  iconEmoji?: string;
}

export interface SlackMessage {
  text: string;
  blocks?: SlackBlock[];
  attachments?: SlackAttachment[];
}

interface SlackBlock {
  type: 'section' | 'header' | 'divider' | 'context' | 'actions';
  text?: {
    type: 'plain_text' | 'mrkdwn';
    text: string;
    emoji?: boolean;
  };
  fields?: Array<{
    type: 'plain_text' | 'mrkdwn';
    text: string;
  }>;
  elements?: Array<{
    type: string;
    text?: { type: string; text: string; emoji?: boolean };
    url?: string;
    action_id?: string;
  }>;
}

interface SlackAttachment {
  color?: string;
  title?: string;
  text?: string;
  fields?: Array<{ title: string; value: string; short?: boolean }>;
  footer?: string;
  ts?: number;
}

/**
 * Verify Slack request signature
 */
export function verifySlackSignature(
  signature: string,
  timestamp: string,
  body: string
): boolean {
  if (!SLACK_SIGNING_SECRET) {
    console.warn('[SlackService] No signing secret configured');
    return false;
  }

  // Check timestamp to prevent replay attacks (5 minute window)
  const fiveMinutesAgo = Math.floor(Date.now() / 1000) - 60 * 5;
  if (parseInt(timestamp, 10) < fiveMinutesAgo) {
    return false;
  }

  const sigBasestring = `v0:${timestamp}:${body}`;
  const mySignature = 'v0=' + crypto
    .createHmac('sha256', SLACK_SIGNING_SECRET)
    .update(sigBasestring)
    .digest('hex');

  return crypto.timingSafeEqual(
    Buffer.from(mySignature),
    Buffer.from(signature)
  );
}

/**
 * Send a message to Slack webhook
 */
export async function sendSlackMessage(
  config: SlackWebhookConfig,
  message: SlackMessage
): Promise<{ success: boolean; error?: string }> {
  if (!FEATURE_SLACK) {
    console.log('[SlackService] Feature disabled, skipping message');
    return { success: true };
  }

  if (!config.webhookUrl) {
    return { success: false, error: 'Webhook URL not configured' };
  }

  try {
    const payload = {
      ...message,
      channel: config.channel,
      username: config.username || 'ResearchFlow',
      icon_emoji: config.iconEmoji || ':microscope:',
    };

    const response = await fetch(config.webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Slack API error: ${response.status} ${text}`);
    }

    return { success: true };
  } catch (error: any) {
    console.error('[SlackService] Error sending message:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Create a project update notification
 */
export function createProjectUpdateMessage(
  projectTitle: string,
  action: string,
  actorName: string,
  projectUrl: string
): SlackMessage {
  return {
    text: `${actorName} ${action} project "${projectTitle}"`,
    blocks: [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: 'Project Update',
          emoji: true,
        },
      },
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*Project:*\n${projectTitle}`,
          },
          {
            type: 'mrkdwn',
            text: `*Action:*\n${action}`,
          },
          {
            type: 'mrkdwn',
            text: `*By:*\n${actorName}`,
          },
        ],
      },
      {
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: {
              type: 'plain_text',
              text: 'View Project',
              emoji: true,
            },
            url: projectUrl,
            action_id: 'view_project',
          },
        ],
      },
    ],
  };
}

/**
 * Create a manuscript status notification
 */
export function createManuscriptStatusMessage(
  manuscriptTitle: string,
  status: string,
  actorName: string,
  manuscriptUrl: string
): SlackMessage {
  const statusEmojis: Record<string, string> = {
    draft: ':pencil:',
    review: ':eyes:',
    approved: ':white_check_mark:',
    published: ':rocket:',
    rejected: ':x:',
  };

  const emoji = statusEmojis[status] || ':page_facing_up:';

  return {
    text: `${emoji} Manuscript "${manuscriptTitle}" is now ${status}`,
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `${emoji} *Manuscript Status Update*\n\n*"${manuscriptTitle}"* is now *${status}*`,
        },
      },
      {
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: `Updated by ${actorName}`,
          },
        ],
      },
      {
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: {
              type: 'plain_text',
              text: 'View Manuscript',
              emoji: true,
            },
            url: manuscriptUrl,
            action_id: 'view_manuscript',
          },
        ],
      },
    ],
  };
}

/**
 * Create a review session notification
 */
export function createReviewSessionMessage(
  topic: string,
  startTime: Date,
  participants: string[],
  joinUrl?: string
): SlackMessage {
  const formattedTime = startTime.toLocaleString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const blocks: SlackBlock[] = [
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: ':calendar: Review Session Scheduled',
        emoji: true,
      },
    },
    {
      type: 'section',
      fields: [
        {
          type: 'mrkdwn',
          text: `*Topic:*\n${topic}`,
        },
        {
          type: 'mrkdwn',
          text: `*Time:*\n${formattedTime}`,
        },
        {
          type: 'mrkdwn',
          text: `*Participants:*\n${participants.join(', ')}`,
        },
      ],
    },
  ];

  if (joinUrl) {
    blocks.push({
      type: 'actions',
      elements: [
        {
          type: 'button',
          text: {
            type: 'plain_text',
            text: 'Join Meeting',
            emoji: true,
          },
          url: joinUrl,
          action_id: 'join_meeting',
        },
      ],
    });
  }

  return {
    text: `Review session scheduled: ${topic}`,
    blocks,
  };
}
