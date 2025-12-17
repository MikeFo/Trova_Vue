<template>
  <ion-page @ionViewDidEnter="onIonViewDidEnter">
    <ion-content :fullscreen="true" class="groups-content">
      <div class="groups-container">
        <!-- Search Bar -->
        <div class="search-container">
          <ion-searchbar
            v-model="searchQuery"
            placeholder="Find Groups"
            class="groups-search"
            debounce="300"
            @ionInput="handleSearch"
          ></ion-searchbar>
          <ion-button
            fill="clear"
            class="create-button-inline"
            @click="navigateTo('/tabs/groups/new')"
          >
            <ion-icon :icon="addOutline"></ion-icon>
          </ion-button>
        </div>

        <!-- Suggested Groups (if any) -->
        <div v-if="suggestedGroups.length > 0" class="section">
          <div class="section-header">
            <h2 class="section-title">Suggested Groups</h2>
          </div>
          <GroupList
            :groups="suggestedGroups"
            :is-joined="false"
            @join="handleJoinGroup"
            @click="navigateToGroup"
          />
        </div>

        <!-- My Groups -->
        <div v-if="myGroups.length > 0" class="section">
          <div class="section-header">
            <h2 class="section-title">My Groups</h2>
            <ion-button
              fill="clear"
              size="small"
              class="filter-button"
              @click="showFilterMenu($event, 'mine')"
            >
              <ion-icon :icon="funnelOutline"></ion-icon>
            </ion-button>
          </div>
          <GroupList
            :groups="filteredMyGroups"
            :is-joined="true"
            :group-messages="groupMessages"
            @click="navigateToGroup"
            @favorite="handleFavorite"
          />
        </div>

        <!-- All Groups -->
        <div v-if="allGroups.length > 0" class="section">
          <div class="section-header">
            <h2 class="section-title">
              {{ myGroups.length > 0 ? 'All Groups' : 'Groups' }}
            </h2>
            <ion-button
              fill="clear"
              size="small"
              class="filter-button"
              @click="showFilterMenu($event, 'all')"
            >
              <ion-icon :icon="funnelOutline"></ion-icon>
            </ion-button>
          </div>
          <GroupList
            :groups="filteredAllGroups"
            :is-joined="false"
            @join="handleJoinGroup"
            @click="navigateToGroup"
          />
        </div>

        <!-- Empty State -->
        <div
          v-if="!isLoading && myGroups.length === 0 && allGroups.length === 0 && suggestedGroups.length === 0"
          class="empty-state"
        >
          <div class="empty-icon">
            <ion-icon :icon="peopleOutline"></ion-icon>
          </div>
          <h3 class="empty-title">Let's get your first group created!</h3>
          <ion-button
            fill="outline"
            class="empty-action-button"
            @click="navigateTo('/tabs/groups/new')"
          >
            Add Groups
          </ion-button>
        </div>

        <!-- Loading State -->
        <div v-if="isLoading" class="loading-container">
          <ion-spinner></ion-spinner>
          <p>Loading groups...</p>
        </div>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { useRouter, useRoute, onBeforeRouteUpdate } from 'vue-router';
import { useAuthStore } from '@/stores/auth.store';
import { useCommunityStore } from '@/stores/community.store';
import { groupService, type Group } from '@/services/group.service';
import { toastController } from '@ionic/vue';
import GroupList from './components/GroupList.vue';
import {
  IonPage,
  IonContent,
  IonSearchbar,
  IonButton,
  IonIcon,
  IonSpinner,
} from '@ionic/vue';
import {
  addCircleOutline,
  addOutline,
  funnelOutline,
  peopleOutline,
} from 'ionicons/icons';

const router = useRouter();
const route = useRoute();
const authStore = useAuthStore();
const communityStore = useCommunityStore();

const isLoading = ref(false);
const searchQuery = ref('');
const myGroups = ref<Group[]>([]);
const allGroups = ref<Group[]>([]);
const suggestedGroups = ref<Group[]>([]);
const groupMessages = ref<any[]>([]);

const filteredMyGroups = computed(() => {
  if (!searchQuery.value.trim()) {
    return myGroups.value;
  }
  const query = searchQuery.value.toLowerCase();
  return myGroups.value.filter(
    (group) =>
      group.name.toLowerCase().includes(query) ||
      group.bio?.toLowerCase().includes(query)
  );
});

const filteredAllGroups = computed(() => {
  if (!searchQuery.value.trim()) {
    return allGroups.value;
  }
  const query = searchQuery.value.toLowerCase();
  return allGroups.value.filter(
    (group) =>
      group.name.toLowerCase().includes(query) ||
      group.bio?.toLowerCase().includes(query)
  );
});

function getCommunityId(): number | null {
  // Get community ID from the community store (current selected community)
  // This matches how the original frontend works - uses the currently selected community
  return communityStore.currentCommunityId;
}

async function loadGroups() {
  if (!authStore.user?.id) {
    console.warn('[GroupsPage] No user ID found, cannot load groups');
    return;
  }

  isLoading.value = true;
  try {
    // Get community ID from user object (as stored in production DB)
    const communityId = getCommunityId();
    console.log('[GroupsPage] Loading groups for communityId:', communityId, 'userId:', authStore.user.id);

    if (!communityId) {
      console.warn('[GroupsPage] No community selected');
      const toast = await toastController.create({
        message: 'Please select a community to view groups.',
        duration: 3000,
        color: 'warning',
      });
      await toast.present();
      myGroups.value = [];
      allGroups.value = [];
      isLoading.value = false;
      return;
    }

    // Load groups for the user's community
    console.log('[GroupsPage] Calling groupService.getGroups...');
    const groups = await groupService.getGroups(communityId, authStore.user.id);
    console.log('[GroupsPage] Received groups:', groups?.length || 0, groups);

    if (!groups || groups.length === 0) {
      console.warn('[GroupsPage] No groups returned from API');
      myGroups.value = [];
      allGroups.value = [];
      isLoading.value = false;
      return;
    }

    // Filter to only show active groups
    const activeGroups = groups.filter((group) => group.isActive !== false);
    console.log('[GroupsPage] Active groups:', activeGroups.length);

    // Set userFollows based on whether user is in members array
    // Backend returns members array, but doesn't set userFollows property
    const userId = authStore.user.id;
    activeGroups.forEach((group) => {
      // Check if user is in the members array or is the leader
      const isMember = group.members?.some((member: any) => member.id === userId) || 
                       group.leaderId === userId;
      group.userFollows = isMember;
    });

    // Separate into joined and not joined
    myGroups.value = activeGroups.filter((group) => group.userFollows === true);
    allGroups.value = activeGroups.filter((group) => group.userFollows === false);
    
    console.log('[GroupsPage] My groups:', myGroups.value.length, 'All groups:', allGroups.value.length);

    // TODO: Load suggested groups separately if there's an endpoint
    // suggestedGroups.value = await groupService.getSuggestedGroups(communityId, authStore.user.id);
  } catch (error: any) {
    console.error('[GroupsPage] Error loading groups:', error);
    console.error('[GroupsPage] Error details:', {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status,
    });
    
    // Show user-friendly error message
    if (error.message?.includes('Community not found')) {
      const toast = await toastController.create({
        message: 'Unable to load groups. Please ensure you are part of a community.',
        duration: 3000,
        color: 'warning',
      });
      await toast.present();
    } else {
      const toast = await toastController.create({
        message: error.message || 'Failed to load groups. Please try again.',
        duration: 3000,
        color: 'danger',
      });
      await toast.present();
    }
    
    myGroups.value = [];
    allGroups.value = [];
  } finally {
    isLoading.value = false;
  }
}

function handleSearch(event: any) {
  searchQuery.value = event.target.value || '';
}

function navigateTo(path: string) {
  router.push(path);
}

function navigateToGroup(group: Group) {
  router.push(`/tabs/groups/${group.id}`);
}

async function handleJoinGroup(group: Group) {
  if (!authStore.user?.id) {
    const toast = await toastController.create({
      message: 'You must be logged in to join a group',
      duration: 2000,
      color: 'danger',
    });
    await toast.present();
    return;
  }

  try {
    await groupService.joinGroup(authStore.user.id, group.id);
    
    // Show success message
    const toast = await toastController.create({
      message: `Successfully joined ${group.name}!`,
      duration: 2000,
      color: 'success',
    });
    await toast.present();
    
    // Move from allGroups to myGroups
    allGroups.value = allGroups.value.filter((g) => g.id !== group.id);
    group.userFollows = true;
    myGroups.value.push(group);
    
    // Reload groups to ensure we have the latest data
    await loadGroups();
  } catch (error: any) {
    console.error('[GroupsPage] Error joining group:', error);
    
    // Show error toast with helpful message
    let errorMessage = 'Failed to join group. Please try again.';
    if (error.message && error.message !== 'Request failed') {
      errorMessage = error.message;
    } else if (error.response?.data?.message) {
      errorMessage = error.response.data.message;
    }
    
    const toast = await toastController.create({
      message: errorMessage,
      duration: 3000,
      color: 'danger',
    });
    await toast.present();
  }
}

function handleFavorite(group: Group) {
  // TODO: Save favorite status to backend
  console.log('Toggle favorite for group:', group.id, group.isFavorite);
}

function showFilterMenu(event: Event, type: 'mine' | 'all') {
  // TODO: Implement filter popover
  console.log('Show filter menu for', type);
}

// Watch for community changes and reload groups
// Only reload if we're currently on the groups page
watch(() => communityStore.currentCommunityId, (newCommunityId) => {
  // Only reload if we're on the groups page (not group detail)
  if (newCommunityId && route.path === '/tabs/groups') {
    loadGroups();
  } else if (!newCommunityId) {
    // Clear groups if no community selected
    myGroups.value = [];
    allGroups.value = [];
  }
});

onMounted(() => {
  loadGroups();
});

// Reload groups when navigating back to this page
// This ensures newly created groups appear
onBeforeRouteUpdate((to, from) => {
  // Reload if coming from create group page or group detail page
  if (from.path.includes('/groups/new') || (from.path.includes('/groups/') && !from.path.includes('/groups/new'))) {
    loadGroups();
  }
});

// Also reload when the view becomes active (Ionic lifecycle)
// This handles cases where the tab is already active but we navigate back
function onIonViewDidEnter() {
  // Always reload when view becomes active to ensure we have latest data
  loadGroups();
}
</script>

<style scoped>
.groups-content {
  --background: #f8fafc;
}

/* Add padding-top on desktop to account for sticky header */
@media (min-width: 768px) {
  .groups-content {
    padding-top: 0;
  }
}

.groups-container {
  padding: 16px;
  max-width: 1200px;
  margin: 0 auto;
}

@media (min-width: 768px) {
  .groups-container {
    padding-top: 24px;
  }
}

.create-button {
  --color: var(--color-primary);
  --border-color: var(--color-primary);
  font-weight: 600;
  text-transform: none;
}

.search-container {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 24px;
}

@media (min-width: 768px) {
  .search-container {
    margin-bottom: 32px;
  }
}

.create-button-inline {
  --color: var(--color-primary);
  --padding-start: 8px;
  --padding-end: 8px;
  margin: 0;
  flex-shrink: 0;
}

.create-button-inline ion-icon {
  font-size: 24px;
}

.groups-search {
  --background: #ffffff;
  --border-radius: 12px;
  --box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
  --placeholder-color: #94a3b8;
  --icon-color: #64748b;
  padding: 0;
}

.section {
  margin-bottom: 32px;
}

@media (min-width: 768px) {
  .section {
    margin-bottom: 40px;
  }
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

@media (min-width: 768px) {
  .section-header {
    margin-bottom: 16px;
  }
}

.section-title {
  font-size: 20px;
  font-weight: 700;
  color: #1a1a1a;
  margin: 0;
  letter-spacing: -0.5px;
}

@media (min-width: 768px) {
  .section-title {
    font-size: 22px;
  }
}

.filter-button {
  --color: #64748b;
  --padding-start: 8px;
  --padding-end: 8px;
}

.empty-state {
  text-align: center;
  padding: 64px 16px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 60vh;
}

.empty-icon {
  width: 100px;
  height: 100px;
  margin: 0 auto 32px;
  background: linear-gradient(135deg, rgba(45, 122, 78, 0.1) 0%, rgba(29, 185, 138, 0.1) 100%);
  border-radius: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 16px rgba(45, 122, 78, 0.1);
}

.empty-icon ion-icon {
  font-size: 48px;
  color: var(--color-primary);
}

.empty-title {
  font-size: 24px;
  font-weight: 700;
  color: #1a1a1a;
  margin: 0 0 12px 0;
}

.empty-description {
  font-size: 16px;
  color: #64748b;
  margin: 0 0 32px 0;
  line-height: 1.6;
  max-width: 500px;
}

.empty-action-button {
  --border-color: var(--color-primary);
  --color: var(--color-primary);
  --border-radius: 12px;
  --padding-start: 32px;
  --padding-end: 32px;
  height: 48px;
  font-weight: 600;
  text-transform: none;
  font-size: 15px;
  transition: all 0.2s ease;
}

.empty-action-button:hover {
  --background: var(--color-primary);
  --color: white;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(45, 122, 78, 0.3);
}

.loading-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 64px 16px;
  color: #64748b;
}

/* Responsive: Desktop */
@media (min-width: 768px) {
  .groups-container {
    padding: 24px;
  }

  .section-title {
    font-size: 26px;
  }

  .empty-state {
    padding: 96px 32px;
    min-height: 70vh;
  }

  .empty-icon {
    width: 120px;
    height: 120px;
    margin-bottom: 40px;
  }

  .empty-icon ion-icon {
    font-size: 56px;
  }

  .empty-title {
    font-size: 28px;
  }

  .empty-description {
    font-size: 18px;
    max-width: 600px;
  }
}

@media (min-width: 1024px) {
  .groups-container {
    padding: 32px;
  }
}
</style>

