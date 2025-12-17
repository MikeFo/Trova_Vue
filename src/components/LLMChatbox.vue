<template>
  <div class="llm-chatbox" :class="{ collapsed: isCollapsed }">
    <div class="chatbox-header" @click="toggleCollapse">
      <div class="header-content">
        <ion-icon :icon="chatbubbleEllipses" class="header-icon"></ion-icon>
        <span class="header-title">AI Assistant</span>
      </div>
      <ion-icon 
        :icon="isCollapsed ? chevronUp : chevronDown" 
        class="collapse-icon"
      ></ion-icon>
    </div>

    <div v-if="!isCollapsed" class="chatbox-content">
      <div class="messages-container" ref="messagesContainer">
        <div
          v-for="(message, index) in messages"
          :key="index"
          class="message"
          :class="{ 'user-message': message.role === 'user', 'assistant-message': message.role === 'assistant' }"
        >
          <div class="message-content">
            <p>{{ message.content }}</p>
          </div>
        </div>
        <div v-if="isLoading" class="message assistant-message">
          <div class="message-content">
            <ion-spinner name="crescent" class="loading-spinner"></ion-spinner>
            <p>Thinking...</p>
          </div>
        </div>
      </div>

      <div class="input-container">
        <ion-input
          v-model="inputMessage"
          placeholder="Ask me anything..."
          class="chat-input"
          @keyup.enter="sendMessage"
          :disabled="isLoading"
        ></ion-input>
        <ion-button 
          fill="clear" 
          class="send-button"
          @click="sendMessage"
          :disabled="!inputMessage.trim() || isLoading"
        >
          <ion-icon :icon="send"></ion-icon>
        </ion-button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, nextTick, watch } from 'vue';
import {
  IonInput,
  IonButton,
  IonIcon,
  IonSpinner,
} from '@ionic/vue';
import { chatbubbleEllipses, send, chevronUp, chevronDown } from 'ionicons/icons';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

const isCollapsed = ref(false);
const inputMessage = ref('');
const isLoading = ref(false);
const messages = ref<Message[]>([
  {
    role: 'assistant',
    content: 'Hello! I\'m your AI assistant. I can help you find information across your communities, groups, and events. This feature is coming soon!'
  }
]);
const messagesContainer = ref<HTMLElement | null>(null);

function toggleCollapse() {
  isCollapsed.value = !isCollapsed.value;
}

async function sendMessage() {
  if (!inputMessage.value.trim() || isLoading.value) return;

  const userMessage = inputMessage.value.trim();
  inputMessage.value = '';

  // Add user message
  messages.value.push({
    role: 'user',
    content: userMessage
  });

  // Scroll to bottom
  await nextTick();
  scrollToBottom();

  // Show loading
  isLoading.value = true;

  // Simulate AI response (placeholder - no backend integration yet)
  setTimeout(() => {
    messages.value.push({
      role: 'assistant',
      content: 'This is a placeholder response. The AI assistant feature is coming soon! Once implemented, I\'ll be able to search across your communities, groups, and events to help you find what you need.'
    });
    isLoading.value = false;
    nextTick(() => {
      scrollToBottom();
    });
  }, 1000);
}

function scrollToBottom() {
  if (messagesContainer.value) {
    messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight;
  }
}

watch(() => messages.value.length, () => {
  nextTick(() => {
    scrollToBottom();
  });
});
</script>

<style scoped>
.llm-chatbox {
  background: #ffffff;
  border-radius: 16px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  border: 1px solid rgba(0, 0, 0, 0.05);
  overflow: hidden;
  transition: all 0.3s ease;
}

.llm-chatbox.collapsed {
  max-height: 56px;
}

.chatbox-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px;
  background: linear-gradient(135deg, var(--color-primary) 0%, var(--color-secondary) 100%);
  color: #ffffff;
  cursor: pointer;
  user-select: none;
}

.header-content {
  display: flex;
  align-items: center;
  gap: 8px;
}

.header-icon {
  font-size: 20px;
}

.header-title {
  font-size: 16px;
  font-weight: 600;
}

.collapse-icon {
  font-size: 20px;
  transition: transform 0.3s ease;
}

.chatbox-content {
  display: flex;
  flex-direction: column;
  height: 400px;
}

.messages-container {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  background: #f8fafc;
}

.message {
  display: flex;
  max-width: 85%;
}

.user-message {
  align-self: flex-end;
}

.assistant-message {
  align-self: flex-start;
}

.message-content {
  padding: 12px 16px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.user-message .message-content {
  background: var(--color-primary);
  color: #ffffff;
  border-bottom-right-radius: 4px;
}

.assistant-message .message-content {
  background: #ffffff;
  color: #1a1a1a;
  border: 1px solid rgba(0, 0, 0, 0.05);
  border-bottom-left-radius: 4px;
}

.message-content p {
  margin: 0;
  font-size: 14px;
  line-height: 1.5;
}

.loading-spinner {
  width: 16px;
  height: 16px;
}

.input-container {
  display: flex;
  gap: 8px;
  padding: 12px 16px;
  background: #ffffff;
  border-top: 1px solid rgba(0, 0, 0, 0.05);
}

.chat-input {
  flex: 1;
  --padding-start: 12px;
  --padding-end: 12px;
  --background: #f8fafc;
  --border-radius: 12px;
  font-size: 14px;
}

.send-button {
  --color: var(--color-primary);
  margin: 0;
  width: 40px;
  height: 40px;
}

.send-button:disabled {
  --color: #94a3b8;
}

.send-button ion-icon {
  font-size: 20px;
}

/* Responsive */
@media (max-width: 768px) {
  .chatbox-content {
    height: 300px;
  }

  .message {
    max-width: 90%;
  }
}
</style>






