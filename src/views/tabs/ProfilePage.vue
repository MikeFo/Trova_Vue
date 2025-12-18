<template>
  <ion-page>
    <ion-content :fullscreen="true" class="profile-content">
      <div class="profile-container">
        <!-- Profile Header Card -->
        <div class="profile-header-card">
          <div class="avatar-wrapper">
            <img
              v-if="displayUser?.profilePicture"
              :src="displayUser.profilePicture"
              :alt="displayUser?.fullName || 'User'"
              class="profile-avatar"
            />
            <div v-else class="avatar-placeholder">
              <ion-icon :icon="person"></ion-icon>
            </div>
            <div 
              v-if="isViewingOwnProfile" 
              class="avatar-edit-overlay" 
              @click="openPhotoUpload"
            >
              <ion-icon :icon="createOutline"></ion-icon>
            </div>
          </div>
          <h2 class="profile-name">{{ displayUser?.fullName || displayUser?.fname || 'User' }}</h2>
          <p class="profile-email">{{ displayUser?.email || '' }}</p>
        </div>

        <!-- Photo Upload Modal -->
        <PhotoUploadModal
          v-if="isViewingOwnProfile"
          :is-open="isPhotoUploadOpen"
          @update:is-open="isPhotoUploadOpen = $event"
          @photo-updated="handlePhotoUpdated"
        />

        <!-- Profile Menu -->
        <div v-if="isViewingOwnProfile" class="profile-menu-section">
          <div class="menu-card">
            <ion-item 
              button 
              lines="none" 
              class="menu-item"
              @click="navigateTo('/setup')"
            >
              <div class="menu-icon-wrapper" slot="start">
                <ion-icon :icon="createOutline" class="menu-icon"></ion-icon>
              </div>
              <ion-label>
                <h3 class="menu-title">Edit Profile</h3>
                <p class="menu-subtitle">Update your information</p>
              </ion-label>
              <ion-icon :icon="chevronForwardOutline" slot="end" class="menu-arrow"></ion-icon>
            </ion-item>

            <ion-item 
              button 
              lines="none" 
              class="menu-item"
              @click="navigateTo('/tabs/communities')"
            >
              <div class="menu-icon-wrapper" slot="start">
                <ion-icon :icon="peopleOutline" class="menu-icon"></ion-icon>
              </div>
              <ion-label>
                <h3 class="menu-title">My Communities</h3>
                <p class="menu-subtitle">View your communities</p>
              </ion-label>
              <ion-icon :icon="chevronForwardOutline" slot="end" class="menu-arrow"></ion-icon>
            </ion-item>

            <ion-item 
              button 
              lines="none" 
              class="menu-item"
            >
              <div class="menu-icon-wrapper" slot="start">
                <ion-icon :icon="notificationsOutline" class="menu-icon"></ion-icon>
              </div>
              <ion-label>
                <h3 class="menu-title">Notifications</h3>
                <p class="menu-subtitle">Manage your notifications</p>
              </ion-label>
              <ion-icon :icon="chevronForwardOutline" slot="end" class="menu-arrow"></ion-icon>
            </ion-item>

            <ion-item 
              button 
              lines="none" 
              class="menu-item"
              @click="navigateTo('/settings')"
            >
              <div class="menu-icon-wrapper" slot="start">
                <ion-icon :icon="settingsOutline" class="menu-icon"></ion-icon>
              </div>
              <ion-label>
                <h3 class="menu-title">Settings</h3>
                <p class="menu-subtitle">App preferences</p>
              </ion-label>
              <ion-icon :icon="chevronForwardOutline" slot="end" class="menu-arrow"></ion-icon>
            </ion-item>
          </div>

          <div class="menu-card logout-card">
            <ion-item 
              button 
              lines="none" 
              class="menu-item logout-item"
              @click="handleLogout"
            >
              <div class="menu-icon-wrapper logout-icon-wrapper" slot="start">
                <ion-icon :icon="logOutOutline" class="menu-icon logout-icon"></ion-icon>
              </div>
              <ion-label>
                <h3 class="menu-title logout-title">Logout</h3>
              </ion-label>
            </ion-item>
          </div>
        </div>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { authService } from '@/services/auth.service';
import { useAuthStore } from '@/stores/auth.store';
import { apiService } from '@/services/api.service';
import type { User } from '@/stores/auth.store';
import PhotoUploadModal from '@/components/PhotoUploadModal.vue';
import {
  person,
  createOutline,
  peopleOutline,
  notificationsOutline,
  settingsOutline,
  logOutOutline,
  chevronForwardOutline,
} from 'ionicons/icons';
import {
  IonPage,
  IonContent,
  IonItem,
  IonLabel,
  IonIcon,
} from '@ionic/vue';

const router = useRouter();
const route = useRoute();
const authStore = useAuthStore();

const viewedUser = ref<User | null>(null);
const isViewingOwnProfile = computed(() => {
  const paramId = route.params.id ? Number(route.params.id) : null;
  if (!paramId) return true;
  return authStore.user?.id === paramId;
});
const displayUser = computed(() => (isViewingOwnProfile.value ? authStore.user : viewedUser.value));
const isPhotoUploadOpen = ref(false);

function navigateTo(path: string) {
  router.push(path);
}

function openPhotoUpload() {
  isPhotoUploadOpen.value = true;
}

function handlePhotoUpdated(photoUrl: string) {
  // Photo is already updated in auth store by the modal
  // This is just for any additional handling if needed
  console.log('Profile photo updated:', photoUrl);
}

async function loadViewedUser() {
  const paramId = route.params.id ? Number(route.params.id) : null;
  if (!paramId || isViewingOwnProfile.value) {
    viewedUser.value = null;
    return;
  }

  try {
    const userData = await apiService.get<User>(`/users/${paramId}`);
    viewedUser.value = userData;
  } catch (error) {
    console.error('Failed to load selected user profile', error);
  }
}

onMounted(loadViewedUser);
watch(() => route.params.id, loadViewedUser);

async function handleLogout() {
  try {
    await authService.logout();
    router.push('/login');
  } catch (error) {
    console.error('Logout error:', error);
  }
}
</script>

<style scoped>
.profile-content {
  --background: #f8fafc;
}

.profile-container {
  padding: 16px;
  max-width: 100%;
  margin: 0 auto;
}

/* Profile Header Card */
.profile-header-card {
  text-align: center;
  padding: 32px 24px;
  background: linear-gradient(135deg, rgba(45, 122, 78, 0.05) 0%, rgba(29, 185, 138, 0.05) 100%);
  border-radius: 20px;
  margin-bottom: 24px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.06);
  border: 1px solid rgba(45, 122, 78, 0.1);
}

.avatar-wrapper {
  position: relative;
  display: inline-block;
  margin-bottom: 20px;
}

.profile-avatar {
  width: 120px;
  height: 120px;
  border-radius: 50%;
  object-fit: cover;
  border: 4px solid #ffffff;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
}

.avatar-placeholder {
  width: 120px;
  height: 120px;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--color-primary) 0%, var(--color-secondary) 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  box-shadow: 0 4px 16px rgba(45, 122, 78, 0.3);
}

.avatar-placeholder ion-icon {
  font-size: 56px;
}

.avatar-edit-overlay {
  position: absolute;
  bottom: 0;
  right: 0;
  width: 36px;
  height: 36px;
  background: var(--color-primary);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  box-shadow: 0 2px 8px rgba(45, 122, 78, 0.4);
  cursor: pointer;
  transition: all 0.2s ease;
  border: 3px solid #ffffff;
}

.avatar-edit-overlay:hover {
  transform: scale(1.1);
  box-shadow: 0 4px 12px rgba(45, 122, 78, 0.5);
}

.avatar-edit-overlay ion-icon {
  font-size: 18px;
}

.profile-name {
  font-size: 26px;
  font-weight: 700;
  color: #1a1a1a;
  margin: 0 0 8px 0;
  letter-spacing: -0.5px;
}

.profile-email {
  font-size: 15px;
  color: #64748b;
  margin: 0;
  font-weight: 500;
}

/* Profile Menu */
.profile-menu-section {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.menu-card {
  background: #ffffff;
  border-radius: 16px;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
  border: 1px solid rgba(0, 0, 0, 0.05);
}

.menu-item {
  --padding-start: 20px;
  --inner-padding-end: 20px;
  --padding-top: 16px;
  --padding-bottom: 16px;
  --min-height: 72px;
  transition: background-color 0.2s ease;
}

.menu-item:hover {
  --background: #f8fafc;
}

.menu-item:active {
  --background: #f1f5f9;
}

.menu-icon-wrapper {
  width: 44px;
  height: 44px;
  border-radius: 12px;
  background: transparent;
  border: 2px solid var(--color-primary);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 16px;
}

.menu-icon {
  font-size: 22px;
  color: var(--color-primary);
}

.menu-title {
  font-size: 16px;
  font-weight: 600;
  color: #1a1a1a;
  margin: 0;
  letter-spacing: -0.2px;
}

.menu-subtitle {
  font-size: 14px;
  color: #64748b;
  margin: 4px 0 0 0;
  font-weight: 400;
}

.menu-arrow {
  font-size: 20px;
  color: #cbd5e1;
  margin-left: 8px;
}

.logout-card {
  border: 1px solid rgba(239, 68, 68, 0.2);
}

.logout-item {
  --background: transparent;
}

.logout-item:hover {
  --background: rgba(239, 68, 68, 0.05);
}

.logout-icon-wrapper {
  background: transparent;
  border: 2px solid #ef4444;
}

.logout-icon {
  color: #ef4444;
}

.logout-title {
  color: #ef4444;
}

/* Responsive: Desktop */
@media (min-width: 768px) {
  .profile-container {
    max-width: 700px;
    padding: 24px;
  }

  .profile-header-card {
    padding: 48px 32px;
  }

  .profile-avatar,
  .avatar-placeholder {
    width: 140px;
    height: 140px;
  }

  .avatar-placeholder ion-icon {
    font-size: 64px;
  }

  .avatar-edit-overlay {
    width: 40px;
    height: 40px;
  }

  .avatar-edit-overlay ion-icon {
    font-size: 20px;
  }

  .profile-name {
    font-size: 32px;
  }

  .profile-email {
    font-size: 16px;
  }

  .header-title {
    font-size: 28px;
  }

  .menu-item {
    --padding-start: 24px;
    --inner-padding-end: 24px;
    --padding-top: 20px;
    --padding-bottom: 20px;
  }

  .menu-icon-wrapper {
    width: 48px;
    height: 48px;
    border-width: 2.5px;
  }

  .menu-icon {
    font-size: 24px;
  }

  .menu-title {
    font-size: 17px;
  }

  .menu-subtitle {
    font-size: 15px;
  }
}

@media (min-width: 1024px) {
  .profile-container {
    max-width: 800px;
    padding: 32px;
  }

  .profile-header-card {
    padding: 56px 40px;
  }
}
</style>

