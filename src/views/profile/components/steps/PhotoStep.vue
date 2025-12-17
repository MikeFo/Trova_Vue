<template>
  <div class="step-panel">
    <h2 class="step-title">Add a photo</h2>
    <p class="step-description">Show your best self!</p>
    
    <div class="photo-upload-container">
      <div class="photo-preview" v-if="photo">
        <img :src="photo" alt="Profile photo" />
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
        <ion-icon :icon="camera" size="large"></ion-icon>
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
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { camera } from 'ionicons/icons';
import { IonButton, IonIcon } from '@ionic/vue';

interface Props {
  photo: string | null;
}

const props = defineProps<Props>();
const emit = defineEmits<{
  'update': [value: string | null];
}>();

const fileInput = ref<HTMLInputElement | null>(null);

function triggerFileInput() {
  fileInput.value?.click();
}

function handlePhotoUpload(event: Event) {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      emit('update', e.target?.result as string);
    };
    reader.readAsDataURL(file);
  }
}

function removePhoto() {
  emit('update', null);
}
</script>

<style scoped>
.step-panel {
  animation: fadeIn 0.3s ease;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.step-title {
  font-size: 28px;
  font-weight: 700;
  color: #1a1a1a;
  margin: 0 0 8px 0;
}

.step-description {
  font-size: 16px;
  color: #6b7280;
  margin: 0 0 32px 0;
}

.photo-upload-container {
  display: flex;
  justify-content: center;
  align-items: center;
  margin: 32px 0;
}

.photo-preview {
  position: relative;
  width: 200px;
  height: 200px;
  border-radius: 50%;
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
  border-radius: 50%;
  border: 3px dashed #d1d5db;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s;
  color: #6b7280;
}

.photo-placeholder:hover {
  border-color: #2d7a4e;
  background: #f0fdf4;
}

.photo-placeholder ion-icon {
  margin-bottom: 8px;
}
</style>

