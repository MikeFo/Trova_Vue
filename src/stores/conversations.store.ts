import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { conversationService } from '../services/conversation.service';
import { conversationBackendService, type BackendConversation, type BackendMessage } from '../services/conversation-backend.service';
import { slackMpimService } from '../services/slack-mpim.service';
import { io } from 'socket.io-client';
import { useAuthStore } from './auth.store';
import { userService } from '../services/user.service';
import type { FirebaseMessages, FirebaseMessage, UserFirebaseMessage } from '../models/conversation';
import type { User } from './auth.store';


function mapBackendConversation(conv: BackendConversation, currentUserId: number): FirebaseMessages {
  const messages = conv.message ? [mapBackendMessage(conv.message, currentUserId)] : [];
  return {
    id: String(conv.id),
    conversationId: String(conv.id),
    messages,
    users: [conv.leftUserId, conv.rightUserId].filter((id): id is number => typeof id === 'number' && id > 0),
    isTyping: [],
    parentId: 0,
    parentType: 'user',
    read: [],
    timestamp: undefined,
    createdAtDate: conv.updatedAt ? new Date(conv.updatedAt) : new Date(),
    updatedAt: undefined,
    isMultiUser: false,
    messagesPicture: conv.user?.profilePicture || '',
    usersInfoForDisplay: [],
    lastMessage: conv.message?.body || '',
    lastFromUserId: conv.message?.userId || undefined,
    messageTitle: conv.user ? `${conv.user.fname || ''} ${conv.user.lname || ''}`.trim() || conv.user.email || 'Unknown' : 'Unknown',
    lastMessageTime: conv.message?.createdAt || conv.updatedAt,
    isRead: conv.readAll ?? true,
    isOnline: false,
    communityId: conv.communityId || undefined,
    slackChannelId: conv.slackChannelId || null,
    isSlackBacked: conv.isSlackBacked || false,
  };
}

function mapBackendMessage(msg: BackendMessage, currentUserId: number): FirebaseMessage {
  return {
    id: String(msg.id),
    userId: msg.userId || 0,
    message: msg.body,
    createdAtDate: msg.createdAt ? new Date(msg.createdAt) : new Date(),
    source: msg.source || null,
    slackChannelId: msg.slackChannelId || null,
    slackTs: msg.slackTs || null,
    slackUserId: msg.slackUserId || null,
    authorName: undefined,
    authorPicture: undefined,
    isDeleted: false,
    isActive: true,
  };
}


const socket = io(import.meta.env.VITE_SOCKET_URL || 'http://localhost:3000', { transports: ['websocket'] });

export const useConversationsStore = defineStore('conversations', () => {
  const authStore = useAuthStore();
  
  // State
  const conversations = ref<Map<string, FirebaseMessages>>(new Map());
  const userConversations = ref<Map<string, UserFirebaseMessage>>(new Map());
  const activeConversation = ref<FirebaseMessages | null>(null);
  const isLoading = ref(false);
  const error = ref<string | null>(null);
  const usersMap = ref<Map<number, User>>(new Map());
  
  // Subscriptions cleanup
  const subscriptions = ref<Array<() => void>>([]);
  const isSubscribed = ref(false);

  // Computed
  const conversationsList = computed<FirebaseMessages[]>(() => {
    return Array.from(conversations.value.values())
      .sort((a, b) => {
        const aTime = a.updatedAt?.toMillis?.() || a.timestamp?.toMillis?.() || a.createdAtDate?.getTime?.() || 0;
        const bTime = b.updatedAt?.toMillis?.() || b.timestamp?.toMillis?.() || b.createdAtDate?.getTime?.() || 0;
        return bTime - aTime; // Most recent first
      });
  });

  const unreadCount = computed(() => {
    return conversationsList.value.filter(conv => !conv.isRead).length;
  });


  // socket listener for new messages
  socket.on('new-message', (msg: any) => {
    const convId = String(msg.conversationId);
    const conv = conversations.value.get(convId);
    if (conv) {
      const mapped = mapBackendMessage({
        id: msg.id || Date.now(),
        userId: msg.userId,
        body: msg.body,
        createdAt: msg.createdAt || new Date().toISOString(),
        slackChannelId: msg.slackChannelId,
        slackTs: msg.slackTs,
        slackUserId: msg.slackUserId,
        source: msg.source,
      }, authStore.user?.id || 0);
      conv.messages = [...(conv.messages || []), mapped];
      conversations.value.set(convId, conv);
      if (activeConversation.value?.conversationId === convId) {
        activeConversation.value.messages = conv.messages;
      }
    }
  });

  // Actions
  async function loadConversations() {
    if (!authStore.user?.id) {
      console.warn('No user ID available');
      return;
    }

    isLoading.value = true;
    error.value = null;

    try {
      const backendConvos = await conversationBackendService.getUserConversations(authStore.user.id);
      const convosMap = new Map<string, FirebaseMessages>();

      for (const conv of backendConvos) {
        const mapped = mapBackendConversation(conv, authStore.user.id);
        convosMap.set(String(mapped.conversationId), mapped);
      }

      conversations.value = convosMap;
    } catch (err: any) {
      console.error('Error loading conversations:', err);
      error.value = err.message || 'Failed to load conversations';
    } finally {
      isLoading.value = false;
    }
  }

  async function startConversationWithUser(toUserId: number, communityId: number) {
    if (!authStore.user?.id) {
      throw new Error('User not authenticated');
    }
    try {
      const created = await conversationBackendService.createConversation(toUserId, communityId, true);
      if (!created) {
        throw new Error('Failed to create conversation');
      }
      const mapped = mapBackendConversation(created, authStore.user.id);
      conversations.value.set(String(mapped.conversationId), mapped);
      activeConversation.value = mapped;
      await loadConversation(String(mapped.conversationId));
      await setActiveConversation(String(mapped.conversationId));
    } catch (err: any) {
      console.error('Error starting conversation:', err);
      error.value = err.message || 'Failed to start conversation';
      throw err;
    }
  }

  function subscribeToConversations() {
    // For Slack-backed via REST we are not using realtime subscriptions; keep no-op to avoid duplicate listeners
    return;
  }

  async function setActiveConversation(conversationId: string | null) {
    if (!conversationId) {
      const currentConvId = activeConversation.value?.conversationId;
      activeConversation.value = null;
      if (currentConvId) {
        socket.emit('leave', { conversationId: currentConvId });
      }
      return;
    }

    // join socket room
    socket.emit('join', { conversationId });

    const conv = conversations.value.get(conversationId);
    if (conv) {
      activeConversation.value = conv;
      await loadConversation(conversationId);
      if (authStore.user?.id) {
        conversationService.markAsRead(conversationId, authStore.user.id);
      }
    } else {
      await loadConversation(conversationId);
    }
  }

  async function loadConversation(conversationId: string) {
    try {
      const backendMessages = await conversationBackendService.getMessages(Number(conversationId));
      const conv = conversations.value.get(conversationId);
      if (conv) {
        conv.messages = backendMessages.map((m) => mapBackendMessage(m, authStore.user?.id || 0));
        conversations.value.set(conversationId, conv);
        activeConversation.value = conv;
      }
    } catch (err: any) {
      console.error('Error loading conversation:', err);
      error.value = err.message || 'Failed to load conversation';
    }
  }

  function subscribeToConversation(conversationId: string) {
    // REST-only for Slack-backed; no realtime subscription implemented
    return;
  }

  async function sendMessage(conversationId: string, message: string) {
    if (!authStore.user?.id) {
      throw new Error('User not authenticated');
    }

    const conv = conversations.value.get(conversationId);
    if (!conv) {
      throw new Error('Conversation not found');
    }

    const isSlack = conv.isSlackBacked && conv.slackChannelId;

    try {
      if (isSlack) {
        await slackMpimService.sendMessage(Number(conversationId), conv.communityId || 0, message);
        // Optimistic append
        const msg: FirebaseMessage = {
          id: String(Date.now()),
          userId: authStore.user.id,
          message,
          createdAtDate: new Date(),
          source: 'slack',
          slackChannelId: conv.slackChannelId,
        };
        conv.messages = [...(conv.messages || []), msg];
        conversations.value.set(conversationId, conv);
        if (activeConversation.value?.conversationId === conversationId) {
          activeConversation.value.messages = conv.messages;
        }
      } else {
        try {
          await conversationService.sendMessage(
            conversationId,
            authStore.user.id,
            message,
            conv.parentId,
            conv.parentType
          );
        } catch (err: any) {
          if ((err as Error)?.message?.toLowerCase().includes('conversation not found')) {
            await conversationService.ensureConversationExists(conv, authStore.user.id);
            await conversationService.sendMessage(
              conversationId,
              authStore.user.id,
              message,
              conv.parentId,
              conv.parentType
            );
          } else {
            throw err;
          }
        }
      }
    } catch (err: any) {
      console.error('Error sending message:', err);
      error.value = err.message || 'Failed to send message';
      throw err;
    }
  }

  async function markAsRead(conversationId: string) {
    if (!authStore.user?.id) {
      return;
    }

    try {
      await conversationService.markAsRead(conversationId, authStore.user.id);
      
      const conv = conversations.value.get(conversationId);
      if (conv) {
        if (!conv.read.includes(authStore.user.id)) {
          conv.read.push(authStore.user.id);
        }
        conv.isRead = true;
        conversations.value.set(conversationId, conv);
      }
    } catch (err) {
      console.error('Error marking as read:', err);
    }
  }

  async function setTyping(conversationId: string, isTyping: boolean) {
    if (!authStore.user?.id) {
      return;
    }

    try {
      await conversationService.setTyping(conversationId, authStore.user.id, isTyping);
    } catch (err) {
      console.error('Error setting typing:', err);
    }
  }

  /**
   * Enrich conversations with computed fields like messageTitle and messagesPicture
   */
  function enrichConversationsWithUserData(convosMap: Map<string, FirebaseMessages>) {
    for (const conv of convosMap.values()) {
      if (!conv.users || conv.users.length === 0) continue;

      const otherUsers = conv.users.filter(id => id !== authStore.user?.id);
      
      if (otherUsers.length === 0) continue;

      // Single user conversation
      if (otherUsers.length === 1) {
        const otherUser = usersMap.value.get(otherUsers[0]);
        if (otherUser) {
          conv.messageTitle = `${otherUser.fname} ${otherUser.lname}`;
          conv.messagesPicture = otherUser.profilePicture || '';
        }
      } else {
        // Multi-user conversation
        conv.isMultiUser = true;
        const userNames: string[] = [];
        const userPics: string[] = [];
        
        otherUsers.slice(0, 3).forEach(userId => {
          const user = usersMap.value.get(userId);
          if (user) {
            userNames.push(user.fname);
            if (user.profilePicture) {
              userPics.push(user.profilePicture);
            }
          }
        });

        if (userNames.length > 0) {
          let title = userNames.join(', ');
          if (otherUsers.length > 3) {
            title += ` and ${otherUsers.length - 3} more`;
          }
          conv.messageTitle = title;
        }
        
        if (userPics.length > 0) {
          conv.messagesPicture = userPics[0]; // Use first user's picture
        }
      }
    }
  }

  function cleanup() {
    subscriptions.value.forEach(unsubscribe => unsubscribe());
    subscriptions.value = [];
    isSubscribed.value = false;
    socket.off('new-message');
    socket.emit('leave', { conversationId: activeConversation.value?.conversationId });
  }

  return {
    // State
    conversations,
    userConversations,
    activeConversation,
    isLoading,
    error,
    usersMap,
    
    // Computed
    conversationsList,
    unreadCount,
    
    // Actions
    loadConversations,
    startConversationWithUser,
    subscribeToConversations,
    setActiveConversation,
    loadConversation,
    subscribeToConversation,
    sendMessage,
    markAsRead,
    setTyping,
    enrichConversationsWithUserData,
    cleanup,
  };
});

