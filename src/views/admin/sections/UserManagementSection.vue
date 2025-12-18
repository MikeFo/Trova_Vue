<template>
  <div class="user-management-section">
    <div class="section-header">
      <h2 class="section-title">User Management</h2>
      <ion-button fill="outline" size="small" @click="exportUsers">
        <ion-icon :icon="downloadOutline" slot="start"></ion-icon>
        Export CSV
      </ion-button>
    </div>

    <!-- Search and Filters -->
    <div class="filters-section">
      <ion-searchbar
        v-model="searchQuery"
        placeholder="Search by name or email..."
        :debounce="300"
        @ionInput="handleSearch"
      ></ion-searchbar>
      <div class="filter-controls">
        <ion-item>
          <ion-label>Sort By</ion-label>
          <ion-select v-model="sortBy" @ionChange="applyFilters">
            <ion-select-option value="name">Name</ion-select-option>
            <ion-select-option value="email">Email</ion-select-option>
            <ion-select-option value="joinDate">Join Date</ion-select-option>
          </ion-select>
        </ion-item>
        <ion-item>
          <ion-label>Filter</ion-label>
          <ion-select v-model="filterBy" @ionChange="applyFilters">
            <ion-select-option value="all">All Users</ion-select-option>
            <ion-select-option value="managers">Managers Only</ion-select-option>
            <ion-select-option value="enabled">Enabled Only</ion-select-option>
            <ion-select-option value="disabled">Disabled Only</ion-select-option>
          </ion-select>
        </ion-item>
      </div>
    </div>

    <!-- Users Table -->
    <div class="users-table-container">
      <div v-if="isLoading" class="loading-state">
        <ion-spinner></ion-spinner>
        <p>Loading users...</p>
      </div>

      <div v-else-if="filteredMembers.length === 0" class="empty-state">
        <p>No users found</p>
      </div>

      <div v-else class="users-table">
        <div class="table-header">
          <div class="col-name">Name</div>
          <div class="col-email">Email</div>
          <div class="col-join-date">Join Date</div>
          <div class="col-status">Status</div>
          <div class="col-role">Role</div>
          <div class="col-actions">Actions</div>
        </div>

        <div
          v-for="member in filteredMembers"
          :key="member.id"
          class="table-row"
          @click="viewUserProfile(member.id)"
        >
          <div class="col-name">
            <div class="user-info">
              <img
                v-if="member.profilePicture"
                :src="member.profilePicture"
                :alt="member.fullName"
                class="user-avatar"
              />
              <div v-else class="user-avatar-placeholder">
                {{ getInitials(member.fullName) }}
              </div>
              <span>{{ member.fullName }}</span>
            </div>
          </div>
          <div class="col-email">{{ member.email }}</div>
          <div class="col-join-date">
            {{ formatDate(member.joinDate) }}
          </div>
          <div class="col-status">
            <ion-chip :color="member.enabled !== false ? 'success' : 'danger'" size="small">
              {{ member.enabled !== false ? 'Enabled' : 'Disabled' }}
            </ion-chip>
          </div>
          <div class="col-role">
            <ion-chip
              v-if="member.isManager"
              color="primary"
              size="small"
            >
              Manager
            </ion-chip>
            <span v-else class="role-text">Member</span>
          </div>
          <div class="col-actions" @click.stop>
            <ion-button
              fill="clear"
              size="small"
              @click.stop="toggleUserStatus(member)"
            >
              <ion-icon
                :icon="member.enabled !== false ? banOutline : checkmarkCircleOutline"
              ></ion-icon>
            </ion-button>
            <ion-button
              fill="clear"
              size="small"
              @click.stop="toggleManager(member)"
            >
              <ion-icon
                :icon="member.isManager ? personRemoveOutline : personAddOutline"
              ></ion-icon>
            </ion-button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { adminService, type CommunityMember } from '@/services/admin.service';
import { toastController } from '@ionic/vue';
import {
  IonButton,
  IonIcon,
  IonSearchbar,
  IonItem,
  IonLabel,
  IonSelect,
  IonSelectOption,
  IonSpinner,
  IonChip,
} from '@ionic/vue';
import {
  downloadOutline,
  banOutline,
  checkmarkCircleOutline,
  personAddOutline,
  personRemoveOutline,
} from 'ionicons/icons';

interface Props {
  communityId: number | null;
}

const props = defineProps<Props>();
const emit = defineEmits<{
  refresh: [];
}>();

const router = useRouter();
const isLoading = ref(false);
const members = ref<CommunityMember[]>([]);
const searchQuery = ref('');
const sortBy = ref('name');
const filterBy = ref('all');

const filteredMembers = computed(() => {
  let filtered = [...members.value];

  // Apply search filter
  if (searchQuery.value.trim()) {
    const query = searchQuery.value.toLowerCase();
    filtered = filtered.filter(
      (member) =>
        member.fullName.toLowerCase().includes(query) ||
        member.email.toLowerCase().includes(query)
    );
  }

  // Apply status filter
  if (filterBy.value === 'managers') {
    filtered = filtered.filter((member) => member.isManager);
  } else if (filterBy.value === 'enabled') {
    filtered = filtered.filter((member) => member.enabled !== false);
  } else if (filterBy.value === 'disabled') {
    filtered = filtered.filter((member) => member.enabled === false);
  }

  // Apply sorting
  filtered.sort((a, b) => {
    if (sortBy.value === 'name') {
      return a.fullName.localeCompare(b.fullName);
    } else if (sortBy.value === 'email') {
      return a.email.localeCompare(b.email);
    } else if (sortBy.value === 'joinDate') {
      const dateA = new Date(a.joinDate || 0).getTime();
      const dateB = new Date(b.joinDate || 0).getTime();
      return dateB - dateA; // Newest first
    }
    return 0;
  });

  return filtered;
});

async function loadMembers() {
  if (!props.communityId) return;

  isLoading.value = true;
  try {
    const loadedMembers = await adminService.getCommunityMembers(props.communityId);
    members.value = loadedMembers;
    
    // If no members loaded and it's not an error, show helpful message
    if (loadedMembers.length === 0) {
      // Don't show error toast - endpoint might not exist yet
      // The UI will show "No users found" message
    }
  } catch (error) {
    console.error('Error loading members:', error);
    // Only show toast for unexpected errors, not 404s
    members.value = [];
  } finally {
    isLoading.value = false;
  }
}

function handleSearch() {
  // Search is handled by computed property
}

function applyFilters() {
  // Filters are handled by computed property
}

function getInitials(name: string): string {
  const parts = name.split(' ');
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return name.substring(0, 2).toUpperCase();
}

function formatDate(dateStr?: string): string {
  if (!dateStr) return 'N/A';
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function viewUserProfile(userId: number) {
  router.push(`/tabs/profile/${userId}`);
}

async function toggleUserStatus(member: CommunityMember) {
  if (!props.communityId) return;

  try {
    await adminService.toggleUserStatus(member.id, member.enabled === false);
    member.enabled = member.enabled === false;
    const toast = await toastController.create({
      message: `User ${member.enabled ? 'enabled' : 'disabled'}`,
      duration: 2000,
      color: 'success',
    });
    await toast.present();
    emit('refresh');
  } catch (error) {
    console.error('Error toggling user status:', error);
    const toast = await toastController.create({
      message: 'Failed to update user status',
      duration: 2000,
      color: 'danger',
    });
    await toast.present();
  }
}

async function toggleManager(member: CommunityMember) {
  if (!props.communityId) return;

  try {
    const newManagerStatus = !member.isManager;
    await adminService.toggleManager(props.communityId, member.id, newManagerStatus);
    member.isManager = newManagerStatus;
    const toast = await toastController.create({
      message: `User ${newManagerStatus ? 'added as' : 'removed from'} manager`,
      duration: 2000,
      color: 'success',
    });
    await toast.present();
    emit('refresh');
  } catch (error) {
    console.error('Error toggling manager:', error);
    const toast = await toastController.create({
      message: 'Failed to update manager status',
      duration: 2000,
      color: 'danger',
    });
    await toast.present();
  }
}

async function exportUsers() {
  if (!props.communityId) return;

  try {
    const blob = await adminService.exportData(props.communityId, 'users');
    adminService.downloadCSV(blob, `users_${props.communityId}_${Date.now()}.csv`);
    const toast = await toastController.create({
      message: 'Users exported successfully',
      duration: 2000,
      color: 'success',
    });
    await toast.present();
  } catch (error) {
    console.error('Error exporting users:', error);
    const toast = await toastController.create({
      message: 'Failed to export users',
      duration: 2000,
      color: 'danger',
    });
    await toast.present();
  }
}

onMounted(() => {
  loadMembers();
});
</script>

<style scoped>
.user-management-section {
  background: white;
  border-radius: 16px;
  padding: 24px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
}

.section-title {
  font-size: 24px;
  font-weight: 700;
  color: #1a1a1a;
  margin: 0;
}

.filters-section {
  margin-bottom: 24px;
}

.filter-controls {
  display: flex;
  gap: 16px;
  margin-top: 16px;
}

.filter-controls ion-item {
  flex: 1;
  --padding-start: 0;
  --inner-padding-end: 0;
}

.users-table-container {
  overflow-x: auto;
}

.loading-state,
.empty-state {
  text-align: center;
  padding: 48px 16px;
  color: #64748b;
}

.users-table {
  display: flex;
  flex-direction: column;
  min-width: 800px;
}

.table-header {
  display: grid;
  grid-template-columns: 2fr 2fr 1.5fr 1fr 1fr 1.5fr;
  gap: 16px;
  padding: 12px 16px;
  background: #f9fafb;
  border-radius: 8px;
  font-weight: 600;
  font-size: 14px;
  color: #64748b;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.table-row {
  display: grid;
  grid-template-columns: 2fr 2fr 1.5fr 1fr 1fr 1.5fr;
  gap: 16px;
  padding: 16px;
  border-bottom: 1px solid #e5e7eb;
  cursor: pointer;
  transition: background 0.2s ease;
}

.table-row:hover {
  background: #f9fafb;
}

.table-row:last-child {
  border-bottom: none;
}

.user-info {
  display: flex;
  align-items: center;
  gap: 12px;
}

.user-avatar,
.user-avatar-placeholder {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  flex-shrink: 0;
}

.user-avatar {
  object-fit: cover;
}

.user-avatar-placeholder {
  background: linear-gradient(135deg, rgba(45, 122, 78, 0.1) 0%, rgba(29, 185, 138, 0.1) 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  color: var(--color-primary);
  font-size: 14px;
}

.col-actions {
  display: flex;
  gap: 8px;
  align-items: center;
}

.role-text {
  color: #64748b;
  font-size: 14px;
}

/* Responsive */
@media (max-width: 768px) {
  .users-table {
    min-width: 100%;
  }

  .table-header,
  .table-row {
    grid-template-columns: 1fr;
    gap: 8px;
  }

  .table-header {
    display: none;
  }

  .table-row {
    padding: 16px;
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    margin-bottom: 12px;
  }
}
</style>






