<template>
  <ion-page>
    <ion-content :fullscreen="true" class="events-content">
      <div class="events-container">
        <!-- Page Title -->
        <div class="events-header">
          <h1 class="page-title">Events</h1>
        </div>

        <!-- Main Content: Side by Side Layout -->
        <div class="events-main-layout">
          <!-- Calendar Grid -->
          <div class="calendar-section">
            <CalendarGrid
              :selected-date="selectedDate"
              :events="events"
              @day-selected="handleDaySelected"
              @create-event="handleCreateEvent"
              @view-events="handleViewEvents"
            />
          </div>

          <!-- Events List Section -->
          <div class="events-list-section">
            <EventsList
              :events="events"
              :selected-date="selectedDate"
              @event-click="navigateToEvent"
              @rsvp="handleRsvp"
              @cancel-rsvp="handleCancelRsvp"
              @create-event="handleCreateEvent"
              @share-event="handleShareEvent"
              @save-event="handleSaveEvent"
            />
          </div>
        </div>

        <!-- Loading State -->
        <div v-if="isLoading" class="loading-container">
          <ion-spinner></ion-spinner>
          <p>Loading events...</p>
        </div>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth.store';
import { useCommunityStore } from '@/stores/community.store';
import { eventService, type Event } from '@/services/event.service';
import CalendarGrid from './components/CalendarGrid.vue';
import EventsList from './components/EventsList.vue';
import {
  IonPage,
  IonContent,
  IonSpinner,
} from '@ionic/vue';

const router = useRouter();
const authStore = useAuthStore();
const communityStore = useCommunityStore();

const isLoading = ref(false);
const events = ref<Event[]>([]);
const selectedDate = ref<Date | undefined>(undefined);

async function loadEvents() {
  if (!authStore.user?.id) {
    return;
  }

  isLoading.value = true;
  try {
    const communityId = communityStore.currentCommunityId;

    if (!communityId) {
      console.warn('No community selected');
      events.value = [];
      return;
    }

    const fetchedEvents = await eventService.getEvents(communityId, authStore.user.id);
    events.value = fetchedEvents;
  } catch (error) {
    console.error('Error loading events:', error);
  } finally {
    isLoading.value = false;
  }
}

function handleDaySelected(date: Date) {
  selectedDate.value = date;
}

function handleCreateEvent(date?: Date) {
  const query = date ? { date: date.toISOString() } : {};
  router.push({ name: 'create-event', query });
}

function handleViewEvents(date: Date, events: Event[]) {
  selectedDate.value = date;
  // Scroll to events list
  // The EventsList component will filter by selectedDate
}

function navigateToEvent(event: Event) {
  router.push(`/tabs/events/${event.id}`);
}

async function handleRsvp(event: Event) {
  if (!authStore.user?.id) {
    return;
  }

  try {
    await eventService.rsvpToEvent(event.id, authStore.user.id);
    // Update local state
    event.userAttending = true;
    event.attendeeCount = (event.attendeeCount || 0) + 1;
  } catch (error) {
    console.error('Error RSVPing to event:', error);
    // TODO: Show error toast
  }
}

async function handleCancelRsvp(event: Event) {
  if (!authStore.user?.id) {
    return;
  }

  try {
    await eventService.cancelRsvp(event.id, authStore.user.id);
    // Update local state
    event.userAttending = false;
    event.attendeeCount = Math.max(0, (event.attendeeCount || 1) - 1);
  } catch (error) {
    console.error('Error canceling RSVP:', error);
    // TODO: Show error toast
  }
}

async function handleShareEvent(event: Event) {
  try {
    const shareUrl = await eventService.shareEvent(event.id);
    // Use Web Share API if available, otherwise copy to clipboard
    if (navigator.share) {
      await navigator.share({
        title: event.name,
        text: event.description || `Check out this event: ${event.name}`,
        url: shareUrl,
      });
    } else {
      await navigator.clipboard.writeText(shareUrl);
      // TODO: Show toast notification
      console.log('Event URL copied to clipboard:', shareUrl);
    }
  } catch (error) {
    console.error('Error sharing event:', error);
    // TODO: Show error toast
  }
}

async function handleSaveEvent(event: Event) {
  if (!authStore.user?.id) {
    return;
  }

  try {
    await eventService.toggleSaveEvent(event.id, authStore.user.id);
    // Update local state - toggle saved status
    event.userSaved = !event.userSaved;
  } catch (error) {
    console.error('Error saving event:', error);
    // TODO: Show error toast
  }
}

// Watch for community changes and reload events
watch(() => communityStore.currentCommunityId, () => {
  loadEvents();
});

onMounted(() => {
  loadEvents();
});
</script>

<style scoped>
.events-content {
  --background: #f8fafc;
}

.events-container {
  padding: 16px;
  max-width: 1200px;
  margin: 0 auto;
}

/* Add padding-top on desktop to account for sticky header */
@media (min-width: 768px) {
  .events-content {
    padding-top: 0;
  }
  
  .events-container {
    padding-top: 24px;
  }
}

.events-header {
  margin-bottom: 24px;
}

.page-title {
  font-size: 32px;
  font-weight: 700;
  color: #1a1a1a;
  margin: 0;
  letter-spacing: -0.5px;
}

.events-main-layout {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.calendar-section {
  flex-shrink: 0;
}

.events-list-section {
  flex: 1;
  min-width: 0;
}

.upcoming-events-section {
  margin-top: 32px;
}

.section-title {
  font-size: 24px;
  font-weight: 700;
  color: #1a1a1a;
  margin: 0 0 24px 0;
  letter-spacing: -0.5px;
}

.loading-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 64px 16px;
  color: #64748b;
}

/* Responsive: Desktop */
@media (min-width: 768px) {
  .events-container {
    padding: 24px;
  }

  .page-title {
    font-size: 36px;
  }

  .section-title {
    font-size: 28px;
  }
}

@media (min-width: 1024px) {
  .events-container {
    padding: 32px;
  }

  .events-main-layout {
    flex-direction: row;
    align-items: flex-start;
    gap: 32px;
  }

  .calendar-section {
    flex: 0 0 400px;
    position: sticky;
    top: 24px;
  }

  .events-list-section {
    flex: 1;
    min-width: 0;
  }
}
</style>

