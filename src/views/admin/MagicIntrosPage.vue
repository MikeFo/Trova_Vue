<template>
  <ion-modal 
    :is-open="isOpen" 
    @didDismiss="handleDismiss"
    @willDismiss="handleDismiss"
    :backdrop-dismiss="true"
    id="magic-intros-list-modal"
  >
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start" v-if="selectedDate">
          <ion-button fill="clear" @click="goBackToList">
            <ion-icon :icon="arrowBack"></ion-icon>
          </ion-button>
        </ion-buttons>
        <ion-title>{{ selectedDate ? 'Magic Intro Pairings' : 'Magic Intros' }}</ion-title>
        <ion-buttons slot="end">
          <ion-button fill="clear" @click="handleDismiss">
            <ion-icon :icon="close"></ion-icon>
          </ion-button>
        </ion-buttons>
        <ion-buttons slot="end">
          <ion-button fill="clear" @click="selectedDate ? loadPairings() : loadMagicIntros()">
            <ion-icon :icon="refresh"></ion-icon>
          </ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>
    <ion-content :fullscreen="true" class="magic-intros-content">
      <!-- Detail View (Pairings) -->
      <div v-if="selectedDate">
        <!-- Loading State -->
        <div v-if="isPairingsLoading" class="loading-state">
          <ion-spinner></ion-spinner>
          <p>Loading pairings...</p>
        </div>

        <!-- Pairings List -->
        <div v-else-if="pairings.length > 0" class="pairings-container">
          <div class="header-section">
            <h2>{{ formattedSelectedDate }}</h2>
            <div class="stats-summary">
              <div class="stat-item">
                <span class="stat-label">Total Pairings:</span>
                <span class="stat-value">{{ formatNumber(filteredPairings.length) }}</span>
              </div>
              <div class="stat-item">
                <span class="stat-label">Engaged:</span>
                <span class="stat-value engaged">{{ formatNumber(filteredEngagedCount) }}</span>
              </div>
              <div class="stat-item">
                <span class="stat-label">Engagement Rate:</span>
                <span class="stat-value">{{ formatPercentage(filteredEngagementRate) }}</span>
              </div>
            </div>
          </div>

          <!-- Search Bar -->
          <div class="search-container">
            <ion-searchbar
              v-model="searchQuery"
              placeholder="Search by user names or match reasons..."
              :debounce="300"
              class="pairings-searchbar"
            ></ion-searchbar>
          </div>

          <!-- No Results Message -->
          <div v-if="searchQuery && filteredPairings.length === 0" class="no-results">
            <p>No pairings found matching "{{ searchQuery }}"</p>
          </div>

          <ion-list v-else class="pairings-list">
            <ion-item
              v-for="(pairing, index) in filteredPairings"
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
      </div>

      <!-- List View (Dates) -->
      <div v-else>
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
                  <span class="stat-value" :title="`Raw: ${magicIntro.totalPairings}`">{{ formatNumber(magicIntro.totalPairings) || '0' }}</span>
                  <span class="stat-separator">•</span>
                  <span class="stat-label">Engaged:</span>
                  <span class="stat-value engaged" :title="`Raw: ${magicIntro.engagedPairings}`">{{ formatNumber(magicIntro.engagedPairings) || '0' }}</span>
                  <span class="stat-separator">•</span>
                  <span class="stat-label">Engagement Rate:</span>
                  <span class="stat-value" :title="`Raw: ${magicIntro.engagementRate}`">{{ formatPercentage(magicIntro.engagementRate) || '0%' }}</span>
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
      </div>
    </ion-content>
  </ion-modal>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { adminService } from '@/services/admin.service';
import {
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
  IonModal,
  IonSearchbar,
} from '@ionic/vue';
import {
  refresh,
  sparklesOutline,
  chevronForward,
  close,
  arrowBack,
  personCircleOutline,
  checkmarkCircle,
  chatbubblesOutline,
  peopleOutline,
} from 'ionicons/icons';

// Props
const props = defineProps<{
  isOpen: boolean;
  communityId: number | null;
  startDate?: string;
  endDate?: string;
}>();

// Emits
const emit = defineEmits<{
  didDismiss: [];
}>();

const isLoading = ref(false);
const magicIntros = ref<Array<{
  date: string;
  dateDisplay: string;
  totalPairings: number;
  engagedPairings: number;
  engagementRate: number;
}>>([]);

// Use props for communityId, startDate, endDate
const communityId = computed(() => props.communityId);
const startDate = computed(() => props.startDate);
const endDate = computed(() => props.endDate);

// View state - using selectedDate to determine if we're showing list or detail
const selectedDate = ref<string>('');
const isPairingsLoading = ref(false);
const pairings = ref<any[]>([]);
const searchQuery = ref('');

const engagedCount = computed(() => {
  return pairings.value.filter(p => p.isEngaged).length;
});

const engagementRate = computed(() => {
  if (pairings.value.length === 0) return 0;
  return (engagedCount.value / pairings.value.length) * 100;
});

const filteredPairings = computed(() => {
  if (!searchQuery.value.trim()) {
    return pairings.value;
  }
  
  const query = searchQuery.value.toLowerCase().trim();
  
  return pairings.value.filter(pairing => {
    const userName = getUserName(pairing.user || {}).toLowerCase();
    const matchedUserName = getUserName(pairing.matchedUser || {}).toLowerCase();
    const reasons = (pairing.reasons || []).join(' ').toLowerCase();
    
    return userName.includes(query) ||
           matchedUserName.includes(query) ||
           reasons.includes(query);
  });
});

const filteredEngagedCount = computed(() => {
  return filteredPairings.value.filter(p => p.isEngaged).length;
});

const filteredEngagementRate = computed(() => {
  if (filteredPairings.value.length === 0) return 0;
  return (filteredEngagedCount.value / filteredPairings.value.length) * 100;
});

const formattedSelectedDate = computed(() => {
  if (!selectedDate.value) return 'Magic Intro Pairings';
  // Parse date string (YYYY-MM-DD) and create date in UTC to avoid timezone shifts
  const [year, month, day] = selectedDate.value.split('-').map(Number);
  const d = new Date(Date.UTC(year, month - 1, day));
  return d.toLocaleDateString('en-US', { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });
});

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

// Watch for modal opening and load data
watch(() => props.isOpen, (isOpen) => {
  if (isOpen && communityId.value) {
    loadMagicIntros();
  }
}, { immediate: true });

// Also watch communityId in case it changes
watch(() => props.communityId, (newId) => {
  if (props.isOpen && newId) {
    loadMagicIntros();
  }
});


async function loadMagicIntros() {
  if (!communityId.value) return;

  isLoading.value = true;
  try {
    console.log('[MagicIntrosPage] Loading magic intros with:', {
      communityId: communityId.value,
      startDate: startDateISO.value,
      endDate: endDateISO.value
    });
    
    const intros = await adminService.getMagicIntrosByDate(
      communityId.value,
      startDateISO.value,
      endDateISO.value
    );
    
    console.log('[MagicIntrosPage] Received magic intros:', intros);
    console.log('[MagicIntrosPage] Sample intro:', intros[0]);
    
    // Log all intros to see their values
    intros.forEach((intro, index) => {
      console.log(`[MagicIntrosPage] Intro ${index}:`, {
        date: intro.date,
        dateDisplay: intro.dateDisplay,
        totalPairings: intro.totalPairings,
        engagedPairings: intro.engagedPairings,
        engagementRate: intro.engagementRate,
        formattedTotal: formatNumber(intro.totalPairings ?? 0),
        formattedEngaged: formatNumber(intro.engagedPairings ?? 0),
        formattedRate: formatPercentage(intro.engagementRate ?? 0)
      });
    });
    
    // Ensure all values are properly set
    magicIntros.value = intros.map(intro => ({
      date: intro.date,
      dateDisplay: intro.dateDisplay,
      totalPairings: typeof intro.totalPairings === 'number' ? intro.totalPairings : 0,
      engagedPairings: typeof intro.engagedPairings === 'number' ? intro.engagedPairings : 0,
      engagementRate: typeof intro.engagementRate === 'number' ? intro.engagementRate : 0,
    }));
    
    console.log('[MagicIntrosPage] Set magicIntros.value:', magicIntros.value);
    console.log('[MagicIntrosPage] First item after mapping:', magicIntros.value[0]);
  } catch (error) {
    console.error('Error loading magic intros:', error);
    magicIntros.value = [];
  } finally {
    isLoading.value = false;
  }
}

function navigateToDetail(date: string) {
  if (!communityId.value) return;
  
  selectedDate.value = date;
  loadPairings();
}

async function loadPairings() {
  if (!communityId.value || !selectedDate.value) return;

  isPairingsLoading.value = true;
  try {
    const results = await adminService.getMagicIntroPairings(
      communityId.value,
      selectedDate.value,
      startDateISO.value,
      endDateISO.value
    );
    pairings.value = results;
  } catch (error) {
    console.error('Error loading pairings:', error);
    pairings.value = [];
  } finally {
    isPairingsLoading.value = false;
  }
}

function goBackToList() {
  selectedDate.value = '';
  pairings.value = [];
  searchQuery.value = ''; // Clear search when going back
}

function getUserName(user: any): string {
  if (!user) return 'Unknown';
  if (user.fullName) return user.fullName;
  if (user.fname && user.lname) return `${user.fname} ${user.lname}`;
  if (user.fname) return user.fname;
  return 'Unknown';
}

function handleDismiss() {
  // Reset to list view when modal closes
  selectedDate.value = '';
  pairings.value = [];
  searchQuery.value = ''; // Clear search when modal closes
  emit('didDismiss');
}

function formatNumber(value: number | undefined | null): string {
  // Explicitly check for 0 as a valid number
  if (value === undefined || value === null) return '0';
  if (typeof value !== 'number' || isNaN(value)) return '0';
  // 0 is a valid number and should display as '0'
  return value.toLocaleString();
}

function formatPercentage(value: number | undefined | null): string {
  // Explicitly check for 0 as a valid number
  if (value === undefined || value === null) return '0%';
  if (typeof value !== 'number' || isNaN(value)) return '0%';
  // 0 is a valid number and should display as '0.0%'
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
  line-height: 1.5;
}

.magic-intro-item ion-label p .stat-value {
  min-width: 20px;
  display: inline-block;
}

.stat-label {
  font-weight: 500;
  color: #64748b;
}

.stat-value {
  font-weight: 600;
  color: #2d7a4e !important; /* Primary Trova Green for visibility */
}

.stat-value.engaged {
  color: #10b981 !important; /* Success green for engaged count */
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

/* Detail view styles */

.pairings-container {
  background: transparent;
  padding: 0 16px 16px 16px;
}

.pairings-list {
  background: transparent;
  padding: 0;
}

.pairings-list ion-item {
  margin-bottom: 8px;
  border-radius: 8px;
  overflow: hidden;
}

.header-section {
  padding: 24px 20px;
  margin: 16px;
  border-radius: 12px;
  border: 1px solid #e5e7eb;
  background: #ffffff;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

.header-section h2 {
  margin: 0 0 20px 0;
  font-size: 24px;
  font-weight: 600;
  color: #1a1a1a;
}

.stats-summary {
  display: flex;
  gap: 32px;
  flex-wrap: wrap;
}

.stat-item {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.stat-label {
  font-size: 12px;
  font-weight: 500;
  color: #64748b;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.stat-value {
  font-size: 28px;
  font-weight: 700;
  color: #2d7a4e;
  line-height: 1.2;
}

.stat-value.engaged {
  color: #10b981;
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

.search-container {
  padding: 12px 16px;
  background: white;
  border-bottom: 1px solid #e5e7eb;
}

.pairings-searchbar {
  --box-shadow: none;
  --border-radius: 8px;
  --background: #f5f5f5;
  padding: 0;
}

.no-results {
  padding: 32px 16px;
  text-align: center;
  color: #64748b;
  font-size: 14px;
}
</style>

<style>
/* Global styles for magic intros list modal - targets Ionic modal shadow DOM */
#magic-intros-list-modal {
  --width: 90%;
  --max-width: 900px;
  --height: 85%;
  --max-height: 800px;
  --border-radius: 16px;
}

/* Target the modal wrapper inside shadow DOM */
#magic-intros-list-modal::part(content) {
  width: 90%;
  max-width: 900px;
  height: 85%;
  max-height: 800px;
  border-radius: 16px;
}

/* Fallback for modal wrapper - targets the actual modal element */
ion-modal#magic-intros-list-modal .modal-wrapper {
  width: 90% !important;
  max-width: 900px !important;
  height: 85% !important;
  max-height: 800px !important;
  border-radius: 16px !important;
  margin: auto;
}

</style>





