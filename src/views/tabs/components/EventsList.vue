<template>
  <div class="events-list-container">
    <!-- Search and Create -->
    <div class="events-header">
      <ion-searchbar
        v-model="searchQuery"
        placeholder="Search events"
        class="events-search"
        :debounce="300"
        @ionInput="handleSearch"
      ></ion-searchbar>
      <ion-button
        fill="solid"
        class="create-event-button"
        @click="createEvent"
      >
        <ion-icon :icon="addOutline"></ion-icon>
      </ion-button>
    </div>

    <!-- Events Grouped by Date -->
    <div v-if="groupedEvents.length > 0" class="events-groups">
      <div
        v-for="group in groupedEvents"
        :key="group.date"
        class="event-group"
      >
        <h3 class="group-date">{{ formatGroupDate(group.date) }}</h3>
        <div class="events-in-group">
          <div
            v-for="event in group.events"
            :key="event.id"
            class="event-card"
            @click="$emit('event-click', event)"
          >
            <div v-if="event.photo" class="event-photo-thumbnail">
              <img :src="event.photo" :alt="event.name" />
            </div>
            <div class="event-card-content-wrapper">
              <div class="event-time">
                <div class="time-display">{{ formatEventTime(event.startTime) }}</div>
                <div v-if="event.endTime" class="time-end">
                  - {{ formatEventTime(event.endTime) }}
                </div>
              </div>
              <div class="event-content">
              <div class="event-header">
                <h4 class="event-name">{{ event.name }}</h4>
                <div v-if="event.isPrivate" class="lock-icon">
                  <ion-icon :icon="lockClosedOutline"></ion-icon>
                </div>
                <div v-if="event.hasNotification" class="notification-badge"></div>
              </div>
              <div v-if="event.description" class="event-description">
                {{ truncateText(event.description, 100) }}
              </div>
              <div class="event-meta">
                <div v-if="event.location" class="event-location">
                  <ion-icon :icon="locationOutline"></ion-icon>
                  <span>{{ event.location }}</span>
                </div>
                <div class="event-attendees">
                  <ion-icon :icon="peopleOutline"></ion-icon>
                  <span>{{ event.attendeeCount || 0 }} going</span>
                </div>
              </div>
              </div>
            <div class="event-actions">
              <div class="action-buttons">
                <ion-button
                  fill="clear"
                  size="small"
                  class="icon-button"
                  @click.stop="$emit('save-event', event)"
                  :color="event.userSaved ? 'primary' : 'medium'"
                >
                  <ion-icon :icon="event.userSaved ? bookmark : bookmarkOutline"></ion-icon>
                </ion-button>
                <ion-button
                  fill="clear"
                  size="small"
                  class="icon-button"
                  @click.stop="$emit('share-event', event)"
                >
                  <ion-icon :icon="shareSocialOutline"></ion-icon>
                </ion-button>
              </div>
              <ion-button
                v-if="!event.userAttending"
                fill="outline"
                size="small"
                class="rsvp-button"
                @click.stop="$emit('rsvp', event)"
              >
                RSVP
              </ion-button>
              <ion-button
                v-else
                fill="clear"
                size="small"
                class="cancel-rsvp-button"
                @click.stop="$emit('cancel-rsvp', event)"
              >
                Going
              </ion-button>
            </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Empty State -->
    <div v-else class="empty-state">
      <div class="empty-icon">
        <ion-icon :icon="calendarOutline"></ion-icon>
      </div>
      <h3 class="empty-title">Create an event, big or small!</h3>
      <ion-button
        fill="outline"
        class="empty-action-button"
        @click="createEvent"
      >
        Create Event
      </ion-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { IonSearchbar, IonButton, IonIcon } from '@ionic/vue';
import {
  addOutline,
  lockClosedOutline,
  locationOutline,
  peopleOutline,
  calendarOutline,
  shareSocialOutline,
  bookmark,
  bookmarkOutline,
} from 'ionicons/icons';
import type { Event } from '@/services/event.service';

interface Props {
  events: Event[];
  selectedDate?: Date;
}

interface EventGroup {
  date: string;
  events: Event[];
}

const props = withDefaults(defineProps<Props>(), {
  events: () => [],
  selectedDate: undefined,
});

const emit = defineEmits<{
  'event-click': [event: Event];
  'rsvp': [event: Event];
  'cancel-rsvp': [event: Event];
  'create-event': [];
  'search': [query: string];
  'share-event': [event: Event];
  'save-event': [event: Event];
}>();

const searchQuery = ref('');

const filteredEvents = computed(() => {
  let events = props.events;

  // Filter by selected date if provided
  if (props.selectedDate) {
    const selectedDateStr = props.selectedDate.toISOString().split('T')[0];
    events = events.filter((event) => {
      const eventDate = new Date(event.startTime);
      const eventDateStr = eventDate.toISOString().split('T')[0];
      return eventDateStr === selectedDateStr;
    });
  }

  // Filter by search query
  if (searchQuery.value.trim()) {
    const query = searchQuery.value.toLowerCase();
    events = events.filter(
      (event) =>
        event.name.toLowerCase().includes(query) ||
        event.description?.toLowerCase().includes(query) ||
        event.location?.toLowerCase().includes(query)
    );
  }

  return events;
});

const groupedEvents = computed(() => {
  const groups: { [key: string]: Event[] } = {};

  filteredEvents.value.forEach((event) => {
    const date = new Date(event.startTime);
    const dateStr = date.toISOString().split('T')[0];
    if (!groups[dateStr]) {
      groups[dateStr] = [];
    }
    groups[dateStr].push(event);
  });

  // Convert to array and sort by date
  return Object.keys(groups)
    .sort()
    .map((date) => ({
      date,
      events: groups[date].sort(
        (a, b) =>
          new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
      ),
    }));
});

function formatGroupDate(dateStr: string): string {
  const date = new Date(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  if (date.toDateString() === today.toDateString()) {
    return 'Today';
  }
  if (date.toDateString() === tomorrow.toDateString()) {
    return 'Tomorrow';
  }

  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
}

function formatEventTime(timeStr: string): string {
  const date = new Date(timeStr);
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text;
  }
  return text.substring(0, maxLength) + '...';
}

function handleSearch(event: any) {
  searchQuery.value = event.target.value || '';
  emit('search', searchQuery.value);
}

function createEvent() {
  emit('create-event');
}
</script>

<style scoped>
.events-list-container {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.events-header {
  display: flex;
  align-items: center;
  gap: 8px;
}

.events-search {
  flex: 1;
  --background: #ffffff;
  --border-radius: 12px;
  --box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
  --placeholder-color: #94a3b8;
  --icon-color: #64748b;
  padding: 0;
}

.create-event-button {
  --background: var(--color-primary);
  --color: #ffffff;
  --border-radius: 50%;
  width: 44px;
  height: 44px;
  margin: 0;
  flex-shrink: 0;
  box-shadow: 0 4px 12px rgba(45, 122, 78, 0.3);
}

.create-event-button ion-icon {
  font-size: 24px;
}

.events-groups {
  display: flex;
  flex-direction: column;
  gap: 32px;
}

.event-group {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.group-date {
  font-size: 18px;
  font-weight: 700;
  color: #1a1a1a;
  margin: 0;
  padding-bottom: 8px;
  border-bottom: 2px solid #e5e7eb;
}

.events-in-group {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.event-card {
  background: #ffffff;
  border-radius: 12px;
  padding: 0;
  display: flex;
  flex-direction: column;
  cursor: pointer;
  transition: all 0.2s ease;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
  border: 2px solid transparent;
  position: relative;
  overflow: hidden;
}

.event-photo-thumbnail {
  width: 100%;
  height: 200px;
  overflow: hidden;
  background: #f3f4f6;
}

.event-photo-thumbnail img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.event-card-content-wrapper {
  padding: 16px;
  display: flex;
  gap: 16px;
}

.event-card:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  transform: translateY(-2px);
  border-color: rgba(45, 122, 78, 0.2);
}

.event-time {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-start;
  flex-shrink: 0;
  min-width: 60px;
}

.time-display {
  font-size: 16px;
  font-weight: 600;
  color: var(--color-primary);
}

.time-end {
  font-size: 12px;
  color: #64748b;
  margin-top: 2px;
}

.event-content {
  flex: 1;
  min-width: 0;
}

.event-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.event-name {
  font-size: 18px;
  font-weight: 600;
  color: #1a1a1a;
  margin: 0;
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.lock-icon {
  color: #64748b;
  font-size: 16px;
  flex-shrink: 0;
}

.notification-badge {
  width: 8px;
  height: 8px;
  background: var(--color-primary);
  border-radius: 50%;
  flex-shrink: 0;
}

.event-description {
  font-size: 14px;
  color: #64748b;
  margin-bottom: 8px;
  line-height: 1.5;
}

.event-meta {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
}

.event-location,
.event-attendees {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 13px;
  color: #64748b;
}

.event-location ion-icon,
.event-attendees ion-icon {
  font-size: 16px;
}

.event-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.action-buttons {
  display: flex;
  align-items: center;
  gap: 4px;
}

.icon-button {
  --padding-start: 8px;
  --padding-end: 8px;
  margin: 0;
  min-width: 36px;
  height: 36px;
}

.icon-button ion-icon {
  font-size: 20px;
}

.rsvp-button {
  --border-color: var(--color-primary);
  --color: var(--color-primary);
  --border-radius: 8px;
  --padding-start: 16px;
  --padding-end: 16px;
  height: 36px;
  font-weight: 600;
  text-transform: none;
  font-size: 13px;
}

.rsvp-button:hover {
  --background: var(--color-primary);
  --color: white;
}

.cancel-rsvp-button {
  --color: var(--color-primary);
  --border-radius: 8px;
  --padding-start: 16px;
  --padding-end: 16px;
  height: 36px;
  font-weight: 600;
  text-transform: none;
  font-size: 13px;
}

.empty-state {
  text-align: center;
  padding: 64px 16px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
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
  font-size: 22px;
  font-weight: 700;
  color: #1a1a1a;
  margin: 0 0 24px 0;
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
}

.empty-action-button:hover {
  --background: var(--color-primary);
  --color: white;
}

/* Responsive: Desktop */
@media (min-width: 768px) {
  .event-card {
    padding: 20px;
  }

  .event-name {
    font-size: 20px;
  }

  .event-description {
    font-size: 15px;
  }
}
</style>

