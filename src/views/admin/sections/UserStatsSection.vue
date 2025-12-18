<template>
  <div class="user-stats-section">
    <div class="section-header">
      <h2 class="section-title">Engagement Dashboard</h2>
      <div class="header-actions">
        <div class="time-period-wrapper">
          <ion-label class="time-period-label-inline">Time Period</ion-label>
          <ion-select v-model="selectedPeriod" @ionChange="onPeriodChange" class="time-period-select-inline">
            <ion-select-option value="all-time">All Time</ion-select-option>
            <ion-select-option value="12-months">Past 12 Months</ion-select-option>
            <ion-select-option value="6-months">Past 6 Months</ion-select-option>
            <ion-select-option value="3-months">Past 3 Months</ion-select-option>
            <ion-select-option value="1-month">Past Month</ion-select-option>
          </ion-select>
        </div>
        <ion-button fill="outline" size="small" @click="exportStats">
          <ion-icon :icon="downloadOutline" slot="start"></ion-icon>
          Export CSV
        </ion-button>
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="isLoading" class="loading-state">
      <ion-spinner></ion-spinner>
      <p>Loading engagement statistics...</p>
    </div>

    <!-- Dashboard Content -->
    <div v-else-if="stats || hasAnyData" class="dashboard-content">
      <!-- Primary Metrics (Core ROI) -->
      <div class="primary-metrics-section">
        <h3 class="section-subtitle">Primary Metrics</h3>
        <div class="primary-metrics-grid">
          <div class="primary-metric-card">
            <div class="metric-icon">
              <ion-icon :icon="personOutline"></ion-icon>
            </div>
            <div class="metric-content">
              <div class="metric-value">{{ formatNumber(stats?.profilesCreated || stats?.totalUsers || 0) }}</div>
              <div class="metric-label">Profiles Created</div>
              <div v-if="stats?.profilesCreatedTrend" class="metric-trend" :class="getTrendClass(stats.profilesCreatedTrend)">
                <ion-icon :icon="stats.profilesCreatedTrend > 0 ? trendingUpOutline : trendingDownOutline"></ion-icon>
                <span>{{ Math.abs(stats.profilesCreatedTrend).toFixed(1) }}%</span>
              </div>
            </div>
          </div>
          <div class="primary-metric-card">
            <div class="metric-icon">
              <ion-icon :icon="peopleOutline"></ion-icon>
            </div>
            <div class="metric-content">
              <div class="metric-value">{{ formatNumber(stats?.connectionsMade || 0) }}</div>
              <div class="metric-label">Connections Made</div>
              <div v-if="stats?.connectionsMadeTrend" class="metric-trend" :class="getTrendClass(stats.connectionsMadeTrend)">
                <ion-icon :icon="stats.connectionsMadeTrend > 0 ? trendingUpOutline : trendingDownOutline"></ion-icon>
                <span>{{ Math.abs(stats.connectionsMadeTrend).toFixed(1) }}%</span>
              </div>
            </div>
          </div>
          <div class="primary-metric-card primary-metric-card-highlight">
            <div class="metric-icon">
              <ion-icon :icon="chatbubblesOutline"></ion-icon>
            </div>
            <div class="metric-content">
              <div class="metric-value">{{ formatNumber(stats?.trovaChatsStarted || 0) }}</div>
              <div class="metric-label">Trova Chats Started</div>
              <div v-if="stats?.trovaChatsStartedTrend" class="metric-trend" :class="getTrendClass(stats.trovaChatsStartedTrend)">
                <ion-icon :icon="stats.trovaChatsStartedTrend > 0 ? trendingUpOutline : trendingDownOutline"></ion-icon>
                <span>{{ Math.abs(stats.trovaChatsStartedTrend).toFixed(1) }}%</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Engagement Metrics -->
      <div class="engagement-metrics-section">
        <h3 class="section-subtitle">Engagement Metrics</h3>
        <div class="engagement-metrics-grid">
          <div class="engagement-metric-card">
            <div class="metric-icon-small">
              <ion-icon :icon="mailOutline"></ion-icon>
            </div>
            <div class="metric-content-small">
              <div class="metric-value-small">{{ formatNumber(stats?.totalMessagesSent || 0) }}</div>
              <div class="metric-label-small">Messages Sent</div>
            </div>
          </div>
          <div class="engagement-metric-card">
            <div class="metric-icon-small">
              <ion-icon :icon="calendarOutline"></ion-icon>
            </div>
            <div class="metric-content-small">
              <div class="metric-value-small">{{ formatNumber(stats?.eventsCreated || 0) }}</div>
              <div class="metric-label-small">Events Created</div>
            </div>
          </div>
          <div class="engagement-metric-card">
            <div class="metric-icon-small">
              <ion-icon :icon="calendarOutline"></ion-icon>
            </div>
            <div class="metric-content-small">
              <div class="metric-value-small">{{ formatNumber(stats?.eventsAttended || 0) }}</div>
              <div class="metric-label-small">Events Attended</div>
            </div>
          </div>
          <div class="engagement-metric-card">
            <div class="metric-icon-small">
              <ion-icon :icon="peopleCircleOutline"></ion-icon>
            </div>
            <div class="metric-content-small">
              <div class="metric-value-small">{{ formatNumber(stats?.groupsCreated || 0) }}</div>
              <div class="metric-label-small">Groups Created</div>
            </div>
          </div>
          <div class="engagement-metric-card">
            <div class="metric-icon-small">
              <ion-icon :icon="peopleCircleOutline"></ion-icon>
            </div>
            <div class="metric-content-small">
              <div class="metric-value-small">{{ formatNumber(stats?.groupsJoined || 0) }}</div>
              <div class="metric-label-small">Groups Joined</div>
            </div>
          </div>
          <div class="engagement-metric-card">
            <div class="metric-icon-small">
              <ion-icon :icon="pulseOutline"></ion-icon>
            </div>
            <div class="metric-content-small">
              <div class="metric-value-small">{{ formatNumber(stats?.dailyActiveUsers || 0) }}</div>
              <div class="metric-label-small">Daily Active Users</div>
            </div>
          </div>
          <div class="engagement-metric-card">
            <div class="metric-icon-small">
              <ion-icon :icon="pulseOutline"></ion-icon>
            </div>
            <div class="metric-content-small">
              <div class="metric-value-small">{{ formatNumber(stats?.weeklyActiveUsers || 0) }}</div>
              <div class="metric-label-small">Weekly Active Users</div>
            </div>
          </div>
          <div class="engagement-metric-card">
            <div class="metric-icon-small">
              <ion-icon :icon="checkmarkCircleOutline"></ion-icon>
            </div>
            <div class="metric-content-small">
              <div class="metric-value-small">
                <span v-if="stats?.profileCompletionCompleted !== undefined && stats?.profileCompletionTotal !== undefined">
                  {{ stats.profileCompletionCompleted }}/{{ stats.profileCompletionTotal }}
                </span>
                <span v-else>{{ formatPercentage(stats?.profileCompletionRate) }}</span>
              </div>
              <div class="metric-label-small">Profile Completion</div>
            </div>
          </div>
          <div class="engagement-metric-card">
            <div class="metric-icon-small">
              <ion-icon :icon="thumbsUpOutline"></ion-icon>
            </div>
            <div class="metric-content-small">
              <div class="metric-value-small">{{ formatPercentage(stats?.matchResponseRate) }}</div>
              <div class="metric-label-small">Match Response Rate</div>
            </div>
          </div>
        </div>
      </div>

      <!-- User Actions Metrics -->
      <div v-if="hasUserActionsData" class="engagement-metrics-section">
        <h3 class="section-subtitle">User Actions</h3>
        <div class="engagement-metrics-grid">
          <div class="engagement-metric-card" v-if="stats?.openedTrova !== undefined">
            <div class="metric-icon-small">
              <ion-icon :icon="openOutline"></ion-icon>
            </div>
            <div class="metric-content-small">
              <div class="metric-value-small">{{ formatNumber(stats.openedTrova) }}</div>
              <div class="metric-label-small">Opened Trova</div>
            </div>
          </div>
          <div class="engagement-metric-card" v-if="stats?.introsLedToConvos !== undefined">
            <div class="metric-icon-small">
              <ion-icon :icon="chatbubblesOutline"></ion-icon>
            </div>
            <div class="metric-content-small">
              <div class="metric-value-small">{{ formatNumber(stats.introsLedToConvos) }}</div>
              <div class="metric-label-small">Intros Led To Convos</div>
            </div>
          </div>
          <div class="engagement-metric-card" v-if="stats?.profileScore !== undefined">
            <div class="metric-icon-small">
              <ion-icon :icon="starOutline"></ion-icon>
            </div>
            <div class="metric-content-small">
              <div class="metric-value-small">{{ formatNumber(stats.profileScore, 1) }}</div>
              <div class="metric-label-small">Avg Profile Score</div>
            </div>
          </div>
          <div class="engagement-metric-card" v-if="stats?.generalActions !== undefined">
            <div class="metric-icon-small">
              <ion-icon :icon="flashOutline"></ion-icon>
            </div>
            <div class="metric-content-small">
              <div class="metric-value-small">{{ formatNumber(stats.generalActions) }}</div>
              <div class="metric-label-small">General Actions</div>
            </div>
          </div>
          <div class="engagement-metric-card" v-if="stats?.spotlightsCreated !== undefined">
            <div class="metric-icon-small">
              <ion-icon :icon="sunnyOutline"></ion-icon>
            </div>
            <div class="metric-content-small">
              <div class="metric-value-small">{{ formatNumber(stats.spotlightsCreated) }}</div>
              <div class="metric-label-small">Spotlights Created</div>
            </div>
          </div>
          <div class="engagement-metric-card" v-if="stats?.recWallsGiven !== undefined">
            <div class="metric-icon-small">
              <ion-icon :icon="heartOutline"></ion-icon>
            </div>
            <div class="metric-content-small">
              <div class="metric-value-small">{{ formatNumber(stats.recWallsGiven) }}</div>
              <div class="metric-label-small">Rec Walls Given</div>
            </div>
          </div>
          <div class="engagement-metric-card" v-if="stats?.recWallsReceived !== undefined">
            <div class="metric-icon-small">
              <ion-icon :icon="heart"></ion-icon>
            </div>
            <div class="metric-content-small">
              <div class="metric-value-small">{{ formatNumber(stats.recWallsReceived) }}</div>
              <div class="metric-label-small">Rec Walls Received</div>
            </div>
          </div>
        </div>
      </div>

      <!-- Engagement Attribution -->
      <div v-if="hasEngagementAttributionData" class="engagement-metrics-section">
        <h3 class="section-subtitle">Engagement Attribution</h3>
        <div class="engagement-metrics-grid">
          <div 
            class="engagement-metric-card clickable" 
            v-if="stats?.trovaMagicEngagements !== undefined"
            @click="navigateToMagicIntros"
          >
            <div class="metric-icon-small">
              <ion-icon :icon="sparklesOutline"></ion-icon>
            </div>
            <div class="metric-content-small">
              <div class="metric-value-small">{{ formatNumber(stats.trovaMagicEngagements) }}</div>
              <div class="metric-label-small">Trova Magic</div>
            </div>
          </div>
          <div class="engagement-metric-card" v-if="stats?.channelPairingOnDemand !== undefined">
            <div class="metric-icon-small">
              <ion-icon :icon="linkOutline"></ion-icon>
            </div>
            <div class="metric-content-small">
              <div class="metric-value-small">{{ formatNumber(stats.channelPairingOnDemand) }}</div>
              <div class="metric-label-small">Channel Pairing (On Demand)</div>
            </div>
          </div>
          <div class="engagement-metric-card" v-if="stats?.channelPairingCadence !== undefined">
            <div class="metric-icon-small">
              <ion-icon :icon="timeOutline"></ion-icon>
            </div>
            <div class="metric-content-small">
              <div class="metric-value-small">{{ formatNumber(stats.channelPairingCadence) }}</div>
              <div class="metric-label-small">Channel Pairing (Cadence)</div>
            </div>
          </div>
        </div>
      </div>

      <!-- Skills Metrics -->
      <div v-if="hasSkillsData" class="engagement-metrics-section">
        <h3 class="section-subtitle">Skills</h3>
        <div class="engagement-metrics-grid">
          <div 
            class="engagement-metric-card clickable" 
            v-if="stats?.totalSkills !== undefined"
            @click="navigateToSkillsList"
          >
            <div class="metric-icon-small">
              <ion-icon :icon="libraryOutline"></ion-icon>
            </div>
            <div class="metric-content-small">
              <div class="metric-value-small">{{ formatNumber(stats.totalSkills) }}</div>
              <div class="metric-label-small">Total Skills</div>
            </div>
          </div>
          <div 
            class="engagement-metric-card clickable" 
            v-if="stats?.usersCanMentor !== undefined"
            @click="navigateToMentorList('can')"
          >
            <div class="metric-icon-small">
              <ion-icon :icon="schoolOutline"></ion-icon>
            </div>
            <div class="metric-content-small">
              <div class="metric-value-small">{{ formatNumber(stats.usersCanMentor) }}</div>
              <div class="metric-label-small">Can Mentor</div>
            </div>
          </div>
          <div 
            class="engagement-metric-card clickable" 
            v-if="stats?.usersWantMentor !== undefined"
            @click="navigateToMentorList('want')"
          >
            <div class="metric-icon-small">
              <ion-icon :icon="bookOutline"></ion-icon>
            </div>
            <div class="metric-content-small">
              <div class="metric-value-small">{{ formatNumber(stats.usersWantMentor) }}</div>
              <div class="metric-label-small">Want Mentor</div>
            </div>
          </div>
        </div>
      </div>

      <!-- Match Metrics -->
      <div v-if="hasMatchData" class="engagement-metrics-section">
        <h3 class="section-subtitle">Match Engagement</h3>
        <div class="engagement-metrics-grid">
          <div class="engagement-metric-card" v-if="stats?.trovaMagicMatches !== undefined">
            <div class="metric-icon-small">
              <ion-icon :icon="sparklesOutline"></ion-icon>
            </div>
            <div class="metric-content-small">
              <div class="metric-value-small">{{ formatNumber(stats.trovaMagicMatches) }}</div>
              <div class="metric-label-small">Trova Magic Matches</div>
            </div>
          </div>
          <div class="engagement-metric-card" v-if="stats?.channelPairingMatches !== undefined">
            <div class="metric-icon-small">
              <ion-icon :icon="linkOutline"></ion-icon>
            </div>
            <div class="metric-content-small">
              <div class="metric-value-small">{{ formatNumber(stats.channelPairingMatches) }}</div>
              <div class="metric-label-small">Channel Pairing Matches</div>
            </div>
          </div>
          <div class="engagement-metric-card" v-if="stats?.allMatchesEngaged !== undefined">
            <div class="metric-icon-small">
              <ion-icon :icon="checkmarkDoneOutline"></ion-icon>
            </div>
            <div class="metric-content-small">
              <div class="metric-value-small">{{ formatNumber(stats.allMatchesEngaged) }}</div>
              <div class="metric-label-small">All Matches Engaged</div>
            </div>
          </div>
          <div class="engagement-metric-card" v-if="stats?.matchEngagementRate !== undefined">
            <div class="metric-icon-small">
              <ion-icon :icon="trendingUpOutline"></ion-icon>
            </div>
            <div class="metric-content-small">
              <div class="metric-value-small">{{ formatPercentage(stats.matchEngagementRate) }}</div>
              <div class="metric-label-small">Match Engagement Rate</div>
            </div>
          </div>
        </div>
      </div>

      <!-- Channel Pairing Metrics -->
      <div v-if="hasChannelPairingData" class="engagement-metrics-section">
        <h3 class="section-subtitle">Channel Pairing</h3>
        <div class="engagement-metrics-grid">
          <div class="engagement-metric-card" v-if="stats?.channelPairingGroups !== undefined">
            <div class="metric-icon-small">
              <ion-icon :icon="peopleCircleOutline"></ion-icon>
            </div>
            <div class="metric-content-small">
              <div class="metric-value-small">{{ formatNumber(stats.channelPairingGroups) }}</div>
              <div class="metric-label-small">Channel Pairing Groups</div>
            </div>
          </div>
          <div class="engagement-metric-card" v-if="stats?.channelPairingUsers !== undefined">
            <div class="metric-icon-small">
              <ion-icon :icon="peopleOutline"></ion-icon>
            </div>
            <div class="metric-content-small">
              <div class="metric-value-small">{{ formatNumber(stats.channelPairingUsers) }}</div>
              <div class="metric-label-small">Users in Pairings</div>
            </div>
          </div>
        </div>
      </div>

      <!-- Legacy Stats (if available) -->
      <div v-if="stats?.activeUsers || stats?.newUsersThisMonth" class="legacy-stats-section">
        <h3 class="section-subtitle">Additional Statistics</h3>
        <div class="legacy-stats-grid">
          <div class="stat-card" v-if="stats.activeUsers">
            <div class="stat-value">{{ formatNumber(stats.activeUsers) }}</div>
            <div class="stat-label">Active Users</div>
          </div>
          <div class="stat-card" v-if="stats.newUsersThisMonth">
            <div class="stat-value">{{ formatNumber(stats.newUsersThisMonth) }}</div>
            <div class="stat-label">New This Month</div>
          </div>
        </div>
      </div>
    </div>

    <!-- No Stats Available -->
    <div v-else class="no-stats">
      <ion-icon :icon="statsChartOutline" class="no-stats-icon"></ion-icon>
      <p>Statistics not available</p>
      <p class="no-stats-hint">This feature requires backend support. The stats endpoint is not currently available.</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { useRouter } from 'vue-router';
import { adminService, type UserStats } from '@/services/admin.service';
import { toastController } from '@ionic/vue';
import {
  IonButton,
  IonIcon,
  IonItem,
  IonLabel,
  IonSelect,
  IonSelectOption,
  IonSpinner,
} from '@ionic/vue';
import {
  downloadOutline,
  statsChartOutline,
  personOutline,
  peopleOutline,
  chatbubblesOutline,
  mailOutline,
  calendarOutline,
  peopleCircleOutline,
  pulseOutline,
  checkmarkCircleOutline,
  thumbsUpOutline,
  trendingUpOutline,
  trendingDownOutline,
  openOutline,
  starOutline,
  flashOutline,
  sunnyOutline,
  heartOutline,
  heart,
  sparklesOutline,
  linkOutline,
  timeOutline,
  libraryOutline,
  schoolOutline,
  bookOutline,
  checkmarkDoneOutline,
} from 'ionicons/icons';

interface Props {
  communityId: number | null;
}

const props = defineProps<Props>();

const router = useRouter();
const isLoading = ref(false);
const stats = ref<UserStats | null>(null);
const skillsStats = ref<Array<{ name: string; count: number }>>([]);
const isSlackCommunity = ref(false); // TODO: Determine from community data
const selectedPeriod = ref<'all-time' | '12-months' | '6-months' | '3-months' | '1-month'>('12-months'); // Default to past 12 months

const hasAnyData = computed(() => {
  if (!stats.value) return false;
  return !!(
    stats.value.profilesCreated ||
    stats.value.connectionsMade ||
    stats.value.trovaChatsStarted ||
    stats.value.totalMessagesSent ||
    stats.value.eventsCreated ||
    stats.value.eventsAttended ||
    stats.value.groupsCreated ||
    stats.value.groupsJoined ||
    stats.value.dailyActiveUsers ||
    stats.value.weeklyActiveUsers ||
    stats.value.profileCompletionRate ||
    stats.value.matchResponseRate ||
    stats.value.totalUsers ||
    stats.value.activeUsers ||
    stats.value.newUsersThisMonth
  );
});

const hasUserActionsData = computed(() => {
  if (!stats.value) return false;
  return !!(
    stats.value.openedTrova !== undefined ||
    stats.value.introsLedToConvos !== undefined ||
    stats.value.profileScore !== undefined ||
    stats.value.generalActions !== undefined ||
    stats.value.spotlightsCreated !== undefined ||
    stats.value.recWallsGiven !== undefined ||
    stats.value.recWallsReceived !== undefined
  );
});

const hasEngagementAttributionData = computed(() => {
  if (!stats.value) return false;
  return !!(
    stats.value.trovaMagicEngagements !== undefined ||
    stats.value.channelPairingOnDemand !== undefined ||
    stats.value.channelPairingCadence !== undefined
  );
});

const hasSkillsData = computed(() => {
  if (!stats.value) return false;
  return !!(
    stats.value.totalSkills !== undefined ||
    stats.value.usersCanMentor !== undefined ||
    stats.value.usersWantMentor !== undefined
  );
});

const hasMatchData = computed(() => {
  if (!stats.value) return false;
  return !!(
    stats.value.trovaMagicMatches !== undefined ||
    stats.value.channelPairingMatches !== undefined ||
    stats.value.allMatchesEngaged !== undefined ||
    stats.value.matchEngagementRate !== undefined
  );
});

const hasChannelPairingData = computed(() => {
  if (!stats.value) return false;
  return !!(
    stats.value.channelPairingGroups !== undefined ||
    stats.value.channelPairingUsers !== undefined
  );
});

function formatNumber(value: number | undefined | null, decimals: number = 0): string {
  if (value === undefined || value === null) return '0';
  if (decimals > 0) {
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(value);
  }
  return new Intl.NumberFormat('en-US').format(value);
}

function formatPercentage(value: number | undefined | null): string {
  if (value === undefined || value === null) return 'N/A';
  return `${value.toFixed(1)}%`;
}

function getTrendClass(trend: number): string {
  return trend > 0 ? 'trend-up' : trend < 0 ? 'trend-down' : 'trend-neutral';
}

function navigateToMagicIntros() {
  if (!props.communityId) return;
  const { start, end } = getDateRangeForPeriod(selectedPeriod.value);
  const query: any = { communityId: props.communityId };
  if (start) query.startDate = start;
  if (end) query.endDate = end;
  router.push({
    path: `/communities/${props.communityId}/console/magic-intros`,
    query
  });
}

function navigateToSkillsList() {
  if (!props.communityId) return;
  router.push({
    path: `/communities/${props.communityId}/console/skills`
  });
}

function navigateToMentorList(type: 'can' | 'want') {
  if (!props.communityId) return;
  router.push({
    path: `/communities/${props.communityId}/console/mentors/${type}`
  });
}

function getDateRangeForPeriod(period: string): { start: string | undefined; end: string | undefined } {
  if (period === 'all-time') {
    return { start: undefined, end: undefined };
  }

  const now = new Date();
  
  // End date: end of today (in UTC to avoid timezone issues)
  const end = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
    23, 59, 59, 999
  ));
  
  // Start date: N months ago from today
  // Calculate months to subtract
  let monthsToSubtract = 12;
  switch (period) {
    case '12-months':
      monthsToSubtract = 12;
      break;
    case '6-months':
      monthsToSubtract = 6;
      break;
    case '3-months':
      monthsToSubtract = 3;
      break;
    case '1-month':
      monthsToSubtract = 1;
      break;
    default:
      monthsToSubtract = 12;
  }
  
  // Get current UTC date components
  const currentYear = now.getUTCFullYear();
  const currentMonth = now.getUTCMonth(); // 0-11
  const currentDay = now.getUTCDate();
  
  // Calculate target month and year
  let targetYear = currentYear;
  let targetMonth = currentMonth - monthsToSubtract;
  
  // Handle year rollover (if targetMonth is negative)
  while (targetMonth < 0) {
    targetMonth += 12;
    targetYear -= 1;
  }
  
  // Use the last day of the month if the day doesn't exist (e.g., Jan 31 -> Feb 28)
  const daysInTargetMonth = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();
  const targetDay = Math.min(currentDay, daysInTargetMonth);
  
  // Create start date in UTC
  const start = new Date(Date.UTC(
    targetYear,
    targetMonth,
    targetDay,
    0, 0, 0, 0
  ));
  
  console.error(`[UserStatsSection] Date range for "${period}": ${start.toISOString()} to ${end.toISOString()}`);
  console.error(`[UserStatsSection] Calculated: ${monthsToSubtract} months ago from ${now.toISOString()} (now is ${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-${String(now.getUTCDate()).padStart(2, '0')})`);
  
  return {
    start: start.toISOString(),
    end: end.toISOString(),
  };
}

function onPeriodChange() {
  loadStats();
}

onMounted(() => {
  loadStats();
});

watch(() => props.communityId, () => {
  if (props.communityId) {
    loadStats();
  }
});

async function loadStats() {
  if (!props.communityId) return;

  isLoading.value = true;
  try {
    const { start, end } = getDateRangeForPeriod(selectedPeriod.value);
    
    // getEngagementStats will try backend endpoint first, then calculate from existing data
    const engagementStats = await adminService.getEngagementStats(props.communityId, start, end);
    
    if (engagementStats) {
      stats.value = { ...engagementStats }; // Create a new object to ensure reactivity
    } else {
      // Fallback: Initialize with zeros if calculation also fails
      stats.value = {
        totalUsers: 0,
        activeUsers: 0,
        newUsersThisMonth: 0,
      };
    }

    // Fetch additional metrics in parallel (non-blocking, updates reactively)
    Promise.allSettled([
      adminService.getUserActionsStats(props.communityId, start, end),
      adminService.getSkillsStats(props.communityId),
      adminService.getMatchEngagementStats(props.communityId, start, end),
      adminService.getChannelPairingStats(props.communityId, start, end),
      adminService.getTrovaChats(props.communityId, start, end),
      adminService.getMessageStats(props.communityId, start, end),
      adminService.getActiveUserStats(props.communityId, start, end),
    ]).then(([userActions, skills, matchEngagement, channelPairing, trovaChats, messages, activeUsers]) => {
      // Update stats reactively by creating a new object
      if (!stats.value) {
        stats.value = {} as UserStats;
      }
      
      const updatedStats: UserStats = { ...(stats.value as UserStats) };
      
      // Helper to merge stats safely - preserve existing non-zero values
      const mergeStats = (source: Partial<UserStats>, target: Partial<UserStats>) => {
        Object.keys(source).forEach(key => {
          const value = source[key as keyof UserStats];
          const existingValue = target[key as keyof UserStats];
          
          // Only merge if:
          // 1. Value is not undefined
          // 2. For numeric values: only overwrite if existing value is undefined/0, or new value > 0
          // 3. For non-numeric values: always merge if not undefined
          if (value !== undefined) {
            if (typeof value === 'number') {
              // For numbers: preserve existing non-zero values, only overwrite if existing is 0/undefined or new is > 0
              if (existingValue === undefined || existingValue === 0 || value > 0) {
                target[key as keyof UserStats] = value;
              }
            } else {
              // For non-numbers: always merge if not undefined
              target[key as keyof UserStats] = value;
            }
          }
        });
      };
      
      // Merge user actions stats
      if (userActions.status === 'fulfilled' && userActions.value) {
        mergeStats(userActions.value, updatedStats);
      }
      // Merge skills stats
      if (skills.status === 'fulfilled' && skills.value) {
        mergeStats(skills.value, updatedStats);
      }
      // Merge match engagement stats
      if (matchEngagement.status === 'fulfilled' && matchEngagement.value) {
        mergeStats(matchEngagement.value, updatedStats);
      }
      // Merge channel pairing stats
      if (channelPairing.status === 'fulfilled' && channelPairing.value) {
        mergeStats(channelPairing.value, updatedStats);
      }
      // Merge Trova chats
      if (trovaChats.status === 'fulfilled' && trovaChats.value) {
        mergeStats(trovaChats.value, updatedStats);
      }
      // Merge message stats
      if (messages.status === 'fulfilled' && messages.value) {
        mergeStats(messages.value, updatedStats);
      }
      // Merge active user stats
      if (activeUsers.status === 'fulfilled' && activeUsers.value) {
        mergeStats(activeUsers.value, updatedStats);
      }
      
      // Update the reactive stats object
      stats.value = updatedStats;
    }).catch((error) => {
      console.warn('[UserStatsSection] Error loading additional metrics:', error);
      // Silently fail - these are additional metrics
    });
  } catch (error) {
    console.error('Error loading stats:', error);
    stats.value = null;
  } finally {
    isLoading.value = false;
  }
}

async function exportStats() {
  if (!props.communityId || !stats.value) return;

  try {
    const { start, end } = getDateRangeForPeriod(selectedPeriod.value);
    
    // Try backend export first
    try {
      const blob = await adminService.exportData(props.communityId, 'stats', start, end);
      adminService.downloadCSV(blob, `roi_stats_${props.communityId}_${Date.now()}.csv`);
      
      const toast = await toastController.create({
        message: 'Statistics exported successfully',
        duration: 2000,
        color: 'success',
      });
      await toast.present();
      return;
    } catch (exportError: any) {
      // If backend export fails, create CSV client-side
      if (exportError?.status === 404 || exportError?.response?.status === 404) {
        console.log('[UserStatsSection] Backend export not available, creating client-side CSV');
      } else {
        throw exportError;
      }
    }

    // Client-side CSV generation
    const csvRows: string[] = [];
    
    // Header
    csvRows.push('ROI Engagement Dashboard Statistics');
    const periodLabel = selectedPeriod.value === 'all-time' 
      ? 'All Time' 
      : selectedPeriod.value.replace('-', ' ').replace(/\b\w/g, (l) => l.toUpperCase());
    csvRows.push(`Time Period: ${periodLabel}`);
    if (start && end) {
      csvRows.push(`Date Range: ${new Date(start).toLocaleDateString()} - ${new Date(end).toLocaleDateString()}`);
    }
    csvRows.push('');
    
    // Primary Metrics
    csvRows.push('PRIMARY METRICS');
    csvRows.push('Metric,Value');
    csvRows.push(`Profiles Created,${formatNumber(stats.value.profilesCreated || stats.value.totalUsers || 0)}`);
    csvRows.push(`Connections Made,${formatNumber(stats.value.connectionsMade || 0)}`);
    csvRows.push(`Trova Chats Started,${formatNumber(stats.value.trovaChatsStarted || 0)}`);
    csvRows.push('');
    
    // Engagement Metrics
    csvRows.push('ENGAGEMENT METRICS');
    csvRows.push('Metric,Value');
    csvRows.push(`Total Messages Sent,${formatNumber(stats.value.totalMessagesSent || 0)}`);
    csvRows.push(`Events Created,${formatNumber(stats.value.eventsCreated || 0)}`);
    csvRows.push(`Events Attended,${formatNumber(stats.value.eventsAttended || 0)}`);
    csvRows.push(`Groups Created,${formatNumber(stats.value.groupsCreated || 0)}`);
    csvRows.push(`Groups Joined,${formatNumber(stats.value.groupsJoined || 0)}`);
    csvRows.push(`Daily Active Users,${formatNumber(stats.value.dailyActiveUsers || 0)}`);
    csvRows.push(`Weekly Active Users,${formatNumber(stats.value.weeklyActiveUsers || 0)}`);
    csvRows.push(`Profile Completion Rate,${formatPercentage(stats.value.profileCompletionRate)}`);
    csvRows.push(`Match Response Rate,${formatPercentage(stats.value.matchResponseRate)}`);
    csvRows.push('');
    
    // Additional Stats
    if (stats.value.activeUsers || stats.value.newUsersThisMonth) {
      csvRows.push('ADDITIONAL STATISTICS');
      csvRows.push('Metric,Value');
      if (stats.value.activeUsers) {
        csvRows.push(`Active Users,${formatNumber(stats.value.activeUsers)}`);
      }
      if (stats.value.newUsersThisMonth) {
        csvRows.push(`New Users This Month,${formatNumber(stats.value.newUsersThisMonth)}`);
      }
    }
    
    // Create blob and download
    const csv = csvRows.join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    adminService.downloadCSV(blob, `roi_stats_${props.communityId}_${Date.now()}.csv`);
    
    const toast = await toastController.create({
      message: 'Statistics exported successfully',
      duration: 2000,
      color: 'success',
    });
    await toast.present();
  } catch (error) {
    console.error('Error exporting stats:', error);
    const toast = await toastController.create({
      message: 'Failed to export statistics',
      duration: 2000,
      color: 'danger',
    });
    await toast.present();
  }
}
</script>

<style scoped>
.user-stats-section {
  background: white;
  border-radius: 16px;
  padding: 24px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
}

.header-actions {
  display: flex;
  gap: 12px;
}

.section-title {
  font-size: 24px;
  font-weight: 700;
  color: #1a1a1a;
  margin: 0;
}

.section-subtitle {
  font-size: 18px;
  font-weight: 600;
  color: #1a1a1a;
  margin: 0 0 16px 0;
}


.dashboard-content {
  display: flex;
  flex-direction: column;
  gap: 32px;
}

/* Primary Metrics Section */
.primary-metrics-section {
  margin-bottom: 8px;
}

.primary-metrics-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 20px;
}

.primary-metric-card {
  display: flex;
  align-items: center;
  gap: 20px;
  padding: 24px;
  background: linear-gradient(135deg, rgba(45, 122, 78, 0.1) 0%, rgba(29, 185, 138, 0.1) 100%);
  border-radius: 16px;
  border: 2px solid rgba(45, 122, 78, 0.2);
  transition: transform 0.2s, box-shadow 0.2s;
}

.primary-metric-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(45, 122, 78, 0.15);
}

.primary-metric-card-highlight {
  background: linear-gradient(135deg, rgba(45, 122, 78, 0.15) 0%, rgba(29, 185, 138, 0.15) 100%);
  border-color: rgba(45, 122, 78, 0.3);
}

.metric-icon {
  font-size: 48px;
  color: var(--color-primary);
  flex-shrink: 0;
}

.metric-content {
  flex: 1;
}

.metric-value {
  font-size: 42px;
  font-weight: 700;
  color: var(--color-primary);
  margin-bottom: 4px;
  line-height: 1.2;
}

.metric-label {
  font-size: 16px;
  color: #64748b;
  font-weight: 500;
}

.metric-trend {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-top: 8px;
  font-size: 12px;
  font-weight: 600;
}

.metric-trend ion-icon {
  font-size: 16px;
}

.metric-trend.trend-up {
  color: #10b981;
}

.metric-trend.trend-down {
  color: #ef4444;
}

.metric-trend.trend-neutral {
  color: #64748b;
}

/* Engagement Metrics Section */
.engagement-metrics-section {
  margin-bottom: 8px;
}

.engagement-metrics-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
}

.engagement-metric-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 20px;
  background: #ffffff;
  border-radius: 12px;
  border: 1px solid #e5e7eb;
  transition: transform 0.2s, box-shadow 0.2s;
}

.engagement-metric-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.08);
  border-color: var(--color-primary);
}

.metric-icon-small {
  font-size: 32px;
  color: var(--color-primary);
  flex-shrink: 0;
  opacity: 0.8;
}

.metric-content-small {
  flex: 1;
}

.metric-value-small {
  font-size: 28px;
  font-weight: 700;
  color: #1a1a1a;
  margin-bottom: 4px;
  line-height: 1.2;
}

.metric-label-small {
  font-size: 13px;
  color: #64748b;
  font-weight: 500;
}

/* Legacy Stats */
.legacy-stats-section {
  margin-bottom: 8px;
}

.legacy-stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
}

.stat-card {
  padding: 24px;
  background: linear-gradient(135deg, rgba(45, 122, 78, 0.1) 0%, rgba(29, 185, 138, 0.1) 100%);
  border-radius: 12px;
  text-align: center;
  border: 1px solid rgba(45, 122, 78, 0.2);
}

.stat-value {
  font-size: 36px;
  font-weight: 700;
  color: var(--color-primary);
  margin-bottom: 8px;
}

.stat-label {
  font-size: 14px;
  color: #64748b;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.subsection-title {
  font-size: 18px;
  font-weight: 600;
  color: #1a1a1a;
  margin: 0 0 16px 0;
}

.skills-stats-section {
  margin-top: 24px;
}

.skills-table {
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  overflow: hidden;
}

.table-header {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 16px;
  padding: 12px 16px;
  background: #f9fafb;
  font-weight: 600;
  font-size: 14px;
  color: #64748b;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.table-row {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 16px;
  padding: 12px 16px;
  border-bottom: 1px solid #e5e7eb;
}

.table-row:last-child {
  border-bottom: none;
}

.col-skill {
  font-weight: 500;
  color: #1a1a1a;
}

.col-count {
  font-weight: 600;
  color: var(--color-primary);
}

.loading-state {
  text-align: center;
  padding: 48px 16px;
  color: #64748b;
}

.no-stats {
  text-align: center;
  padding: 48px 16px;
  color: #64748b;
}

.no-stats-icon {
  font-size: 64px;
  color: #cbd5e1;
  margin-bottom: 16px;
}

.no-stats-hint {
  font-size: 12px;
  color: #94a3b8;
  margin-top: 8px;
}

.engagement-metric-card.clickable {
  cursor: pointer;
  transition: all 0.2s ease;
}

.engagement-metric-card.clickable:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

/* Responsive */
@media (max-width: 768px) {
  .primary-metrics-grid {
    grid-template-columns: 1fr;
  }

  .engagement-metrics-grid {
    grid-template-columns: repeat(2, 1fr);
  }

  .legacy-stats-grid {
    grid-template-columns: 1fr;
  }


  .section-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 16px;
  }

  .header-actions {
    width: 100%;
  }
}
</style>





