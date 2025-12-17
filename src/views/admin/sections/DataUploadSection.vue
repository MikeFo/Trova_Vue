<template>
  <div class="data-upload-section">
    <h2 class="section-title">Data Upload & Management</h2>
    <p class="section-description">Upload CSV files to manage community data</p>

    <div class="upload-cards">
      <!-- Driver Data Upload -->
      <div class="upload-card">
        <div class="card-header">
          <ion-icon :icon="carOutline" class="card-icon"></ion-icon>
          <h3 class="card-title">Driver Data</h3>
        </div>
        <p class="card-description">Upload CSV file with driver data</p>
        <div class="file-input-container">
          <input
            ref="driverFileInput"
            type="file"
            accept=".csv"
            @change="handleDriverFileSelect"
            style="display: none"
          />
          <ion-button fill="outline" @click="triggerDriverInput">
            <ion-icon :icon="documentOutline" slot="start"></ion-icon>
            Choose CSV File
          </ion-button>
          <div v-if="driverFile" class="file-name">{{ driverFile.name }}</div>
        </div>
        <ion-button
          expand="block"
          @click="uploadDriverData"
          :disabled="!driverFile || isUploading"
        >
          {{ isUploading ? 'Uploading...' : 'Upload Driver Data' }}
        </ion-button>
      </div>

      <!-- Reports To Data Upload -->
      <div class="upload-card">
        <div class="card-header">
          <ion-icon :icon="peopleOutline" class="card-icon"></ion-icon>
          <h3 class="card-title">Reports To Data</h3>
        </div>
        <p class="card-description">Upload CSV with user reports-to-manager data</p>
        <div class="file-input-container">
          <input
            ref="reportsToFileInput"
            type="file"
            accept=".csv"
            @change="handleReportsToFileSelect"
            style="display: none"
          />
          <ion-button fill="outline" @click="triggerReportsToInput">
            <ion-icon :icon="documentOutline" slot="start"></ion-icon>
            Choose CSV File
          </ion-button>
          <div v-if="reportsToFile" class="file-name">{{ reportsToFile.name }}</div>
        </div>
        <ion-button
          expand="block"
          @click="uploadReportsToData"
          :disabled="!reportsToFile || isUploading"
        >
          {{ isUploading ? 'Uploading...' : 'Upload Reports To Data' }}
        </ion-button>
      </div>

      <!-- Mapped Pairings Upload -->
      <div class="upload-card">
        <div class="card-header">
          <ion-icon :icon="linkOutline" class="card-icon"></ion-icon>
          <h3 class="card-title">Mapped Pairings</h3>
        </div>
        <p class="card-description">Upload CSV with user email pairings for groups (up to 6 users per group)</p>
        <div class="file-input-container">
          <input
            ref="pairingsFileInput"
            type="file"
            accept=".csv"
            @change="handlePairingsFileSelect"
            style="display: none"
          />
          <ion-button fill="outline" @click="triggerPairingsInput">
            <ion-icon :icon="documentOutline" slot="start"></ion-icon>
            Choose CSV File
          </ion-button>
          <div v-if="pairingsFile" class="file-name">{{ pairingsFile.name }}</div>
        </div>
        <ion-button
          expand="block"
          @click="uploadPairings"
          :disabled="!pairingsFile || isUploading"
        >
          {{ isUploading ? 'Uploading...' : 'Upload Mapped Pairings' }}
        </ion-button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { adminService } from '@/services/admin.service';
import { toastController } from '@ionic/vue';
import {
  IonButton,
  IonIcon,
} from '@ionic/vue';
import {
  carOutline,
  peopleOutline,
  linkOutline,
  documentOutline,
} from 'ionicons/icons';

interface Props {
  communityId: number | null;
}

const props = defineProps<Props>();

const driverFileInput = ref<HTMLInputElement | null>(null);
const reportsToFileInput = ref<HTMLInputElement | null>(null);
const pairingsFileInput = ref<HTMLInputElement | null>(null);
const driverFile = ref<File | null>(null);
const reportsToFile = ref<File | null>(null);
const pairingsFile = ref<File | null>(null);
const isUploading = ref(false);

function triggerDriverInput() {
  driverFileInput.value?.click();
}

function triggerReportsToInput() {
  reportsToFileInput.value?.click();
}

function triggerPairingsInput() {
  pairingsFileInput.value?.click();
}

function handleDriverFileSelect(event: Event) {
  const target = event.target as HTMLInputElement;
  driverFile.value = target.files?.[0] || null;
}

function handleReportsToFileSelect(event: Event) {
  const target = event.target as HTMLInputElement;
  reportsToFile.value = target.files?.[0] || null;
}

function handlePairingsFileSelect(event: Event) {
  const target = event.target as HTMLInputElement;
  pairingsFile.value = target.files?.[0] || null;
}

async function uploadDriverData() {
  if (!props.communityId || !driverFile.value) return;

  isUploading.value = true;
  try {
    await adminService.uploadDriverData(props.communityId, driverFile.value);
    const toast = await toastController.create({
      message: 'Driver data uploaded successfully',
      duration: 2000,
      color: 'success',
    });
    await toast.present();
    driverFile.value = null;
    if (driverFileInput.value) {
      driverFileInput.value.value = '';
    }
  } catch (error) {
    console.error('Error uploading driver data:', error);
    const toast = await toastController.create({
      message: 'Failed to upload driver data',
      duration: 2000,
      color: 'danger',
    });
    await toast.present();
  } finally {
    isUploading.value = false;
  }
}

async function uploadReportsToData() {
  if (!props.communityId || !reportsToFile.value) return;

  isUploading.value = true;
  try {
    await adminService.uploadReportsToData(props.communityId, reportsToFile.value);
    const toast = await toastController.create({
      message: 'Reports to data uploaded successfully',
      duration: 2000,
      color: 'success',
    });
    await toast.present();
    reportsToFile.value = null;
    if (reportsToFileInput.value) {
      reportsToFileInput.value.value = '';
    }
  } catch (error) {
    console.error('Error uploading reports to data:', error);
    const toast = await toastController.create({
      message: 'Failed to upload reports to data',
      duration: 2000,
      color: 'danger',
    });
    await toast.present();
  } finally {
    isUploading.value = false;
  }
}

async function uploadPairings() {
  if (!props.communityId || !pairingsFile.value) return;

  isUploading.value = true;
  try {
    await adminService.uploadMappedPairings(props.communityId, pairingsFile.value);
    const toast = await toastController.create({
      message: 'Mapped pairings uploaded successfully',
      duration: 2000,
      color: 'success',
    });
    await toast.present();
    pairingsFile.value = null;
    if (pairingsFileInput.value) {
      pairingsFileInput.value.value = '';
    }
  } catch (error) {
    console.error('Error uploading pairings:', error);
    const toast = await toastController.create({
      message: 'Failed to upload mapped pairings',
      duration: 2000,
      color: 'danger',
    });
    await toast.present();
  } finally {
    isUploading.value = false;
  }
}
</script>

<style scoped>
.data-upload-section {
  background: white;
  border-radius: 16px;
  padding: 24px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
}

.section-title {
  font-size: 24px;
  font-weight: 700;
  color: #1a1a1a;
  margin: 0 0 8px 0;
}

.section-description {
  font-size: 14px;
  color: #64748b;
  margin: 0 0 24px 0;
}

.upload-cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 24px;
}

.upload-card {
  padding: 24px;
  background: #f9fafb;
  border-radius: 12px;
  border: 1px solid #e5e7eb;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.card-header {
  display: flex;
  align-items: center;
  gap: 12px;
}

.card-icon {
  font-size: 32px;
  color: var(--color-primary);
}

.card-title {
  font-size: 18px;
  font-weight: 600;
  color: #1a1a1a;
  margin: 0;
}

.card-description {
  font-size: 14px;
  color: #64748b;
  margin: 0;
}

.file-input-container {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.file-name {
  font-size: 14px;
  color: #1a1a1a;
  padding: 8px 12px;
  background: white;
  border-radius: 8px;
  border: 1px solid #e5e7eb;
}

.upload-card ion-button {
  margin-top: auto;
  --border-radius: 8px;
}
</style>





