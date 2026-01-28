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
        <!-- Community Selector (if multiple communities OR super admin) -->
        <div v-if="managedCommunities.length > 1 || isSuperAdminUser" class="community-selector-section">
          <ion-item>
            <ion-label>
              <span v-if="isSuperAdminUser" style="font-weight: bold; color: #3880ff;">
                Super Admin: Select Community
              </span>
              <span v-else>Select Community</span>
            </ion-label>
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
        </ion-segment>

        <!-- Tab Content -->
        <div class="tab-content">
          <!-- User Statistics Tab -->
          <div v-if="activeTab === 'stats'" class="tab-panel">
            <UserStatsSection
              :community-id="selectedCommunityId"
              @open-magic-intros="openMagicIntrosModal"
              @open-channel-pairings="openChannelPairingsModal"
              @open-mentor-mentee-matches="openMentorMenteeMatchesModal"
              @open-connections="openConnectionsModal"
              @open-skills="openSkillsModal"
              @open-mentor-list="openMentorListModal"
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
        </div>
      </div>
    </ion-content>

    <!-- Magic Intros Modal -->
    <MagicIntrosPage
      :is-open="isMagicIntrosModalOpen"
      :community-id="selectedCommunityId"
      :start-date="magicIntrosStartDate"
      :end-date="magicIntrosEndDate"
      @did-dismiss="closeMagicIntrosModal"
    />

    <!-- Skills Modal -->
    <SkillsListPage
      :is-open="isSkillsModalOpen"
      :community-id="selectedCommunityId"
      @did-dismiss="closeSkillsModal"
    />

    <!-- Mentor List Modal -->
    <MentorListPage
      v-if="selectedCommunityId"
      :is-open="isMentorListModalOpen"
      :community-id="selectedCommunityId"
      :mentor-type="mentorListType"
      @did-dismiss="closeMentorListModal"
    />

    <!-- Channel Pairings Modal -->
    <ChannelPairingsPage
      :is-open="isChannelPairingsModalOpen"
      :community-id="selectedCommunityId"
      :start-date="channelPairingsStartDate"
      :end-date="channelPairingsEndDate"
      @did-dismiss="closeChannelPairingsModal"
    />

    <!-- Mentor/Mentee Matches Modal -->
    <MentorMenteeMatchesPage
      :is-open="isMentorMenteeMatchesModalOpen"
      :community-id="selectedCommunityId"
      :start-date="mentorMenteeMatchesStartDate"
      :end-date="mentorMenteeMatchesEndDate"
      @did-dismiss="closeMentorMenteeMatchesModal"
    />

    <!-- Connections Modal -->
    <ConnectionsPage
      :is-open="isConnectionsModalOpen"
      :community-id="selectedCommunityId"
      :start-date="connectionsStartDate"
      :end-date="connectionsEndDate"
      @did-dismiss="closeConnectionsModal"
    />
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
import DataUploadSection from './sections/DataUploadSection.vue';
import AnalyticsDashboardSection from './sections/AnalyticsDashboardSection.vue';
import UserStatsSection from './sections/UserStatsSection.vue';
import MagicIntrosPage from './MagicIntrosPage.vue';
import SkillsListPage from './SkillsListPage.vue';
import MentorListPage from './MentorListPage.vue';
import ChannelPairingsPage from './ChannelPairingsPage.vue';
import MentorMenteeMatchesPage from './MentorMenteeMatchesPage.vue';
import ConnectionsPage from './ConnectionsPage.vue';
import type { Community } from '@/services/community.service';

const router = useRouter();
const route = useRoute();
const authStore = useAuthStore();
const communityStore = useCommunityStore();

const isLoading = ref(true);
const isManager = ref(false);
const isSuperAdminUser = ref(false);
const activeTab = ref('stats');
const managedCommunities = ref<Community[]>([]);
const selectedCommunityId = ref<number | null>(null);

// Magic Intros Modal state
const isMagicIntrosModalOpen = ref(false);
const magicIntrosStartDate = ref<string | undefined>(undefined);
const magicIntrosEndDate = ref<string | undefined>(undefined);

// Skills Modal state
const isSkillsModalOpen = ref(false);

// Mentor List Modal state
const isMentorListModalOpen = ref(false);
const mentorListType = ref<'can' | 'want'>('can');

// Channel Pairings Modal state
const isChannelPairingsModalOpen = ref(false);
const channelPairingsStartDate = ref<string | undefined>(undefined);
const channelPairingsEndDate = ref<string | undefined>(undefined);

// Mentor/Mentee Matches Modal state
const isMentorMenteeMatchesModalOpen = ref(false);
const mentorMenteeMatchesStartDate = ref<string | undefined>(undefined);
const mentorMenteeMatchesEndDate = ref<string | undefined>(undefined);

const isConnectionsModalOpen = ref(false);
const connectionsStartDate = ref<string | undefined>(undefined);
const connectionsEndDate = ref<string | undefined>(undefined);

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

  // Check if user is super admin first
  isSuperAdminUser.value = adminService.isSuperAdmin(authStore.user.id);
  
  const communityId = getCommunityId();

  // For super admins, allow access even without a specific communityId
  if (isSuperAdminUser.value) {
    isManager.value = true;
    await loadManagedCommunities();
    // Set initial community if available, otherwise use first from list
    if (communityId) {
      selectedCommunityId.value = communityId;
    } else if (managedCommunities.value.length > 0) {
      selectedCommunityId.value = managedCommunities.value[0].id;
    }
    isLoading.value = false;
    return;
  }

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
  if (!authStore.user?.id) {
    return;
  }

  // For super admins, load all communities
  if (isSuperAdminUser.value) {
    try {
      const allCommunities = await adminService.getAllCommunitiesForSuperAdmin(authStore.user.id);
      managedCommunities.value = allCommunities;
      console.log('[AdminConsole] Loaded all communities for super admin:', allCommunities.length);
      
      // Set initial selected community if not already set
      if (!selectedCommunityId.value && allCommunities.length > 0) {
        selectedCommunityId.value = allCommunities[0].id;
        // Also set in store for backend middleware
        communityStore.setCurrentCommunity(allCommunities[0]);
      }
    } catch (error) {
      console.error('Failed to load all communities for super admin:', error);
      // Fallback to current community
      if (communityStore.currentCommunity) {
        managedCommunities.value = [communityStore.currentCommunity];
      }
    }
    return;
  }

  // For regular managers, load communities where user is a manager
  // TODO: Implement endpoint to get all communities where user is a manager
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
  // Community changed, update store
  // The child components (UserStatsSection, AnalyticsDashboardSection, etc.) 
  // watch the communityId prop and will automatically reload their data
  if (selectedCommunityId.value) {
    const selectedCommunity = managedCommunities.value.find(c => c.id === selectedCommunityId.value);
    if (selectedCommunity) {
      communityStore.setCurrentCommunity(selectedCommunity);
      console.log('[AdminConsole] Switched to community:', selectedCommunity.id, selectedCommunity.name);
      // No need to call refreshData() - the prop change will trigger watchers in child components
    }
  }
}

async function refreshData() {
  isLoading.value = true;
  await checkManagerAccess();
  isLoading.value = false;
}

function openMagicIntrosModal(startDate?: string, endDate?: string) {
  magicIntrosStartDate.value = startDate;
  magicIntrosEndDate.value = endDate;
  isMagicIntrosModalOpen.value = true;
}

function closeMagicIntrosModal() {
  isMagicIntrosModalOpen.value = false;
  magicIntrosStartDate.value = undefined;
  magicIntrosEndDate.value = undefined;
}

function openSkillsModal() {
  isSkillsModalOpen.value = true;
}

function closeSkillsModal() {
  isSkillsModalOpen.value = false;
}

function openMentorListModal(type: 'can' | 'want') {
  mentorListType.value = type;
  isMentorListModalOpen.value = true;
}

function closeMentorListModal() {
  isMentorListModalOpen.value = false;
}

function openChannelPairingsModal(startDate?: string, endDate?: string) {
  channelPairingsStartDate.value = startDate;
  channelPairingsEndDate.value = endDate;
  isChannelPairingsModalOpen.value = true;
}

function closeChannelPairingsModal() {
  isChannelPairingsModalOpen.value = false;
  channelPairingsStartDate.value = undefined;
  channelPairingsEndDate.value = undefined;
}

function openMentorMenteeMatchesModal(startDate?: string, endDate?: string) {
  mentorMenteeMatchesStartDate.value = startDate;
  mentorMenteeMatchesEndDate.value = endDate;
  isMentorMenteeMatchesModalOpen.value = true;
}

function closeMentorMenteeMatchesModal() {
  isMentorMenteeMatchesModalOpen.value = false;
  mentorMenteeMatchesStartDate.value = undefined;
  mentorMenteeMatchesEndDate.value = undefined;
}

function openConnectionsModal(startDate?: string, endDate?: string) {
  connectionsStartDate.value = startDate;
  connectionsEndDate.value = endDate;
  isConnectionsModalOpen.value = true;
}

function closeConnectionsModal() {
  isConnectionsModalOpen.value = false;
  connectionsStartDate.value = undefined;
  connectionsEndDate.value = undefined;
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




