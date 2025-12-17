<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-button @click="goBack">
            <ion-icon :icon="arrowBack"></ion-icon>
          </ion-button>
        </ion-buttons>
        <ion-title>Event Details</ion-title>
        <ion-buttons slot="end">
          <ion-button @click="handleShare" v-if="event">
            <ion-icon :icon="shareSocialOutline"></ion-icon>
          </ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>
    <ion-content :fullscreen="true" class="event-detail-content">
      <div v-if="isLoading" class="loading-container">
        <ion-spinner></ion-spinner>
        <p>Loading event...</p>
      </div>

      <div v-else-if="event" class="event-detail-container">
        <!-- Event Photo -->
        <div v-if="event.photo" class="event-photo-section">
          <img :src="event.photo" :alt="event.name" class="event-photo" />
        </div>

        <!-- Event Header -->
        <div class="event-header">
          <h1 class="event-title">{{ event.name }}</h1>
          <div class="event-meta-top">
            <div class="event-date-time">
              <ion-icon :icon="calendarOutline"></ion-icon>
              <div>
                <div class="date-display">{{ formatDate(event.startTime) }}</div>
                <div class="time-display">{{ formatTime(event.startTime) }}</div>
                <div v-if="event.endTime" class="time-end">
                  - {{ formatTime(event.endTime) }}
                </div>
              </div>
            </div>
            <div v-if="event.location" class="event-location">
              <ion-icon :icon="locationOutline"></ion-icon>
              <span>{{ event.location }}</span>
            </div>
          </div>
        </div>

        <!-- Event Actions -->
        <div class="event-actions-bar">
          <ion-button
            v-if="!event.userAttending"
            fill="solid"
            expand="block"
            class="rsvp-button"
            @click="handleRsvp"
            :disabled="isUpdating"
          >
            <ion-icon :icon="checkmarkCircleOutline" slot="start"></ion-icon>
            RSVP
          </ion-button>
          <ion-button
            v-else
            fill="outline"
            expand="block"
            class="cancel-rsvp-button"
            @click="handleCancelRsvp"
            :disabled="isUpdating"
          >
            <ion-icon :icon="closeCircleOutline" slot="start"></ion-icon>
            Cancel RSVP
          </ion-button>
          <div class="action-buttons">
            <ion-button
              fill="clear"
              class="icon-button"
              @click="handleSave"
              :color="event.userSaved ? 'primary' : 'medium'"
            >
              <ion-icon :icon="event.userSaved ? bookmark : bookmarkOutline"></ion-icon>
            </ion-button>
            <ion-button
              fill="clear"
              class="icon-button"
              @click="handleShare"
            >
              <ion-icon :icon="shareSocialOutline"></ion-icon>
            </ion-button>
            <ion-button
              v-if="canEdit"
              fill="clear"
              class="icon-button"
              @click="handleEdit"
            >
              <ion-icon :icon="createOutline"></ion-icon>
            </ion-button>
          </div>
        </div>

        <!-- Event Description -->
        <div v-if="event.description" class="event-section">
          <h2 class="section-title">About this event</h2>
          <p class="event-description">{{ event.description }}</p>
        </div>

        <!-- Attendees -->
        <div class="event-section">
          <h2 class="section-title">
            Attendees
            <span class="attendee-count">({{ event.attendeeCount || 0 }})</span>
          </h2>
          <div v-if="event.attendees && event.attendees.length > 0" class="attendees-list">
            <div
              v-for="attendee in event.attendees"
              :key="attendee.id"
              class="attendee-item"
              @click="navigateToProfile(attendee.id)"
            >
              <div class="attendee-avatar">
                <img
                  v-if="attendee.profilePicture"
                  :src="attendee.profilePicture"
                  :alt="attendee.fullName"
                />
                <div v-else class="avatar-placeholder">
                  {{ getInitials(attendee.fullName) }}
                </div>
              </div>
              <span class="attendee-name">{{ attendee.fullName }}</span>
            </div>
          </div>
          <div v-else class="empty-attendees">
            <p>No attendees yet. Be the first to RSVP!</p>
          </div>
        </div>

        <!-- Event Info -->
        <div class="event-section">
          <h2 class="section-title">Event Information</h2>
          <div class="info-grid">
            <div class="info-item">
              <ion-icon :icon="peopleOutline"></ion-icon>
              <div>
                <div class="info-label">Attendees</div>
                <div class="info-value">{{ event.attendeeCount || 0 }} going</div>
              </div>
            </div>
            <div class="info-item" v-if="event.isPrivate">
              <ion-icon :icon="lockClosedOutline"></ion-icon>
              <div>
                <div class="info-label">Privacy</div>
                <div class="info-value">Private Event</div>
              </div>
            </div>
            <div class="info-item" v-if="event.createdBy">
              <ion-icon :icon="personOutline"></ion-icon>
              <div>
                <div class="info-label">Organized by</div>
                <div class="info-value">Event Organizer</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div v-else class="error-container">
        <ion-icon :icon="alertCircleOutline" class="error-icon"></ion-icon>
        <h2>Event not found</h2>
        <p>The event you're looking for doesn't exist or has been removed.</p>
        <ion-button @click="goBack">Go Back</ion-button>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useAuthStore } from '@/stores/auth.store';
import { eventService, type Event } from '@/services/event.service';
import { toastController } from '@ionic/vue';
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonButtons,
  IonButton,
  IonIcon,
  IonContent,
  IonSpinner,
} from '@ionic/vue';
import {
  arrowBack,
  shareSocialOutline,
  calendarOutline,
  locationOutline,
  checkmarkCircleOutline,
  closeCircleOutline,
  bookmark,
  bookmarkOutline,
  createOutline,
  peopleOutline,
  lockClosedOutline,
  personOutline,
  alertCircleOutline,
} from 'ionicons/icons';

const router = useRouter();
const route = useRoute();
const authStore = useAuthStore();

const event = ref<Event | null>(null);
const isLoading = ref(true);
const isUpdating = ref(false);

const canEdit = computed(() => {
  return event.value && authStore.user?.id === event.value.createdBy;
});

async function loadEvent() {
  const id = route.params.id;
  if (!id || typeof id !== 'string') {
    isLoading.value = false;
    return;
  }

  isLoading.value = true;
  try {
    const loadedEvent = await eventService.getEvent(id);
    event.value = loadedEvent;
  } catch (error) {
    console.error('Error loading event:', error);
    const toast = await toastController.create({
      message: 'Failed to load event',
      duration: 2000,
      color: 'danger',
    });
    await toast.present();
  } finally {
    isLoading.value = false;
  }
}

function goBack() {
  router.back();
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function formatTime(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

function getInitials(name: string): string {
  const parts = name.split(' ');
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return name.substring(0, 2).toUpperCase();
}

function navigateToProfile(userId: number) {
  router.push(`/tabs/profile/${userId}`);
}

async function handleRsvp() {
  if (!authStore.user?.id || !event.value) {
    return;
  }

  isUpdating.value = true;
  try {
    await eventService.rsvpToEvent(event.value.id, authStore.user.id);
    if (event.value) {
      event.value.userAttending = true;
      event.value.attendeeCount = (event.value.attendeeCount || 0) + 1;
    }
    const toast = await toastController.create({
      message: 'You\'re going to this event!',
      duration: 2000,
      color: 'success',
    });
    await toast.present();
    // Reload event to get updated attendees list
    await loadEvent();
  } catch (error) {
    console.error('Error RSVPing to event:', error);
    const toast = await toastController.create({
      message: 'Failed to RSVP. Please try again.',
      duration: 2000,
      color: 'danger',
    });
    await toast.present();
  } finally {
    isUpdating.value = false;
  }
}

async function handleCancelRsvp() {
  if (!authStore.user?.id || !event.value) {
    return;
  }

  isUpdating.value = true;
  try {
    await eventService.cancelRsvp(event.value.id, authStore.user.id);
    if (event.value) {
      event.value.userAttending = false;
      event.value.attendeeCount = Math.max(0, (event.value.attendeeCount || 1) - 1);
    }
    const toast = await toastController.create({
      message: 'RSVP canceled',
      duration: 2000,
      color: 'medium',
    });
    await toast.present();
    // Reload event to get updated attendees list
    await loadEvent();
  } catch (error) {
    console.error('Error canceling RSVP:', error);
    const toast = await toastController.create({
      message: 'Failed to cancel RSVP. Please try again.',
      duration: 2000,
      color: 'danger',
    });
    await toast.present();
  } finally {
    isUpdating.value = false;
  }
}

async function handleShare() {
  if (!event.value) return;

  try {
    const shareUrl = await eventService.shareEvent(event.value.id);
    if (navigator.share) {
      await navigator.share({
        title: event.value.name,
        text: event.value.description || `Check out this event: ${event.value.name}`,
        url: shareUrl,
      });
    } else {
      await navigator.clipboard.writeText(shareUrl);
      const toast = await toastController.create({
        message: 'Event URL copied to clipboard!',
        duration: 2000,
        color: 'success',
      });
      await toast.present();
    }
  } catch (error) {
    console.error('Error sharing event:', error);
  }
}

async function handleSave() {
  if (!authStore.user?.id || !event.value) {
    return;
  }

  try {
    await eventService.toggleSaveEvent(event.value.id, authStore.user.id);
    if (event.value) {
      event.value.userSaved = !event.value.userSaved;
    }
    const toast = await toastController.create({
      message: event.value?.userSaved ? 'Event saved!' : 'Event unsaved',
      duration: 2000,
      color: 'success',
    });
    await toast.present();
  } catch (error) {
    console.error('Error saving event:', error);
    const toast = await toastController.create({
      message: 'Failed to save event. Please try again.',
      duration: 2000,
      color: 'danger',
    });
    await toast.present();
  }
}

function handleEdit() {
  if (event.value) {
    router.push(`/tabs/events/${event.value.id}/edit`);
  }
}

onMounted(() => {
  loadEvent();
});
</script>

<style scoped>
.event-detail-content {
  --background: #f8fafc;
}

.loading-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 64px 16px;
  color: #64748b;
}

.event-detail-container {
  max-width: 800px;
  margin: 0 auto;
  padding: 16px;
}

.event-photo-section {
  width: 100%;
  margin-bottom: 16px;
  border-radius: 16px;
  overflow: hidden;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.event-photo {
  width: 100%;
  height: auto;
  max-height: 400px;
  object-fit: cover;
  display: block;
}

.event-header {
  background: white;
  border-radius: 16px;
  padding: 24px;
  margin-bottom: 16px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
}

.event-title {
  font-size: 28px;
  font-weight: 700;
  color: #1a1a1a;
  margin: 0 0 20px 0;
  letter-spacing: -0.5px;
}

.event-meta-top {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.event-date-time,
.event-location {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  color: #64748b;
}

.event-date-time ion-icon,
.event-location ion-icon {
  font-size: 20px;
  color: var(--color-primary);
  margin-top: 2px;
  flex-shrink: 0;
}

.date-display {
  font-size: 16px;
  font-weight: 600;
  color: #1a1a1a;
}

.time-display {
  font-size: 14px;
  color: #64748b;
  margin-top: 4px;
}

.time-end {
  font-size: 14px;
  color: #64748b;
}

.event-actions-bar {
  background: white;
  border-radius: 16px;
  padding: 16px;
  margin-bottom: 16px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.rsvp-button {
  --background: linear-gradient(135deg, var(--color-primary) 0%, var(--color-secondary) 100%);
  --color: white;
  --border-radius: 12px;
  height: 48px;
  font-weight: 600;
  font-size: 16px;
  text-transform: none;
  box-shadow: 0 4px 12px rgba(45, 122, 78, 0.3);
}

.cancel-rsvp-button {
  --border-color: var(--color-primary);
  --color: var(--color-primary);
  --border-radius: 12px;
  height: 48px;
  font-weight: 600;
  font-size: 16px;
  text-transform: none;
}

.action-buttons {
  display: flex;
  justify-content: center;
  gap: 8px;
  padding-top: 8px;
  border-top: 1px solid #e5e7eb;
}

.icon-button {
  --padding-start: 12px;
  --padding-end: 12px;
  margin: 0;
}

.icon-button ion-icon {
  font-size: 22px;
}

.event-section {
  background: white;
  border-radius: 16px;
  padding: 24px;
  margin-bottom: 16px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
}

.section-title {
  font-size: 20px;
  font-weight: 700;
  color: #1a1a1a;
  margin: 0 0 16px 0;
  display: flex;
  align-items: center;
  gap: 8px;
}

.attendee-count {
  font-size: 16px;
  font-weight: 500;
  color: #64748b;
}

.event-description {
  font-size: 16px;
  line-height: 1.6;
  color: #374151;
  white-space: pre-wrap;
}

.attendees-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.attendee-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  border-radius: 12px;
  cursor: pointer;
  transition: background 0.2s ease;
}

.attendee-item:hover {
  background: #f9fafb;
}

.attendee-avatar {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  overflow: hidden;
  flex-shrink: 0;
  background: linear-gradient(135deg, rgba(45, 122, 78, 0.1) 0%, rgba(29, 185, 138, 0.1) 100%);
}

.attendee-avatar img {
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
  font-weight: 600;
  color: var(--color-primary);
  font-size: 18px;
}

.attendee-name {
  font-size: 16px;
  font-weight: 500;
  color: #1a1a1a;
}

.empty-attendees {
  text-align: center;
  padding: 32px 16px;
  color: #64748b;
}

.info-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
}

.info-item {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 16px;
  background: #f9fafb;
  border-radius: 12px;
}

.info-item ion-icon {
  font-size: 24px;
  color: var(--color-primary);
  flex-shrink: 0;
}

.info-label {
  font-size: 12px;
  color: #64748b;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 4px;
}

.info-value {
  font-size: 16px;
  font-weight: 600;
  color: #1a1a1a;
}

.error-container {
  text-align: center;
  padding: 64px 16px;
  max-width: 400px;
  margin: 0 auto;
}

.error-icon {
  font-size: 64px;
  color: #ef4444;
  margin-bottom: 16px;
}

.error-container h2 {
  font-size: 24px;
  font-weight: 700;
  color: #1a1a1a;
  margin: 0 0 8px 0;
}

.error-container p {
  font-size: 16px;
  color: #64748b;
  margin: 0 0 24px 0;
}

/* Responsive: Desktop */
@media (min-width: 768px) {
  .event-detail-container {
    padding: 24px;
  }

  .event-title {
    font-size: 32px;
  }

  .event-actions-bar {
    flex-direction: row;
    align-items: center;
  }

  .action-buttons {
    padding-top: 0;
    border-top: none;
    border-left: 1px solid #e5e7eb;
    padding-left: 16px;
    margin-left: 16px;
  }
}
</style>







