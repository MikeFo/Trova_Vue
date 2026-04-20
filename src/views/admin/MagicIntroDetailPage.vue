<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-button @click="goBack">
            <ion-icon :icon="arrowBack"></ion-icon>
          </ion-button>
        </ion-buttons>
        <ion-title>Magic Intro Pairings</ion-title>
        <ion-buttons slot="end">
          <ion-button @click="loadPairings">
            <ion-icon :icon="refresh"></ion-icon>
          </ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>
    <ion-content :fullscreen="true" class="magic-intro-detail-content">
      <!-- Loading State -->
      <div v-if="isLoading" class="loading-state">
        <ion-spinner></ion-spinner>
        <p>Loading pairings...</p>
      </div>

      <!-- Pairings List -->
      <div v-else-if="pairings.length > 0" class="pairings-container">
        <div class="header-section">
          <h2>{{ formattedDate }}</h2>
          <div class="stats-summary">
            <div class="stat-item">
              <span class="stat-label">Total Pairings:</span>
              <span class="stat-value">{{ formatNumber(pairings.length) }}</span>
            </div>
            <div class="stat-item">
              <span class="stat-label">Engaged:</span>
              <span class="stat-value engaged">{{ formatNumber(engagedCount) }}</span>
            </div>
            <div class="stat-item">
              <span class="stat-label">Engagement Rate:</span>
              <span class="stat-value">{{ formatPercentage(engagementRate) }}</span>
            </div>
          </div>
        </div>

        <ion-list class="pairings-list">
          <ion-item
            v-for="(pairing, index) in pairings"
            :key="pairing.channelId || index"
            class="pairing-item"
            :class="{ 'engaged': pairing.isFullyEngaged }"
          >
            <ion-icon 
              :icon="pairing.isFullyEngaged ? checkmarkCircle : personCircleOutline" 
              slot="start"
              :class="pairing.isFullyEngaged ? 'icon-engaged' : 'icon-default'"
            ></ion-icon>
            <ion-label>
              <h2>
                <span v-for="(p, i) in pairing.participants" :key="p.userId">
                  <span>{{ p.name || `User ${p.userId}` }}</span>
                  <span v-if="i < pairing.participants.length - 1" class="separator">↔</span>
                </span>
              </h2>
              <p v-if="(pairing.totalHumanMessages || 0) > 0" class="engaged-badge">
                <ion-icon :icon="chatbubblesOutline"></ion-icon>
                <span v-if="pairing.isFullyEngaged">Fully engaged</span>
                <span v-else-if="(pairing.distinctHumanSpeakers || 0) === 1">Partial engagement</span>
                <span v-else>Conversation started</span>
                <span>
                  ({{ pairing.totalHumanMessages }} msg{{ pairing.totalHumanMessages === 1 ? '' : 's' }})
                </span>
              </p>
              <p v-if="(pairing.totalHumanMessages || 0) > 0 && (pairing.distinctHumanSpeakers || 0) === 1" class="partial-engagement-detail">
                <span class="reasons-label">Engaged:</span>
                {{
                  pairing.participants
                    .filter((p) => (p.messageCount || 0) > 0)
                    .map((p) => p.name || `User ${p.userId}`)
                    .join(', ')
                }}
                <span class="separator">•</span>
                <span class="reasons-label">Unresponsive:</span>
                {{
                  pairing.participants
                    .filter((p) => (p.messageCount || 0) === 0)
                    .map((p) => p.name || `User ${p.userId}`)
                    .join(', ')
                }}
              </p>
            </ion-label>
          </ion-item>
        </ion-list>
      </div>

      <!-- Empty State -->
      <div v-else class="empty-state">
        <ion-icon :icon="peopleOutline" class="empty-icon"></ion-icon>
        <h2>No Pairings Found</h2>
        <p>No pairings were found for this magic intro date.</p>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { adminService } from '@/services/admin.service';
import { formatIsoDateLabel } from '@/utils/iso-date';
import { fetchMagicIntroPairings } from '@/services/magic-intro.service';
import type { DateRange, MagicIntroPairingRow } from '@/types/magic-intros';
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
  personCircleOutline,
  checkmarkCircle,
  chatbubblesOutline,
  peopleOutline,
} from 'ionicons/icons';

const router = useRouter();
const route = useRoute();

const isLoading = ref(false);
const pairings = ref<MagicIntroPairingRow[]>([]);

const communityId = ref<number | null>(null);
const date = ref<string>('');
const startDate = ref<string | undefined>(undefined);
const endDate = ref<string | undefined>(undefined);

const engagedCount = computed(() => {
  return pairings.value.filter(p => p.isFullyEngaged).length;
});

const engagementRate = computed(() => {
  if (pairings.value.length === 0) return 0;
  return (engagedCount.value / pairings.value.length) * 100;
});

const formattedDate = computed(() => {
  if (!date.value) return 'Magic Intro Pairings';
  return formatIsoDateLabel(date.value);
});

onMounted(() => {
  // Get communityId and date from route params
  const id = route.params.communityId 
    ? parseInt(route.params.communityId as string, 10)
    : null;
  
  communityId.value = id;
  date.value = route.params.date as string || '';
  startDate.value = route.query.startDate as string | undefined;
  endDate.value = route.query.endDate as string | undefined;

  if (communityId.value && date.value) {
    loadPairings();
  }
});

async function loadPairings() {
  if (!communityId.value || !date.value) return;

  isLoading.value = true;
  try {
    const range =
      startDate.value && endDate.value
        ? ({ startDate: startDate.value, endDate: endDate.value } satisfies DateRange)
        : undefined;

    const response = await fetchMagicIntroPairings(communityId.value, {
      range,
      date: date.value,
    });

    pairings.value = response.pairings || [];
  } catch (error) {
    console.error('Error loading pairings:', error);
    pairings.value = [];
  } finally {
    isLoading.value = false;
  }
}

function getUserName(user: any): string {
  if (!user) return 'Unknown';
  if (user.fullName) return user.fullName;
  if (user.fname && user.lname) return `${user.fname} ${user.lname}`;
  if (user.fname) return user.fname;
  return 'Unknown';
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
.magic-intro-detail-content {
  --background: #f9fafb;
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

.pairings-container {
  background: transparent;
  padding-bottom: 16px;
}

.pairings-list {
  background: transparent;
  padding: 0 16px;
}

.pairings-list ion-item {
  margin-bottom: 8px;
  border-radius: 8px;
  overflow: hidden;
}

.header-section {
  padding: 20px 16px;
  margin: 16px;
  border-radius: 12px;
  border-bottom: none;
  background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
  color: white;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.header-section h2 {
  margin: 0 0 16px 0;
  font-size: 24px;
  font-weight: 600;
  color: white;
}

.stats-summary {
  display: flex;
  gap: 24px;
  flex-wrap: wrap;
}

.stat-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.stat-label {
  font-size: 12px;
  font-weight: 500;
  opacity: 0.9;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.stat-value {
  font-size: 20px;
  font-weight: 700;
  color: white;
}

.stat-value.engaged {
  color: #10b981;
}

.header-section .stat-value.engaged {
  color: white;
}

.pairing-item {
  --padding-start: 16px;
  --padding-end: 16px;
  --min-height: 88px;
  border-bottom: 1px solid #f3f4f6;
  background: white;
}

.pairing-item:last-child {
  border-bottom: none;
}

.pairing-item.engaged {
  background: #f0fdf4;
}

.icon-default {
  color: #94a3b8;
  font-size: 32px;
}

.icon-engaged {
  color: #10b981;
  font-size: 32px;
}

.pairing-item ion-label h2 {
  font-size: 16px;
  font-weight: 600;
  color: #1a1a1a;
  margin-bottom: 8px;
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}

.separator {
  color: #cbd5e1;
  font-weight: 300;
}

.pairing-item ion-label p {
  font-size: 14px;
  color: #64748b;
  margin: 4px 0;
}

.reasons-label,
.score-label {
  font-weight: 500;
  color: #475569;
}

.partial-engagement-detail {
  font-size: 13px;
  color: #64748b;
  margin-top: 6px;
}

.score-value {
  font-weight: 600;
  color: var(--ion-color-primary);
}

.engaged-badge {
  display: flex;
  align-items: center;
  gap: 4px;
  color: #10b981;
  font-weight: 500;
  margin-top: 8px;
}

.engaged-badge ion-icon {
  font-size: 16px;
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




