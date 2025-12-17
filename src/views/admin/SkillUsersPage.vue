<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-button @click="goBack">
            <ion-icon :icon="arrowBack"></ion-icon>
          </ion-button>
        </ion-buttons>
        <ion-title>{{ skillName }}</ion-title>
        <ion-buttons slot="end">
          <ion-button @click="loadUsers">
            <ion-icon :icon="refresh"></ion-icon>
          </ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>
    <ion-content :fullscreen="true" class="skill-users-content">
      <!-- Loading State -->
      <div v-if="isLoading" class="loading-state">
        <ion-spinner></ion-spinner>
        <p>Loading users...</p>
      </div>

      <!-- Users List -->
      <div v-else-if="users.length > 0" class="users-list">
        <div class="list-header">
          <h2>Users with "{{ skillName }}"</h2>
          <p class="subtitle">{{ formatNumber(users.length) }} user{{ users.length !== 1 ? 's' : '' }}</p>
        </div>

        <ion-list>
          <ion-item
            v-for="user in users"
            :key="user.id"
            class="user-item"
          >
            <ion-avatar slot="start" v-if="user.profilePicture">
              <img :src="user.profilePicture" :alt="getUserName(user)" />
            </ion-avatar>
            <ion-icon :icon="personCircleOutline" slot="start" v-else class="avatar-icon"></ion-icon>
            <ion-label>
              <h2>{{ getUserName(user) }}</h2>
              <p v-if="user.jobTitle || user.currentEmployer">
                {{ [user.jobTitle, user.currentEmployer].filter(Boolean).join(' at ') }}
              </p>
            </ion-label>
          </ion-item>
        </ion-list>
      </div>

      <!-- Empty State -->
      <div v-else class="empty-state">
        <ion-icon :icon="peopleOutline" class="empty-icon"></ion-icon>
        <h2>No Users Found</h2>
        <p>No users were found with this skill.</p>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { adminService } from '@/services/admin.service';
import type { CommunityMember } from '@/services/admin.service';
import {
  IonPage,
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
  IonAvatar,
} from '@ionic/vue';
import { arrowBack, refresh, personCircleOutline, peopleOutline } from 'ionicons/icons';

const router = useRouter();
const route = useRoute();

const isLoading = ref(true);
const users = ref<CommunityMember[]>([]);

const communityId = computed(() => {
  const id = route.params.communityId;
  return typeof id === 'string' ? parseInt(id, 10) : Number(id);
});

const skillName = computed(() => {
  const name = route.params.skillName;
  return typeof name === 'string' ? decodeURIComponent(name) : String(name);
});

function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-US').format(value);
}

function getUserName(user: CommunityMember): string {
  if (user.fullName) return user.fullName;
  if (user.fname && user.lname) return `${user.fname} ${user.lname}`;
  if (user.fname) return user.fname;
  return `User ${user.id}`;
}

function goBack() {
  router.back();
}

async function loadUsers() {
  if (!communityId.value || !skillName.value) return;
  
  isLoading.value = true;
  try {
    const fetchedUsers = await adminService.getUsersBySkill(
      communityId.value,
      'general',
      skillName.value,
      true
    );
    users.value = fetchedUsers;
    
    // Log if no users found to help debug
    if (fetchedUsers.length === 0) {
      console.warn(`[SkillUsersPage] No users found for skill "${skillName.value}"`);
      console.warn(`[SkillUsersPage] Backend endpoint /communities/${communityId.value}/skills/users may not be implemented`);
    }
  } catch (error) {
    console.error('Error loading users:', error);
    users.value = [];
  } finally {
    isLoading.value = false;
  }
}

onMounted(() => {
  loadUsers();
});
</script>

<style scoped>
.skill-users-content {
  --background: #f5f5f5;
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
  padding: 24px 16px 16px;
  background: white;
  border-bottom: 1px solid #e5e7eb;
}

.list-header h2 {
  margin: 0 0 4px 0;
  font-size: 20px;
  font-weight: 600;
  color: #1a1a1a;
}

.subtitle {
  margin: 0;
  font-size: 14px;
  color: #64748b;
}

.users-list {
  background: white;
}

.user-item {
  --padding-start: 16px;
  --padding-end: 16px;
  --min-height: 72px;
  border-bottom: 1px solid #e5e7eb;
}

.user-item:last-child {
  border-bottom: none;
}

.avatar-icon {
  font-size: 40px;
  color: #cbd5e1;
  margin-right: 16px;
}

ion-avatar {
  width: 40px;
  height: 40px;
  margin-right: 16px;
}

.user-item ion-label h2 {
  font-size: 16px;
  font-weight: 500;
  color: #1a1a1a;
  margin-bottom: 4px;
}

.user-item ion-label p {
  font-size: 14px;
  color: #64748b;
  margin: 0;
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
  margin: 0 0 8px 0;
  font-size: 14px;
  color: #64748b;
}

.empty-hint {
  margin-top: 8px;
  font-size: 12px;
  color: #94a3b8;
  font-style: italic;
}
</style>
