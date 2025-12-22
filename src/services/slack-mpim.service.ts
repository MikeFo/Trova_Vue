import { apiService } from './api.service';

class SlackMpimService {
  /**
   * Send a message to a Slack-backed MPIM conversation.
   * The backend mirrors to Slack and persists the message.
   */
  async sendMessage(conversationId: number, communityId: number, text: string): Promise<void> {
    try {
      await apiService.post('/slack/mpim/send', {
        conversationId,
        communityId,
        text,
      });
    } catch (error) {
      console.error('[slackMpimService] Failed to send Slack MPIM message', error);
      throw error;
    }
  }
}

export const slackMpimService = new SlackMpimService();

