<template>
  <ion-modal 
    :is-open="isOpen" 
    @didDismiss="handleDismiss"
    @willDismiss="handleDismiss"
    :backdrop-dismiss="true"
    id="mentor-list-modal"
  >
    <ion-header>
      <ion-toolbar>
        <ion-title>{{ pageTitle }}</ion-title>
        <ion-buttons slot="end">
          <ion-button fill="clear" @click="handleDismiss">
            <ion-icon :icon="close"></ion-icon>
          </ion-button>
        </ion-buttons>
        <ion-buttons slot="end">
          <ion-button fill="clear" @click="loadUsers">
            <ion-icon :icon="refresh"></ion-icon>
          </ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>
    <ion-content :fullscreen="true" class="mentor-list-content">
      <!-- Loading State -->
      <div v-if="isLoading" class="loading-state">
        <ion-spinner></ion-spinner>
        <p>Loading {{ props.mentorType === 'can' ? 'mentors' : 'mentees' }}...</p>
      </div>

      <!-- Users List -->
      <div v-else-if="users.length > 0 || expectedCount > 0" class="users-list">
        <div class="list-header">
          <h2>{{ pageTitle }}</h2>
          <p class="subtitle">
            <span v-if="expectedCount > 0">{{ formatNumber(expectedCount) }} user{{ expectedCount !== 1 ? 's' : '' }}</span>
            <span v-else>{{ formatNumber(filteredUsers.length) }} user{{ filteredUsers.length !== 1 ? 's' : '' }}</span>
            <span v-if="searchQuery && filteredUsers.length !== expectedCount"> ({{ formatNumber(filteredUsers.length) }} shown)</span>
            <span v-else-if="expectedCount > 0 && filteredUsers.length < expectedCount" class="count-warning"> ({{ formatNumber(filteredUsers.length) }} with profile data)</span>
          </p>
        </div>

        <!-- Search Bar -->
        <div class="search-container">
          <ion-searchbar
            v-model="searchQuery"
            placeholder="Search by name, job title, or skills..."
            :debounce="300"
            class="user-searchbar"
          ></ion-searchbar>
        </div>

        <!-- No Results Message -->
        <div v-if="searchQuery && filteredUsers.length === 0" class="no-results">
          <p>No users found matching "{{ searchQuery }}"</p>
        </div>

        <ion-list v-else>
          <ion-item
            v-for="user in filteredUsers"
            :key="user.id"
            class="user-item"
          >
            <ion-avatar slot="start" v-if="user.profilePicture">
              <img :src="user.profilePicture" :alt="getUserName(user)" />
            </ion-avatar>
            <ion-icon :icon="props.mentorType === 'can' ? schoolOutline : bookOutline" slot="start" v-else class="avatar-icon"></ion-icon>
            <ion-label>
              <h2>{{ getUserName(user) }}</h2>
              <p v-if="user.jobTitle || user.currentEmployer">
                {{ [user.jobTitle, user.currentEmployer].filter(Boolean).join(' at ') }}
              </p>
              <div v-if="getUserSkills(user).length > 0" class="user-skills">
                <ion-chip
                  v-for="skill in getUserSkills(user)"
                  :key="skill"
                  size="small"
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
        <ion-icon :icon="props.mentorType === 'can' ? schoolOutline : bookOutline" class="empty-icon"></ion-icon>
        <h2>No {{ props.mentorType === 'can' ? 'Mentors' : 'Mentees' }} Found</h2>
        <p v-if="expectedCount > 0">
          The backend reports {{ expectedCount }} {{ props.mentorType === 'can' ? 'mentor' : 'mentee' }}{{ expectedCount !== 1 ? 's' : '' }}, 
          but no profile data is available to display them.
        </p>
        <p v-else>
          No users {{ props.mentorType === 'can' ? 'who can mentor' : 'who want to be mentored' }} were found.
        </p>
      </div>
    </ion-content>
  </ion-modal>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue';
import { adminService } from '@/services/admin.service';
import type { CommunityMember } from '@/services/admin.service';
import {
  IonModal,
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
  IonSearchbar,
} from '@ionic/vue';
import { close, refresh, schoolOutline, bookOutline } from 'ionicons/icons';

interface Props {
  isOpen: boolean;
  communityId: number;
  mentorType: 'can' | 'want';
}

const props = defineProps<Props>();

const emit = defineEmits<{
  didDismiss: [];
}>();

const isLoading = ref(true);
const users = ref<CommunityMember[]>([]);
const searchQuery = ref('');
const expectedCount = ref(0);

const pageTitle = computed(() => {
  return props.mentorType === 'can' ? 'Can Mentor' : 'Want Mentor';
});

const filteredUsers = computed(() => {
  if (!searchQuery.value.trim()) {
    return users.value;
  }
  
  const query = searchQuery.value.toLowerCase().trim();
  
  return users.value.filter(user => {
    const name = getUserName(user).toLowerCase();
    const jobTitle = (user.jobTitle || '').toLowerCase();
    const employer = (user.currentEmployer || '').toLowerCase();
    const skills = getUserSkills(user);
    const skillsText = skills.join(' ').toLowerCase();
    
    return name.includes(query) ||
           jobTitle.includes(query) ||
           employer.includes(query) ||
           skillsText.includes(query);
  });
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

function getUserSkills(user: CommunityMember): string[] {
  // Get skills from mentorSkills or menteeSkills based on the type
  const skills = props.mentorType === 'can' 
    ? (user as any).mentorSkills 
    : (user as any).menteeSkills;
  
  return Array.isArray(skills) ? skills : [];
}

function handleDismiss() {
  emit('didDismiss');
}

async function loadUsers() {
  if (!props.communityId) return;
  
  isLoading.value = true;
  try {
    // Fetch both the users list and the expected count from backend stats
    const [usersList, stats] = await Promise.all([
      adminService.getMentorMenteeUsers(props.communityId, props.mentorType),
      adminService.getMentorMenteeStats(props.communityId).catch(() => null)
    ]);
    
    users.value = usersList;
    
    // Get the expected count from backend stats
    if (stats) {
      expectedCount.value = props.mentorType === 'can' 
        ? (stats.usersCanMentor || 0)
        : (stats.usersWantMentor || 0);
    } else {
      // If stats fetch failed, use the users list length as fallback
      expectedCount.value = usersList.length;
    }
  } catch (error) {
    console.error('Error loading users:', error);
    users.value = [];
    expectedCount.value = 0;
  } finally {
    isLoading.value = false;
  }
}

// Watch for modal opening, mentorType, and communityId changes
watch(() => props.isOpen, (newValue) => {
  if (newValue) {
    searchQuery.value = ''; // Clear search when modal opens
    loadUsers();
  }
});

watch(() => props.mentorType, () => {
  if (props.isOpen) {
    loadUsers();
  }
});

watch(() => props.communityId, () => {
  if (props.isOpen) {
    loadUsers();
  }
});

onMounted(() => {
  if (props.isOpen) {
    loadUsers();
  }
});
</script>

<style scoped>
:deep(#mentor-list-modal) {
  --width: 90%;
  --max-width: 600px;
  --height: 80%;
  --border-radius: 16px;
}

.mentor-list-content {
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

.count-warning {
  color: #f59e0b;
  font-weight: 500;
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

.user-skills {
  margin-top: 8px;
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.skill-chip {
  --background: #e0f2fe;
  --color: #0369a1;
  font-size: 12px;
  height: 24px;
  margin: 0;
}

.search-container {
  padding: 12px 16px;
  background: white;
  border-bottom: 1px solid #e5e7eb;
}

.user-searchbar {
  --box-shadow: none;
  --border-radius: 8px;
  --background: #f5f5f5;
  padding: 0;
}

.no-results {
  padding: 32px 16px;
  text-align: center;
  color: #64748b;
  font-size: 14px;
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
