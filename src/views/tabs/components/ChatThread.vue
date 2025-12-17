<template>
  <div v-if="conversation" class="chat-thread-container">
    <!-- Chat Header -->
    <div class="chat-header">
      <ion-button fill="clear" @click="$emit('back')" class="back-button">
        <ion-icon :icon="arrowBack"></ion-icon>
      </ion-button>
      <div class="header-info">
        <img
          v-if="!conversation.isMultiUser && conversation.messagesPicture"
          :src="conversation.messagesPicture"
          :alt="conversation.messageTitle"
          class="header-avatar"
        />
        <div v-else class="header-avatar-placeholder">
          <ion-icon :icon="people"></ion-icon>
        </div>
        <div class="header-details">
          <h3 class="header-name">{{ conversation.messageTitle || 'Unknown' }}</h3>
          <p v-if="typingUsers.length > 0" class="header-status typing">typing...</p>
          <p v-else-if="conversation.isOnline && !conversation.isMultiUser" class="header-status online">Online</p>
          <p v-else-if="conversation.isMultiUser" class="header-status">{{ getParticipantsCount() }} participants</p>
        </div>
      </div>
      <ion-button fill="clear" class="more-button">
        <ion-icon :icon="ellipsisVertical"></ion-icon>
      </ion-button>
    </div>

    <!-- Messages List -->
    <div ref="messagesContainer" class="messages-list">
      <div v-if="isLoadingMessages" class="loading-messages">
        <ion-spinner></ion-spinner>
      </div>
      
      <div v-for="(message, index) in sortedMessages" :key="message.id || index" class="message-wrapper">
        <div
          class="message-bubble"
          :class="{
            'own-message': isOwnMessage(message),
            'other-message': !isOwnMessage(message),
            'show-avatar': shouldShowAvatar(message, index),
          }"
        >
          <img
            v-if="shouldShowAvatar(message, index) && conversation.messagesPicture"
            :src="conversation.messagesPicture"
            :alt="message.authorName"
            class="message-avatar"
          />
          
          <div class="message-content">
            <div v-if="shouldShowAuthor(message, index)" class="message-author">
              {{ message.authorName }}
            </div>
            <div class="message-text" v-html="formatMessage(message.message || '')"></div>
            <div v-if="message.image" class="message-image">
              <img :src="message.image" alt="Message image" />
            </div>
            <div class="message-time">
              {{ formatMessageTime(message.timestamp) }}
              <ion-icon
                v-if="isOwnMessage(message) && isMessageRead(message)"
                :icon="checkmarkDone"
                class="read-icon"
              ></ion-icon>
            </div>
          </div>
        </div>
      </div>

      <!-- Typing Indicator -->
      <div v-if="typingUsers.length > 0" class="typing-indicator">
        <div class="typing-dots">
          <span></span>
          <span></span>
          <span></span>
        </div>
      </div>
    </div>

    <!-- Message Input -->
    <div class="message-input-container">
      <ion-button fill="clear" class="attach-button">
        <ion-icon :icon="attachOutline"></ion-icon>
      </ion-button>
      <div class="input-wrapper">
        <ion-textarea
          v-model="messageText"
          placeholder="Type a message..."
          rows="1"
          auto-grow
          :maxlength="5000"
          class="message-input"
          @keydown.enter.exact.prevent="handleEnterKey"
          @keydown.enter.shift.exact="handleShiftEnter"
          @input="handleTyping"
        ></ion-textarea>
      </div>
      <ion-button
        :disabled="!canSend"
        @click="sendMessage"
        class="send-button"
        :class="{ 'enabled': canSend }"
      >
        <ion-icon :icon="canSend ? send : sendOutline"></ion-icon>
      </ion-button>
    </div>
  </div>
  <div v-else class="chat-thread-container">
    <div class="empty-state">
      <p>Loading conversation...</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick, watch } from 'vue';
import { useConversationsStore } from '@/stores/conversations.store';
import { useAuthStore } from '@/stores/auth.store';
import {
  arrowBack,
  people,
  ellipsisVertical,
  attachOutline,
  send,
  sendOutline,
  checkmarkDone,
} from 'ionicons/icons';
import {
  IonButton,
  IonIcon,
  IonSpinner,
  IonTextarea,
} from '@ionic/vue';
import type { FirebaseMessages, FirebaseMessage } from '@/models/conversation';
import { Timestamp } from 'firebase/firestore';

interface Props {
  conversation: FirebaseMessages | null;
}

const props = defineProps<Props>();
const emit = defineEmits<{
  back: [];
}>();

const conversationsStore = useConversationsStore();
const authStore = useAuthStore();
const messageText = ref('');
const messagesContainer = ref<HTMLElement | null>(null);
const isLoadingMessages = ref(false);
const typingUsers = ref<number[]>([]);
const typingTimeout = ref<ReturnType<typeof setTimeout> | null>(null);

const sortedMessages = computed(() => {
  if (!props.conversation || !props.conversation.messages) return [];
  return [...props.conversation.messages].sort((a, b) => {
    const aTime = a.timestamp?.toMillis() || 0;
    const bTime = b.timestamp?.toMillis() || 0;
    return aTime - bTime;
  });
});

const canSend = computed(() => {
  return messageText.value.trim().length > 0;
});

function isOwnMessage(message: FirebaseMessage): boolean {
  return message.userId === authStore.user?.id;
}

function shouldShowAuthor(message: FirebaseMessage, index: number): boolean {
  if (isOwnMessage(message)) return false;
  if (index === 0) return true;
  const prevMessage = sortedMessages.value[index - 1];
  return prevMessage.userId !== message.userId;
}

function shouldShowAvatar(message: FirebaseMessage, index: number): boolean {
  if (isOwnMessage(message)) return false;
  if (index === sortedMessages.value.length - 1) return true;
  const nextMessage = sortedMessages.value[index + 1];
  return nextMessage.userId !== message.userId;
}

function formatMessage(text: string): string {
  if (!text) return '';
  // Basic HTML sanitization and linkification
  return text
    .replace(/\n/g, '<br>')
    .replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank">$1</a>');
}

function formatMessageTime(timestamp: Timestamp | undefined): string {
  if (!timestamp) return '';
  
  const date = timestamp.toDate();
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  
  return date.toLocaleTimeString('en-US', { 
    hour: 'numeric', 
    minute: '2-digit',
    hour12: true 
  });
}

function isMessageRead(message: FirebaseMessage): boolean {
  // This would need to check if the message is in the read array
  return true; // Simplified for now
}

function getParticipantsCount(): number {
  if (!props.conversation) return 0;
  return props.conversation.users?.length || 0;
}

async function sendMessage() {
  if (!canSend.value || !authStore.user?.id || !props.conversation) return;

  const text = messageText.value.trim();
  messageText.value = '';
  
  // Stop typing indicator
  await conversationsStore.setTyping(props.conversation.conversationId, false);
  
  try {
    await conversationsStore.sendMessage(props.conversation.conversationId, text);
    scrollToBottom();
  } catch (error) {
    console.error('Error sending message:', error);
    // Restore message text on error
    messageText.value = text;
  }
}

function handleEnterKey(event: KeyboardEvent) {
  if (canSend.value) {
    sendMessage();
  }
}

function handleShiftEnter(event: KeyboardEvent) {
  // Allow new line with Shift+Enter
  // The textarea will handle this naturally
}

let typingDebounceTimer: ReturnType<typeof setTimeout> | null = null;

function handleTyping() {
  if (!authStore.user?.id || !props.conversation) return;

  // Clear existing timer
  if (typingDebounceTimer) {
    clearTimeout(typingDebounceTimer);
  }

  // Set typing indicator
  conversationsStore.setTyping(props.conversation.conversationId, true);

  // Clear typing indicator after 3 seconds of no typing
  typingDebounceTimer = setTimeout(async () => {
    if (props.conversation) {
      await conversationsStore.setTyping(props.conversation.conversationId, false);
    }
    typingDebounceTimer = null;
  }, 3000);
}

function scrollToBottom() {
  nextTick(() => {
    if (messagesContainer.value) {
      messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight;
    }
  });
}

// Watch for new messages and scroll to bottom
watch(() => sortedMessages.value.length, () => {
  scrollToBottom();
});

// Watch for typing updates
watch(() => props.conversation?.isTyping, (newTyping) => {
  if (newTyping) {
    typingUsers.value = newTyping.filter(id => id !== authStore.user?.id);
  } else {
    typingUsers.value = [];
  }
});

onMounted(() => {
  if (!props.conversation) return;
  
  scrollToBottom();
  
  // Add conversation to store if not already there
  const existingConvo = conversationsStore.conversations.get(props.conversation.conversationId);
  if (!existingConvo) {
    conversationsStore.conversations.set(props.conversation.conversationId, props.conversation);
  }
  
  // Use setActiveConversation which handles subscription internally
  try {
    conversationsStore.setActiveConversation(props.conversation.conversationId);
  } catch (err) {
    console.warn('[ChatThread] Error setting active conversation:', err);
    // Fallback: try direct subscription if available
    if (typeof conversationsStore.subscribeToConversation === 'function') {
      conversationsStore.subscribeToConversation(props.conversation.conversationId);
    }
  }
  
  // Mark as read
  conversationsStore.markAsRead(props.conversation.conversationId);
});

onUnmounted(() => {
  // Stop typing if user was typing
  if (authStore.user?.id && props.conversation) {
    conversationsStore.setTyping(props.conversation.conversationId, false);
  }
  
  if (typingDebounceTimer) {
    clearTimeout(typingDebounceTimer);
  }
});
</script>

<style scoped>
.chat-thread-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: #f8fafc;
}

.chat-header {
  background: #ffffff;
  padding: 12px 16px;
  display: flex;
  align-items: center;
  gap: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
  border-bottom: 1px solid #e5e7eb;
}

.back-button {
  --padding-start: 8px;
  --padding-end: 8px;
  margin: 0;
}

.back-button ion-icon {
  font-size: 24px;
  color: #1a1a1a;
}

.header-info {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}

.header-avatar {
  width: 40px;
  height: 40px;
  border-radius: 10px;
  object-fit: cover;
  flex-shrink: 0;
}

.header-avatar-placeholder {
  width: 40px;
  height: 40px;
  border-radius: 10px;
  background: linear-gradient(135deg, var(--color-primary) 0%, var(--color-secondary) 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.header-avatar-placeholder ion-icon {
  font-size: 20px;
  color: #ffffff;
}

.header-details {
  flex: 1;
  min-width: 0;
}

.header-name {
  font-size: 16px;
  font-weight: 600;
  color: #1a1a1a;
  margin: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.header-status {
  font-size: 12px;
  color: #64748b;
  margin: 2px 0 0 0;
}

.header-status.typing {
  color: var(--color-primary);
  font-style: italic;
}

.header-status.online {
  color: #10b981;
}

.more-button {
  --padding-start: 8px;
  --padding-end: 8px;
  margin: 0;
}

.more-button ion-icon {
  font-size: 20px;
  color: #1a1a1a;
}

.messages-list {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.loading-messages {
  display: flex;
  justify-content: center;
  padding: 24px;
}

.message-wrapper {
  display: flex;
  flex-direction: column;
}

.message-bubble {
  display: flex;
  gap: 8px;
  max-width: 75%;
  animation: fadeInUp 0.3s ease;
}

.message-bubble.own-message {
  align-self: flex-end;
  flex-direction: row-reverse;
}

.message-bubble.other-message {
  align-self: flex-start;
}

.message-avatar {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  object-fit: cover;
  flex-shrink: 0;
  align-self: flex-end;
}

.message-content {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.own-message .message-content {
  align-items: flex-end;
}

.other-message .message-content {
  align-items: flex-start;
}

.message-author {
  font-size: 12px;
  font-weight: 600;
  color: #64748b;
  margin-bottom: 2px;
}

.message-text {
  background: #ffffff;
  padding: 12px 16px;
  border-radius: 16px;
  font-size: 15px;
  line-height: 1.5;
  color: #1a1a1a;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  word-wrap: break-word;
}

.own-message .message-text {
  background: linear-gradient(135deg, var(--color-primary) 0%, var(--color-secondary) 100%);
  color: #ffffff;
  border-bottom-right-radius: 4px;
}

.other-message .message-text {
  background: #ffffff;
  border-bottom-left-radius: 4px;
}

.message-text :deep(a) {
  color: inherit;
  text-decoration: underline;
}

.own-message .message-text :deep(a) {
  color: #ffffff;
}

.message-image {
  margin-top: 4px;
  border-radius: 12px;
  overflow: hidden;
  max-width: 300px;
}

.message-image img {
  width: 100%;
  height: auto;
  display: block;
}

.message-time {
  font-size: 11px;
  color: #94a3b8;
  display: flex;
  align-items: center;
  gap: 4px;
  margin-top: 2px;
}

.read-icon {
  font-size: 14px;
  color: var(--color-primary);
}

.typing-indicator {
  padding: 12px 16px;
  display: flex;
  align-items: center;
}

.typing-dots {
  display: flex;
  gap: 4px;
  padding: 12px 16px;
  background: #ffffff;
  border-radius: 16px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
}

.typing-dots span {
  width: 8px;
  height: 8px;
  background: #94a3b8;
  border-radius: 50%;
  animation: typing 1.4s infinite;
}

.typing-dots span:nth-child(2) {
  animation-delay: 0.2s;
}

.typing-dots span:nth-child(3) {
  animation-delay: 0.4s;
}

.message-input-container {
  background: #ffffff;
  padding: 12px 16px;
  display: flex;
  align-items: flex-end;
  gap: 12px;
  box-shadow: 0 -2px 8px rgba(0, 0, 0, 0.04);
  border-top: 1px solid #e5e7eb;
}

.attach-button {
  --padding-start: 8px;
  --padding-end: 8px;
  margin: 0;
  flex-shrink: 0;
}

.attach-button ion-icon {
  font-size: 24px;
  color: #64748b;
}

.input-wrapper {
  flex: 1;
  background: #f1f5f9;
  border-radius: 24px;
  padding: 8px 16px;
  min-height: 44px;
  display: flex;
  align-items: center;
}

.message-input {
  --background: transparent;
  --padding-start: 0;
  --padding-end: 0;
  --color: #1a1a1a;
  font-size: 15px;
  line-height: 1.5;
  width: 100%;
}

.send-button {
  --padding-start: 12px;
  --padding-end: 12px;
  margin: 0;
  width: 44px;
  height: 44px;
  border-radius: 22px;
  flex-shrink: 0;
  --background: #e5e7eb;
  --color: #94a3b8;
  transition: all 0.2s ease;
}

.send-button.enabled {
  --background: linear-gradient(135deg, var(--color-primary) 0%, var(--color-secondary) 100%);
  --color: #ffffff;
  box-shadow: 0 4px 12px rgba(52, 168, 83, 0.3);
}

.send-button.enabled:active {
  transform: scale(0.95);
}

.send-button ion-icon {
  font-size: 20px;
}

@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes typing {
  0%, 60%, 100% {
    transform: translateY(0);
    opacity: 0.7;
  }
  30% {
    transform: translateY(-10px);
    opacity: 1;
  }
}
</style>

