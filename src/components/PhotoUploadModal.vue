<template>
  <ion-modal :is-open="isOpen" @didDismiss="close">
    <ion-header>
      <ion-toolbar>
        <ion-title>Change Profile Photo</ion-title>
        <ion-buttons slot="end">
          <ion-button @click="close">
            <ion-icon :icon="closeOutline"></ion-icon>
          </ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>
    <ion-content class="photo-upload-content">
      <div class="photo-upload-container">
        <!-- Photo Preview -->
        <div class="photo-preview-section">
          <div class="photo-preview" v-if="previewUrl">
            <img :src="previewUrl" alt="Profile photo preview" />
          </div>
          <div v-else class="photo-placeholder">
            <ion-icon :icon="camera"></ion-icon>
            <p>No photo selected</p>
          </div>
        </div>

        <!-- Upload Options -->
        <div class="upload-options">
          <ion-button
            expand="block"
            fill="outline"
            @click="triggerFileInput"
            :disabled="isUploading"
          >
            <ion-icon :icon="imageOutline" slot="start"></ion-icon>
            Choose Photo
          </ion-button>
          
          <input
            ref="fileInput"
            type="file"
            accept="image/*"
            @change="handleFileSelect"
            style="display: none"
          />

          <ion-button
            v-if="previewUrl"
            expand="block"
            @click="handleUpload"
            :disabled="isUploading"
          >
            <ion-icon :icon="checkmarkOutline" slot="start"></ion-icon>
            {{ isUploading ? 'Uploading...' : 'Save Photo' }}
          </ion-button>

          <ion-button
            v-if="previewUrl"
            expand="block"
            fill="clear"
            @click="removePhoto"
            :disabled="isUploading"
          >
            Remove Photo
          </ion-button>
        </div>
      </div>
    </ion-content>
  </ion-modal>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { useFirebase } from '@/composables/useFirebase';
import { useAuthStore } from '@/stores/auth.store';
import { userService } from '@/services/user.service';
import { toastController } from '@ionic/vue';
import {
  IonModal,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonButtons,
  IonButton,
  IonIcon,
  IonContent,
} from '@ionic/vue';
import {
  closeOutline,
  camera,
  imageOutline,
  checkmarkOutline,
} from 'ionicons/icons';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';

interface Props {
  isOpen: boolean;
}

const props = defineProps<Props>();
const emit = defineEmits<{
  'update:isOpen': [value: boolean];
  'photo-updated': [photoUrl: string];
}>();

const authStore = useAuthStore();
const { storage } = useFirebase();
const fileInput = ref<HTMLInputElement | null>(null);
const previewUrl = ref<string | null>(null);
const selectedFile = ref<File | null>(null);
const isUploading = ref(false);

watch(() => props.isOpen, (newValue) => {
  if (!newValue) {
    // Reset when modal closes
    previewUrl.value = null;
    selectedFile.value = null;
  }
});

function close() {
  emit('update:isOpen', false);
}

function triggerFileInput() {
  fileInput.value?.click();
}

function handleFileSelect(event: Event) {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];
  if (file) {
    selectedFile.value = file;
    const reader = new FileReader();
    reader.onload = (e) => {
      previewUrl.value = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  }
}

function removePhoto() {
  previewUrl.value = null;
  selectedFile.value = null;
  if (fileInput.value) {
    fileInput.value.value = '';
  }
}

async function handleUpload() {
  if (!selectedFile.value || !authStore.user?.id || !storage) {
    return;
  }

  isUploading.value = true;

  try {
    // Upload to Firebase Storage
    const userId = authStore.user.id;
    const fileName = `u_${userId}_${Date.now()}`;
    const imageRef = storageRef(storage, `images/${fileName}`);

    await uploadBytes(imageRef, selectedFile.value);
    const downloadURL = await getDownloadURL(imageRef);

    // Save URL to backend using the set-profile-picture endpoint
    const updatedUser = await userService.setUserImageUrl(downloadURL, userId);

    // Update auth store
    authStore.setUser(updatedUser);

    const toast = await toastController.create({
      message: 'Profile photo updated successfully!',
      duration: 2000,
      color: 'success',
    });
    await toast.present();

    emit('photo-updated', downloadURL);
    close();
  } catch (error: any) {
    console.error('Error uploading photo:', error);
    const toast = await toastController.create({
      message: error.message || 'Failed to upload photo. Please try again.',
      duration: 3000,
      color: 'danger',
    });
    await toast.present();
  } finally {
    isUploading.value = false;
  }
}
</script>

<style scoped>
.photo-upload-content {
  --background: #f8fafc;
}

.photo-upload-container {
  padding: 24px;
  max-width: 500px;
  margin: 0 auto;
}

.photo-preview-section {
  display: flex;
  justify-content: center;
  margin-bottom: 32px;
}

.photo-preview {
  width: 200px;
  height: 200px;
  border-radius: 50%;
  overflow: hidden;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
  border: 4px solid #ffffff;
}

.photo-preview img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.photo-placeholder {
  width: 200px;
  height: 200px;
  border-radius: 50%;
  border: 3px dashed #d1d5db;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: #6b7280;
  background: #f9fafb;
}

.photo-placeholder ion-icon {
  font-size: 64px;
  margin-bottom: 12px;
}

.photo-placeholder p {
  font-size: 14px;
  margin: 0;
}

.upload-options {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.upload-options ion-button {
  --border-radius: 12px;
  height: 48px;
  font-weight: 600;
  text-transform: none;
}

/* Responsive: Desktop */
@media (min-width: 768px) {
  .photo-upload-container {
    padding: 32px;
  }

  .photo-preview,
  .photo-placeholder {
    width: 240px;
    height: 240px;
  }
}
</style>

