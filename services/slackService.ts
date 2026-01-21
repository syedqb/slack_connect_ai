
import { SlackChannel, SlackMessageResponse } from '../types';

const SLACK_API_BASE = 'https://slack.com/api';

export class SlackService {
  private token: string;
  private proxyUrl: string | null;

  constructor(token: string, proxyUrl: string | null = null) {
    this.token = token.trim();
    this.proxyUrl = proxyUrl;
  }

  private async request(endpoint: string, options: RequestInit = {}): Promise<any> {
    const headers = {
      'Authorization': `Bearer ${this.token}`,
      'Content-Type': 'application/json; charset=utf-8',
      ...options.headers,
    };

    const targetUrl = `${SLACK_API_BASE}/${endpoint}`;
    
    // corsproxy.io uses a simple append format: https://corsproxy.io/?{url}
    const finalUrl = this.proxyUrl ? `${this.proxyUrl}${targetUrl}` : targetUrl;

    try {
      const response = await fetch(finalUrl, {
        ...options,
        headers,
      });

      if (!response.ok) {
        throw new Error(`HTTP_${response.status}`);
      }

      const data = await response.json();
      
      if (!data.ok) {
        throw new Error(data.error || 'slack_api_error');
      }
      return data;
    } catch (error: any) {
      if (error instanceof TypeError) {
        // This usually indicates a CORS block or total lack of internet
        throw new Error('CORS_ERROR');
      }
      throw error;
    }
  }

  async fetchChannels(): Promise<SlackChannel[]> {
    const data = await this.request('conversations.list?types=public_channel,private_channel&limit=100');
    return data.channels || [];
  }

  async sendMessage(channelId: string, text: string): Promise<SlackMessageResponse> {
    return await this.request('chat.postMessage', {
      method: 'POST',
      body: JSON.stringify({
        channel: channelId,
        text,
      }),
    });
  }

  async testConnection(): Promise<any> {
    return await this.request('auth.test');
  }
}
