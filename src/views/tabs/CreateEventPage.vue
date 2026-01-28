<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-button @click="goBack">
            <ion-icon :icon="closeOutline"></ion-icon>
          </ion-button>
        </ion-buttons>
        <ion-title>{{ isEditing ? 'Edit Event' : 'Create Event' }}</ion-title>
        <ion-buttons slot="end">
          <ion-button 
            @click="handleSave" 
            :disabled="!canSave || isSubmitting"
          >
            {{ isSubmitting ? 'Saving...' : (isEditing ? 'Save' : 'Create') }}
          </ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>
    <ion-content :fullscreen="true" class="create-event-content">
      <div class="create-event-container">
        <form @submit.prevent="handleSave">
          <!-- Event Information -->
          <div class="form-section">
            <ion-label class="section-label">Event Information</ion-label>
            
            <ion-item class="form-item" lines="full">
              <ion-label position="stacked">Event Name</ion-label>
              <ion-input
                v-model="formData.name"
                placeholder="What's your event called?"
                :maxlength="100"
                required
              ></ion-input>
            </ion-item>
            <div v-if="errors.name" class="error-message">{{ errors.name }}</div>

            <ion-item class="form-item" lines="full">
              <ion-label position="stacked">Description</ion-label>
              <ion-textarea
                v-model="formData.description"
                placeholder="Tell people what your event is about"
                :maxlength="1000"
                :rows="5"
              ></ion-textarea>
            </ion-item>
            <div v-if="errors.description" class="error-message">{{ errors.description }}</div>
          </div>

          <!-- Event Photo -->
          <div class="form-section">
            <ion-label class="section-label">Event Photo</ion-label>
            <div class="photo-upload-container">
              <div class="photo-preview" v-if="formData.photo">
                <img :src="formData.photo" alt="Event photo" />
                <ion-button
                  fill="clear"
                  size="small"
                  @click="removePhoto"
                  class="remove-photo"
                >
                  Remove
                </ion-button>
              </div>
              <div v-else class="photo-placeholder" @click="triggerFileInput">
                <ion-icon :icon="camera"></ion-icon>
                <p>Tap to add photo</p>
              </div>
              <input
                ref="fileInput"
                type="file"
                accept="image/*"
                @change="handlePhotoUpload"
                style="display: none"
              />
            </div>
          </div>

          <!-- Date & Time -->
          <div class="form-section">
            <ion-label class="section-label">Date & Time</ion-label>
            
            <div class="form-item-wrapper">
              <ion-label class="form-label">Start Date & Time</ion-label>
              <input
                type="datetime-local"
                v-model="startDateTimeLocal"
                :min="minDateTimeLocal"
                class="datetime-input"
                required
                @change="updateStartTime"
              />
            </div>

            <div class="form-item-wrapper">
              <ion-label class="form-label">End Date & Time (Optional)</ion-label>
              <input
                type="datetime-local"
                v-model="endDateTimeLocal"
                :min="startDateTimeLocal || minDateTimeLocal"
                class="datetime-input"
                @change="updateEndTime"
              />
            </div>
            <div v-if="errors.startTime" class="error-message">{{ errors.startTime }}</div>
          </div>

          <!-- Location -->
          <div class="form-section">
            <ion-label class="section-label">Location</ion-label>
            <ion-item class="form-item" lines="full">
              <ion-label position="stacked">Event Location</ion-label>
              <ion-input
                v-model="formData.location"
                placeholder="Where is your event?"
                :maxlength="200"
              ></ion-input>
            </ion-item>
            <div v-if="errors.location" class="error-message">{{ errors.location }}</div>
          </div>

          <!-- Privacy -->
          <div class="form-section">
            <ion-label class="section-label">Privacy</ion-label>
            <ion-radio-group v-model="formData.isPrivate">
              <ion-item lines="none">
                <ion-radio slot="start" :value="false"></ion-radio>
                <ion-label>
                  <h3>Public</h3>
                  <p>Anyone can see and join this event</p>
                </ion-label>
              </ion-item>
              <ion-item lines="none">
                <ion-radio slot="start" :value="true"></ion-radio>
                <ion-label>
                  <h3>Private</h3>
                  <p>Only invited members can see this event</p>
                </ion-label>
              </ion-item>
            </ion-radio-group>
          </div>

          <!-- Submit Button -->
          <div class="form-actions">
            <ion-button
              expand="block"
              @click="handleSave"
              :disabled="!canSave || isSubmitting"
              class="submit-button"
            >
              {{ isSubmitting ? 'Saving...' : (isEditing ? 'Save Changes' : 'Create Event') }}
            </ion-button>
          </div>
        </form>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useAuthStore } from '@/stores/auth.store';
import { useCommunityStore } from '@/stores/community.store';
import { useFirebase } from '@/composables/useFirebase';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { eventService, type Event, type CreateEventData } from '@/services/event.service';
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
  IonItem,
  IonLabel,
  IonInput,
  IonTextarea,
  IonRadioGroup,
  IonRadio,
} from '@ionic/vue';
import { closeOutline, camera } from 'ionicons/icons';

const router = useRouter();
const route = useRoute();
const authStore = useAuthStore();
const communityStore = useCommunityStore();
const { storage } = useFirebase();

const isEditing = ref(false);
const eventId = ref<number | null>(null);
const isSubmitting = ref(false);

// Get initial date from query params if provided
function getInitialDate(): Date {
  if (route.query.date) {
    try {
      const date = new Date(route.query.date as string);
      if (!isNaN(date.getTime())) {
        // Set initial time to next hour
        date.setHours(date.getHours() + 1, 0, 0, 0);
        return date;
      }
    } catch (e) {
      console.warn('Invalid date in query params:', e);
    }
  }
  const date = new Date();
  date.setHours(date.getHours() + 1, 0, 0, 0);
  return date;
}

const initialDate = getInitialDate();
// Set initial end time to 1 hour after start time
const initialEndDate = new Date(initialDate);
initialEndDate.setHours(initialEndDate.getHours() + 1);

const formData = ref({
  name: '',
  description: '',
  startTime: initialDate.toISOString(),
  endTime: initialEndDate.toISOString(),
  location: '',
  photo: null as string | null,
  photoFile: null as File | null,
  isPrivate: false,
});

const fileInput = ref<HTMLInputElement | null>(null);

const errors = ref({
  name: '',
  description: '',
  startTime: '',
  location: '',
});

// Convert ISO strings to datetime-local format (YYYY-MM-DDTHH:mm)
function toDateTimeLocal(isoString: string): string {
  if (!isoString) return '';
  const date = new Date(isoString);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

// Convert datetime-local format to ISO string
function fromDateTimeLocal(dateTimeLocal: string): string {
  if (!dateTimeLocal) return '';
  return new Date(dateTimeLocal).toISOString();
}

const startDateTimeLocal = ref(toDateTimeLocal(initialDate.toISOString()));
const endDateTimeLocal = ref(toDateTimeLocal(initialEndDate.toISOString()));

const minDateTimeLocal = computed(() => {
  return toDateTimeLocal(new Date().toISOString());
});

function updateStartTime() {
  formData.value.startTime = fromDateTimeLocal(startDateTimeLocal.value);
  
  // If end time is before new start time, or if end time is empty, set it to 1 hour after start time
  if (!endDateTimeLocal.value || endDateTimeLocal.value < startDateTimeLocal.value) {
    const startDate = new Date(startDateTimeLocal.value);
    const endDate = new Date(startDate);
    endDate.setHours(endDate.getHours() + 1);
    
    endDateTimeLocal.value = toDateTimeLocal(endDate.toISOString());
    formData.value.endTime = endDate.toISOString();
  }
}

function updateEndTime() {
  formData.value.endTime = endDateTimeLocal.value ? fromDateTimeLocal(endDateTimeLocal.value) : '';
}

const canSave = computed(() => {
  return formData.value.name.trim().length > 0 && 
         formData.value.startTime.length > 0;
});

function goBack() {
  router.back();
}

function triggerFileInput() {
  fileInput.value?.click();
}

function handlePhotoUpload(event: any) {
  const target = event?.target as HTMLInputElement | null;
  const file = target?.files?.[0];
  if (file) {
    formData.value.photoFile = file;
    const reader = new FileReader();
    reader.onload = (e) => {
      formData.value.photo = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  }
}

function removePhoto() {
  formData.value.photo = null;
  formData.value.photoFile = null;
  if (fileInput.value) {
    fileInput.value.value = '';
  }
}

function validateForm(): boolean {
  errors.value = { name: '', description: '', startTime: '', location: '' };
  let isValid = true;

  if (!formData.value.name.trim()) {
    errors.value.name = 'Event name is required';
    isValid = false;
  } else if (formData.value.name.length > 100) {
    errors.value.name = 'Event name must be 100 characters or less';
    isValid = false;
  }

  if (formData.value.description && formData.value.description.length > 1000) {
    errors.value.description = 'Description must be 1000 characters or less';
    isValid = false;
  }

  if (!formData.value.startTime) {
    errors.value.startTime = 'Start date and time are required';
    isValid = false;
  } else {
    const startDate = new Date(formData.value.startTime);
    if (startDate < new Date()) {
      errors.value.startTime = 'Start time must be in the future';
      isValid = false;
    }
  }

  if (formData.value.endTime) {
    const startDate = new Date(formData.value.startTime);
    const endDate = new Date(formData.value.endTime);
    if (endDate <= startDate) {
      errors.value.startTime = 'End time must be after start time';
      isValid = false;
    }
  }

  if (formData.value.location && formData.value.location.length > 200) {
    errors.value.location = 'Location must be 200 characters or less';
    isValid = false;
  }

  return isValid;
}

async function handleSave() {
  if (!validateForm()) {
    return;
  }

  if (!authStore.user?.id) {
    const toast = await toastController.create({
      message: 'You must be logged in to create an event',
      duration: 2000,
      color: 'danger',
    });
    await toast.present();
    return;
  }

  isSubmitting.value = true;

  try {
    const communityId = communityStore.currentCommunityId;
    if (!communityId) {
      const toast = await toastController.create({
        message: 'You must be part of a community to create an event. Please select a community first.',
        duration: 4000,
        color: 'warning',
      });
      await toast.present();
      isSubmitting.value = false;
      return;
    }

    // Upload photo to Firebase Storage if provided
    let photoUrl: string | undefined = undefined;
    if (formData.value.photoFile && storage) {
      try {
        const userId = authStore.user.id;
        const fileName = `event_${userId}_${Date.now()}`;
        const imageRef = storageRef(storage, `images/${fileName}`);
        
        await uploadBytes(imageRef, formData.value.photoFile);
        photoUrl = await getDownloadURL(imageRef);
      } catch (uploadError: any) {
        console.error('Error uploading photo:', uploadError);
        const toast = await toastController.create({
          message: uploadError.message || 'Failed to upload photo. Creating event without photo.',
          duration: 3000,
          color: 'warning',
        });
        await toast.present();
        // Continue with event creation even if photo upload fails
      }
    } else if (formData.value.photo && !formData.value.photoFile) {
      // If photo exists but no file (editing existing event with existing photo), use existing URL
      photoUrl = formData.value.photo;
    }

    const eventData: CreateEventData = {
      name: formData.value.name.trim(),
      description: formData.value.description.trim() || undefined,
      startTime: new Date(formData.value.startTime).toISOString(),
      endTime: formData.value.endTime ? new Date(formData.value.endTime).toISOString() : undefined,
      location: formData.value.location.trim() || undefined,
      photo: photoUrl,
      communityId: communityId,
      isPrivate: formData.value.isPrivate,
    };

    let savedEvent: Event;
    if (isEditing.value && eventId.value) {
      savedEvent = await eventService.updateEvent(eventId.value, eventData);
    } else {
      savedEvent = await eventService.createEvent(eventData);
    }

    const toast = await toastController.create({
      message: isEditing.value ? 'Event updated successfully!' : 'Event created successfully!',
      duration: 2000,
      color: 'success',
    });
    await toast.present();

    // Navigate back to events page
    router.push('/tabs/events');
  } catch (error: any) {
    console.error('Error saving event:', error);
    
    let errorMessage = isEditing.value 
      ? 'Failed to update event. Please try again.' 
      : 'Failed to create event. Please try again.';
    
    if (error.message && error.message !== '{}' && error.message !== 'Request failed') {
      errorMessage = error.message;
    } else if (error.response?.data) {
      const responseData = error.response.data;
      if (responseData.message && responseData.message !== '{}') {
        errorMessage = responseData.message;
      } else if (responseData.error) {
        errorMessage = responseData.error;
      }
    }
    
    const toast = await toastController.create({
      message: errorMessage,
      duration: 4000,
      color: 'danger',
    });
    await toast.present();
  } finally {
    isSubmitting.value = false;
  }
}

async function loadEvent() {
  const id = route.params.id;
  if (id && typeof id === 'string' && !isNaN(Number(id)) && route.path.includes('/edit')) {
    isEditing.value = true;
    eventId.value = Number(id);
    
    try {
      const event = await eventService.getEvent(eventId.value);
      if (event) {
        const startTime = new Date(event.startTime);
        // If no end time, default to 1 hour after start time
        let endTime = event.endTime ? new Date(event.endTime).toISOString() : '';
        if (!endTime) {
          const defaultEndTime = new Date(startTime);
          defaultEndTime.setHours(defaultEndTime.getHours() + 1);
          endTime = defaultEndTime.toISOString();
        }
        
        formData.value = {
          name: event.name,
          description: event.description || '',
          startTime: startTime.toISOString(),
          endTime: endTime,
          location: event.location || '',
          photo: event.photo || null,
          photoFile: null,
          isPrivate: event.isPrivate,
        };
        startDateTimeLocal.value = toDateTimeLocal(formData.value.startTime);
        endDateTimeLocal.value = toDateTimeLocal(formData.value.endTime);
      }
    } catch (error) {
      console.error('Error loading event:', error);
      const toast = await toastController.create({
        message: 'Failed to load event',
        duration: 2000,
        color: 'danger',
      });
      await toast.present();
      router.back();
    }
  }
}

onMounted(() => {
  loadEvent();
});
</script>

<style scoped>
.create-event-content {
  --background: #f8fafc;
}

.create-event-container {
  padding: 16px;
  max-width: 600px;
  margin: 0 auto;
}

.form-section {
  background: white;
  border-radius: 16px;
  padding: 24px;
  margin-bottom: 16px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
}

.section-label {
  font-size: 18px;
  font-weight: 600;
  color: #1a1a1a;
  margin-bottom: 16px;
  display: block;
}

.form-item {
  --padding-start: 0;
  --padding-end: 0;
  --inner-padding-end: 0;
  margin-bottom: 16px;
}

.form-item-wrapper {
  margin-bottom: 20px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.form-label {
  font-size: 14px;
  font-weight: 500;
  color: #374151;
  margin-bottom: 4px;
}

.error-message {
  color: #ef4444;
  font-size: 14px;
  margin-top: -12px;
  margin-bottom: 12px;
  padding-left: 16px;
}

.datetime-input {
  width: 100%;
  padding: 12px 48px 12px 12px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  font-size: 16px;
  font-family: inherit;
  background: white;
  color: #1a1a1a;
  transition: border-color 0.2s;
  box-sizing: border-box;
  min-height: 48px;
}

.datetime-input:focus {
  outline: none;
  border-color: var(--color-primary);
}

.datetime-input:disabled {
  background: #f9fafb;
  color: #6b7280;
  cursor: not-allowed;
}

.photo-upload-container {
  display: flex;
  justify-content: center;
  align-items: center;
  margin: 16px 0;
}

.photo-preview {
  position: relative;
  width: 200px;
  height: 200px;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
}

.photo-preview img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.remove-photo {
  position: absolute;
  bottom: 8px;
  right: 8px;
}

.photo-placeholder {
  width: 200px;
  height: 200px;
  border-radius: 12px;
  border: 3px dashed #d1d5db;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s;
  color: #6b7280;
  background: #f9fafb;
}

.photo-placeholder:hover {
  border-color: var(--color-primary);
  background: #f0fdf4;
}

.photo-placeholder ion-icon {
  font-size: 48px;
  margin-bottom: 8px;
}

.photo-placeholder p {
  font-size: 14px;
  margin: 0;
}

.form-actions {
  margin-top: 24px;
  padding: 0 8px;
}

.submit-button {
  --border-radius: 12px;
  --padding-top: 16px;
  --padding-bottom: 16px;
  height: 52px;
  font-weight: 600;
  font-size: 16px;
  text-transform: none;
  --background: linear-gradient(135deg, var(--color-primary) 0%, var(--color-secondary) 100%);
  --color: #ffffff;
  box-shadow: 0 4px 12px rgba(52, 168, 83, 0.3);
  transition: all 0.2s ease;
}

.submit-button:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(52, 168, 83, 0.4);
}

.submit-button:disabled {
  --background: #e5e7eb;
  --color: #94a3b8;
  box-shadow: none;
  opacity: 0.6;
}

/* Responsive: Desktop */
@media (min-width: 768px) {
  .create-event-container {
    padding: 24px;
  }

  .form-section {
    padding: 32px;
  }
}
</style>







