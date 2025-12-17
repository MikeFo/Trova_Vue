<template>
  <div class="group-list">
    <div
      v-for="group in displayedGroups"
      :key="group.id"
      class="group-item"
      @click="$emit('click', group)"
    >
      <!-- Notification Badge -->
      <div
        v-if="group.hasNotification"
        class="notification-badge"
      ></div>

      <!-- Group Image -->
      <div class="group-image">
        <img
          v-if="group.logoSmall || group.logo"
          :src="group.logoSmall || group.logo"
          :alt="group.name"
          class="group-logo"
        />
        <div v-else class="group-logo-placeholder">
          <ion-icon :icon="people"></ion-icon>
        </div>
      </div>

      <!-- Group Info -->
      <div class="group-info">
        <div class="group-header">
          <h3 class="group-name">{{ group.name }}</h3>
          <div v-if="group.isPrivate" class="lock-icon">
            <ion-icon :icon="lockClosed"></ion-icon>
          </div>
        </div>

        <!-- Last Message (if joined) or Bio -->
        <div v-if="isJoined && getLastMessage(group)" class="group-message">
          <span class="message-author" v-if="getLastMessageAuthor(group)">
            <strong>{{ getLastMessageAuthor(group) }}</strong>
            <span class="message-separator"> • </span>
          </span>
          <span class="message-text">{{ getLastMessage(group) }}</span>
          <span class="message-time">{{ getLastMessageTime(group) }}</span>
        </div>
        <div v-else class="group-bio">
          {{ truncateText(group.bio || 'No description', 100) }}
        </div>

        <!-- Member Avatars -->
        <div class="group-meta">
          <div v-if="group.users && group.users.length > 0" class="member-avatars">
            <img
              v-for="(member, index) in getDisplayedMembers(group)"
              :key="member.id"
              :src="member.profilePicture || '/assets/images/default-pro-pic.svg'"
              :alt="member.fullName"
              class="member-avatar"
              :style="{ zIndex: getDisplayedMembers(group).length - index }"
            />
            <span v-if="getExtraMembersCount(group) > 0" class="extra-members">
              +{{ getExtraMembersCount(group) }}
            </span>
          </div>
          <span v-else class="member-count">
            {{ (group.memberCount || 0) + 1 }} member{{ (group.memberCount || 0) !== 0 ? 's' : '' }}
          </span>
        </div>
      </div>

      <!-- Action Buttons -->
      <div class="group-actions">
        <div v-if="isJoined" class="favorite-icon" @click.stop="toggleFavorite(group)">
          <ion-icon 
            :icon="group.isFavorite ? star : starOutline" 
            :class="{ 'favorite-active': group.isFavorite }"
          ></ion-icon>
        </div>
        <div v-if="!isJoined && !group.isPrivate" class="join-button-wrapper">
          <ion-button
            fill="outline"
            size="small"
            class="join-button"
            @click.stop="$emit('join', group)"
          >
            Join
          </ion-button>
        </div>
        <div v-if="isJoined" class="side-icons">
          <ion-icon :icon="chevronForward" class="chevron-icon"></ion-icon>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { Group } from '@/services/group.service';
import { IonIcon, IonButton } from '@ionic/vue';
import { people, lockClosed, chevronForward, star, starOutline } from 'ionicons/icons';

interface Props {
  groups: Group[];
  isJoined?: boolean;
  groupMessages?: any[];
}

const props = withDefaults(defineProps<Props>(), {
  isJoined: false,
  groupMessages: () => [],
});

const emit = defineEmits<{
  click: [group: Group];
  join: [group: Group];
  favorite: [group: Group];
}>();

function toggleFavorite(group: Group) {
  group.isFavorite = !group.isFavorite;
  emit('favorite', group);
}

function getDisplayedMembers(group: Group) {
  if (!group.users || group.users.length === 0) return [];
  // Show up to 3 member avatars
  return group.users.slice(0, 3);
}

function getExtraMembersCount(group: Group) {
  if (!group.users || group.users.length <= 3) return 0;
  return group.users.length - 3;
}

const displayedGroups = computed(() => {
  return props.groups;
});

function getLastMessage(group: Group): string | null {
  // TODO: Get last message from groupMessages map
  // For now, return null
  return group.lastMessage || null;
}

function getLastMessageAuthor(group: Group): string | null {
  return group.lastMessageAuthor || null;
}

function getLastMessageTime(group: Group): string {
  if (group.lastMessageTime) {
    return formatRelativeTime(group.lastMessageTime);
  }
  return '';
}

function formatRelativeTime(timeString: string): string {
  const date = new Date(timeString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  const diffWeeks = Math.floor(diffDays / 7);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m`;
  if (diffHours < 24) return `${diffHours}h`;
  if (diffDays < 7) return `${diffDays}d`;
  if (diffWeeks < 52) return `${diffWeeks}w`;
  
  const diffYears = Math.floor(diffWeeks / 52);
  return `${diffYears}y`;
}

function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text;
  }
  return text.substring(0, maxLength) + '...';
}
</script>

<style scoped>
.group-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

@media (min-width: 768px) {
  .group-list {
    gap: 12px;
  }
}

.group-item {
  background: #ffffff;
  border-radius: 12px;
  padding: 12px;
  display: flex;
  align-items: flex-start;
  gap: 12px;
  cursor: pointer;
  transition: all 0.2s ease;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
  border: 1px solid #e5e7eb;
  position: relative;
}

@media (min-width: 768px) {
  .group-item {
    border-radius: 16px;
    padding: 16px;
    gap: 16px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
    border: 2px solid transparent;
  }
}

.group-item:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  transform: translateY(-2px);
  border-color: rgba(45, 122, 78, 0.2);
}

.notification-badge {
  position: absolute;
  top: 12px;
  left: 12px;
  width: 12px;
  height: 12px;
  background: var(--color-primary);
  border-radius: 50%;
  border: 2px solid #ffffff;
  z-index: 1;
}

.group-image {
  flex-shrink: 0;
  position: relative;
}

.group-logo {
  width: 56px;
  height: 56px;
  border-radius: 10px;
  object-fit: cover;
  border: 2px solid #e5e7eb;
}

.group-logo-placeholder {
  width: 56px;
  height: 56px;
  border-radius: 10px;
  background: linear-gradient(135deg, var(--color-primary) 0%, var(--color-secondary) 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  border: 2px solid #e5e7eb;
}

@media (min-width: 768px) {
  .group-logo,
  .group-logo-placeholder {
    width: 64px;
    height: 64px;
    border-radius: 12px;
  }
}

.group-logo-placeholder ion-icon {
  font-size: 32px;
  color: #ffffff;
}

.group-info {
  flex: 1;
  min-width: 0;
}

.group-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.group-name {
  font-size: 16px;
  font-weight: 600;
  color: #1a1a1a;
  margin: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
  line-height: 1.3;
}

@media (min-width: 768px) {
  .group-name {
    font-size: 18px;
  }
}

.lock-icon {
  color: #64748b;
  font-size: 16px;
  flex-shrink: 0;
}

.group-message {
  font-size: 13px;
  color: #64748b;
  margin-bottom: 4px;
  line-height: 1.4;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

@media (min-width: 768px) {
  .group-message {
    font-size: 14px;
    margin-bottom: 6px;
  }
}

.message-author {
  color: #1a1a1a;
  font-weight: 500;
}

.message-separator {
  color: #94a3b8;
}

.message-text {
  color: #64748b;
}

.message-time {
  color: #94a3b8;
  font-size: 12px;
  margin-left: 4px;
}

.group-bio {
  font-size: 13px;
  color: #64748b;
  margin-bottom: 4px;
  line-height: 1.4;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

@media (min-width: 768px) {
  .group-bio {
    font-size: 14px;
    margin-bottom: 6px;
  }
}

.group-meta {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 8px;
}

.member-avatars {
  display: flex;
  align-items: center;
  gap: -8px;
  position: relative;
}

.member-avatar {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  object-fit: cover;
  border: 2px solid #ffffff;
  margin-left: -6px;
  position: relative;
}

.member-avatar:first-child {
  margin-left: 0;
}

.extra-members {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: #f1f5f9;
  border: 2px solid #ffffff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 9px;
  font-weight: 600;
  color: #64748b;
  margin-left: -6px;
  position: relative;
}

@media (min-width: 768px) {
  .member-avatar {
    width: 24px;
    height: 24px;
    margin-left: -8px;
  }

  .extra-members {
    width: 24px;
    height: 24px;
    font-size: 10px;
    margin-left: -8px;
  }
}

.member-count {
  font-size: 12px;
  color: #94a3b8;
  font-weight: 500;
}

.group-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.favorite-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  padding: 4px;
  transition: transform 0.2s ease;
}

.favorite-icon:hover {
  transform: scale(1.1);
}

.favorite-icon ion-icon {
  font-size: 20px;
  color: #cbd5e1;
  transition: color 0.2s ease;
}

.favorite-icon .favorite-active {
  color: var(--color-primary);
}

.join-button-wrapper {
  display: flex;
  align-items: center;
}

.join-button {
  --border-color: var(--color-primary);
  --color: var(--color-primary);
  --border-radius: 8px;
  --padding-start: 16px;
  --padding-end: 16px;
  height: 36px;
  font-weight: 600;
  text-transform: none;
  font-size: 13px;
  transition: all 0.2s ease;
}

.join-button:hover {
  --background: var(--color-primary);
  --color: white;
}

.side-icons {
  display: flex;
  align-items: center;
  color: #cbd5e1;
}

.chevron-icon {
  font-size: 20px;
}

/* Additional responsive adjustments */
@media (min-width: 1024px) {
  .group-item {
    padding: 20px;
    gap: 20px;
  }

  .group-logo,
  .group-logo-placeholder {
    width: 72px;
    height: 72px;
  }

  .group-logo-placeholder ion-icon {
    font-size: 36px;
  }

  .group-name {
    font-size: 20px;
  }

  .group-message,
  .group-bio {
    font-size: 15px;
  }
}
</style>

