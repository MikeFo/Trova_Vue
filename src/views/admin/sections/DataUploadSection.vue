<template>
  <div class="data-upload-section">
    <h2 class="section-title">Data Upload & Management</h2>
    <p class="section-description">Upload CSV files to manage community data</p>

    <div class="upload-cards">
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
          <ion-button fill="outline" @click="triggerReportsToInput" :disabled="isUploadingReports">
            <ion-icon :icon="documentOutline" slot="start"></ion-icon>
            Choose CSV File
          </ion-button>
          <div v-if="reportsToFile" class="file-name">{{ reportsToFile.name }}</div>
        </div>
        <ion-button
          expand="block"
          color="primary"
          @click="uploadReportsToData"
          :disabled="!reportsToFile || isUploadingReports"
        >
          <ion-spinner v-if="isUploadingReports" name="dots" slot="start"></ion-spinner>
          {{ isUploadingReports ? 'Uploading...' : 'Upload Reports To Data' }}
        </ion-button>
      </div>

      <!-- Mapped Pairings Upload -->
      <div class="upload-card">
        <div class="card-header">
          <ion-icon :icon="linkOutline" class="card-icon"></ion-icon>
          <h3 class="card-title">Mapped Pairings</h3>
        </div>
        <p class="card-description">Upload CSV with user email pairings for groups (up to 6 users per group)</p>
        <div class="csv-format-help">
          <p class="format-label">Required columns:</p>
          <pre class="format-sample">useremail1,useremail2,useremail3,useremail4,useremail5,useremail6
alice@co.com,bob@co.com,carol@co.com,,,
dave@co.com,eve@co.com,,,,</pre>
          <p class="format-note">Only useremail1 and useremail2 are required. Columns 3–6 are optional.</p>
        </div>
        <div class="file-input-container">
          <input
            ref="pairingsFileInput"
            type="file"
            accept=".csv"
            @change="handlePairingsFileSelect"
            style="display: none"
          />
          <ion-button fill="outline" @click="triggerPairingsInput" :disabled="isUploadingPairings">
            <ion-icon :icon="documentOutline" slot="start"></ion-icon>
            Choose CSV File
          </ion-button>
          <div v-if="pairingsFile" class="file-name">{{ pairingsFile.name }}</div>
        </div>
        <ion-button
          expand="block"
          color="primary"
          @click="uploadPairings"
          :disabled="!pairingsFile || isUploadingPairings"
        >
          <ion-spinner v-if="isUploadingPairings" name="dots" slot="start"></ion-spinner>
          {{ isUploadingPairings ? 'Uploading...' : 'Upload Mapped Pairings' }}
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
  IonSpinner,
} from '@ionic/vue';
import {
  peopleOutline,
  linkOutline,
  documentOutline,
} from 'ionicons/icons';

interface Props {
  communityId: number | null;
  hasCustomData?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  hasCustomData: false,
});

const reportsToFileInput = ref<HTMLInputElement | null>(null);
const pairingsFileInput = ref<HTMLInputElement | null>(null);
const reportsToFile = ref<File | null>(null);
const pairingsFile = ref<File | null>(null);
const isUploadingReports = ref(false);
const isUploadingPairings = ref(false);

function triggerReportsToInput() {
  reportsToFileInput.value?.click();
}

function triggerPairingsInput() {
  pairingsFileInput.value?.click();
}

function handleReportsToFileSelect(event: Event) {
  const target = event.target as HTMLInputElement;
  reportsToFile.value = target.files?.[0] || null;
}

function handlePairingsFileSelect(event: Event) {
  const target = event.target as HTMLInputElement;
  pairingsFile.value = target.files?.[0] || null;
}

function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}

async function uploadReportsToData() {
  if (!props.communityId || !reportsToFile.value) return;

  const file = reportsToFile.value;
  isUploadingReports.value = true;

  const warnToast = await toastController.create({
    message: `Uploading ${file.name} — this might take a bit!`,
    duration: 3000,
    color: 'warning',
  });
  await warnToast.present();

  try {
    const csvData = await readFileAsText(file);
    await adminService.uploadReportsToData(props.communityId, csvData);
    const toast = await toastController.create({
      message: 'Successfully uploaded reports to data',
      duration: 2000,
      color: 'success',
    });
    await toast.present();
    reportsToFile.value = null;
    if (reportsToFileInput.value) reportsToFileInput.value.value = '';
  } catch (error) {
    console.error('Error uploading reports to data:', error);
    const toast = await toastController.create({
      message: 'Failed to upload reports to data. Please try again.',
      duration: 3000,
      color: 'danger',
    });
    await toast.present();
  } finally {
    isUploadingReports.value = false;
  }
}

async function uploadPairings() {
  if (!props.communityId || !pairingsFile.value) return;

  const file = pairingsFile.value;
  isUploadingPairings.value = true;

  const warnToast = await toastController.create({
    message: `Uploading ${file.name} — this might take a bit!`,
    duration: 3000,
    color: 'warning',
  });
  await warnToast.present();

  try {
    const csvData = await readFileAsText(file);
    await adminService.uploadMappedPairings(props.communityId, csvData, file.name);
    const toast = await toastController.create({
      message: 'Successfully uploaded mapped pairings',
      duration: 2000,
      color: 'success',
    });
    await toast.present();
    pairingsFile.value = null;
    if (pairingsFileInput.value) pairingsFileInput.value.value = '';
  } catch (error) {
    console.error('Error uploading pairings:', error);
    const toast = await toastController.create({
      message: 'Failed to upload mapped pairings. Please try again.',
      duration: 3000,
      color: 'danger',
    });
    await toast.present();
  } finally {
    isUploadingPairings.value = false;
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

.csv-format-help {
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 12px;
}

.format-label {
  font-size: 12px;
  font-weight: 600;
  color: #475569;
  margin: 0 0 6px 0;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.format-sample {
  font-size: 11px;
  background: #f1f5f9;
  padding: 8px;
  border-radius: 4px;
  overflow-x: auto;
  margin: 0 0 6px 0;
  color: #334155;
  line-height: 1.5;
}

.format-note {
  font-size: 12px;
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
