<template>
  <ion-page>
    <!-- Community Menu (left side) -->
    <CommunityMenu />
    
    <!-- Desktop: Top navigation with logo and profile -->
    <ion-header v-if="!isMobile" class="desktop-header">
      <ion-toolbar class="desktop-toolbar">
        <div class="header-content">
          <!-- Logo on the left - opens community menu -->
          <ion-menu-toggle menu="community-menu">
            <div class="logo-wrapper">
              <div class="trova-logo">
                <img
                  v-if="communityLogo"
                  :src="communityLogo"
                  :alt="communityName"
                  class="community-logo-img"
                />
                <span v-else class="logo-letter">{{ communityName.charAt(0).toUpperCase() }}</span>
              </div>
            </div>
          </ion-menu-toggle>

          <div class="tab-buttons-container">
            <button 
              type="button"
              class="tab-button" 
              :class="{ active: isActiveTab('home') }"
              @click.prevent="navigateTo('/tabs/home')"
            >
              <ion-icon :icon="home" />
              <span>Home</span>
            </button>

            <button 
              type="button"
              class="tab-button" 
              :class="{ active: isActiveTab('groups') }"
              @click.prevent="navigateTo('/tabs/groups')"
            >
              <ion-icon :icon="gridOutline" />
              <span>Groups</span>
            </button>

            <button 
              type="button"
              class="tab-button" 
              :class="{ active: isActiveTab('discover') }"
              @click.prevent="navigateTo('/tabs/discover')"
            >
              <ion-icon :icon="search" />
              <span>Discover</span>
            </button>

            <button 
              type="button"
              class="tab-button" 
              :class="{ active: isActiveTab('map') }"
              @click.prevent="navigateTo('/tabs/map')"
            >
              <ion-icon :icon="mapOutline" />
              <span>Map</span>
            </button>

            <button 
              type="button"
              class="tab-button" 
              :class="{ active: isActiveTab('events') }"
              @click.prevent="navigateTo('/tabs/events')"
            >
              <ion-icon :icon="calendarOutline" />
              <span>Events</span>
            </button>

            <button 
              type="button"
              class="tab-button" 
              :class="{ active: isActiveTab('org-chart') }"
              @click.prevent="navigateTo('/tabs/org-chart')"
            >
              <ion-icon :icon="business" />
              <span>Org Chart</span>
            </button>

            <button 
              type="button"
              class="tab-button" 
              :class="{ active: isActiveTab('messages') }"
              @click.prevent="navigateTo('/tabs/messages')"
            >
              <ion-icon :icon="chatbubbles" />
              <span>Messages</span>
            </button>
          </div>
          
          <!-- Profile picture on the right - opens settings menu -->
          <div class="profile-wrapper" id="profile-trigger">
            <img
              v-if="user?.profilePicture"
              :src="user.profilePicture"
              :alt="user.fullName || 'Profile'"
              class="profile-picture"
            />
            <div v-else class="profile-placeholder">
              <ion-icon :icon="person"></ion-icon>
            </div>
          </div>
        </div>
      </ion-toolbar>
    </ion-header>

    <!-- Profile Menu (right side) - opens from profile icon -->
    <ProfileMenu />

    <!-- Photo Upload Modal -->
    <PhotoUploadModal
      :is-open="isPhotoUploadOpen"
      @update:is-open="isPhotoUploadOpen = $event"
      @photo-updated="handlePhotoUpdated"
    />

    <ion-tabs id="main-content">
      <ion-router-outlet></ion-router-outlet>
      
      <!-- Mobile: Bottom navigation -->
      <ion-tab-bar 
        v-if="isMobile"
        slot="bottom" 
        class="custom-tab-bar tab-bar-mobile"
      >
        <ion-tab-button tab="home" href="/tabs/home">
          <ion-icon :icon="home" />
          <ion-label>Home</ion-label>
        </ion-tab-button>

        <ion-tab-button tab="groups" href="/tabs/groups">
          <ion-icon :icon="gridOutline" />
          <ion-label>Groups</ion-label>
        </ion-tab-button>

        <ion-tab-button tab="discover" href="/tabs/discover">
          <ion-icon :icon="search" />
          <ion-label>Discover</ion-label>
        </ion-tab-button>

        <ion-tab-button tab="map" href="/tabs/map">
          <ion-icon :icon="mapOutline" />
          <ion-label>Map</ion-label>
        </ion-tab-button>

        <ion-tab-button tab="events" href="/tabs/events">
          <ion-icon :icon="calendarOutline" />
          <ion-label>Events</ion-label>
        </ion-tab-button>

        <ion-tab-button tab="org-chart" href="/tabs/org-chart">
          <ion-icon :icon="business" />
          <ion-label>Org Chart</ion-label>
        </ion-tab-button>

        <ion-tab-button tab="messages" href="/tabs/messages">
          <ion-icon :icon="chatbubbles" />
          <ion-label>Messages</ion-label>
        </ion-tab-button>
      </ion-tab-bar>
    </ion-tabs>
  </ion-page>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useAuthStore } from '@/stores/auth.store';
import { useCommunityStore } from '@/stores/community.store';
import CommunityMenu from '@/components/CommunityMenu.vue';
import ProfileMenu from '@/components/ProfileMenu.vue';
import PhotoUploadModal from '@/components/PhotoUploadModal.vue';
import { IonTabBar, IonTabButton, IonTabs, IonLabel, IonIcon, IonPage, IonRouterOutlet, IonHeader, IonToolbar, IonMenuToggle } from '@ionic/vue';
import { home, chatbubbles, search, people, person, gridOutline, calendarOutline, mapOutline, business } from 'ionicons/icons';

const router = useRouter();
const route = useRoute();
const authStore = useAuthStore();
const communityStore = useCommunityStore();
const isMobile = ref(false);
const isPhotoUploadOpen = ref(false);

const user = computed(() => authStore.user);
const currentCommunity = computed(() => communityStore.currentCommunity);
const communityLogo = computed(() => communityStore.currentCommunityLogo);
const communityName = computed(() => communityStore.currentCommunityName);

// Note: Photo upload is now accessible from ProfilePage, not from header profile icon
// The header profile icon now opens the ProfileMenu (settings menu)

function checkIsMobile() {
  // Check if device is mobile based on user agent and screen width
  const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera;
  const isMobileUserAgent = /Android|webOS|iPhone|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);
  const isMobileWidth = window.innerWidth < 768;
  
  isMobile.value = isMobileUserAgent || isMobileWidth;
}

function navigateToHome() {
  router.push('/tabs/home');
}

function navigateTo(path: string) {
  console.log('[TabsPage] Navigating to:', path);
  try {
    router.push(path);
  } catch (error) {
    console.error('[TabsPage] Navigation error:', error);
  }
}

function isActiveTab(tab: string): boolean {
  const currentPath = route.path;
  if (tab === 'home') {
    return currentPath === '/tabs/home' || currentPath === '/tabs';
  }
  if (tab === 'groups') {
    return currentPath === '/tabs/groups' || currentPath.includes('/groups/');
  }
  if (tab === 'events') {
    return currentPath === '/tabs/events' || currentPath.includes('/events/');
  }
  if (tab === 'map') {
    return currentPath === '/tabs/map';
  }
  if (tab === 'org-chart') {
    return currentPath === '/tabs/org-chart';
  }
  return currentPath === `/tabs/${tab}`;
}

function openPhotoUpload() {
  isPhotoUploadOpen.value = true;
}

function handlePhotoUpdated(photoUrl: string) {
  // Photo is already updated in auth store by the modal
  // This is just for any additional handling if needed
  console.log('Profile photo updated:', photoUrl);
}

onMounted(() => {
  checkIsMobile();
  window.addEventListener('resize', checkIsMobile);
});

onUnmounted(() => {
  window.removeEventListener('resize', checkIsMobile);
});
</script>

<style scoped>
/* Desktop Header */
.desktop-header {
  position: sticky;
  top: 0;
  z-index: 100;
}

.desktop-toolbar {
  --background: #ffffff;
  --border-width: 0;
  --padding-top: 0;
  --padding-bottom: 0;
  --min-height: 64px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
  border-bottom: 1px solid #e5e7eb;
}

.header-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
  max-width: 1400px;
  margin: 0 auto;
  width: 100%;
  padding: 0 24px;
  height: 64px;
}

.tab-buttons-container {
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 1;
  gap: 8px;
  position: relative;
  z-index: 1;
}

.tab-button {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 8px 16px;
  min-width: 100px;
  max-width: 160px;
  flex: 1;
  background: transparent;
  border: none;
  cursor: pointer;
  color: #6b7280;
  font-size: 12px;
  font-weight: 500;
  transition: all 0.2s ease;
  border-radius: 8px;
  position: relative;
  z-index: 1;
  -webkit-tap-highlight-color: transparent;
}

.tab-button:hover {
  background: rgba(45, 122, 78, 0.05);
  color: #2d7a4e;
}

.tab-button.active {
  color: #2d7a4e;
  font-weight: 600;
}

.tab-button ion-icon {
  font-size: 24px;
  margin-bottom: 2px;
}

.tab-button span {
  font-size: 12px;
  line-height: 1.2;
}

.logo-wrapper {
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  padding: 8px;
  margin-right: 24px;
  transition: transform 0.2s ease;
  flex-shrink: 0;
  position: relative;
  z-index: 1;
  -webkit-tap-highlight-color: transparent;
}

.logo-wrapper:hover {
  transform: scale(1.05);
}

.logo-wrapper:active {
  transform: scale(0.95);
}

.profile-wrapper {
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  padding: 4px;
  margin-left: 24px;
  transition: transform 0.2s ease;
  flex-shrink: 0;
}

.profile-wrapper:hover {
  transform: scale(1.05);
}

.profile-wrapper:active {
  transform: scale(0.95);
}

.profile-picture {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  object-fit: cover;
  border: 2px solid #e5e7eb;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.profile-placeholder {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--color-primary) 0%, var(--color-secondary) 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  border: 2px solid #e5e7eb;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.profile-placeholder ion-icon {
  font-size: 24px;
  color: #ffffff;
}

.trova-logo {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: var(--color-primary);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 8px rgba(45, 122, 78, 0.3);
}

.logo-letter {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  font-size: 24px;
  font-weight: 700;
  color: #ffffff;
  line-height: 1;
}

.community-logo-img {
  width: 100%;
  height: 100%;
  border-radius: 50%;
  object-fit: cover;
}

/* Mobile: Bottom navigation */
.tab-bar-mobile {
  --background: #ffffff;
  --border: 1px solid #e5e7eb;
  box-shadow: 0 -2px 8px rgba(0, 0, 0, 0.05);
  border-top: 1px solid #e5e7eb;
  border-bottom: none;
}

.tab-bar-mobile ion-tab-button {
  --color: #6b7280;
  --color-selected: #2d7a4e;
}
</style>
