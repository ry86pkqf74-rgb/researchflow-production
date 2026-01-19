/**
 * Slack Integration Provider
 * Task 166: Slack integration for notifications
 */

import { IntegrationProvider, IntegrationConfig, SyncResult } from '../types';

interface SlackConfig extends IntegrationConfig {
  botToken: string;
  signingSecret?: string;
  defaultChannel?: string;
}

interface SlackMessage {
  channel: string;
  text: string;
  blocks?: SlackBlock[];
  threadTs?: string;
}

interface SlackBlock {
  type: string;
  text?: {
    type: string;
    text: string;
    emoji?: boolean;
  };
  accessory?: unknown;
  elements?: unknown[];
}

export class SlackProvider implements IntegrationProvider {
  private config: SlackConfig;
  private baseUrl = 'https://slack.com/api';

  constructor(config: SlackConfig) {
    this.config = config;
  }

  async authenticate(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/auth.test`, {
        method: 'POST',
        headers: this.getHeaders(),
      });
      const data = await response.json();
      return data.ok === true;
    } catch {
      return false;
    }
  }

  async sync(): Promise<SyncResult> {
    return {
      success: true,
      itemsSynced: 0,
      errors: [],
    };
  }

  async disconnect(): Promise<void> {
    // Slack tokens need manual revocation via app management
  }

  async sendMessage(message: SlackMessage): Promise<{ ts: string; channel: string }> {
    const response = await fetch(`${this.baseUrl}/chat.postMessage`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({
        channel: message.channel || this.config.defaultChannel,
        text: message.text,
        blocks: message.blocks,
        thread_ts: message.threadTs,
      }),
    });

    const data = await response.json();
    if (!data.ok) {
      throw new Error(`Slack API error: ${data.error}`);
    }

    return { ts: data.ts, channel: data.channel };
  }

  async sendResearchNotification(
    channel: string,
    notification: {
      type: 'started' | 'completed' | 'failed' | 'update';
      researchId: string;
      title: string;
      message: string;
      url?: string;
    }
  ): Promise<void> {
    const emoji = {
      started: ':rocket:',
      completed: ':white_check_mark:',
      failed: ':x:',
      update: ':information_source:',
    }[notification.type];

    const color = {
      started: '#2196F3',
      completed: '#4CAF50',
      failed: '#F44336',
      update: '#FF9800',
    }[notification.type];

    const blocks: SlackBlock[] = [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: `${emoji} Research ${notification.type.charAt(0).toUpperCase() + notification.type.slice(1)}`,
          emoji: true,
        },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*${notification.title}*\n${notification.message}`,
        },
      },
      {
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: `Research ID: \`${notification.researchId}\``,
          },
        ],
      },
    ];

    if (notification.url) {
      blocks.push({
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: {
              type: 'plain_text',
              text: 'View Research',
              emoji: true,
            },
            url: notification.url,
          },
        ],
      });
    }

    await this.sendMessage({
      channel,
      text: `${emoji} ${notification.title}: ${notification.message}`,
      blocks,
    });
  }

  async listChannels(): Promise<{ id: string; name: string }[]> {
    const response = await fetch(
      `${this.baseUrl}/conversations.list?types=public_channel,private_channel`,
      {
        headers: this.getHeaders(),
      }
    );

    const data = await response.json();
    if (!data.ok) {
      throw new Error(`Slack API error: ${data.error}`);
    }

    return data.channels.map((ch: any) => ({
      id: ch.id,
      name: ch.name,
    }));
  }

  private getHeaders(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.config.botToken}`,
      'Content-Type': 'application/json',
    };
  }
}
