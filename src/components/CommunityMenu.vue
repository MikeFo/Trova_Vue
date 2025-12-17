<template>
  <ion-menu side="start" menu-id="community-menu" content-id="main-content" @ionDidOpen="handleMenuOpen">
    <ion-header>
      <ion-toolbar>
        <ion-title>Communities</ion-title>
      </ion-toolbar>
    </ion-header>
    <ion-content>
      <ion-list v-if="communities.length > 0" lines="full">
        <!-- Global View Option -->
        <ion-item
          button
          :class="{ 'selected': currentCommunityId === null }"
          @click="selectGlobal"
        >
          <ion-avatar slot="start">
            <div class="global-placeholder">
              <ion-icon :icon="globe"></ion-icon>
            </div>
          </ion-avatar>
          <ion-label>
            <h2>Global</h2>
            <p>All Communities</p>
          </ion-label>
        </ion-item>

        <ion-item
          v-for="community in sortedCommunities"
          :key="community.id"
          button
          :class="{ 'selected': community.id === currentCommunityId }"
          @click="selectCommunity(community)"
        >
          <ion-avatar slot="start">
            <img
              v-if="community.logo"
              :src="community.logo"
              :alt="community.name"
            />
            <div v-else class="community-placeholder">
              <ion-icon :icon="people"></ion-icon>
            </div>
          </ion-avatar>
          <ion-label>
            <h2>{{ community.name }}</h2>
          </ion-label>
          <ion-badge v-if="community.hasNotification" color="danger" slot="end">
            <span style="font-size: 8px;">●</span>
          </ion-badge>
        </ion-item>

        <ion-item button @click="joinCommunity">
          <ion-avatar slot="start">
            <div class="icon-wrapper">
              <ion-icon :icon="gitBranchOutline"></ion-icon>
            </div>
          </ion-avatar>
          <ion-label>
            <h2>Join a community</h2>
          </ion-label>
        </ion-item>

        <ion-item button @click="createCommunity">
          <ion-avatar slot="start">
            <div class="icon-wrapper">
              <ion-icon :icon="addCircleOutline"></ion-icon>
            </div>
          </ion-avatar>
          <ion-label>
            <h2>Create a new community</h2>
          </ion-label>
        </ion-item>

        <ion-item button @click="handleLogout">
          <ion-avatar slot="start">
            <div class="icon-wrapper">
              <ion-icon :icon="logOutOutline"></ion-icon>
            </div>
          </ion-avatar>
          <ion-label>
            <h2>Log out</h2>
          </ion-label>
        </ion-item>
      </ion-list>

      <div v-else class="empty-state">
        <p>No communities yet</p>
        <ion-button fill="outline" @click="joinCommunity">
          Join a community
        </ion-button>
      </div>
    </ion-content>
  </ion-menu>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import { useRouter } from 'vue-router';
import { authService } from '@/services/auth.service';
import { communityService } from '@/services/community.service';
import { useAuthStore } from '@/stores/auth.store';
import { useCommunityStore } from '@/stores/community.store';
import {
  IonMenu,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonList,
  IonItem,
  IonAvatar,
  IonLabel,
  IonBadge,
  IonIcon,
  IonButton,
} from '@ionic/vue';
import { people, gitBranchOutline, addCircleOutline, logOutOutline, globe } from 'ionicons/icons';

interface Community {
  id: number;
  name: string;
  logo?: string;
  hasNotification?: boolean;
}

const router = useRouter();
const authStore = useAuthStore();
const communityStore = useCommunityStore();
const communities = ref<Community[]>([]);
const currentCommunityId = computed(() => communityStore.currentCommunityId);

// Sort communities alphabetically by name
const sortedCommunities = computed(() => {
  return [...communities.value].sort((a, b) => {
    return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
  });
});

async function loadCommunities(forceRefresh: boolean = false) {
  try {
    const userId = authStore.user?.id;
    if (!userId) {
      console.log('[CommunityMenu] No user ID, cannot load communities');
      communities.value = [];
      return;
    }

    console.log('[CommunityMenu] Loading user communities for userId:', userId, forceRefresh ? '(force refresh)' : '');
    const userCommunities = await communityService.getUserCommunities(userId, forceRefresh);
    communities.value = userCommunities;
    // Update the community store
    communityStore.setCommunities(userCommunities);
    console.log('[CommunityMenu] Loaded communities:', userCommunities.length);
  } catch (error) {
    console.error('[CommunityMenu] Failed to load communities:', error);
    communities.value = [];
  }
}

// Watch for user changes and reload communities
watch(() => authStore.user?.id, (newUserId) => {
  if (newUserId) {
    loadCommunities();
  } else {
    communities.value = [];
  }
});

// Listen for community updates (e.g., after joining a new community)
onMounted(() => {
  window.addEventListener('communities-updated', handleCommunitiesUpdated);
});

onUnmounted(() => {
  window.removeEventListener('communities-updated', handleCommunitiesUpdated);
});

function handleCommunitiesUpdated() {
  if (authStore.user?.id) {
    // Retry loading communities with increasing delays to handle backend processing time
    const retryLoad = async (attempt: number = 0) => {
      const delay = attempt === 0 ? 500 : 1000; // First retry after 500ms, then 1s
      setTimeout(async () => {
        const beforeCount = communities.value.length;
        await loadCommunities(true); // Force refresh to bypass cache
        const afterCount = communities.value.length;
        
        // If count didn't increase and we haven't retried too many times, try again
        if (afterCount === beforeCount && attempt < 2) {
          console.log(`[CommunityMenu] Community count unchanged (${afterCount}), retrying... (attempt ${attempt + 1})`);
          retryLoad(attempt + 1);
        } else if (afterCount > beforeCount) {
          console.log(`[CommunityMenu] Successfully refreshed communities: ${beforeCount} -> ${afterCount}`);
        }
      }, delay);
    };
    
    retryLoad();
  }
}

// Refresh communities when menu opens
function handleMenuOpen() {
  if (authStore.user?.id) {
    loadCommunities();
  }
}

function selectGlobal() {
  // Set to null to indicate global/all-communities view
  communityStore.setCurrentCommunity(null);
  console.log('[CommunityMenu] Switched to Global view (all communities)');
  
  // Close menu
  const menu = document.querySelector('ion-menu[menu-id="community-menu"]') as any;
  if (menu) {
    menu.close();
  }
}

function selectCommunity(community: Community) {
  // Update the community store with the selected community
  communityStore.setCurrentCommunity(community);
  console.log('[CommunityMenu] Switched to community:', community.name, community.id);
  
  // Refresh user profile to update community context if needed
  // This might trigger a reload of groups, events, etc. for the new community
  authService.getUserProfile().catch(err => {
    console.warn('[CommunityMenu] Failed to refresh user profile after community switch:', err);
  });
  
  // Close menu
  const menu = document.querySelector('ion-menu[menu-id="community-menu"]') as any;
  if (menu) {
    menu.close();
  }
}

function joinCommunity() {
  router.push('/select-community');
  const menu = document.querySelector('ion-menu[menu-id="community-menu"]') as any;
  if (menu) {
    menu.close();
  }
}

function createCommunity() {
  router.push('/build-community');
  const menu = document.querySelector('ion-menu[menu-id="community-menu"]') as any;
  if (menu) {
    menu.close();
  }
}

async function handleLogout() {
  try {
    await authService.logout();
    router.push('/login');
  } catch (error) {
    console.error('Logout error:', error);
  }
}

onMounted(() => {
  loadCommunities();
});
</script>

<style scoped>
ion-menu {
  --width: 300px;
}

.selected {
  --background: rgba(45, 122, 78, 0.1);
  --color: var(--color-primary);
}

.community-placeholder {
  width: 100%;
  height: 100%;
  background: var(--color-primary);
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
}

.community-placeholder ion-icon {
  color: white;
  font-size: 24px;
}

.icon-wrapper {
  width: 100%;
  height: 100%;
  background: rgba(45, 122, 78, 0.1);
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
}

.icon-wrapper ion-icon {
  color: var(--color-primary);
  font-size: 24px;
}

.global-placeholder {
  width: 100%;
  height: 100%;
  background: linear-gradient(135deg, var(--color-primary) 0%, var(--color-secondary) 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
}

.global-placeholder ion-icon {
  color: white;
  font-size: 24px;
}

.empty-state {
  padding: 32px;
  text-align: center;
}

.empty-state p {
  margin-bottom: 16px;
  color: #64748b;
}
</style>


