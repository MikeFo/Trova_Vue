<template>
  <ion-page>
    <ion-content :fullscreen="true" class="messages-content">
      <div v-if="!activeConversation" class="conversations-container">
        <!-- Search Bar -->
        <div class="search-container">
          <ion-searchbar
            v-model="searchQuery"
            placeholder="Search conversations..."
            class="conversations-search"
            debounce="300"
          ></ion-searchbar>
        </div>

        <!-- Conversations List -->
        <div v-if="isLoading && conversationsList.length === 0" class="loading-container">
          <ion-spinner></ion-spinner>
          <p>Loading conversations...</p>
        </div>

        <div v-else-if="filteredConversations.length === 0" class="empty-state">
          <div class="empty-icon">
            <ion-icon :icon="chatbubblesOutline"></ion-icon>
          </div>
          <h3 class="empty-title">No conversations yet</h3>
          <p class="empty-description">
            Start a conversation with someone from Discover!
          </p>
          <ion-button 
            fill="outline" 
            class="empty-action-button"
            @click="$router.push('/tabs/discover')"
          >
            Discover People
          </ion-button>
        </div>

        <div v-else class="conversations-list">
          <div
            v-for="conversation in filteredConversations"
            :key="conversation.conversationId"
            class="conversation-item"
            :class="{ 'unread': !conversation.isRead, 'active': activeConversation?.conversationId === conversation.conversationId }"
            @click="selectConversation(conversation)"
          >
            <div class="conversation-avatar">
              <img
                v-if="!conversation.isMultiUser && conversation.messagesPicture"
                :src="conversation.messagesPicture"
                :alt="conversation.messageTitle"
                class="avatar-image"
              />
              <div
                v-else
                class="avatar-placeholder"
              >
                <ion-icon :icon="people"></ion-icon>
              </div>
              <div
                v-if="conversation.isMultiUser"
                class="multi-user-badge"
              >
                +{{ getOtherUsersCount(conversation) }}
              </div>
              <div
                v-if="conversation.isOnline && !conversation.isMultiUser"
                class="online-indicator"
              ></div>
            </div>

            <div class="conversation-content">
              <div class="conversation-header">
                <h3 class="conversation-name">{{ conversation.messageTitle || 'Unknown' }}</h3>
                <span class="conversation-time">{{ formatTime(conversation.updatedAt || conversation.timestamp) }}</span>
              </div>
              <div class="conversation-preview">
                <p class="last-message">{{ getLastMessagePreview(conversation) }}</p>
                <ion-badge
                  v-if="!conversation.isRead"
                  color="primary"
                  class="unread-badge"
                >
                  {{ getUnreadCount(conversation) }}
                </ion-badge>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Active Chat Thread -->
      <ChatThread
        v-else
        :conversation="activeConversation"
        @back="activeConversation = null"
      />
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import { useConversationsStore } from '@/stores/conversations.store';
import { createOutline, chatbubblesOutline, people } from 'ionicons/icons';
import {
  IonPage,
  IonContent,
  IonIcon,
  IonSearchbar,
  IonSpinner,
  IonBadge,
  IonButton,
} from '@ionic/vue';
import ChatThread from './components/ChatThread.vue';
import type { FirebaseMessages } from '@/models/conversation';
import { Timestamp } from 'firebase/firestore';

const conversationsStore = useConversationsStore();
const searchQuery = ref('');
const activeConversation = ref<FirebaseMessages | null>(null);
const showCreateModal = ref(false);

const conversationsList = computed(() => conversationsStore.conversationsList);
const isLoading = computed(() => conversationsStore.isLoading);
const unreadCount = computed(() => conversationsStore.unreadCount);

const filteredConversations = computed(() => {
  if (!searchQuery.value.trim()) {
    return conversationsList.value;
  }

  const query = searchQuery.value.toLowerCase();
  return conversationsList.value.filter(conv => {
    const title = (conv.messageTitle || '').toLowerCase();
    const lastMessage = (conv.lastMessage || '').toLowerCase();
    return title.includes(query) || lastMessage.includes(query);
  });
});

function selectConversation(conversation: FirebaseMessages) {
  activeConversation.value = conversation;
  conversationsStore.setActiveConversation(conversation.conversationId);
}

function getLastMessagePreview(conversation: FirebaseMessages): string {
  if (conversation.lastMessage) {
    // Strip HTML tags
    return conversation.lastMessage.replace(/<[^>]*>/g, '').substring(0, 50);
  }
  if (conversation.messages && conversation.messages.length > 0) {
    const lastMsg = conversation.messages[conversation.messages.length - 1];
    return lastMsg.message?.replace(/<[^>]*>/g, '').substring(0, 50) || 'No messages';
  }
  return 'No messages';
}

function formatTime(timestamp: Timestamp | undefined): string {
  if (!timestamp) return '';
  
  const date = timestamp.toDate();
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m`;
  if (diffHours < 24) return `${diffHours}h`;
  if (diffDays < 7) return `${diffDays}d`;
  
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function getUnreadCount(conversation: FirebaseMessages): number {
  // This would need to be calculated based on unread messages
  // For now, return 1 if not read
  return conversation.isRead ? 0 : 1;
}

function getOtherUsersCount(conversation: FirebaseMessages): number {
  if (!conversation.isMultiUser || !conversation.users) return 0;
  return Math.max(0, conversation.users.length - 1);
}

onMounted(async () => {
  await conversationsStore.loadConversations();
  conversationsStore.subscribeToConversations();
});

onUnmounted(() => {
  conversationsStore.cleanup();
});

watch(() => conversationsStore.activeConversation, (newConv) => {
  activeConversation.value = newConv;
});
</script>

<style scoped>
.messages-content {
  --background: #f8fafc;
}

.conversations-container {
  padding: 16px;
  max-width: 100%;
  margin: 0 auto;
  height: 100%;
}

/* Responsive: Desktop */
@media (min-width: 768px) {
  .conversations-container {
    max-width: 800px;
    padding: 24px;
  }

  .header-title {
    font-size: 28px;
  }
}

@media (min-width: 1024px) {
  .conversations-container {
    max-width: 900px;
    padding: 32px;
  }
}

.search-container {
  margin-bottom: 16px;
}

.conversations-search {
  --background: #ffffff;
  --border-radius: 12px;
  --box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
  --placeholder-color: #94a3b8;
  --icon-color: #64748b;
  padding: 0;
}

.loading-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 64px 16px;
  color: #64748b;
}

.empty-state {
  text-align: center;
  padding: 64px 16px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 60vh;
}

.empty-icon {
  width: 100px;
  height: 100px;
  margin: 0 auto 32px;
  background: linear-gradient(135deg, rgba(45, 122, 78, 0.1) 0%, rgba(29, 185, 138, 0.1) 100%);
  border-radius: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 16px rgba(45, 122, 78, 0.1);
}

.empty-icon ion-icon {
  font-size: 48px;
  color: var(--color-primary);
}

.empty-title {
  font-size: 24px;
  font-weight: 700;
  color: #1a1a1a;
  margin: 0 0 12px 0;
}

.empty-description {
  font-size: 16px;
  color: #64748b;
  margin: 0 0 32px 0;
  line-height: 1.6;
  max-width: 400px;
}

.empty-action-button {
  --border-color: var(--color-primary);
  --color: var(--color-primary);
  --border-radius: 12px;
  --padding-start: 32px;
  --padding-end: 32px;
  height: 48px;
  font-weight: 600;
  text-transform: none;
  font-size: 15px;
  transition: all 0.2s ease;
}

.empty-action-button:hover {
  --background: var(--color-primary);
  --color: white;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(45, 122, 78, 0.3);
}

@media (min-width: 768px) {
  .empty-state {
    padding: 96px 32px;
    min-height: 70vh;
  }

  .empty-icon {
    width: 120px;
    height: 120px;
    margin-bottom: 40px;
  }

  .empty-icon ion-icon {
    font-size: 56px;
  }

  .empty-title {
    font-size: 28px;
  }

  .empty-description {
    font-size: 18px;
    max-width: 500px;
  }
}

.conversations-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.conversation-item {
  background: #ffffff;
  border-radius: 16px;
  padding: 16px;
  display: flex;
  align-items: center;
  gap: 16px;
  cursor: pointer;
  transition: all 0.2s ease;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
  border: 2px solid transparent;
  position: relative;
}

.conversation-item::after {
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 4px;
  background: var(--color-primary);
  border-radius: 0 4px 4px 0;
  opacity: 0;
  transition: opacity 0.2s ease;
}

.conversation-item:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  transform: translateY(-2px);
}

.conversation-item:hover::after {
  opacity: 1;
}

@media (min-width: 768px) {
  .conversation-item {
    padding: 20px;
    gap: 20px;
  }
}

.conversation-item.active {
  border-color: var(--color-primary);
  background: rgba(45, 122, 78, 0.02);
}

.conversation-item.unread {
  background: rgba(45, 122, 78, 0.04);
}

.conversation-avatar {
  position: relative;
  flex-shrink: 0;
}

.avatar-image {
  width: 56px;
  height: 56px;
  border-radius: 14px;
  object-fit: cover;
  border: 2px solid #ffffff;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.avatar-placeholder {
  width: 56px;
  height: 56px;
  border-radius: 14px;
  background: linear-gradient(135deg, var(--color-primary) 0%, var(--color-secondary) 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #ffffff;
}

.avatar-placeholder ion-icon {
  font-size: 28px;
}

.multi-user-badge {
  position: absolute;
  bottom: -4px;
  right: -4px;
  background: var(--color-primary);
  color: #ffffff;
  font-size: 10px;
  font-weight: 700;
  padding: 2px 6px;
  border-radius: 8px;
  border: 2px solid #ffffff;
}

.online-indicator {
  position: absolute;
  bottom: 2px;
  right: 2px;
  width: 14px;
  height: 14px;
  background: #10b981;
  border: 2px solid #ffffff;
  border-radius: 50%;
}

.conversation-content {
  flex: 1;
  min-width: 0;
}

.conversation-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 6px;
}

.conversation-name {
  font-size: 16px;
  font-weight: 600;
  color: #1a1a1a;
  margin: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.conversation-time {
  font-size: 12px;
  color: #94a3b8;
  font-weight: 500;
  flex-shrink: 0;
  margin-left: 8px;
}

.conversation-preview {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
}

.last-message {
  font-size: 14px;
  color: #64748b;
  margin: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
}

.unread-badge {
  font-size: 11px;
  min-width: 20px;
  height: 20px;
  border-radius: 10px;
  flex-shrink: 0;
}

.conversation-item.unread .last-message {
  color: #1a1a1a;
  font-weight: 500;
}
</style>
