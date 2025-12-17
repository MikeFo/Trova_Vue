<template>
  <ion-popover
    ref="popoverRef"
    trigger="profile-trigger"
    trigger-action="click"
    side="bottom"
    alignment="end"
    @didPresent="onMenuOpen"
  >
    <ion-content>
      <ion-list lines="none">
        <ion-item button @click="navigateTo('/tabs/profile')">
          <ion-icon :icon="personOutline" slot="start"></ion-icon>
          <ion-label>My Profile</ion-label>
        </ion-item>

        <ion-item button @click="navigateTo('/spotlights')">
          <ion-icon :icon="starOutline" slot="start"></ion-icon>
          <ion-label>Spotlights</ion-label>
        </ion-item>

        <ion-item button @click="navigateTo('/tabs/home/notifications')">
          <ion-icon :icon="notificationsOutline" slot="start"></ion-icon>
          <ion-label>Notifications</ion-label>
        </ion-item>

        <ion-item button @click="navigateTo('/profile/community-links')">
          <ion-icon :icon="linkOutline" slot="start"></ion-icon>
          <ion-label>Community Links</ion-label>
        </ion-item>

        <ion-item v-if="isPropertyManager" button @click="navigateToConsole">
          <ion-icon :icon="settingsOutline" slot="start"></ion-icon>
          <ion-label>Admin Console</ion-label>
        </ion-item>

        <ion-item button @click="handleShare">
          <ion-icon :icon="shareSocialOutline" slot="start"></ion-icon>
          <ion-label>Share</ion-label>
        </ion-item>

        <ion-item button @click="navigateTo('/snoozes')">
          <ion-icon :icon="timeOutline" slot="start"></ion-icon>
          <ion-label>Snoozes</ion-label>
        </ion-item>

        <ion-item button @click="navigateTo('/contact')">
          <ion-icon :icon="mailOutline" slot="start"></ion-icon>
          <ion-label>Suggest a Feature / Contact</ion-label>
        </ion-item>

        <ion-item button @click="showMore = !showMore">
          <ion-icon :icon="ellipsisHorizontalOutline" slot="start"></ion-icon>
          <ion-label>More</ion-label>
          <ion-icon
            :icon="showMore ? chevronUpOutline : chevronDownOutline"
            slot="end"
          ></ion-icon>
        </ion-item>

        <div v-if="showMore" class="more-menu">
          <ion-item button @click="handleLogout">
            <ion-icon :icon="logOutOutline" slot="start"></ion-icon>
            <ion-label>Sign Out</ion-label>
          </ion-item>

          <ion-item button @click="navigateTo('/account-settings')">
            <ion-icon :icon="settingsOutline" slot="start"></ion-icon>
            <ion-label>Account Settings</ion-label>
          </ion-item>

          <ion-item button @click="navigateTo('/safety')">
            <ion-icon :icon="shieldCheckmarkOutline" slot="start"></ion-icon>
            <ion-label>Safety Tips</ion-label>
          </ion-item>

          <ion-item button @click="navigateTo('/terms')">
            <ion-icon :icon="documentTextOutline" slot="start"></ion-icon>
            <ion-label>Terms of Use</ion-label>
          </ion-item>

          <ion-item button @click="navigateTo('/privacy')">
            <ion-icon :icon="lockClosedOutline" slot="start"></ion-icon>
            <ion-label>Privacy Policy</ion-label>
          </ion-item>

          <ion-item button @click="navigateTo('/cookie-policy')">
            <ion-icon :icon="documentOutline" slot="start"></ion-icon>
            <ion-label>Cookie Policy</ion-label>
          </ion-item>
        </div>
      </ion-list>
    </ion-content>
  </ion-popover>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth.store';
import { useCommunityStore } from '@/stores/community.store';
import { authService } from '@/services/auth.service';
import {
  IonPopover,
  IonContent,
  IonList,
  IonItem,
  IonLabel,
  IonIcon,
} from '@ionic/vue';
import {
  personOutline,
  starOutline,
  notificationsOutline,
  linkOutline,
  settingsOutline,
  shareSocialOutline,
  timeOutline,
  mailOutline,
  ellipsisHorizontalOutline,
  chevronDownOutline,
  chevronUpOutline,
  logOutOutline,
  shieldCheckmarkOutline,
  documentTextOutline,
  lockClosedOutline,
  documentOutline,
} from 'ionicons/icons';

const router = useRouter();
const authStore = useAuthStore();
const communityStore = useCommunityStore();
const popoverRef = ref<any>(null);
const showMore = ref(false);
const isPropertyManager = ref(false);

const currentCommunityId = computed(() => {
  return communityStore.currentCommunityId;
});

// Quick check: is user the leader? (synchronous, no API call needed)
const isLeader = computed(() => {
  if (!authStore.user?.id || !communityStore.currentCommunity) {
    return false;
  }
  return communityStore.currentCommunity.leaderId === authStore.user.id;
});

async function checkManagerStatus() {
  // Quick synchronous check first
  if (isLeader.value) {
    isPropertyManager.value = true;
    return;
  }

  if (!authStore.user?.id || !currentCommunityId.value) {
    isPropertyManager.value = false;
    return;
  }

  // Otherwise, check communities_managers table via API (non-blocking)
  try {
    const { adminService } = await import('@/services/admin.service');
    const community = communityStore.currentCommunity;
    const isManager = await adminService.isManager(
      currentCommunityId.value,
      authStore.user.id,
      community || undefined
    );
    isPropertyManager.value = isManager;
  } catch (error) {
    // Silently fail - don't log errors that might spam console
    // Fall back to leader check if API fails
    isPropertyManager.value = isLeader.value;
  }
}

function navigateTo(path: string) {
  router.push(path);
  popoverRef.value?.$el?.dismiss();
}

function navigateToConsole() {
  if (currentCommunityId.value) {
    router.push(`/communities/${currentCommunityId.value}/console`);
  }
  popoverRef.value?.$el?.dismiss();
}

function handleShare() {
  // TODO: Implement share functionality
  console.log('Share clicked');
  popoverRef.value?.$el?.dismiss();
}

function onMenuOpen() {
  // Check manager status when menu opens (non-blocking)
  checkManagerStatus().catch(() => {
    // Silently fail if check fails
  });
}

async function handleLogout() {
  try {
    await authService.logout();
    router.push('/login');
  } catch (error) {
    console.error('Logout error:', error);
  }
}

// Watch for community changes and re-check manager status
watch(() => communityStore.currentCommunityId, () => {
  checkManagerStatus();
});

// Watch for community object changes (in case leaderId changes)
watch(() => communityStore.currentCommunity, (newCommunity) => {
  if (newCommunity) {
    checkManagerStatus();
  }
});

onMounted(() => {
  checkManagerStatus();
});
</script>

<style scoped>
ion-popover {
  --width: 280px;
}

.more-menu {
  background: #f8fafc;
  padding: 8px 0;
}

ion-item {
  --padding-start: 16px;
  --padding-end: 16px;
  --min-height: 48px;
}

ion-icon {
  font-size: 20px;
  color: #64748b;
}
</style>

