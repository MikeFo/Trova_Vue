<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-button @click="goBack">
            <ion-icon :icon="arrowBack"></ion-icon>
          </ion-button>
        </ion-buttons>
        <ion-title>Admin Console</ion-title>
        <ion-buttons slot="end">
          <ion-button @click="refreshData">
            <ion-icon :icon="refresh"></ion-icon>
          </ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>
    <ion-content :fullscreen="true" class="admin-console-content">
      <div v-if="!isLoading && !isManager" class="access-denied">
        <ion-icon :icon="lockClosedOutline" class="lock-icon"></ion-icon>
        <h2>Access Denied</h2>
        <p>You must be a community leader or manager to access the admin console.</p>
        <p class="redirect-message">Redirecting you back...</p>
        <ion-button @click="goBack">Go Back Now</ion-button>
      </div>

      <div v-else-if="isLoading" class="loading-container">
        <ion-spinner></ion-spinner>
        <p>Loading admin console...</p>
      </div>

      <div v-else class="admin-console-container">
        <!-- Community Selector (if multiple communities) -->
        <div v-if="managedCommunities.length > 1" class="community-selector-section">
          <ion-item>
            <ion-label>Select Community</ion-label>
            <ion-select v-model="selectedCommunityId" @ionChange="onCommunityChange">
              <ion-select-option
                v-for="community in managedCommunities"
                :key="community.id"
                :value="community.id"
              >
                {{ community.name }}
              </ion-select-option>
            </ion-select>
          </ion-item>
        </div>

        <!-- Tabs Navigation -->
        <ion-segment v-model="activeTab" @ionChange="onTabChange">
          <ion-segment-button value="stats">
            <ion-label>Stats</ion-label>
          </ion-segment-button>
          <ion-segment-button value="analytics">
            <ion-label>Analytics</ion-label>
          </ion-segment-button>
          <ion-segment-button value="data">
            <ion-label>Upload Data</ion-label>
          </ion-segment-button>
          <ion-segment-button value="users">
            <ion-label>Users</ion-label>
          </ion-segment-button>
          <ion-segment-button value="community">
            <ion-label>Community</ion-label>
          </ion-segment-button>
          <ion-segment-button value="messaging">
            <ion-label>Messaging</ion-label>
          </ion-segment-button>
        </ion-segment>

        <!-- Tab Content -->
        <div class="tab-content">
          <!-- User Statistics Tab -->
          <div v-if="activeTab === 'stats'" class="tab-panel">
            <UserStatsSection
              :community-id="selectedCommunityId"
            />
          </div>

          <!-- Analytics Dashboard Tab -->
          <div v-if="activeTab === 'analytics'" class="tab-panel">
            <AnalyticsDashboardSection
              :community-id="selectedCommunityId"
            />
          </div>

          <!-- Data Upload Tab -->
          <div v-if="activeTab === 'data'" class="tab-panel">
            <DataUploadSection
              :community-id="selectedCommunityId"
            />
          </div>

          <!-- User Management Tab -->
          <div v-if="activeTab === 'users'" class="tab-panel">
            <UserManagementSection
              :community-id="selectedCommunityId"
              @refresh="refreshData"
            />
          </div>

          <!-- Community Configuration Tab -->
          <div v-if="activeTab === 'community'" class="tab-panel">
            <CommunityConfigSection
              :community-id="selectedCommunityId"
              @refresh="refreshData"
            />
          </div>

          <!-- Messaging Tab -->
          <div v-if="activeTab === 'messaging'" class="tab-panel">
            <MessagingSection
              :community-id="selectedCommunityId"
            />
          </div>
        </div>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useAuthStore } from '@/stores/auth.store';
import { useCommunityStore } from '@/stores/community.store';
import { adminService } from '@/services/admin.service';
import { slackSessionService } from '@/services/slack-session.service';
import { toastController } from '@ionic/vue';
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonButtons,
  IonButton,
  IonIcon,
  IonContent,
  IonSpinner,
  IonSegment,
  IonSegmentButton,
  IonLabel,
  IonItem,
  IonSelect,
  IonSelectOption,
} from '@ionic/vue';
import {
  arrowBack,
  refresh,
  lockClosedOutline,
} from 'ionicons/icons';
import UserManagementSection from './sections/UserManagementSection.vue';
import CommunityConfigSection from './sections/CommunityConfigSection.vue';
import MessagingSection from './sections/MessagingSection.vue';
import DataUploadSection from './sections/DataUploadSection.vue';
import AnalyticsDashboardSection from './sections/AnalyticsDashboardSection.vue';
import UserStatsSection from './sections/UserStatsSection.vue';
import type { Community } from '@/services/community.service';

const router = useRouter();
const route = useRoute();
const authStore = useAuthStore();
const communityStore = useCommunityStore();

const isLoading = ref(true);
const isManager = ref(false);
const activeTab = ref('stats');
const managedCommunities = ref<Community[]>([]);
const selectedCommunityId = ref<number | null>(null);

// Use the same community identification pattern as other pages
// Priority: selectedCommunityId (from admin console) > store > getCommunityId()
const currentCommunityId = computed(() => {
  if (selectedCommunityId.value) {
    return selectedCommunityId.value;
  }
  if (communityStore.currentCommunityId) {
    return communityStore.currentCommunityId;
  }
  // Fallback to getCommunityId() pattern (query params > session > route params)
  return getCommunityId();
});

/**
 * Get community ID using the same pattern as other pages:
 * 1. Check route.query.communityId (from Slack URL)
 * 2. Check validated Slack session
 * 3. Fall back to route.params.communityId (route param)
 * 4. Finally use communityStore.currentCommunityId (user's selected community)
 */
function getCommunityId(): number | null {
  const params = route.query;
  
  // Priority 1: Query params (from Slack links)
  if (params.communityId) {
    const queryCommunityId = Number(params.communityId);
    if (!isNaN(queryCommunityId)) {
      console.log('[AdminConsole] Using communityId from query params:', queryCommunityId);
      return queryCommunityId;
    }
  }
  
  // Priority 2: Validated Slack session
  const validatedSession = slackSessionService.getCurrentValidation();
  if (validatedSession?.communityId) {
    console.log('[AdminConsole] Using communityId from validated Slack session:', validatedSession.communityId);
    return validatedSession.communityId;
  }
  
  // Priority 3: Route params
  if (route.params.communityId) {
    const paramCommunityId = Number(route.params.communityId);
    if (!isNaN(paramCommunityId)) {
      console.log('[AdminConsole] Using communityId from route params:', paramCommunityId);
      return paramCommunityId;
    }
  }
  
  // Priority 4: User's selected community from store
  if (communityStore.currentCommunityId) {
    console.log('[AdminConsole] Using communityId from store:', communityStore.currentCommunityId);
    return communityStore.currentCommunityId;
  }
  
  console.warn('[AdminConsole] No communityId found in query params, session, route params, or store');
  return null;
}

async function checkManagerAccess() {
  if (!authStore.user?.id) {
    isManager.value = false;
    isLoading.value = false;
    return;
  }

  const communityId = getCommunityId();

  if (!communityId) {
    isManager.value = false;
    isLoading.value = false;
    return;
  }

  try {
    // Get community to check leaderId
    let community = communityStore.getCommunityById(communityId);
    if (!community) {
      // Try to load community if not in store
      const { communityService } = await import('@/services/community.service');
      community = await communityService.getCommunityById(communityId);
    }

    // Check if user is admin (leader OR in communities_managers table)
    isManager.value = await adminService.isManager(communityId, authStore.user.id, community || undefined);
    
    if (isManager.value) {
      selectedCommunityId.value = communityId;
      
      // Ensure the community is set in the store so backend middleware uses the correct community
      // This matches the pattern used in other pages (MapPage, OrgChartPage, etc.)
      const community = communityStore.getCommunityById(communityId);
      if (community) {
        communityStore.setCurrentCommunity(community);
        console.log('[AdminConsole] Set community in store:', communityId, community.name);
      } else {
        // Try to load community if not in store
        const { communityService } = await import('@/services/community.service');
        const loadedCommunity = await communityService.getCommunityById(communityId);
        if (loadedCommunity) {
          communityStore.setCurrentCommunity(loadedCommunity);
          console.log('[AdminConsole] Loaded and set community in store:', communityId, loadedCommunity.name);
        }
      }
      
      await loadManagedCommunities();
    } else {
      // User is not an admin, redirect after a moment
      setTimeout(() => {
        router.push('/tabs/home');
      }, 2000);
    }
  } catch (error) {
    console.error('Error checking manager access:', error);
    isManager.value = false;
    // Redirect on error
    setTimeout(() => {
      router.push('/tabs/home');
    }, 2000);
  } finally {
    isLoading.value = false;
  }
}

async function loadManagedCommunities() {
  // TODO: Load communities where user is a manager
  // For now, use current community
  if (communityStore.currentCommunity) {
    managedCommunities.value = [communityStore.currentCommunity];
  }
}

// Set community and trigger data loading (matching production pattern)
function setCommunity(communityId: number) {
  selectedCommunityId.value = communityId;
  // This will trigger the watch in AnalyticsDashboardSection to load data
}

function goBack() {
  router.back();
}

function onTabChange() {
  // Tab changed, could refresh data if needed
}

function onCommunityChange() {
  // Community changed, refresh data
  refreshData();
}

async function refreshData() {
  isLoading.value = true;
  await checkManagerAccess();
  isLoading.value = false;
}

onMounted(() => {
  checkManagerAccess();
});
</script>

<style scoped>
.admin-console-content {
  --background: #f8fafc;
}

.access-denied {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 64px 16px;
  text-align: center;
}

.lock-icon {
  font-size: 64px;
  color: #ef4444;
  margin-bottom: 16px;
}

.access-denied h2 {
  font-size: 24px;
  font-weight: 700;
  color: #1a1a1a;
  margin: 0 0 8px 0;
}

.access-denied p {
  font-size: 16px;
  color: #64748b;
  margin: 0 0 8px 0;
}

.redirect-message {
  font-size: 14px;
  font-style: italic;
  margin-bottom: 24px !important;
}

.loading-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 64px 16px;
  color: #64748b;
}

.admin-console-container {
  max-width: 1400px;
  margin: 0 auto;
  padding: 16px;
}

.community-selector-section {
  background: white;
  border-radius: 12px;
  padding: 16px;
  margin-bottom: 16px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
}

ion-segment {
  margin-bottom: 24px;
  --background: white;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
  padding: 4px;
}

.tab-content {
  min-height: 400px;
}

.tab-panel {
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

/* Responsive */
@media (min-width: 768px) {
  .admin-console-container {
    padding: 24px;
  }
}
</style>




