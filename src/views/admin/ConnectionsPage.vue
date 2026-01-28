<template>
  <ion-modal 
    :is-open="isOpen" 
    @didDismiss="handleDismiss"
    @willDismiss="handleDismiss"
    :backdrop-dismiss="true"
    id="connections-list-modal"
  >
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start" v-if="selectedUserId">
          <ion-button fill="clear" @click="goBackToUserList">
            <ion-icon :icon="arrowBack"></ion-icon>
          </ion-button>
        </ion-buttons>
        <ion-title>{{ selectedUserId ? `${selectedUserName}'s Connections` : 'Introductions Created' }}</ion-title>
        <ion-buttons slot="end">
          <ion-button fill="clear" @click="handleDismiss">
            <ion-icon :icon="close"></ion-icon>
          </ion-button>
        </ion-buttons>
        <ion-buttons slot="end">
          <ion-button fill="clear" @click="selectedUserId ? loadUserConnections() : loadUsers()">
            <ion-icon :icon="refresh"></ion-icon>
          </ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>
    <ion-content :fullscreen="true" class="connections-content">
      <!-- Detail View (User Connections) -->
      <div v-if="selectedUserId">
        <!-- Loading State -->
        <div v-if="isConnectionsLoading" class="loading-state">
          <ion-spinner></ion-spinner>
          <p>Loading connections...</p>
        </div>

        <!-- Connections List -->
        <div v-else-if="userConnections.length > 0" class="connections-container">
          <div class="header-section">
            <h2>{{ selectedUserName }}</h2>
            <div class="stats-summary">
              <div class="stat-item">
                <span class="stat-label">Total Connections:</span>
                <span class="stat-value">{{ formatNumber(userConnections.length) }}</span>
              </div>
            </div>
          </div>

          <!-- Search Bar -->
          <div class="search-container">
            <ion-searchbar
              v-model="searchQuery"
              placeholder="Search by connected user names..."
              :debounce="300"
              class="connections-searchbar"
            ></ion-searchbar>
          </div>

          <!-- No Results Message -->
          <div v-if="searchQuery && filteredUserConnections.length === 0" class="no-results">
            <p>No connections found matching "{{ searchQuery }}"</p>
          </div>

          <ion-list v-else class="connections-list">
            <ion-item
              v-for="(connection, index) in filteredUserConnections"
              :key="connection.id || index"
              class="connection-item"
            >
              <ion-icon 
                :icon="personCircleOutline" 
                slot="start"
                class="icon-default"
              ></ion-icon>
              <ion-label>
                <h2>{{ connection.connectedUserName }}</h2>
                <p>
                  <span class="stat-label">Connected:</span>
                  <span class="stat-value">{{ formatDate(connection.createdAt) }}</span>
                </p>
                <p v-if="connection.matchType" class="match-type">
                  <span class="stat-label">Type:</span>
                  <span class="stat-value">{{ formatMatchType(connection.matchType) }}</span>
                </p>
              </ion-label>
            </ion-item>
          </ion-list>
        </div>

        <!-- Empty State -->
        <div v-else class="empty-state">
          <ion-icon :icon="peopleOutline" class="empty-icon"></ion-icon>
          <h2>No Connections Found</h2>
          <p>No connections were found for this user.</p>
        </div>
      </div>

      <!-- List View (Users) -->
      <div v-else>
        <!-- Loading State -->
        <div v-if="isLoading" class="loading-state">
          <ion-spinner></ion-spinner>
          <p>Loading connections...</p>
        </div>

        <!-- Users List -->
        <div v-else-if="users.length > 0" class="users-list">
          <div class="list-header">
            <h2>Users with Connections</h2>
            <p class="subtitle">Click on a user to view their connections</p>
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
              @click="navigateToUserConnections(user.userId, user.userName)"
              class="user-item"
            >
              <ion-icon :icon="peopleOutline" slot="start" class="user-icon"></ion-icon>
              <ion-label>
                <h2>{{ user.userName }}</h2>
                <p>
                  <span class="stat-label">Connections:</span>
                  <span class="stat-value">{{ formatNumber(user.connectionCount) }}</span>
                </p>
              </ion-label>
              <ion-icon :icon="chevronForward" slot="end"></ion-icon>
            </ion-item>
          </ion-list>
        </div>

        <!-- Empty State -->
        <div v-else class="empty-state">
          <ion-icon :icon="peopleOutline" class="empty-icon"></ion-icon>
          <h2>No Connections Found</h2>
          <p>No connections were found for the selected time period.</p>
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
  peopleOutline,
  chevronForward,
  close,
  arrowBack,
  personCircleOutline,
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
const users = ref<Array<{
  userId: number;
  userName: string;
  connectionCount: number;
}>>([]);

// Use props for communityId, startDate, endDate
const communityId = computed(() => props.communityId);
const startDate = computed(() => props.startDate);
const endDate = computed(() => props.endDate);

// View state - using selectedUserId to determine if we're showing list or detail
const selectedUserId = ref<number | null>(null);
const selectedUserName = ref<string>('');
const isConnectionsLoading = ref(false);
const userConnections = ref<Array<{
  id: number;
  connectedUserId: number;
  connectedUserName: string;
  createdAt: string;
  matchType?: string;
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

const filteredUserConnections = computed(() => {
  if (!searchQuery.value.trim()) {
    return userConnections.value;
  }
  
  const query = searchQuery.value.toLowerCase().trim();
  
  return userConnections.value.filter(connection => {
    return connection.connectedUserName.toLowerCase().includes(query);
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
      loadUserConnections();
    } else {
      loadUsers();
    }
  }
}, { immediate: true });

// Also watch communityId in case it changes
watch(() => props.communityId, (newId) => {
  if (props.isOpen && newId) {
    if (selectedUserId.value) {
      loadUserConnections();
    } else {
      loadUsers();
    }
  }
});

async function loadUsers() {
  if (!communityId.value) return;

  isLoading.value = true;
  selectedUserId.value = null;
  selectedUserName.value = '';
  try {
    console.log('[ConnectionsPage] Loading users with connections:', {
      communityId: communityId.value,
      startDate: startDateISO.value,
      endDate: endDateISO.value
    });
    
    const result = await adminService.getUsersWithConnections(
      communityId.value,
      startDateISO.value,
      endDateISO.value
    );
    
    console.log('[ConnectionsPage] Received users:', result);
    
    users.value = result;
  } catch (error) {
    console.error('Error loading users:', error);
    users.value = [];
  } finally {
    isLoading.value = false;
  }
}

async function loadUserConnections() {
  if (!communityId.value || !selectedUserId.value) return;

  isConnectionsLoading.value = true;
  try {
    const results = await adminService.getConnectionsForUser(
      communityId.value,
      selectedUserId.value,
      startDateISO.value,
      endDateISO.value
    );
    userConnections.value = results;
    searchQuery.value = ''; // Reset search when loading new connections
  } catch (error) {
    console.error('Error loading user connections:', error);
    userConnections.value = [];
  } finally {
    isConnectionsLoading.value = false;
  }
}

function navigateToUserConnections(userId: number, userName: string) {
  selectedUserId.value = userId;
  selectedUserName.value = userName;
  searchQuery.value = ''; // Clear search when navigating
  loadUserConnections();
}

function goBackToUserList() {
  selectedUserId.value = null;
  selectedUserName.value = '';
  userConnections.value = [];
  searchQuery.value = ''; // Clear search when going back
}

function handleDismiss() {
  // Reset to list view when modal closes
  selectedUserId.value = null;
  selectedUserName.value = '';
  userConnections.value = [];
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

function formatMatchType(matchType: string | undefined | null): string {
  if (!matchType) return 'Unknown';
  // Convert snake_case or kebab-case to Title Case
  return matchType
    .split(/[-_]/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}
</script>

<style scoped>
.connections-content {
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

.connections-list {
  background: white;
}

.connection-item {
  --padding-start: 16px;
  --padding-end: 16px;
  --min-height: 72px;
  border-bottom: 1px solid #f3f4f6;
}

.connection-item:last-child {
  border-bottom: none;
}

.icon-default {
  color: #94a3b8;
  font-size: 32px;
}

.connection-item ion-label h2 {
  font-size: 16px;
  font-weight: 600;
  color: #1a1a1a;
  margin-bottom: 8px;
}

.connection-item ion-label p {
  font-size: 14px;
  color: #64748b;
  margin: 4px 0;
  display: flex;
  align-items: center;
  gap: 4px;
}

.match-type {
  margin-top: 4px;
}

.stat-label {
  font-weight: 500;
  color: #64748b;
}

.stat-value {
  font-weight: 600;
  color: #2d7a4e !important;
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

.search-container {
  padding: 12px 16px;
  background: white;
  border-bottom: 1px solid #e5e7eb;
}

.connections-searchbar,
.users-searchbar {
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

.user-item {
  --padding-start: 16px;
  --padding-end: 16px;
  --min-height: 72px;
  border-bottom: 1px solid #f3f4f6;
}

.user-item:last-child {
  border-bottom: none;
}

.user-icon {
  color: #6366f1;
  font-size: 32px;
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
  display: flex;
  align-items: center;
  gap: 4px;
}

.connections-container {
  background: transparent;
  padding: 0;
}
</style>

<style>
/* Global styles for connections list modal - targets Ionic modal shadow DOM */
#connections-list-modal {
  --width: 90%;
  --max-width: 900px;
  --height: 85%;
  --max-height: 800px;
  --border-radius: 16px;
}

/* Target the modal wrapper inside shadow DOM */
#connections-list-modal::part(content) {
  width: 90%;
  max-width: 900px;
  height: 85%;
  max-height: 800px;
  border-radius: 16px;
}

/* Fallback for modal wrapper - targets the actual modal element */
ion-modal#connections-list-modal .modal-wrapper {
  width: 90% !important;
  max-width: 900px !important;
  height: 85% !important;
  max-height: 800px !important;
  border-radius: 16px !important;
  margin: auto;
}
</style>

