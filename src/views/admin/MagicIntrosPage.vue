<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-button @click="goBack">
            <ion-icon :icon="arrowBack"></ion-icon>
          </ion-button>
        </ion-buttons>
        <ion-title>Magic Intros</ion-title>
        <ion-buttons slot="end">
          <ion-button @click="loadMagicIntros">
            <ion-icon :icon="refresh"></ion-icon>
          </ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>
    <ion-content :fullscreen="true" class="magic-intros-content">
      <!-- Loading State -->
      <div v-if="isLoading" class="loading-state">
        <ion-spinner></ion-spinner>
        <p>Loading magic intros...</p>
      </div>

      <!-- Magic Intros List -->
      <div v-else-if="magicIntros.length > 0" class="magic-intros-list">
        <div class="list-header">
          <h2>Magic Intros by Date</h2>
          <p class="subtitle">Click on a date to view all pairings</p>
        </div>

        <ion-list>
          <ion-item
            v-for="magicIntro in magicIntros"
            :key="magicIntro.date"
            button
            @click="navigateToDetail(magicIntro.date)"
            class="magic-intro-item"
          >
            <ion-icon :icon="sparklesOutline" slot="start" class="magic-icon"></ion-icon>
            <ion-label>
              <h2>{{ magicIntro.dateDisplay }}</h2>
              <p>
                <span class="stat-label">Total Pairings:</span>
                <span class="stat-value">{{ formatNumber(magicIntro.totalPairings) }}</span>
                <span class="stat-separator">•</span>
                <span class="stat-label">Engaged:</span>
                <span class="stat-value engaged">{{ formatNumber(magicIntro.engagedPairings) }}</span>
                <span class="stat-separator">•</span>
                <span class="stat-label">Engagement Rate:</span>
                <span class="stat-value">{{ formatPercentage(magicIntro.engagementRate) }}</span>
              </p>
            </ion-label>
            <ion-icon :icon="chevronForward" slot="end"></ion-icon>
          </ion-item>
        </ion-list>
      </div>

      <!-- Empty State -->
      <div v-else class="empty-state">
        <ion-icon :icon="sparklesOutline" class="empty-icon"></ion-icon>
        <h2>No Magic Intros Found</h2>
        <p>No Trova Magic intros were found for the selected time period.</p>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { adminService } from '@/services/admin.service';
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonButtons,
  IonButton,
  IonIcon,
  IonContent,
  IonList,
  IonItem,
  IonLabel,
  IonSpinner,
} from '@ionic/vue';
import {
  arrowBack,
  refresh,
  sparklesOutline,
  chevronForward,
} from 'ionicons/icons';

const router = useRouter();
const route = useRoute();

const isLoading = ref(false);
const magicIntros = ref<Array<{
  date: string;
  dateDisplay: string;
  totalPairings: number;
  engagedPairings: number;
  engagementRate: number;
}>>([]);

const communityId = ref<number | null>(null);
const startDate = ref<string | undefined>(undefined);
const endDate = ref<string | undefined>(undefined);

// Computed properties to ensure ISO format dates
const startDateISO = computed(() => {
  if (!startDate.value) return undefined;
  // If already ISO format, return as-is; otherwise convert
  try {
    const date = new Date(startDate.value);
    return isNaN(date.getTime()) ? startDate.value : date.toISOString();
  } catch {
    return startDate.value;
  }
});

const endDateISO = computed(() => {
  if (!endDate.value) return undefined;
  // If already ISO format, return as-is; otherwise convert
  try {
    const date = new Date(endDate.value);
    return isNaN(date.getTime()) ? endDate.value : date.toISOString();
  } catch {
    return endDate.value;
  }
});

onMounted(() => {
  // Get communityId from route params or query
  const id = route.params.communityId 
    ? parseInt(route.params.communityId as string, 10)
    : route.query.communityId 
    ? parseInt(route.query.communityId as string, 10)
    : null;
  
  communityId.value = id;
  startDate.value = route.query.startDate as string | undefined;
  endDate.value = route.query.endDate as string | undefined;

  if (communityId.value) {
    loadMagicIntros();
  }
});

async function loadMagicIntros() {
  if (!communityId.value) return;

  isLoading.value = true;
  try {
    const intros = await adminService.getMagicIntrosByDate(
      communityId.value,
      startDateISO.value,
      endDateISO.value
    );
    magicIntros.value = intros;
  } catch (error) {
    console.error('Error loading magic intros:', error);
    magicIntros.value = [];
  } finally {
    isLoading.value = false;
  }
}

function navigateToDetail(date: string) {
  if (!communityId.value) return;
  
  router.push({
    path: `/communities/${communityId.value}/console/magic-intros/${date}`,
    query: {
      startDate: startDateISO.value,
      endDate: endDateISO.value,
    }
  });
}

function goBack() {
  router.back();
}

function formatNumber(value: number): string {
  if (value === undefined || value === null) return '0';
  return value.toLocaleString();
}

function formatPercentage(value: number): string {
  if (value === undefined || value === null) return '0%';
  return `${value.toFixed(1)}%`;
}
</script>

<style scoped>
.magic-intros-content {
  --background: #f9fafb;
}

.date-range-section {
  display: flex;
  gap: 16px;
  padding: 16px;
  background: white;
  border-bottom: 1px solid #e5e7eb;
}

.date-range-item {
  flex: 1;
  --padding-start: 0;
  --padding-end: 0;
  --inner-padding-end: 0;
}

.date-input {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  font-size: 14px;
  color: #1a1a1a;
  background: white;
}

.date-input:focus {
  outline: none;
  border-color: var(--ion-color-primary);
  box-shadow: 0 0 0 3px rgba(45, 122, 78, 0.1);
}

.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 48px 16px;
  color: #64748b;
}

.loading-state ion-spinner {
  margin-bottom: 16px;
}

.list-header {
  padding: 16px;
  background: white;
  border-bottom: 1px solid #e5e7eb;
}

.list-header h2 {
  margin: 0 0 4px 0;
  font-size: 20px;
  font-weight: 600;
  color: #1a1a1a;
}

.list-header .subtitle {
  margin: 0;
  font-size: 14px;
  color: #64748b;
}

.magic-intros-list {
  background: white;
}

.magic-intro-item {
  --padding-start: 16px;
  --padding-end: 16px;
  --min-height: 72px;
  border-bottom: 1px solid #f3f4f6;
}

.magic-intro-item:last-child {
  border-bottom: none;
}

.magic-icon {
  color: var(--ion-color-primary);
  font-size: 24px;
  margin-right: 12px;
}

.magic-intro-item ion-label h2 {
  font-size: 16px;
  font-weight: 600;
  color: #1a1a1a;
  margin-bottom: 8px;
}

.magic-intro-item ion-label p {
  font-size: 14px;
  color: #64748b;
  margin: 0;
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 4px;
}

.stat-label {
  font-weight: 500;
  color: #64748b;
}

.stat-value {
  font-weight: 600;
  color: var(--ion-color-primary);
}

.stat-value.engaged {
  color: #10b981;
}

.stat-separator {
  color: #cbd5e1;
  margin: 0 4px;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 64px 32px;
  text-align: center;
}

.empty-icon {
  font-size: 64px;
  color: #cbd5e1;
  margin-bottom: 16px;
}

.empty-state h2 {
  margin: 0 0 8px 0;
  font-size: 20px;
  font-weight: 600;
  color: #1a1a1a;
}

.empty-state p {
  margin: 0;
  font-size: 14px;
  color: #64748b;
}
</style>





