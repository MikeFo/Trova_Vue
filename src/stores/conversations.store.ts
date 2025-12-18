import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { conversationService } from '../services/conversation.service';
import { useAuthStore } from './auth.store';
import { userService } from '../services/user.service';
import type { FirebaseMessages, FirebaseMessage, UserFirebaseMessage } from '../models/conversation';
import type { User } from './auth.store';

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
        const aTime = a.updatedAt?.toMillis() || a.timestamp?.toMillis() || 0;
        const bTime = b.updatedAt?.toMillis() || b.timestamp?.toMillis() || 0;
        return bTime - aTime; // Most recent first
      });
  });

  const unreadCount = computed(() => {
    return conversationsList.value.filter(conv => !conv.isRead).length;
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
      // Get user conversations map
      const userConvos = await conversationService.getFirebaseConversationsByUserId(authStore.user.id);
      userConversations.value = userConvos;

      // Load each conversation
      const convosMap = new Map<string, FirebaseMessages>();
      const userIdsToFetch = new Set<number>();
      
      for (const [key, userConvo] of userConvos.entries()) {
        if (userConvo.conversationId) {
          const conv = await conversationService.getConversationById(userConvo.conversationId);
          if (conv) {
            // Collect user IDs to fetch
            if (conv.users) {
              conv.users.forEach(id => {
                if (id !== authStore.user?.id) {
                  userIdsToFetch.add(id);
                }
              });
            }
            convosMap.set(userConvo.conversationId, conv);
          }
        }
      }

      // Fetch user data for conversations
      if (userIdsToFetch.size > 0) {
        const fetchedUsers = await userService.getUsersByIds(Array.from(userIdsToFetch));
        fetchedUsers.forEach((user, id) => {
          usersMap.value.set(id, user);
        });
      }

      // Enrich conversations with user data
      enrichConversationsWithUserData(convosMap);
      conversations.value = convosMap;
    } catch (err: any) {
      console.error('Error loading conversations:', err);
      error.value = err.message || 'Failed to load conversations';
    } finally {
      isLoading.value = false;
    }
  }

  function subscribeToConversations() {
    if (!authStore.user?.id) {
      return;
    }

    // Prevent duplicate subscriptions
    if (isSubscribed.value) {
      console.warn('[ConversationsStore] Already subscribed to conversations, skipping duplicate subscription');
      return;
    }

    // Subscribe to user conversations
    const unsubscribe = conversationService.subscribeToUserConversations(
      authStore.user.id,
      async (userConvos) => {
        userConversations.value = userConvos;

        // Load/update each conversation
        const convosMap = new Map<string, FirebaseMessages>();
        const userIdsToFetch = new Set<number>();
        
        for (const [key, userConvo] of userConvos.entries()) {
          if (userConvo.conversationId) {
            const conv = await conversationService.getConversationById(userConvo.conversationId);
            if (conv) {
              // Collect user IDs to fetch
              if (conv.users) {
                conv.users.forEach(id => {
                  if (id !== authStore.user?.id) {
                    userIdsToFetch.add(id);
                  }
                });
              }
              convosMap.set(userConvo.conversationId, conv);
            }
          }
        }

        // Fetch user data for conversations
        if (userIdsToFetch.size > 0) {
          const fetchedUsers = await userService.getUsersByIds(Array.from(userIdsToFetch));
          fetchedUsers.forEach((user, id) => {
            usersMap.value.set(id, user);
          });
        }

        // Enrich conversations with user data
        enrichConversationsWithUserData(convosMap);
        conversations.value = convosMap;
      }
    );

    subscriptions.value.push(unsubscribe);
    isSubscribed.value = true;
  }

  function setActiveConversation(conversationId: string | null) {
    if (!conversationId) {
      activeConversation.value = null;
      return;
    }

    const conv = conversations.value.get(conversationId);
    if (conv) {
      activeConversation.value = conv;
      
      // Subscribe to real-time updates for this conversation
      subscribeToConversation(conversationId);
      
      // Mark as read
      if (authStore.user?.id) {
        conversationService.markAsRead(conversationId, authStore.user.id);
      }
    } else {
      // Load conversation if not in store
      loadConversation(conversationId);
    }
  }

  async function loadConversation(conversationId: string) {
    try {
      const conv = await conversationService.getConversationById(conversationId);
      if (conv) {
        conversations.value.set(conversationId, conv);
        activeConversation.value = conv;
        
        subscribeToConversation(conversationId);
        
        if (authStore.user?.id) {
          conversationService.markAsRead(conversationId, authStore.user.id);
        }
      }
    } catch (err: any) {
      console.error('Error loading conversation:', err);
      error.value = err.message || 'Failed to load conversation';
    }
  }

  function subscribeToConversation(conversationId: string) {
    // Unsubscribe from previous conversation if exists
    if (activeConversation.value?.id) {
      // Cleanup would be handled by the component
    }

    // Subscribe to conversation updates
    const unsubscribeConversation = conversationService.subscribeToConversation(
      conversationId,
      (conv) => {
        if (conv) {
          conversations.value.set(conversationId, conv);
          if (activeConversation.value?.conversationId === conversationId) {
            activeConversation.value = conv;
          }
        }
      }
    );

    // Subscribe to messages updates
    const unsubscribeMessages = conversationService.subscribeToMessages(
      conversationId,
      (messages) => {
        const conv = conversations.value.get(conversationId);
        if (conv) {
          conv.messages = messages;
          conversations.value.set(conversationId, conv);
          
          if (activeConversation.value?.conversationId === conversationId) {
            activeConversation.value.messages = messages;
          }
        }
      }
    );

    subscriptions.value.push(unsubscribeConversation, unsubscribeMessages);
  }

  async function sendMessage(conversationId: string, message: string) {
    if (!authStore.user?.id) {
      throw new Error('User not authenticated');
    }

    try {
      const conv = conversations.value.get(conversationId);
      if (!conv) {
        throw new Error('Conversation not found');
      }

      await conversationService.sendMessage(
        conversationId,
        authStore.user.id,
        message,
        conv.parentId,
        conv.parentType
      );
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

