<template>
  <div class="activity-feed-section">
    <div class="section-header">
      <h2 class="section-title">
        {{ showCommunityBadge ? 'All Communities' : currentCommunityName }}
      </h2>
    </div>

    <div v-if="isLoading" class="loading-state">
      <ion-spinner name="crescent"></ion-spinner>
      <p>Loading activity...</p>
    </div>

    <div v-else-if="activityItems.length > 0" class="activity-feed">
      <div
        v-for="(item, index) in activityItems"
        :key="item.id || index"
        class="activity-item"
      >
        <!-- Date separator -->
        <div 
          v-if="shouldShowDateSeparator(item, index)"
          class="date-separator"
        >
          {{ formatDateSeparator(item.timestamp) }}
        </div>

        <div class="activity-content">
          <div class="activity-avatar">
            <img
              v-if="item.author?.profilePicture"
              :src="item.author.profilePicture"
              :alt="item.author.fullName"
            />
            <div v-else class="avatar-placeholder">
              {{ getInitials(item.author?.fullName || 'U') }}
            </div>
          </div>
          <div class="activity-message">
            <div class="message-header">
              <span class="author-name">{{ item.author?.fullName || 'Unknown' }}</span>
              <span class="message-time">{{ formatTime(item.timestamp) }}</span>
            </div>
            <p class="message-text">{{ item.content }}</p>
            <ion-badge 
              v-if="showCommunityBadge && item.communityName"
              color="primary" 
              class="community-label"
            >
              {{ item.communityName }}
            </ion-badge>
          </div>
        </div>
      </div>
    </div>

    <div v-else class="empty-state">
      <div class="empty-icon">
        <ion-icon :icon="chatbubbleEllipses"></ion-icon>
      </div>
      <h3 class="empty-title">
        {{ showCommunityBadge ? 'No activity across communities' : `No activity in ${currentCommunityName}` }}
      </h3>
      <p class="empty-description">
        {{ showCommunityBadge 
          ? 'Activity from all your communities will appear here' 
          : 'Community updates and messages will appear here' }}
      </p>
    </div>

    <!-- Message input (disabled in all-communities mode) -->
    <div v-if="!showCommunityBadge" class="message-input-container">
      <ion-input
        v-model="messageInput"
        placeholder="Send a message..."
        class="message-input"
        :disabled="true"
      ></ion-input>
      <ion-button 
        fill="clear" 
        class="send-button"
        :disabled="true"
      >
        <ion-icon :icon="send"></ion-icon>
      </ion-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { activityService, type ActivityItem } from '@/services/activity.service';
import { useAuthStore } from '@/stores/auth.store';
import { useCommunityStore } from '@/stores/community.store';
import {
  IonInput,
  IonButton,
  IonIcon,
  IonBadge,
  IonSpinner,
} from '@ionic/vue';
import { chatbubbleEllipses, send } from 'ionicons/icons';

interface Props {
  communityId?: number | null;
}

const props = withDefaults(defineProps<Props>(), {
  communityId: null,
});

const authStore = useAuthStore();
const communityStore = useCommunityStore();
const activityItems = ref<ActivityItem[]>([]);
const isLoading = ref(false);
const messageInput = ref('');

const showCommunityBadge = computed(() => props.communityId === null);
const currentCommunityName = computed(() => communityStore.currentCommunityName);

function getInitials(name: string): string {
  const parts = name.split(' ');
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return name.substring(0, 2).toUpperCase();
}

function formatTime(timestamp: string | Date): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatDateSeparator(timestamp: string | Date): string {
  const date = new Date(timestamp);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const itemDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  
  const diffTime = today.getTime() - itemDate.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return date.toLocaleDateString('en-US', { weekday: 'long' });

  return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined });
}

function shouldShowDateSeparator(item: ActivityItem, index: number): boolean {
  if (index === 0) return true;
  
  const currentDate = new Date(item.timestamp);
  const prevDate = new Date(activityItems.value[index - 1].timestamp);
  
  const currentDay = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate());
  const prevDay = new Date(prevDate.getFullYear(), prevDate.getMonth(), prevDate.getDate());
  
  return currentDay.getTime() !== prevDay.getTime();
}

async function loadActivity() {
  const userId = authStore.user?.id;
  if (!userId) {
    activityItems.value = [];
    return;
  }

  isLoading.value = true;
  try {
    if (props.communityId === null) {
      // All communities mode
      const allActivity = await activityService.getAllCommunitiesActivity(userId);
      activityItems.value = allActivity;
    } else if (props.communityId) {
      // Single community mode
      const communityActivity = await activityService.getCommunityActivity(props.communityId);
      activityItems.value = communityActivity;
    } else {
      activityItems.value = [];
    }
  } catch (error) {
    console.error('[HomeActivityFeed] Failed to load activity:', error);
    activityItems.value = [];
  } finally {
    isLoading.value = false;
  }
}

watch(() => props.communityId, () => {
  loadActivity();
});

onMounted(() => {
  loadActivity();
});
</script>

<style scoped>
.activity-feed-section {
  margin-bottom: 32px;
}

.section-header {
  margin-bottom: 16px;
}

.section-title {
  font-size: 20px;
  font-weight: 700;
  color: #1a1a1a;
  margin: 0;
  letter-spacing: -0.3px;
}

.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 16px;
  min-height: 200px;
}

.loading-state p {
  margin-top: 16px;
  color: #64748b;
  font-size: 14px;
}

.activity-feed {
  background: #ffffff;
  border-radius: 16px;
  padding: 16px;
  max-height: 600px;
  overflow-y: auto;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
  border: 1px solid rgba(0, 0, 0, 0.05);
}

.date-separator {
  text-align: center;
  margin: 16px 0;
  font-size: 12px;
  font-weight: 600;
  color: #94a3b8;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.activity-item {
  margin-bottom: 16px;
}

.activity-item:last-child {
  margin-bottom: 0;
}

.activity-content {
  display: flex;
  gap: 12px;
}

.activity-avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  overflow: hidden;
  flex-shrink: 0;
  background: linear-gradient(135deg, var(--color-primary) 0%, var(--color-secondary) 100%);
  display: flex;
  align-items: center;
  justify-content: center;
}

.activity-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.avatar-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #ffffff;
  font-size: 14px;
  font-weight: 600;
}

.activity-message {
  flex: 1;
  min-width: 0;
}

.message-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}

.author-name {
  font-size: 14px;
  font-weight: 600;
  color: #1a1a1a;
}

.message-time {
  font-size: 12px;
  color: #94a3b8;
}

.message-text {
  font-size: 14px;
  color: #64748b;
  margin: 0;
  line-height: 1.5;
  word-wrap: break-word;
}

.community-label {
  margin-top: 6px;
  font-size: 10px;
  padding: 2px 6px;
  border-radius: 4px;
  display: inline-block;
}

.message-input-container {
  display: flex;
  gap: 8px;
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid rgba(0, 0, 0, 0.05);
}

.message-input {
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

.send-button ion-icon {
  font-size: 20px;
}

.empty-state {
  background: #ffffff;
  border-radius: 16px;
  padding: 40px 24px;
  text-align: center;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
  border: 1px solid rgba(0, 0, 0, 0.05);
}

.empty-icon {
  width: 64px;
  height: 64px;
  margin: 0 auto 20px;
  background: linear-gradient(135deg, rgba(45, 122, 78, 0.1) 0%, rgba(29, 185, 138, 0.1) 100%);
  border-radius: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.empty-icon ion-icon {
  font-size: 32px;
  color: var(--color-primary);
}

.empty-title {
  font-size: 18px;
  font-weight: 700;
  color: #1a1a1a;
  margin: 0 0 8px 0;
}

.empty-description {
  font-size: 14px;
  color: #64748b;
  margin: 0;
  line-height: 1.5;
}

/* Responsive */
@media (max-width: 768px) {
  .activity-feed {
    padding: 12px;
    max-height: 500px;
  }

  .activity-avatar {
    width: 36px;
    height: 36px;
  }

  .author-name {
    font-size: 13px;
  }

  .message-text {
    font-size: 13px;
  }
}
</style>






