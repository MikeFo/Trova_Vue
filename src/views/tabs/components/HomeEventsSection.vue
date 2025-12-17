<template>
  <div class="events-section">
    <div class="section-header">
      <h2 class="section-title">Upcoming Events</h2>
      <ion-button 
        fill="clear" 
        size="small" 
        class="see-all-button"
        @click="navigateTo('/tabs/events')"
      >
        View all
        <ion-icon :icon="chevronForward" slot="end"></ion-icon>
      </ion-button>
    </div>

    <div v-if="isLoading" class="loading-state">
      <ion-spinner name="crescent"></ion-spinner>
      <p>Loading events...</p>
    </div>

    <div v-else-if="events.length > 0" class="events-list">
      <div
        v-for="event in events"
        :key="event.id"
        class="event-card"
        @click="navigateToEvent(event.id)"
      >
        <div class="event-image">
          <img
            v-if="eventImage"
            :src="eventImage"
            :alt="event.name"
          />
          <div v-else class="event-placeholder">
            <ion-icon :icon="calendarOutline"></ion-icon>
          </div>
        </div>
        <div class="event-content">
          <h3 class="event-name">{{ event.name }}</h3>
          <div class="event-details">
            <div class="event-detail-item" v-if="event.startTime">
              <ion-icon :icon="timeOutline" class="detail-icon"></ion-icon>
              <span>{{ formatDate(event.startTime) }}</span>
            </div>
            <div class="event-detail-item" v-if="event.location">
              <ion-icon :icon="locationOutline" class="detail-icon"></ion-icon>
              <span>{{ event.location }}</span>
            </div>
          </div>
          <div class="event-footer">
            <ion-badge 
              v-if="event.userAttending" 
              color="success" 
              class="rsvp-badge"
            >
              RSVP'd
            </ion-badge>
            <ion-badge 
              v-if="showCommunityBadge && event.communityId"
              color="primary" 
              class="community-badge"
            >
              {{ getCommunityName(event.communityId) }}
            </ion-badge>
          </div>
        </div>
      </div>
    </div>

    <div v-else class="empty-state">
      <div class="empty-icon">
        <ion-icon :icon="calendarOutline"></ion-icon>
      </div>
      <h3 class="empty-title">
        {{ showCommunityBadge ? 'No upcoming events' : `No upcoming events in ${currentCommunityName}` }}
      </h3>
      <p class="empty-description">
        {{ showCommunityBadge 
          ? 'RSVP to events to see them here' 
          : 'RSVP to events in this community to see them here' }}
      </p>
      <ion-button 
        fill="outline" 
        class="empty-action-button"
        @click="navigateTo('/tabs/events')"
      >
        View Events
      </ion-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { useRouter } from 'vue-router';
import { eventService, type Event } from '@/services/event.service';
import { useAuthStore } from '@/stores/auth.store';
import { useCommunityStore } from '@/stores/community.store';
import {
  IonButton,
  IonIcon,
  IonBadge,
  IonSpinner,
} from '@ionic/vue';
import { chevronForward, calendarOutline, timeOutline, locationOutline } from 'ionicons/icons';

interface Props {
  communityId?: number | null;
}

const props = withDefaults(defineProps<Props>(), {
  communityId: null,
});

const router = useRouter();
const authStore = useAuthStore();
const communityStore = useCommunityStore();
const events = ref<Event[]>([]);
const isLoading = ref(false);

const showCommunityBadge = computed(() => props.communityId === null);
const currentCommunityName = computed(() => communityStore.currentCommunityName);
const eventImage = computed(() => null); // Placeholder - can be enhanced later

function getCommunityName(communityId: number): string {
  const community = communityStore.getCommunityById(communityId);
  return community?.name || 'Community';
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const eventDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  
  const diffTime = eventDate.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Tomorrow';
  if (diffDays < 7) return `In ${diffDays} days`;

  // Format as "Mon, Jan 15" or "Jan 15, 2024" if different year
  const options: Intl.DateTimeFormatOptions = {
    month: 'short',
    day: 'numeric',
  };
  
  if (date.getFullYear() !== now.getFullYear()) {
    options.year = 'numeric';
  }
  
  return date.toLocaleDateString('en-US', options);
}

function navigateToEvent(eventId: number) {
  router.push(`/tabs/events/${eventId}`);
}

function navigateTo(path: string) {
  router.push(path);
}

async function loadEvents() {
  const userId = authStore.user?.id;
  if (!userId) {
    events.value = [];
    return;
  }

  isLoading.value = true;
  try {
    const upcomingEvents = await eventService.getUpcomingRSVPEvents(userId, props.communityId || undefined);
    events.value = upcomingEvents;
  } catch (error) {
    console.error('[HomeEventsSection] Failed to load events:', error);
    events.value = [];
  } finally {
    isLoading.value = false;
  }
}

watch(() => props.communityId, () => {
  loadEvents();
});

onMounted(() => {
  loadEvents();
});
</script>

<style scoped>
.events-section {
  margin-bottom: 32px;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.section-title {
  font-size: 20px;
  font-weight: 700;
  color: #1a1a1a;
  margin: 0;
  letter-spacing: -0.3px;
}

.see-all-button {
  --color: var(--color-primary);
  font-size: 14px;
  font-weight: 600;
  --padding-start: 8px;
  --padding-end: 8px;
  margin: 0;
}

.see-all-button ion-icon {
  font-size: 16px;
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

.events-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.event-card {
  background: #ffffff;
  border-radius: 16px;
  padding: 16px;
  display: flex;
  gap: 16px;
  cursor: pointer;
  transition: all 0.2s ease;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
  border: 1px solid rgba(0, 0, 0, 0.05);
}

.event-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
}

.event-card:active {
  transform: translateY(0);
}

.event-image {
  width: 80px;
  height: 80px;
  border-radius: 12px;
  overflow: hidden;
  flex-shrink: 0;
  background: linear-gradient(135deg, rgba(45, 122, 78, 0.1) 0%, rgba(29, 185, 138, 0.1) 100%);
  display: flex;
  align-items: center;
  justify-content: center;
}

.event-image img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.event-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.event-placeholder ion-icon {
  font-size: 32px;
  color: var(--color-primary);
}

.event-content {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.event-name {
  font-size: 18px;
  font-weight: 600;
  color: #1a1a1a;
  margin: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.event-details {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.event-detail-item {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: #64748b;
}

.detail-icon {
  font-size: 16px;
  color: #94a3b8;
}

.event-footer {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: auto;
}

.rsvp-badge {
  font-size: 11px;
  padding: 4px 8px;
  border-radius: 6px;
}

.community-badge {
  font-size: 11px;
  padding: 4px 8px;
  border-radius: 6px;
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
  margin: 0 0 20px 0;
  line-height: 1.5;
}

.empty-action-button {
  --border-color: var(--color-primary);
  --color: var(--color-primary);
  --border-radius: 12px;
  --padding-start: 20px;
  --padding-end: 20px;
  height: 40px;
  font-weight: 600;
  text-transform: none;
  font-size: 14px;
}

/* Responsive */
@media (max-width: 768px) {
  .event-card {
    padding: 12px;
    gap: 12px;
  }

  .event-image {
    width: 64px;
    height: 64px;
  }

  .event-name {
    font-size: 16px;
  }
}
</style>






