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

        <!-- Spreadsheet-style format reference -->
        <div class="csv-format-help">
          <p class="format-label">Required CSV Format</p>
          <div class="spreadsheet-preview">
            <table class="spreadsheet-table">
              <thead>
                <tr>
                  <th class="row-number"></th>
                  <th>A</th>
                  <th>B</th>
                  <th class="optional-col">C</th>
                  <th class="optional-col">D</th>
                  <th class="optional-col">E</th>
                  <th class="optional-col">F</th>
                </tr>
              </thead>
              <tbody>
                <tr class="header-row">
                  <td class="row-number">1</td>
                  <td class="required-cell">useremail1</td>
                  <td class="required-cell">useremail2</td>
                  <td class="optional-cell">useremail3</td>
                  <td class="optional-cell">useremail4</td>
                  <td class="optional-cell">useremail5</td>
                  <td class="optional-cell">useremail6</td>
                </tr>
                <tr>
                  <td class="row-number">2</td>
                  <td>alice@company.com</td>
                  <td>bob@company.com</td>
                  <td>carol@company.com</td>
                  <td></td>
                  <td></td>
                  <td></td>
                </tr>
                <tr>
                  <td class="row-number">3</td>
                  <td>dave@company.com</td>
                  <td>eve@company.com</td>
                  <td></td>
                  <td></td>
                  <td></td>
                  <td></td>
                </tr>
              </tbody>
            </table>
          </div>
          <div class="format-legend">
            <span class="legend-required"><span class="legend-dot required"></span> Required</span>
            <span class="legend-optional"><span class="legend-dot optional"></span> Optional</span>
          </div>
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

    <!-- Format Error Modal -->
    <ion-modal :is-open="showFormatErrorModal" @did-dismiss="showFormatErrorModal = false">
      <ion-header>
        <ion-toolbar>
          <ion-title>Incorrect CSV Format</ion-title>
          <ion-buttons slot="end">
            <ion-button @click="showFormatErrorModal = false">Close</ion-button>
          </ion-buttons>
        </ion-toolbar>
      </ion-header>
      <ion-content class="format-error-content">
        <div class="error-modal-body">
          <div class="error-banner">
            <ion-icon :icon="alertCircleOutline" class="error-icon"></ion-icon>
            <div>
              <h3>Upload Failed</h3>
              <p>{{ formatErrorMessage }}</p>
            </div>
          </div>

          <div v-if="formatErrorColumns.length" class="error-columns-found">
            <p class="detail-label">Columns found in your file:</p>
            <div class="column-chips">
              <span
                v-for="col in formatErrorColumns"
                :key="col"
                class="column-chip"
                :class="{ 'chip-valid': isValidPairingColumn(col), 'chip-invalid': !isValidPairingColumn(col) }"
              >{{ col }}</span>
            </div>
          </div>

          <div class="expected-format-section">
            <p class="detail-label">Your CSV must look like this:</p>
            <div class="spreadsheet-preview modal-preview">
              <table class="spreadsheet-table">
                <thead>
                  <tr>
                    <th class="row-number"></th>
                    <th>A</th>
                    <th>B</th>
                    <th class="optional-col">C</th>
                    <th class="optional-col">D</th>
                    <th class="optional-col">E</th>
                    <th class="optional-col">F</th>
                  </tr>
                </thead>
                <tbody>
                  <tr class="header-row">
                    <td class="row-number">1</td>
                    <td class="required-cell">useremail1</td>
                    <td class="required-cell">useremail2</td>
                    <td class="optional-cell">useremail3</td>
                    <td class="optional-cell">useremail4</td>
                    <td class="optional-cell">useremail5</td>
                    <td class="optional-cell">useremail6</td>
                  </tr>
                  <tr>
                    <td class="row-number">2</td>
                    <td>john@email.com</td>
                    <td>sarah@email.com</td>
                    <td>mike@email.com</td>
                    <td></td>
                    <td></td>
                    <td></td>
                  </tr>
                  <tr>
                    <td class="row-number">3</td>
                    <td>alex@email.com</td>
                    <td>taylor@email.com</td>
                    <td></td>
                    <td></td>
                    <td></td>
                    <td></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div class="format-rules">
            <p class="detail-label">Rules</p>
            <ul>
              <li><strong>Row 1</strong> must be the header row with exact column names</li>
              <li><strong>useremail1</strong> and <strong>useremail2</strong> are required in every row</li>
              <li><strong>useremail3</strong> through <strong>useremail6</strong> are optional (for larger groups)</li>
              <li>Save as <strong>.csv</strong> (comma-separated), not .xlsx</li>
            </ul>
          </div>

          <ion-button expand="block" @click="retryPairingsUpload" color="primary">
            Try Again
          </ion-button>
        </div>
      </ion-content>
    </ion-modal>
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
  IonModal,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonButtons,
  IonContent,
} from '@ionic/vue';
import {
  peopleOutline,
  linkOutline,
  documentOutline,
  alertCircleOutline,
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

const showFormatErrorModal = ref(false);
const formatErrorMessage = ref('');
const formatErrorColumns = ref<string[]>([]);

const VALID_PAIRING_COLUMNS = ['useremail1', 'useremail2', 'useremail3', 'useremail4', 'useremail5', 'useremail6'];

function isValidPairingColumn(col: string): boolean {
  return VALID_PAIRING_COLUMNS.includes(col.toLowerCase().trim());
}

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

function parseColumnsFromError(errorMsg: string): string[] {
  const match = errorMsg.match(/Found columns:\s*(.+)/i);
  if (match) {
    return match[1].split(',').map(c => c.trim()).filter(Boolean);
  }
  return [];
}

function showPairingsFormatError(error: any) {
  const msg = error?.response?.data?.error
    || error?.response?.data?.message
    || error?.message
    || 'Unknown error';

  formatErrorColumns.value = parseColumnsFromError(msg);

  if (msg.toLowerCase().includes('useremail1') || msg.toLowerCase().includes('columns')) {
    formatErrorMessage.value = 'Your CSV is missing the required column headers. The first row must contain useremail1 and useremail2.';
  } else if (msg.toLowerCase().includes('empty')) {
    formatErrorMessage.value = 'The uploaded CSV file is empty. Please add data and try again.';
  } else if (msg.toLowerCase().includes('parse')) {
    formatErrorMessage.value = 'The file could not be read as a CSV. Make sure it is saved as a .csv file, not .xlsx.';
  } else {
    formatErrorMessage.value = msg;
  }

  showFormatErrorModal.value = true;
}

function retryPairingsUpload() {
  showFormatErrorModal.value = false;
  pairingsFile.value = null;
  if (pairingsFileInput.value) pairingsFileInput.value.value = '';
  triggerPairingsInput();
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
  } catch (error: any) {
    console.error('Error uploading pairings:', error);
    const status = error?.status || error?.response?.status;
    if (status === 400) {
      showPairingsFormatError(error);
    } else {
      const toast = await toastController.create({
        message: 'Failed to upload mapped pairings. Please try again.',
        duration: 3000,
        color: 'danger',
      });
      await toast.present();
    }
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

/* Spreadsheet-style table */
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
  margin: 0 0 8px 0;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.spreadsheet-preview {
  overflow-x: auto;
  border: 1px solid #d1d5db;
  border-radius: 4px;
}

.spreadsheet-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
  font-family: -apple-system, BlinkMacSystemFont, 'SF Mono', 'Menlo', monospace;
  white-space: nowrap;
}

.spreadsheet-table thead th {
  background: #e5e7eb;
  color: #6b7280;
  font-weight: 500;
  font-size: 11px;
  text-align: center;
  padding: 4px 8px;
  border: 1px solid #d1d5db;
}

.spreadsheet-table thead th.optional-col {
  color: #9ca3af;
}

.spreadsheet-table td {
  padding: 6px 10px;
  border: 1px solid #e5e7eb;
  color: #374151;
}

.spreadsheet-table .row-number {
  background: #f3f4f6;
  color: #9ca3af;
  text-align: center;
  width: 28px;
  font-size: 11px;
  padding: 4px 6px;
}

.spreadsheet-table thead th.row-number {
  background: #e5e7eb;
  width: 28px;
}

.spreadsheet-table .header-row td {
  font-weight: 700;
  background: #f8fafc;
}

.spreadsheet-table .required-cell {
  color: #15803d;
  background: #f0fdf4;
}

.spreadsheet-table .optional-cell {
  color: #9ca3af;
  background: #fafafa;
}

.format-legend {
  display: flex;
  gap: 16px;
  margin-top: 8px;
  font-size: 11px;
  color: #64748b;
}

.legend-required, .legend-optional {
  display: flex;
  align-items: center;
  gap: 4px;
}

.legend-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  display: inline-block;
}

.legend-dot.required { background: #16a34a; }
.legend-dot.optional { background: #d1d5db; }

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

/* Format Error Modal */
.format-error-content {
  --background: #f8fafc;
}

.error-modal-body {
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.error-banner {
  display: flex;
  gap: 16px;
  align-items: flex-start;
  background: #fef2f2;
  border: 1px solid #fecaca;
  border-radius: 12px;
  padding: 16px;
}

.error-icon {
  font-size: 28px;
  color: #dc2626;
  flex-shrink: 0;
  margin-top: 2px;
}

.error-banner h3 {
  font-size: 16px;
  font-weight: 700;
  color: #991b1b;
  margin: 0 0 4px 0;
}

.error-banner p {
  font-size: 14px;
  color: #7f1d1d;
  margin: 0;
  line-height: 1.5;
}

.error-columns-found {
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 16px;
}

.detail-label {
  font-size: 13px;
  font-weight: 600;
  color: #374151;
  margin: 0 0 8px 0;
}

.column-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.column-chip {
  font-size: 12px;
  font-family: 'SF Mono', 'Menlo', monospace;
  padding: 4px 10px;
  border-radius: 6px;
  font-weight: 500;
}

.chip-valid {
  background: #dcfce7;
  color: #166534;
  border: 1px solid #bbf7d0;
}

.chip-invalid {
  background: #fee2e2;
  color: #991b1b;
  border: 1px solid #fecaca;
}

.expected-format-section {
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 16px;
}

.modal-preview {
  margin-top: 4px;
}

.format-rules {
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 16px;
}

.format-rules ul {
  margin: 0;
  padding-left: 20px;
  font-size: 13px;
  color: #475569;
  line-height: 1.8;
}

.format-rules ul strong {
  color: #1e293b;
}
</style>
