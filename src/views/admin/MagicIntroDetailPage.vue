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

        <ion-list>
          <ion-item
            v-for="(pairing, index) in pairings"
            :key="pairing.id || index"
            class="pairing-item"
            :class="{ 'engaged': pairing.isEngaged }"
          >
            <ion-icon 
              :icon="pairing.isEngaged ? checkmarkCircle : personCircleOutline" 
              slot="start"
              :class="pairing.isEngaged ? 'icon-engaged' : 'icon-default'"
            ></ion-icon>
            <ion-label>
              <h2>
                <span v-if="pairing.user?.fullName || pairing.user?.fname">
                  {{ getUserName(pairing.user) }}
                </span>
                <span v-else-if="pairing.userId">
                  User {{ pairing.userId }}
                </span>
                <span v-else>Unknown User</span>
                <span class="separator">↔</span>
                <span v-if="pairing.matchedUser?.fullName || pairing.matchedUser?.fname">
                  {{ getUserName(pairing.matchedUser) }}
                </span>
                <span v-else-if="pairing.matchedUserId">
                  User {{ pairing.matchedUserId }}
                </span>
                <span v-else>Unknown User</span>
              </h2>
              <p v-if="pairing.reasons && pairing.reasons.length > 0">
                <span class="reasons-label">Match reasons:</span>
                {{ pairing.reasons.join(', ') }}
              </p>
              <p v-if="pairing.score !== undefined">
                <span class="score-label">Score:</span>
                <span class="score-value">{{ pairing.score.toFixed(2) }}</span>
              </p>
              <p v-if="pairing.isEngaged" class="engaged-badge">
                <ion-icon :icon="chatbubblesOutline"></ion-icon>
                Conversation started
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
const pairings = ref<any[]>([]);

const communityId = ref<number | null>(null);
const date = ref<string>('');
const startDate = ref<string | undefined>(undefined);
const endDate = ref<string | undefined>(undefined);

const engagedCount = computed(() => {
  return pairings.value.filter(p => p.isEngaged).length;
});

const engagementRate = computed(() => {
  if (pairings.value.length === 0) return 0;
  return (engagedCount.value / pairings.value.length) * 100;
});

const formattedDate = computed(() => {
  if (!date.value) return 'Magic Intro Pairings';
  // Parse date string (YYYY-MM-DD) and create date in UTC to avoid timezone shifts
  const [year, month, day] = date.value.split('-').map(Number);
  const d = new Date(Date.UTC(year, month - 1, day));
  return d.toLocaleDateString('en-US', { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });
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
    const results = await adminService.getMagicIntroPairings(
      communityId.value,
      date.value,
      startDate.value,
      endDate.value
    );
    pairings.value = results;
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
  background: white;
}

.header-section {
  padding: 20px 16px;
  border-bottom: 2px solid #e5e7eb;
  background: linear-gradient(135deg, #34A853 0%, #1DB98A 100%);
  color: white;
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

.pairing-item {
  --padding-start: 16px;
  --padding-end: 16px;
  --min-height: 88px;
  border-bottom: 1px solid #f3f4f6;
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




