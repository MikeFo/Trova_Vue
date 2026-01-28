<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-title>Communities</ion-title>
      </ion-toolbar>
    </ion-header>
    <ion-content :fullscreen="true" class="communities-content">
      <div class="communities-container">
        <!-- Search Bar -->
        <div class="search-section">
          <ion-searchbar
            v-model="searchQuery"
            placeholder="Search communities by name..."
            @ionInput="handleSearch"
            @ionClear="handleSearchClear"
            :debounce="500"
            class="search-bar"
          ></ion-searchbar>
        </div>

        <!-- Loading State -->
        <div v-if="isLoading" class="loading-state">
          <ion-spinner name="crescent"></ion-spinner>
          <p>Loading communities...</p>
        </div>

        <!-- Communities List -->
        <div v-else-if="communities.length > 0" class="communities-list">
          <div
            v-for="community in communities"
            :key="community.id"
            class="community-card"
          >
            <div class="community-card-content">
              <div class="community-logo">
                <img
                  v-if="community.logo"
                  :src="community.logo"
                  :alt="community.name"
                />
                <div v-else class="community-placeholder">
                  <ion-icon :icon="peopleOutline"></ion-icon>
                </div>
              </div>
              <div class="community-info">
                <h3 class="community-name">{{ community.name }}</h3>
                <p v-if="community.bio" class="community-bio">
                  {{ community.bio }}
                </p>
                <div v-if="community.leader" class="community-leader">
                  <span class="leader-label">Leader:</span>
                  <span class="leader-name">
                    {{ community.leader.fname }} {{ community.leader.lname }}
                  </span>
                </div>
              </div>
              <div class="community-action">
                <ion-button
                  fill="solid"
                  size="small"
                  class="join-button"
                  @click.stop="navigateToCommunity(community)"
                  :disabled="isLoading"
                >
                  Join
                </ion-button>
              </div>
            </div>
          </div>
        </div>

        <!-- Empty State -->
        <div v-else class="empty-state">
          <div class="empty-icon">
            <ion-icon :icon="peopleOutline"></ion-icon>
          </div>
          <h3 class="empty-title">
            {{ searchQuery ? 'No communities found' : 'No communities yet' }}
          </h3>
          <p class="empty-description">
            {{
              searchQuery
                ? `No communities found matching "${searchQuery}". Try a different search term.`
                : 'Join or create a community to get started!'
            }}
          </p>
          <ion-button
            v-if="!searchQuery"
            fill="solid"
            class="empty-action-button"
            @click="createCommunity"
          >
            <ion-icon :icon="addOutline" slot="start"></ion-icon>
            Create Community
          </ion-button>
        </div>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { communityService, type Community } from '@/services/community.service';
import { useCommunityStore } from '@/stores/community.store';
import { useAuthStore } from '@/stores/auth.store';
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonSearchbar,
  IonSpinner,
  IonButton,
  IonIcon,
  toastController,
} from '@ionic/vue';
import {
  peopleOutline,
  addOutline,
} from 'ionicons/icons';

const router = useRouter();
const communityStore = useCommunityStore();
const authStore = useAuthStore();
const communities = ref<Community[]>([]);
const searchQuery = ref('');
const isLoading = ref(false);

let searchTimeout: ReturnType<typeof setTimeout> | null = null;

async function loadCommunities(searchTerm?: string) {
  isLoading.value = true;
  try {
    console.log('[CommunitiesPage] Loading public communities...', searchTerm ? `search: "${searchTerm}"` : '');
    const publicCommunities = await communityService.getPublicCommunities(searchTerm);
    console.log('[CommunitiesPage] Loaded communities:', publicCommunities.length);
    communities.value = publicCommunities;
  } catch (error: any) {
    console.error('[CommunitiesPage] Error loading communities:', error);
    const toast = await toastController.create({
      message: error.message || 'Failed to load communities. Please try again.',
      duration: 3000,
      color: 'danger',
    });
    await toast.present();
    communities.value = [];
  } finally {
    isLoading.value = false;
  }
}

function handleSearch(event: any) {
  const query = event.target.value || '';
  searchQuery.value = query;
  
  if (searchTimeout) {
    clearTimeout(searchTimeout);
  }
  
  searchTimeout = setTimeout(() => {
    if (query.trim()) {
      loadCommunities(query.trim());
    } else {
      loadCommunities();
    }
  }, 500);
}

function handleSearchClear() {
  searchQuery.value = '';
  loadCommunities();
}

async function navigateToCommunity(community: Community) {
  // Join the community when clicking on it
  try {
    isLoading.value = true;
    await communityService.joinCommunity(community.id);
    
    // Show success message
    const toast = await toastController.create({
      message: `Successfully joined ${community.name}!`,
      duration: 2000,
      color: 'success',
    });
    await toast.present();

    // Refresh user profile to get updated community ID
    const { authService } = await import('@/services/auth.service');
    await authService.getUserProfile();

    // Fetch the full community details to add to store
    let fullCommunityDetails: Community | null = null;
    try {
      fullCommunityDetails = await communityService.getCommunityById(community.id);
      console.log('[CommunitiesPage] Fetched full community details:', fullCommunityDetails);
    } catch (error) {
      console.warn('[CommunitiesPage] Could not fetch full community details, using provided community data');
      fullCommunityDetails = community;
    }

    // Trigger community menu refresh
    window.dispatchEvent(new CustomEvent('communities-updated'));

    // Wait for communities to refresh, then automatically select the newly joined community
    // Retry a few times to handle backend processing delay
    const selectNewCommunity = async (attempt: number = 0): Promise<void> => {
      // Increase delays: first attempt after 1s, then 2s, then 3s
      const delay = (attempt + 1) * 1000;
      await new Promise(resolve => setTimeout(resolve, delay));
      
      const userId = authStore.user?.id;
      if (!userId) return;
      
      try {
        const userCommunities = await communityService.getUserCommunities(userId, true);
        
        let joinedCommunity = userCommunities.find(c => c.id === community.id);
        
        // If community not found in API response but we have the details, add it manually
        if (!joinedCommunity && fullCommunityDetails) {
          const communitiesWithNew = [...userCommunities, fullCommunityDetails];
          communityStore.setCommunities(communitiesWithNew);
          joinedCommunity = fullCommunityDetails;
        } else if (joinedCommunity) {
          // Update store with all communities
          communityStore.setCommunities(userCommunities);
        }
        
        if (joinedCommunity) {
          // Automatically select the newly joined community
          communityStore.setCurrentCommunity(joinedCommunity);
        } else if (attempt < 4) {
          // Retry if community not found yet (up to 5 attempts total)
          return selectNewCommunity(attempt + 1);
        } else {
          // Still update the store even if we can't find the specific community
          communityStore.setCommunities(userCommunities);
        }
      } catch (error) {
        console.error('[CommunitiesPage] Error selecting new community:', error);
        // Even if selection fails, if we have the community details, add it manually
        if (fullCommunityDetails) {
          const currentCommunities = communityStore.communities;
          const exists = currentCommunities.find(c => c.id === fullCommunityDetails!.id);
          if (!exists) {
            communityStore.setCommunities([...currentCommunities, fullCommunityDetails]);
            communityStore.setCurrentCommunity(fullCommunityDetails);
            console.log('[CommunitiesPage] Manually added community to store after error');
          }
        }
      }
    };
    
    await selectNewCommunity();

    // Navigate to home page
    router.push('/tabs/home');
  } catch (error: any) {
    console.error('[CommunitiesPage] Error joining community:', error);
    const toast = await toastController.create({
      message: error.message || 'Failed to join community. Please try again.',
      duration: 3000,
      color: 'danger',
    });
    await toast.present();
  } finally {
    isLoading.value = false;
  }
}

function createCommunity() {
  // TODO: Navigate to create community page when implemented
  console.log('Create community');
}

onMounted(() => {
  loadCommunities();
});
</script>

<style scoped>
.communities-content {
  --background: #f8fafc;
}

.communities-container {
  padding: 16px;
  max-width: 100%;
  margin: 0 auto;
}

.search-section {
  margin-bottom: 16px;
}

.search-bar {
  --background: white;
  --border-radius: 12px;
  --box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  padding: 0;
}

.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 64px 16px;
  min-height: 40vh;
}

.loading-state p {
  margin-top: 16px;
  color: #64748b;
  font-size: 14px;
}

.communities-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.community-card {
  background: white;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  cursor: pointer;
  transition: all 0.2s ease;
}

.community-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.12);
}

.community-card-content {
  display: flex;
  align-items: center;
  padding: 16px;
  gap: 16px;
}

.community-logo {
  width: 64px;
  height: 64px;
  border-radius: 12px;
  overflow: hidden;
  flex-shrink: 0;
  background: linear-gradient(135deg, rgba(45, 122, 78, 0.1) 0%, rgba(29, 185, 138, 0.1) 100%);
  display: flex;
  align-items: center;
  justify-content: center;
}

.community-logo img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.community-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.community-placeholder ion-icon {
  font-size: 32px;
  color: var(--color-primary);
}

.community-info {
  flex: 1;
  min-width: 0;
}

.community-name {
  font-size: 18px;
  font-weight: 600;
  color: #1a1a1a;
  margin: 0 0 4px 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.community-bio {
  font-size: 14px;
  color: #64748b;
  margin: 0 0 8px 0;
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.community-leader {
  font-size: 12px;
  color: #94a3b8;
  display: flex;
  align-items: center;
  gap: 4px;
}

.leader-label {
  font-weight: 500;
}

.leader-name {
  color: #64748b;
}

.community-action {
  flex-shrink: 0;
  display: flex;
  align-items: center;
}

.join-button {
  --background: var(--color-primary);
  --color: white;
  --border-radius: 8px;
  --padding-start: 16px;
  --padding-end: 16px;
  height: 36px;
  font-weight: 600;
  font-size: 14px;
  text-transform: none;
  margin: 0;
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
  max-width: 400px;
}

.empty-action-button {
  --background: linear-gradient(135deg, var(--color-primary) 0%, var(--color-secondary) 100%);
  --color: white;
  --border-radius: 12px;
  --padding-start: 32px;
  --padding-end: 32px;
  height: 48px;
  font-weight: 600;
  text-transform: none;
  font-size: 15px;
  transition: all 0.2s ease;
  box-shadow: 0 4px 12px rgba(45, 122, 78, 0.3);
}

.empty-action-button:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(45, 122, 78, 0.4);
}

.empty-action-button:active {
  transform: translateY(0);
}

/* Responsive: Desktop */
@media (min-width: 768px) {
  .communities-container {
    max-width: 900px;
    padding: 24px;
  }

  .communities-list {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
    gap: 16px;
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
    max-width: 500px;
  }
}

@media (min-width: 1024px) {
  .communities-container {
    max-width: 1000px;
    padding: 32px;
  }
}
</style>

