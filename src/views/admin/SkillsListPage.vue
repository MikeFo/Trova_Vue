<template>
  <ion-modal 
    :is-open="isOpen" 
    @didDismiss="handleDismiss"
    @willDismiss="handleDismiss"
    :backdrop-dismiss="true"
    id="skills-list-modal"
  >
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start" v-if="selectedSkillName">
          <ion-button fill="clear" @click="goBackToList">
            <ion-icon :icon="arrowBack"></ion-icon>
          </ion-button>
        </ion-buttons>
        <ion-title>{{ selectedSkillName ? selectedSkillName : 'Skills' }}</ion-title>
        <ion-buttons slot="end">
          <ion-button fill="clear" @click="handleDismiss">
            <ion-icon :icon="close"></ion-icon>
          </ion-button>
        </ion-buttons>
        <ion-buttons slot="end">
          <ion-button fill="clear" @click="selectedSkillName ? loadUsers() : loadSkills()">
            <ion-icon :icon="refresh"></ion-icon>
          </ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>
    <ion-content :fullscreen="true" class="skills-content">
      <!-- Detail View (Users) -->
      <div v-if="selectedSkillName">
        <!-- Loading State -->
        <div v-if="isUsersLoading" class="loading-state">
          <ion-spinner></ion-spinner>
          <p>Loading users...</p>
        </div>

        <!-- Users List -->
        <div v-else-if="users.length > 0" class="users-list">
          <div class="list-header">
            <h2>Users with "{{ selectedSkillName }}"</h2>
            <p class="subtitle">{{ formatNumber(filteredUsers.length) }} user{{ filteredUsers.length !== 1 ? 's' : '' }}{{ searchQuery ? ` (filtered from ${users.length})` : '' }}</p>
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
              <ion-icon :icon="personCircleOutline" slot="start" v-else class="avatar-icon"></ion-icon>
              <ion-label>
                <h2>{{ getUserName(user) }}</h2>
                <p v-if="user.jobTitle || user.currentEmployer">
                  {{ [user.jobTitle, user.currentEmployer].filter(Boolean).join(' at ') }}
                </p>
                <!-- Show skills for "Other" category -->
                <p v-if="selectedSkillName?.toLowerCase() === 'other' && (user.skillsDisplay || user.skills)" class="user-skills">
                  <span class="skills-label">Skills:</span> {{ user.skillsDisplay || (Array.isArray(user.skills) ? user.skills.join(', ') : user.skills) }}
                </p>
              </ion-label>
            </ion-item>
          </ion-list>
        </div>

        <!-- Empty State / Backend Not Available -->
        <div v-else class="empty-state">
          <ion-icon :icon="peopleOutline" class="empty-icon"></ion-icon>
          <h2>User List Unavailable</h2>
          <p v-if="expectedUserCount > 0">
            Expected {{ formatNumber(expectedUserCount) }} user{{ expectedUserCount !== 1 ? 's' : '' }} with this skill, but the backend endpoint is not yet implemented.
          </p>
          <p v-else>
            The backend endpoint for retrieving users by skill is not yet implemented.
          </p>
          <p class="empty-hint">
            This feature requires backend support to display the user list.
          </p>
        </div>
      </div>

      <!-- List View (Skills) -->
      <div v-else>
        <!-- Loading State -->
        <div v-if="isLoading" class="loading-state">
          <ion-spinner></ion-spinner>
          <p>Loading skills...</p>
        </div>

        <!-- Skills List -->
        <div v-else-if="skills.length > 0" class="skills-list">
          <div class="list-header">
            <h2>All Skills</h2>
            <p class="subtitle">Click on a skill to view users who have it</p>
          </div>

          <ion-list>
            <ion-item
              v-for="skill in skills"
              :key="skill.name"
              button
              @click="navigateToSkillUsers(skill.name)"
              class="skill-item"
            >
              <ion-icon :icon="libraryOutline" slot="start" class="skill-icon"></ion-icon>
              <ion-label>
                <h2>{{ skill.name }}</h2>
                <p>
                  <span class="stat-label">Users:</span>
                  <span class="stat-value">{{ formatNumber(skill.value || 0) }}</span>
                </p>
              </ion-label>
              <ion-icon :icon="chevronForward" slot="end"></ion-icon>
            </ion-item>
          </ion-list>
        </div>

        <!-- Empty State -->
        <div v-else class="empty-state">
          <ion-icon :icon="libraryOutline" class="empty-icon"></ion-icon>
          <h2>No Skills Found</h2>
          <p>No skills were found for this community.</p>
        </div>
      </div>
    </ion-content>
  </ion-modal>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { adminService } from '@/services/admin.service';
import type { CommunityMember } from '@/services/admin.service';
import {
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
  IonModal,
  IonAvatar,
  IonSearchbar,
} from '@ionic/vue';
import { arrowBack, refresh, libraryOutline, chevronForward, close, personCircleOutline, peopleOutline } from 'ionicons/icons';

// Props
const props = defineProps<{
  isOpen: boolean;
  communityId: number | null;
}>();

// Emits
const emit = defineEmits<{
  didDismiss: [];
}>();

const isLoading = ref(false);
const skills = ref<Array<{ name: string; value: number }>>([]);

// Detail view state
const selectedSkillName = ref<string>('');
const isUsersLoading = ref(false);
const users = ref<CommunityMember[]>([]);
const searchQuery = ref('');

// Expected user count from skills list
const expectedUserCount = computed(() => {
  if (!selectedSkillName.value) return 0;
  const skill = skills.value.find(s => s.name === selectedSkillName.value);
  return skill?.value || 0;
});

const communityId = computed(() => props.communityId);

// Watch for modal opening and load data
watch(() => props.isOpen, (isOpen) => {
  if (isOpen && communityId.value) {
    loadSkills();
    // Reset detail view when modal opens
    selectedSkillName.value = '';
    users.value = [];
  }
}, { immediate: true });

// Also watch communityId in case it changes
watch(() => props.communityId, (newId) => {
  if (props.isOpen && newId) {
    loadSkills();
  }
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

const filteredUsers = computed(() => {
  if (!searchQuery.value.trim()) {
    return users.value;
  }
  
  const query = searchQuery.value.toLowerCase().trim();
  
  return users.value.filter(user => {
    const name = getUserName(user).toLowerCase();
    const jobTitle = (user.jobTitle || '').toLowerCase();
    const employer = (user.currentEmployer || '').toLowerCase();
    const skillsText = selectedSkillName.value?.toLowerCase() === 'other' 
      ? ((user.skillsDisplay || (Array.isArray(user.skills) ? user.skills.join(', ') : user.skills)) || '').toLowerCase()
      : '';
    
    return name.includes(query) ||
           jobTitle.includes(query) ||
           employer.includes(query) ||
           skillsText.includes(query);
  });
});

function navigateToSkillUsers(skillName: string) {
  if (!communityId.value) return;
  
  selectedSkillName.value = skillName;
  loadUsers();
}

async function loadSkills() {
  if (!communityId.value) return;
  
  isLoading.value = true;
  try {
    // First try to get unconsolidated skills (all individual skills)
    let allSkills = await adminService.getSkillsChartData(communityId.value, 'all', false, true);
    
    // If we get consolidated results with "Other", expand it
    if (allSkills.length === 0 || allSkills.some(s => s.name?.toLowerCase() === 'other')) {
      // Try consolidated to see what we get
      const consolidated = await adminService.getSkillsChartData(communityId.value, 'all', true, true);
      const hasOther = consolidated.some(s => s.name?.toLowerCase() === 'other');
      
      if (hasOther) {
        // Expand "Other" by getting all individual skills from profiles
        console.log('[SkillsListPage] Expanding "Other" category to show all individual skills');
        allSkills = await adminService.getAllIndividualSkills(communityId.value);
      } else {
        allSkills = consolidated;
      }
    }
    
    skills.value = allSkills
      .filter(skill => skill.name?.toLowerCase() !== 'other') // Remove "Other" if it exists
      .map(skill => ({
        name: skill.name,
        value: skill.value || 0
      }))
      .sort((a, b) => b.value - a.value); // Sort by count descending
  } catch (error) {
    console.error('Error loading skills:', error);
    skills.value = [];
  } finally {
    isLoading.value = false;
  }
}

async function loadUsers() {
  if (!communityId.value || !selectedSkillName.value) return;
  
  isUsersLoading.value = true;
  try {
    const fetchedUsers = await adminService.getUsersBySkill(
      communityId.value,
      'general',
      selectedSkillName.value,
      true
    );
    users.value = fetchedUsers;
    
    // Log if no users found to help debug
    if (fetchedUsers.length === 0) {
      console.warn(`[SkillsListPage] No users found for skill "${selectedSkillName.value}"`);
    }
  } catch (error) {
    console.error('Error loading users:', error);
    users.value = [];
  } finally {
    isUsersLoading.value = false;
  }
}

function goBackToList() {
  selectedSkillName.value = '';
  users.value = [];
  searchQuery.value = ''; // Clear search when going back
}

function handleDismiss() {
  // Reset to list view when modal closes
  selectedSkillName.value = '';
  users.value = [];
  searchQuery.value = ''; // Clear search when modal closes
  emit('didDismiss');
}
</script>

<style scoped>
.skills-content {
  --background: #f9fafb;
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
  padding: 16px;
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

.skills-list {
  background: white;
}

.skill-item {
  --padding-start: 16px;
  --padding-end: 16px;
  --min-height: 72px;
  border-bottom: 1px solid #f3f4f6;
}

.skill-item:last-child {
  border-bottom: none;
}

.skill-icon {
  color: var(--ion-color-primary);
  font-size: 24px;
  margin-right: 12px;
}

.skill-item ion-label h2 {
  font-size: 16px;
  font-weight: 600;
  color: #1a1a1a;
  margin-bottom: 8px;
}

.skill-item ion-label p {
  font-size: 14px;
  color: #64748b;
  margin: 0;
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 4px;
}

.stat-label {
  font-weight: 500;
  color: #64748b;
}

.stat-value {
  font-weight: 600;
  color: var(--ion-color-primary);
}

.users-list {
  background: white;
}

.user-item {
  --padding-start: 16px;
  --padding-end: 16px;
  --min-height: 72px;
  border-bottom: 1px solid #f3f4f6;
}

.user-item:last-child {
  border-bottom: none;
}

.avatar-icon {
  font-size: 40px;
  color: #94a3b8;
  margin-right: 12px;
}

ion-avatar {
  width: 40px;
  height: 40px;
  margin-right: 12px;
}

.user-item ion-label h2 {
  font-size: 16px;
  font-weight: 600;
  color: #1a1a1a;
  margin-bottom: 4px;
}

.user-item ion-label p {
  font-size: 14px;
  color: #64748b;
  margin: 0;
}

.user-skills {
  margin-top: 8px !important;
  font-size: 13px !important;
  color: #64748b !important;
}

.skills-label {
  font-weight: 500;
  color: #475569;
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

.empty-hint {
  margin-top: 8px;
  font-size: 12px;
  color: #94a3b8;
  font-style: italic;
}
</style>

<style>
/* Global styles for skills list modal - targets Ionic modal shadow DOM */
#skills-list-modal {
  --width: 90%;
  --max-width: 900px;
  --height: 85%;
  --max-height: 800px;
  --border-radius: 16px;
}

/* Target the modal wrapper inside shadow DOM */
#skills-list-modal::part(content) {
  width: 90%;
  max-width: 900px;
  height: 85%;
  max-height: 800px;
  border-radius: 16px;
}

/* Fallback for modal wrapper - targets the actual modal element */
ion-modal#skills-list-modal .modal-wrapper {
  width: 90% !important;
  max-width: 900px !important;
  height: 85% !important;
  max-height: 800px !important;
  border-radius: 16px !important;
  margin: auto;
}
</style>
