<template>
  <div
    v-if="isOpen && user"
    class="org-user-popup-overlay"
    @click="handleOverlayClick"
  >
    <div
      class="org-user-popup"
      @click.stop
      :style="popupStyle"
    >
      <button class="org-user-popup-close" @click="close">
        <ion-icon :icon="closeIcon"></ion-icon>
      </button>

      <div class="org-user-popup-header">
        <img
          v-if="user.profilePicture"
          :src="user.profilePicture"
          :alt="user.name"
          class="org-user-popup-avatar"
        />
        <div v-else class="org-user-popup-avatar-placeholder">
          {{ user.name.charAt(0).toUpperCase() }}
        </div>
        <h3 class="org-user-popup-name">{{ user.name }}</h3>
      </div>

      <div class="org-user-popup-content">
        <div v-if="user.email" class="org-user-popup-field">
          <strong>Email:</strong>
          <a :href="`mailto:${user.email}`" class="org-user-popup-link">
            {{ user.email }}
          </a>
        </div>
        <div v-if="user.department" class="org-user-popup-field">
          <strong>Department:</strong> {{ user.department }}
        </div>
        <div v-if="user.location" class="org-user-popup-field">
          <strong>Location:</strong> {{ user.location }}
        </div>
        <div v-if="user.role" class="org-user-popup-field">
          <strong>Role:</strong> {{ user.role }}
        </div>
        <div v-if="user.team" class="org-user-popup-field">
          <strong>Team:</strong> {{ user.team }}
        </div>
        <div v-if="user.title" class="org-user-popup-field">
          <strong>Title:</strong> {{ user.title }}
        </div>
      </div>

      <div class="org-user-popup-actions">
        <button
          class="org-user-popup-button"
          @click="viewProfileInSlack"
        >
          View Trova Profile in Slack
        </button>
        <button
          class="org-user-popup-button"
          @click="messageInSlack"
        >
          Message in Slack
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, type CSSProperties } from 'vue';
import { close as closeIcon } from 'ionicons/icons';
import { IonIcon } from '@ionic/vue';
import type { OrgUser } from '@/models/org-chart';

const props = defineProps<{
  isOpen: boolean;
  user: OrgUser | null;
  position?: { x: number; y: number };
}>();

const emit = defineEmits<{
  (e: 'close'): void;
}>();

const popupStyle = computed<CSSProperties>(() => {
  if (props.position) {
    return {
      position: 'fixed',
      left: `${props.position.x}px`,
      top: `${props.position.y}px`,
      transform: 'translate(-50%, -50%)',
    };
  }
  return {};
});

function close() {
  emit('close');
}

function handleOverlayClick() {
  close();
}

function viewProfileInSlack() {
  const user = props.user;
  if (!user?.slackId) return;
  
  // Deep link to Slack profile
  const slackUrl = `slack://user?team=${getSlackTeamId()}&id=${user.slackId}`;
  window.location.href = slackUrl;
  
  // Fallback to web if app doesn't open
  setTimeout(() => {
    const webUrl = `https://app.slack.com/client/${getSlackTeamId()}/user/${user.slackId}`;
    window.open(webUrl, '_blank');
  }, 1000);
}

function messageInSlack() {
  const user = props.user;
  if (!user?.slackId) return;
  
  // Deep link to Slack DM
  const slackUrl = `slack://channel?team=${getSlackTeamId()}&id=${user.slackId}`;
  window.location.href = slackUrl;
  
  // Fallback to web if app doesn't open
  setTimeout(() => {
    const webUrl = `https://app.slack.com/client/${getSlackTeamId()}/im/${user.slackId}`;
    window.open(webUrl, '_blank');
  }, 1000);
}

function getSlackTeamId(): string {
  // Get from URL params or environment
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get('slackTeamId') || '';
}
</script>

<style scoped>
.org-user-popup-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  backdrop-filter: blur(4px);
}

.org-user-popup {
  background: #ffffff;
  border-radius: 16px;
  padding: 24px;
  max-width: 400px;
  width: 90%;
  max-height: 80vh;
  overflow-y: auto;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  position: relative;
  animation: popupFadeIn 0.2s ease;
}

@keyframes popupFadeIn {
  from {
    opacity: 0;
    transform: scale(0.9);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

.org-user-popup-close {
  position: absolute;
  top: 12px;
  right: 12px;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: #f3f4f6;
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s ease;
}

.org-user-popup-close:hover {
  background: #e5e7eb;
}

.org-user-popup-close ion-icon {
  font-size: 20px;
  color: #6b7280;
}

.org-user-popup-header {
  text-align: center;
  margin-bottom: 24px;
}

.org-user-popup-avatar {
  width: 100px;
  height: 100px;
  border-radius: 50%;
  object-fit: cover;
  border: 4px solid #e5e7eb;
  margin-bottom: 16px;
}

.org-user-popup-avatar-placeholder {
  width: 100px;
  height: 100px;
  border-radius: 50%;
  background: linear-gradient(135deg, #2d7a4e 0%, #1db98a 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #ffffff;
  font-size: 40px;
  font-weight: 600;
  margin: 0 auto 16px;
}

.org-user-popup-name {
  font-size: 24px;
  font-weight: 700;
  color: #1a1a1a;
  margin: 0;
}

.org-user-popup-content {
  margin-bottom: 24px;
}

.org-user-popup-field {
  margin-bottom: 12px;
  font-size: 14px;
  color: #4b5563;
  line-height: 1.6;
}

.org-user-popup-field strong {
  color: #1a1a1a;
  margin-right: 8px;
}

.org-user-popup-link {
  color: #2d7a4e;
  text-decoration: none;
}

.org-user-popup-link:hover {
  text-decoration: underline;
}

.org-user-popup-actions {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.org-user-popup-button {
  padding: 12px 24px;
  background: #2d7a4e;
  color: #ffffff;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
}

.org-user-popup-button:hover {
  background: #1db98a;
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(45, 122, 78, 0.3);
}

.org-user-popup-button:active {
  transform: translateY(0);
}

@media (max-width: 768px) {
  .org-user-popup {
    padding: 20px;
    max-width: 90%;
  }

  .org-user-popup-avatar,
  .org-user-popup-avatar-placeholder {
    width: 80px;
    height: 80px;
  }

  .org-user-popup-name {
    font-size: 20px;
  }
}
</style>






