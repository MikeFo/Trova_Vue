import { apiService } from './api.service';

export type BackendMessage = {
  id: number | string;
  userId: number;
  body: string;
  createdAt?: string;
  source?: string | null;
  slackChannelId?: string | null;
  slackTs?: string | null;
  slackUserId?: string | null;
};

export type BackendConversation = {
  id: number | string;
  leftUserId?: number;
  rightUserId?: number;
  communityId?: number | null;
  updatedAt?: string;
  message?: BackendMessage | null;
  user?: {
    id?: number;
    fname?: string;
    lname?: string;
    email?: string;
    profilePicture?: string;
  } | null;
  readAll?: boolean;
  slackChannelId?: string | null;
  isSlackBacked?: boolean;
};

class ConversationBackendService {
  async getUserConversations(userId: number): Promise<BackendConversation[]> {
    try {
      const data = await apiService.get<BackendConversation[]>(`/conversations/user/${userId}`);
      return data || [];
    } catch (error) {
      console.error('[conversationBackendService] getUserConversations failed', error);
      return [];
    }
  }

  async getMessages(conversationId: number): Promise<BackendMessage[]> {
    try {
      const data = await apiService.get<BackendMessage[]>(`/messages?conversationId=${conversationId}`);
      return data || [];
    } catch (error) {
      console.error('[conversationBackendService] getMessages failed', error);
      return [];
    }
  }

  async createConversation(
    toUserId: number,
    communityId: number,
    slackMirror: boolean = true
  ): Promise<BackendConversation | null> {
    try {
      const data = await apiService.post<BackendConversation>('/conversations', {
        toUserId,
        communityId,
        slackMirror,
      });
      return data || null;
    } catch (error) {
      console.error('[conversationBackendService] createConversation failed', error);
      return null;
    }
  }
}

export const conversationBackendService = new ConversationBackendService();





