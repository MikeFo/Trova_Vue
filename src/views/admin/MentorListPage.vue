<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-button @click="goBack">
            <ion-icon :icon="arrowBack"></ion-icon>
          </ion-button>
        </ion-buttons>
        <ion-title>{{ pageTitle }}</ion-title>
        <ion-buttons slot="end">
          <ion-button @click="loadUsers">
            <ion-icon :icon="refresh"></ion-icon>
          </ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>
    <ion-content :fullscreen="true" class="mentor-list-content">
      <div class="page-container">
      <!-- Loading State -->
      <div v-if="isLoading" class="loading-state">
        <ion-spinner></ion-spinner>
        <p>Loading {{ mentorType === 'can' ? 'mentors' : 'mentees' }}...</p>
      </div>

      <!-- Users List -->
      <div v-else-if="users.length > 0" class="users-list">
        <div class="list-header">
          <h2>{{ pageTitle }}</h2>
          <p class="subtitle">{{ formatNumber(users.length) }} user{{ users.length !== 1 ? 's' : '' }}</p>
          <div class="list-controls">
            <ion-select
              interface="popover"
              label="Sort by"
              label-placement="stacked"
              :value="sortBy"
              @ionChange="sortBy = $event.detail.value"
            >
              <ion-select-option value="name">Name (A–Z)</ion-select-option>
              <ion-select-option value="popular-skill">Most common skill</ion-select-option>
            </ion-select>
          </div>
        </div>

        <ion-list>
          <ion-item
            v-for="user in sortedUsers"
            :key="user.id"
            class="user-item"
          >
            <ion-avatar slot="start" v-if="user.profilePicture">
              <img :src="user.profilePicture" :alt="getUserName(user)" />
            </ion-avatar>
            <ion-icon :icon="mentorType === 'can' ? schoolOutline : bookOutline" slot="start" v-else class="avatar-icon"></ion-icon>
            <ion-label>
              <h2>{{ getUserName(user) }}</h2>
              <p v-if="user.jobTitle || user.currentEmployer">
                {{ [user.jobTitle, user.currentEmployer].filter(Boolean).join(' at ') }}
              </p>
              <div v-if="getUserSkills(user).length" class="skills-row">
                <ion-chip
                  outline
                  v-for="skill in getUserSkills(user)"
                  :key="skill"
                  class="skill-chip"
                >
                  {{ skill }}
                </ion-chip>
              </div>
            </ion-label>
          </ion-item>
        </ion-list>
      </div>

      <!-- Empty State -->
      <div v-else class="empty-state">
        <ion-icon :icon="mentorType === 'can' ? schoolOutline : bookOutline" class="empty-icon"></ion-icon>
        <h2>No {{ mentorType === 'can' ? 'Mentors' : 'Mentees' }} Found</h2>
        <p>No users {{ mentorType === 'can' ? 'who can mentor' : 'who want to be mentored' }} were found.</p>
      </div>
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
  IonChip,
  IonSelect,
  IonSelectOption,
} from '@ionic/vue';
import { arrowBack, refresh, schoolOutline, bookOutline } from 'ionicons/icons';

const router = useRouter();
const route = useRoute();

const isLoading = ref(true);
const users = ref<CommunityMember[]>([]);
const sortBy = ref<'name' | 'popular-skill'>('name');

const communityId = computed(() => {
  const id = route.params.communityId;
  return typeof id === 'string' ? parseInt(id, 10) : Number(id);
});

const mentorType = computed(() => {
  const type = route.params.type;
  return (type === 'can' || type === 'want') ? type : 'can';
});

const pageTitle = computed(() => {
  return mentorType.value === 'can' ? 'Can Mentor' : 'Want Mentor';
});

const sortedUsers = computed(() => {
  const list = [...users.value];

  if (sortBy.value === 'name') {
    return list.sort((a, b) => getUserName(a).localeCompare(getUserName(b)));
  }

  // popular-skill: sort by highest frequency skill among the user's skills, then by name
  const freq = new Map<string, number>();
  list.forEach(user => {
    getUserSkills(user).forEach(skill => {
      freq.set(skill, (freq.get(skill) || 0) + 1);
    });
  });

  const score = (user: CommunityMember) => {
    const skills = getUserSkills(user);
    if (skills.length === 0) return 0;
    return Math.max(...skills.map(s => freq.get(s) || 0));
  };

  return list
    .map(u => ({ user: u, s: score(u) }))
    .sort((a, b) => b.s - a.s || getUserName(a.user).localeCompare(getUserName(b.user)))
    .map(x => x.user);
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

function getUserSkills(user: CommunityMember): string[] {
  const skills = (user as any).skills;
  let list: string[] = [];

  if (Array.isArray(skills)) {
    list = skills;
  } else if (typeof skills === 'string') {
    list = skills.split(',').map(s => s.trim()).filter(Boolean);
  } else if (skills && typeof skills === 'object') {
    list = Object.keys(skills);
  }

  return list
    .map(s => s.trim())
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
}

async function loadUsers() {
  if (!communityId.value) return;
  
  isLoading.value = true;
  try {
    users.value = await adminService.getMentorMenteeUsers(communityId.value, mentorType.value);
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
.mentor-list-content {
  --background: #f5f5f5;
}

.page-container {
  max-width: 1080px;
  margin: 0 auto;
  padding: 16px 16px 32px;
  box-sizing: border-box;
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
  color: var(--color-primary);
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

.skills-row {
  margin-top: 6px;
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.skill-chip {
  --padding-start: 10px;
  --padding-end: 10px;
  --background: #f8fafc;
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
  margin: 0;
  font-size: 14px;
  color: #64748b;
}
</style>
