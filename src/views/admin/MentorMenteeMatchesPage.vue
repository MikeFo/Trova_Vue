<template>
  <ion-modal 
    :is-open="isOpen" 
    @didDismiss="handleDismiss"
    @willDismiss="handleDismiss"
    :backdrop-dismiss="true"
    id="mentor-mentee-matches-list-modal"
  >
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start" v-if="selectedUserId">
          <ion-button fill="clear" @click="goBackToUserList">
            <ion-icon :icon="arrowBack"></ion-icon>
          </ion-button>
        </ion-buttons>
        <ion-title>{{ selectedUserId ? 'Mentor/Mentee Matches' : 'Mentor/Mentee Matches' }}</ion-title>
        <ion-buttons slot="end">
          <ion-button fill="clear" @click="handleDismiss">
            <ion-icon :icon="close"></ion-icon>
          </ion-button>
        </ion-buttons>
        <ion-buttons slot="end">
          <ion-button fill="clear" @click="selectedUserId ? loadUserMatches() : loadUsers()">
            <ion-icon :icon="refresh"></ion-icon>
          </ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>
    <ion-content :fullscreen="true" class="mentor-mentee-matches-content">
      <!-- Detail View (User Matches) -->
      <div v-if="selectedUserId">
        <!-- Loading State -->
        <div v-if="isMatchesLoading" class="loading-state">
          <ion-spinner></ion-spinner>
          <p>Loading matches...</p>
        </div>

        <!-- Matches List -->
        <div v-else-if="userMatches.length > 0" class="matches-container">
          <div class="header-section">
            <h2>{{ selectedUserName }}</h2>
            <div class="stats-summary">
              <div class="stat-item">
                <span class="stat-label">Total Matches:</span>
                <span class="stat-value">{{ formatNumber(userMatches.length) }}</span>
              </div>
            </div>
          </div>

          <!-- Search Bar -->
          <div class="search-container">
            <ion-searchbar
              v-model="searchQuery"
              placeholder="Search by matched user names..."
              :debounce="300"
              class="matches-searchbar"
            ></ion-searchbar>
          </div>

          <!-- No Results Message -->
          <div v-if="searchQuery && filteredUserMatches.length === 0" class="no-results">
            <p>No matches found matching "{{ searchQuery }}"</p>
          </div>

          <ion-list v-else class="matches-list">
            <ion-item
              v-for="(match, index) in filteredUserMatches"
              :key="match.id || index"
              class="match-item"
            >
              <ion-icon 
                :icon="personCircleOutline" 
                slot="start"
                class="icon-default"
              ></ion-icon>
              <ion-label>
                <h2>
                  <span>{{ match.matchedUserName }}</span>
                </h2>
                <p>
                  <span class="stat-label">Matched:</span>
                  <span class="stat-value">{{ formatDate(match.createdAt) }}</span>
                </p>
                <p class="role-info">
                  <span v-if="match.userWasMentor" class="role-badge mentor-badge">
                    <ion-icon :icon="schoolOutline"></ion-icon>
                    You were <strong>Mentor</strong>
                  </span>
                  <span v-if="match.userWasMentee" class="role-badge mentee-badge">
                    <ion-icon :icon="personCircleOutline"></ion-icon>
                    You were <strong>Mentee</strong>
                  </span>
                  <span class="role-separator">→</span>
                  <span v-if="match.userWasMentor" class="role-badge mentee-badge">
                    <ion-icon :icon="personCircleOutline"></ion-icon>
                    {{ match.matchedUserName }} was <strong>Mentee</strong>
                  </span>
                  <span v-if="match.userWasMentee" class="role-badge mentor-badge">
                    <ion-icon :icon="schoolOutline"></ion-icon>
                    {{ match.matchedUserName }} was <strong>Mentor</strong>
                  </span>
                </p>
              </ion-label>
            </ion-item>
          </ion-list>
        </div>

        <!-- Empty State -->
        <div v-else class="empty-state">
          <ion-icon :icon="peopleOutline" class="empty-icon"></ion-icon>
          <h2>No Matches Found</h2>
          <p>No mentor/mentee matches were found for this user.</p>
        </div>
      </div>

      <!-- List View (Users) -->
      <div v-else>
        <!-- Loading State -->
        <div v-if="isLoading" class="loading-state">
          <ion-spinner></ion-spinner>
          <p>Loading mentor/mentee matches...</p>
        </div>

        <!-- Users List -->
        <div v-else-if="users.length > 0" class="users-list">
          <div class="list-header">
            <h2>Users with Mentor/Mentee Matches</h2>
            <p class="subtitle">Click on a user to view their matches</p>
          </div>

          <!-- Search Bar -->
          <div class="search-container">
            <ion-searchbar
              v-model="searchQuery"
              placeholder="Search by user name..."
              :debounce="300"
              class="users-searchbar"
            ></ion-searchbar>
          </div>

          <!-- No Results Message -->
          <div v-if="searchQuery && filteredUsers.length === 0" class="no-results">
            <p>No users found matching "{{ searchQuery }}"</p>
          </div>

          <ion-list v-else>
            <ion-item
              v-for="user in filteredUsers"
              :key="user.userId"
              button
              @click="navigateToUserMatches(user.userId, user.userName)"
              class="user-item"
            >
              <ion-icon :icon="schoolOutline" slot="start" class="user-icon"></ion-icon>
              <ion-label>
                <h2>{{ user.userName }}</h2>
                <p>
                  <span class="stat-label">Matches:</span>
                  <span class="stat-value">{{ formatNumber(user.matchCount) }}</span>
                </p>
              </ion-label>
              <ion-icon :icon="chevronForward" slot="end"></ion-icon>
            </ion-item>
          </ion-list>
        </div>

        <!-- Empty State -->
        <div v-else class="empty-state">
          <ion-icon :icon="schoolOutline" class="empty-icon"></ion-icon>
          <h2>No Mentor/Mentee Matches Found</h2>
          <p v-if="hasBackendIssue" class="error-message">
            <strong>No Matches Found:</strong> No mentor/mentee matches were found for the selected time period. 
            This could mean: (1) No matches exist in the date range, (2) The matches are outside the selected date range, 
            or (3) There may be a data filtering issue. Check the console for more details.
          </p>
          <p v-else>No mentor/mentee matches were found for the selected time period.</p>
        </div>
      </div>
    </ion-content>
  </ion-modal>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { adminService } from '@/services/admin.service';
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
  IonSearchbar,
} from '@ionic/vue';
import {
  refresh,
  schoolOutline,
  chevronForward,
  close,
  arrowBack,
  personCircleOutline,
  checkmarkCircle,
  chatbubblesOutline,
  peopleOutline,
} from 'ionicons/icons';

// Props
const props = defineProps<{
  isOpen: boolean;
  communityId: number | null;
  startDate?: string;
  endDate?: string;
}>();

// Emits
const emit = defineEmits<{
  didDismiss: [];
}>();

const isLoading = ref(false);
const hasBackendIssue = ref(false);
const users = ref<Array<{
  userId: number;
  userName: string;
  matchCount: number;
}>>([]);

// Use props for communityId, startDate, endDate
const communityId = computed(() => props.communityId);
const startDate = computed(() => props.startDate);
const endDate = computed(() => props.endDate);

// View state - using selectedUserId to determine if we're showing list or detail
const selectedUserId = ref<number | null>(null);
const selectedUserName = ref<string>('');
const isMatchesLoading = ref(false);
const userMatches = ref<Array<{
  id: number;
  matchedUserId: number;
  matchedUserName: string;
  createdAt: string;
  subType?: string;
  userWasMentor: boolean;
  userWasMentee: boolean;
}>>([]);
const searchQuery = ref('');

const filteredUsers = computed(() => {
  if (!searchQuery.value.trim()) {
    return users.value;
  }
  
  const query = searchQuery.value.toLowerCase().trim();
  
  return users.value.filter(user => {
    return user.userName.toLowerCase().includes(query);
  });
});

const filteredUserMatches = computed(() => {
  if (!searchQuery.value.trim()) {
    return userMatches.value;
  }
  
  const query = searchQuery.value.toLowerCase().trim();
  
  return userMatches.value.filter(match => {
    return match.matchedUserName.toLowerCase().includes(query);
  });
});

// Computed properties to ensure ISO format dates
const startDateISO = computed(() => {
  if (!startDate.value) return undefined;
  try {
    const date = new Date(startDate.value);
    return isNaN(date.getTime()) ? startDate.value : date.toISOString();
  } catch {
    return startDate.value;
  }
});

const endDateISO = computed(() => {
  if (!endDate.value) return undefined;
  try {
    const date = new Date(endDate.value);
    return isNaN(date.getTime()) ? endDate.value : date.toISOString();
  } catch {
    return endDate.value;
  }
});

// Watch for modal opening and load data
watch(() => props.isOpen, (isOpen) => {
  if (isOpen && communityId.value) {
    if (selectedUserId.value) {
      loadUserMatches();
    } else {
      loadUsers();
    }
  }
}, { immediate: true });

// Also watch communityId in case it changes
watch(() => props.communityId, (newId) => {
  if (props.isOpen && newId) {
    if (selectedUserId.value) {
      loadUserMatches();
    } else {
      loadUsers();
    }
  }
});

async function loadUsers() {
  if (!communityId.value) return;

  isLoading.value = true;
  hasBackendIssue.value = false;
  selectedUserId.value = null;
  selectedUserName.value = '';
  try {
    console.log('[MentorMenteeMatchesPage] Loading users with mentor/mentee matches:', {
      communityId: communityId.value,
      startDate: startDateISO.value,
      endDate: endDateISO.value
    });
    
    const result = await adminService.getMentorMenteeUsersWithMatches(
      communityId.value,
      startDateISO.value,
      endDateISO.value
    );
    
    console.log('[MentorMenteeMatchesPage] Received users:', result);
    
    users.value = result;
  } catch (error) {
    console.error('Error loading users:', error);
    users.value = [];
  } finally {
    isLoading.value = false;
  }
}

async function loadUserMatches() {
  if (!communityId.value || !selectedUserId.value) return;

  isMatchesLoading.value = true;
  try {
    const results = await adminService.getMentorMenteeMatchesForUser(
      communityId.value,
      selectedUserId.value,
      startDateISO.value,
      endDateISO.value
    );
    userMatches.value = results;
    searchQuery.value = ''; // Reset search when loading new matches
  } catch (error) {
    console.error('Error loading user matches:', error);
    userMatches.value = [];
  } finally {
    isMatchesLoading.value = false;
  }
}

function navigateToUserMatches(userId: number, userName: string) {
  selectedUserId.value = userId;
  selectedUserName.value = userName;
  searchQuery.value = ''; // Clear search when navigating
  loadUserMatches();
}

function goBackToUserList() {
  selectedUserId.value = null;
  selectedUserName.value = '';
  userMatches.value = [];
  searchQuery.value = ''; // Clear search when going back
}

function getUserName(user: any): string {
  if (!user) return 'Unknown';
  if (user.fullName) return user.fullName;
  if (user.fname && user.lname) return `${user.fname} ${user.lname}`;
  if (user.fname) return user.fname;
  return 'Unknown';
}

function handleDismiss() {
  // Reset to list view when modal closes
  selectedUserId.value = null;
  selectedUserName.value = '';
  userMatches.value = [];
  searchQuery.value = ''; // Clear search when modal closes
  emit('didDismiss');
}

function formatNumber(value: number | undefined | null): string {
  if (value === undefined || value === null) return '0';
  if (typeof value !== 'number' || isNaN(value)) return '0';
  return value.toLocaleString();
}

function formatDate(dateString: string | undefined | null): string {
  if (!dateString) return 'Unknown date';
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return 'Invalid date';
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
  } catch {
    return 'Invalid date';
  }
}
</script>

<style scoped>
.mentor-mentee-matches-content {
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

.list-header .subtitle {
  margin: 0;
  font-size: 14px;
  color: #64748b;
}

.matches-list {
  background: white;
}

.match-item {
  --padding-start: 16px;
  --padding-end: 16px;
  --min-height: 72px;
  border-bottom: 1px solid #f3f4f6;
}

.match-item:last-child {
  border-bottom: none;
}

.match-icon {
  color: var(--ion-color-primary);
  font-size: 24px;
  margin-right: 12px;
}

.match-item ion-label h2 {
  font-size: 16px;
  font-weight: 600;
  color: #1a1a1a;
  margin-bottom: 8px;
}

.match-item ion-label p {
  font-size: 14px;
  color: #64748b;
  margin: 0;
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 4px;
  line-height: 1.5;
}

.match-item ion-label p .stat-value {
  min-width: 20px;
  display: inline-block;
}

.stat-label {
  font-weight: 500;
  color: #64748b;
}

.stat-value {
  font-weight: 600;
  color: #2d7a4e !important;
}

.stat-value.engaged {
  color: #10b981 !important;
}

.stat-separator {
  color: #cbd5e1;
  margin: 0 4px;
}

.role-info {
  margin-top: 8px;
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.role-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 500;
}

.role-badge ion-icon {
  font-size: 14px;
}

.mentor-badge {
  background-color: #f0f9ff;
  color: #0369a1;
  border: 1px solid #bae6fd;
}

.mentor-badge ion-icon {
  color: #0369a1;
}

.mentee-badge {
  background-color: #fef3c7;
  color: #92400e;
  border: 1px solid #fde68a;
}

.mentee-badge ion-icon {
  color: #92400e;
}

.role-separator {
  color: #94a3b8;
  font-weight: 600;
  margin: 0 4px;
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

/* Detail view styles */

.pairings-container {
  background: transparent;
  padding: 0 16px 16px 16px;
}

.pairings-list {
  background: transparent;
  padding: 0;
}

.pairings-list ion-item {
  margin-bottom: 8px;
  border-radius: 8px;
  overflow: hidden;
}

.header-section {
  padding: 24px 20px;
  margin: 16px;
  border-radius: 12px;
  border: 1px solid #e5e7eb;
  background: #ffffff;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

.header-section h2 {
  margin: 0 0 20px 0;
  font-size: 24px;
  font-weight: 600;
  color: #1a1a1a;
}

.stats-summary {
  display: flex;
  gap: 32px;
  flex-wrap: wrap;
}

.stat-item {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.stat-label {
  font-size: 12px;
  font-weight: 500;
  color: #64748b;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.stat-value {
  font-size: 28px;
  font-weight: 700;
  color: #2d7a4e;
  line-height: 1.2;
}

.stat-value.engaged {
  color: #10b981;
}

.pairing-item {
  --padding-start: 16px;
  --padding-end: 16px;
  --min-height: 88px;
  border-bottom: 1px solid #f3f4f6;
  background: white;
}

.pairing-item:last-child {
  border-bottom: none;
}

.pairing-item.engaged {
  background: #f0fdf4;
}

.icon-default {
  color: #94a3b8;
  font-size: 32px;
}

.icon-engaged {
  color: #10b981;
  font-size: 32px;
}

.pairing-item ion-label h2 {
  font-size: 16px;
  font-weight: 600;
  color: #1a1a1a;
  margin-bottom: 8px;
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}

.separator {
  color: #cbd5e1;
  font-weight: 300;
}

.pairing-item ion-label p {
  font-size: 14px;
  color: #64748b;
  margin: 4px 0;
}

.engaged-badge {
  display: flex;
  align-items: center;
  gap: 4px;
  color: #10b981;
  font-weight: 500;
  margin-top: 8px;
}

.engaged-badge ion-icon {
  font-size: 16px;
}

.search-container {
  padding: 12px 16px;
  background: white;
  border-bottom: 1px solid #e5e7eb;
}

.pairings-searchbar {
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
</style>

<style>
/* Global styles for mentor/mentee matches list modal - targets Ionic modal shadow DOM */
#mentor-mentee-matches-list-modal {
  --width: 90%;
  --max-width: 900px;
  --height: 85%;
  --max-height: 800px;
  --border-radius: 16px;
}

/* Target the modal wrapper inside shadow DOM */
#mentor-mentee-matches-list-modal::part(content) {
  width: 90%;
  max-width: 900px;
  height: 85%;
  max-height: 800px;
  border-radius: 16px;
}

/* Fallback for modal wrapper - targets the actual modal element */
ion-modal#mentor-mentee-matches-list-modal .modal-wrapper {
  width: 90% !important;
  max-width: 900px !important;
  height: 85% !important;
  max-height: 800px !important;
  border-radius: 16px !important;
  margin: auto;
}
</style>


