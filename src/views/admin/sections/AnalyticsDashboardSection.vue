<template>
  <div class="analytics-dashboard-section">
    <div class="section-header">
      <h2 class="section-title">Insights & Analytics Dashboard</h2>
      <ion-button fill="outline" size="small" @click="exportAllDashboards">
        <ion-icon :icon="downloadOutline" slot="start"></ion-icon>
        Export All CSV
      </ion-button>
    </div>

    <!-- Dashboard Selector -->
    <div class="dashboard-selector">
      <div class="dashboard-selector-header" @click="toggleSelectorCollapse">
        <h3 class="subsection-title">Available Dashboards</h3>
        <ion-icon 
          :icon="isSelectorCollapsed ? chevronDown : chevronUp" 
          class="collapse-icon"
        ></ion-icon>
      </div>
      
      <div v-show="!isSelectorCollapsed" class="dashboard-selector-content">
        <!-- Default Dashboards -->
        <div class="dashboard-group">
          <h4 class="group-title">Default Dashboards</h4>
          <div class="dashboard-checkboxes">
            <div
              v-for="dashboard in defaultDashboards"
              :key="dashboard"
              class="dashboard-checkbox-item"
            >
              <ion-checkbox
                :checked="visibleDashboards.includes(dashboard)"
                @ionChange="toggleDashboard(dashboard)"
              ></ion-checkbox>
              <ion-label>{{ formatDashboardName(dashboard) }}</ion-label>
            </div>
          </div>
        </div>

        <!-- Additional Dashboards -->
        <!-- Removed: Additional Dashboards section (intention, movies, music, occupation, organization, university, location) -->

        <!-- Custom Field Dashboards -->
        <div v-if="customFields.length > 0" class="dashboard-group">
          <h4 class="group-title">Custom Field Dashboards</h4>
          <div class="dashboard-checkboxes">
            <div
              v-for="field in customFields"
              :key="field.id"
              class="dashboard-checkbox-item"
            >
              <ion-checkbox
                :checked="visibleDashboards.includes(getCustomFieldDashboardKey(field))"
                @ionChange="toggleCustomFieldDashboard(field)"
              ></ion-checkbox>
              <ion-label>{{ field.name || field.label || `Custom Field ${field.id}` }}</ion-label>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Dashboard Charts -->
    <div v-if="isLoading && !hasLoadedData" class="loading-state">
      <ion-spinner></ion-spinner>
      <p>Loading dashboards...</p>
    </div>

    <div v-else class="dashboards-grid">
      <div
        v-for="dashboard in visibleDashboards"
        :key="dashboard"
        class="dashboard-card"
      >
        <div class="dashboard-header">
          <h3 class="dashboard-title">{{ getDashboardTitle(dashboard) }}</h3>
          <ion-button fill="clear" size="small" @click="exportDashboard(dashboard)">
            <ion-icon :icon="downloadOutline"></ion-icon>
          </ion-button>
        </div>
        <div v-if="isLoadingDashboard(dashboard)" class="loading-mini">
          <ion-spinner name="dots"></ion-spinner>
        </div>
        <div v-else-if="getDashboardData(dashboard) && getDashboardData(dashboard).length > 0" class="dashboard-chart">
          <div 
            class="chart-items-container"
            :class="{ 'chart-scrollable': getDashboardData(dashboard).length > 10 }"
          >
            <div
              v-for="item in getDashboardData(dashboard)"
              :key="item.name"
              class="chart-item"
              @click="openUserModal(dashboard, item.name)"
            >
              <div class="chart-bar-container">
                <div
                  class="chart-bar"
                  :style="{ width: `${(item.value / maxValue(dashboard)) * 100}%` }"
                ></div>
              </div>
              <div class="chart-label">{{ item.name }}</div>
              <div class="chart-value">{{ item.value }}</div>
            </div>
          </div>
        </div>
        <div v-else class="no-data">{{ getNoDataMessage(dashboard) }}</div>
      </div>
    </div>

    <!-- User Stats Table -->
    <div class="user-stats-table-section">
      <div class="section-header secondary">
        <h3 class="section-title-small">User Actions Table</h3>
        <div class="user-table-actions">
          <ion-button fill="clear" size="small" @click="loadUserTableData">
            <ion-icon :icon="refreshOutline" slot="start"></ion-icon>
            Refresh
          </ion-button>
          <ion-button fill="outline" size="small" @click="exportUserTableCsv">
            <ion-icon :icon="downloadOutline" slot="start"></ion-icon>
            Download CSV
          </ion-button>
        </div>
      </div>

      <div class="user-table-controls">
        <div class="control-field">
          <label>Start Date</label>
          <input
            type="date"
            v-model="userTableStartDate"
            @change="loadUserTableData"
          />
        </div>
        <div class="control-field">
          <label>End Date</label>
          <input
            type="date"
            v-model="userTableEndDate"
            @change="loadUserTableData"
          />
        </div>
        <div class="control-field search">
          <input
            type="search"
            placeholder="Search name, email, city, state, country"
            v-model="userTableSearch"
            @input="handleUserTableSearch"
          />
        </div>
        <div class="control-field">
          <label>Page size</label>
          <select
            :value="userTablePageSize"
            @change="changeUserTablePageSize(parseInt(($event.target as HTMLSelectElement).value))"
          >
            <option :value="10">10</option>
            <option :value="25">25</option>
            <option :value="50">50</option>
          </select>
        </div>
        <div class="control-summary">{{ userTableRangeLabel }}</div>
      </div>

      <div class="user-table-wrapper">
        <div v-if="userTableLoading" class="loading-state">
          <ion-spinner></ion-spinner>
          <p>Loading users...</p>
        </div>
        <div v-else-if="pagedUserTableRows.length === 0" class="no-data">
          No user data for this range.
        </div>
        <div v-else class="table-scroll">
          <table class="user-table">
            <thead>
              <tr>
                <th
                  v-for="col in visibleUserTableColumns"
                  :key="col.prop"
                  @click="changeUserTableSort(col.prop)"
                  :class="{ sortable: true, active: userTableSortBy === col.prop }"
                >
                  {{ col.name }}
                  <span v-if="userTableSortBy === col.prop">
                    {{ userTableSortDir === 'asc' ? '▲' : '▼' }}
                  </span>
                </th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in pagedUserTableRows" :key="row.email || row.name">
                <td v-for="col in visibleUserTableColumns" :key="col.prop">
                  {{ getUserTableCell(row, col) }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="pagination-row">
          <button class="pager" :disabled="userTablePage === 1" @click="changeUserTablePage(-1)">Prev</button>
          <span class="pager-status">{{ userTableRangeLabel }}</span>
          <button
            class="pager"
            :disabled="userTablePage >= Math.max(1, Math.ceil(sortedUserTableRows.length / userTablePageSize))"
            @click="changeUserTablePage(1)"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  </div>

  <!-- User List Modal -->
  <ion-modal 
    :is-open="isUserModalOpen" 
    @didDismiss="closeUserModal"
    @willDismiss="closeUserModal"
    :backdrop-dismiss="true"
  >
    <ion-header>
      <ion-toolbar>
        <ion-title>{{ modalTitle }}</ion-title>
        <ion-buttons slot="end">
          <ion-button @click="closeUserModal" fill="clear">
            <ion-icon :icon="closeOutline"></ion-icon>
          </ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>
    <ion-content class="user-modal-content">
      <div v-if="isLoadingUsers" class="loading-state">
        <ion-spinner></ion-spinner>
        <p>Loading users...</p>
      </div>
      <div v-else-if="modalUsers.length === 0" class="no-users">
        <ion-icon :icon="peopleOutline" class="no-users-icon"></ion-icon>
        <p>No users found</p>
        <p class="no-users-hint">This feature requires backend support or user profile data to be available.</p>
      </div>
      <div v-else class="users-list">
        <div
          v-for="user in modalUsers"
          :key="user.id"
          class="user-item"
          @click="navigateToUser(user.id)"
        >
          <div class="user-avatar">
            <img
              v-if="user.profilePicture"
              :src="user.profilePicture"
              :alt="user.fullName"
            />
            <div v-else class="avatar-placeholder">
              {{ user.fullName.charAt(0).toUpperCase() }}
            </div>
          </div>
          <div class="user-info">
            <div class="user-name">{{ user.fullName }}</div>
            <div class="user-email">{{ user.email }}</div>
          </div>
          <ion-icon :icon="chevronForwardOutline" class="chevron-icon"></ion-icon>
        </div>
      </div>
    </ion-content>
  </ion-modal>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { adminService, type AttributeModel } from '@/services/admin.service';
import { profileService } from '@/services/profile.service';
import { toastController } from '@ionic/vue';
import {
  IonButton,
  IonIcon,
  IonCheckbox,
  IonLabel,
  IonSpinner,
  IonModal,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonButtons,
  IonContent,
} from '@ionic/vue';
import {
  downloadOutline,
  chevronDown,
  chevronUp,
  closeOutline,
  chevronForwardOutline,
  peopleOutline,
  refreshOutline,
} from 'ionicons/icons';
import { useRouter } from 'vue-router';
import type { CommunityMember } from '@/services/admin.service';

interface Props {
  communityId: number | null;
}

interface CustomField {
  id: number;
  name?: string;
  label?: string;
  [key: string]: any;
}

const props = defineProps<Props>();
const router = useRouter();

const isLoading = ref(false);
const hasLoadedData = ref(false);
const visibleDashboards = ref<string[]>([]);
const customFields = ref<CustomField[]>([]);
// Store custom field names from chart responses (fieldName from backend)
const customFieldNames = ref<Map<number, string>>(new Map());

// User modal state
const isUserModalOpen = ref(false);
const modalTitle = ref('');
const modalUsers = ref<CommunityMember[]>([]);
const isLoadingUsers = ref(false);
const currentModalContext = ref<{ dashboard: string; value: string } | null>(null);

// User stats table (slack-user-stats)
const userTableRows = ref<any[]>([]);
const userTableColumns = ref<any[]>([]);
const userTableTotal = ref(0);
const userTableLoading = ref(false);
const userTableSearch = ref('');
const userTableSortBy = ref<string>('homepageViews');
const userTableSortDir = ref<'asc' | 'desc'>('desc');
const userTablePage = ref(1);
const userTablePageSize = ref(25);
const userTableStartDate = ref(getStartOfMonthDate());
const userTableEndDate = ref(getTodayDate());

const defaultUserTableColumns = [
  { name: 'Name', prop: 'name', isVisible: true },
  { name: 'Trova Opens', prop: 'homepageViews', isVisible: true },
  { name: 'Intros Led To Convos', prop: 'introsLedToConvos', isVisible: true },
  { name: 'Profile Score', prop: 'profileCompletionScore', isVisible: true, isPercent: true },
  { name: 'City', prop: 'city', isVisible: true },
  { name: 'State', prop: 'state', isVisible: true },
  { name: 'Country', prop: 'country', isVisible: true },
];

const visibleUserTableColumns = computed(() => {
  const columns = userTableColumns.value && userTableColumns.value.length > 0
    ? userTableColumns.value
    : defaultUserTableColumns;
  return columns.filter((col: any) => col.isVisible !== false);
});

const filteredUserTableRows = computed(() => {
  if (!userTableSearch.value) return userTableRows.value;
  const term = userTableSearch.value.toLowerCase();
  return userTableRows.value.filter((row: any) => {
    return ['name', 'email', 'city', 'state', 'country']
      .some((field) => (row[field] || '').toString().toLowerCase().includes(term));
  });
});

const sortedUserTableRows = computed(() => {
  const rows = [...filteredUserTableRows.value];
  const sortKey = userTableSortBy.value;
  const dir = userTableSortDir.value === 'asc' ? 1 : -1;
  rows.sort((a: any, b: any) => {
    const va = a?.[sortKey];
    const vb = b?.[sortKey];
    if (va === vb) return 0;
    // Numeric sort when both are numbers
    if (typeof va === 'number' && typeof vb === 'number') {
      return (va - vb) * dir;
    }
    // Fallback string compare
    return va?.toString().localeCompare(vb?.toString()) * dir;
  });
  return rows;
});

const pagedUserTableRows = computed(() => {
  const start = (userTablePage.value - 1) * userTablePageSize.value;
  return sortedUserTableRows.value.slice(start, start + userTablePageSize.value);
});

const userTableRangeLabel = computed(() => {
  const total = sortedUserTableRows.value.length;
  if (total === 0) return 'Showing 0';
  const start = (userTablePage.value - 1) * userTablePageSize.value + 1;
  const end = Math.min(total, start + userTablePageSize.value - 1);
  return `Showing ${start}-${end} of ${userTableTotal.value || total}`;
});

// Helper functions for date defaults
function getStartOfMonthDate(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = '01';
  return `${year}-${month}-${day}`;
}

function getTodayDate(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// User table functions
async function loadUserTableData() {
  if (!props.communityId) return;
  
  userTableLoading.value = true;
  try {
    const startDate = userTableStartDate.value ? new Date(userTableStartDate.value).toISOString() : undefined;
    const endDate = userTableEndDate.value ? new Date(userTableEndDate.value + 'T23:59:59').toISOString() : undefined;
    
    const result = await adminService.getSlackUserStats(props.communityId, startDate, endDate);
    
    userTableRows.value = result.rows || [];
    // Filter out Spotlights, Mentor/mentee matches, and General Actions columns
    const columnsToExclude = [
      'spotlights', 
      'spotlightscreated', 
      'spotlights_created',
      'mentormentee', 
      'mentormenteematches', 
      'mentor_mentee',
      'mentor_mentee_matches',
      'mentor/mentee', 
      'mentor/mentee matches',
      'generalactions',
      'general_actions',
      'profileactions',
      'profile_actions'
    ];
    userTableColumns.value = (result.columns || []).filter((col: any) => {
      const colName = (col.name || '').toLowerCase().replace(/[_\s\/]/g, '');
      const colProp = (col.prop || '').toLowerCase().replace(/[_\s\/]/g, '');
      return !columnsToExclude.some(exclude => 
        colName.includes(exclude) || colProp.includes(exclude)
      );
    });
    userTableTotal.value = result.totalUserCount || result.rows?.length || 0;
    userTablePage.value = 1; // Reset to first page on new load
  } catch (error) {
    console.error('[AnalyticsDashboardSection] Error loading user table data:', error);
    userTableRows.value = [];
    userTableColumns.value = [];
    userTableTotal.value = 0;
  } finally {
    userTableLoading.value = false;
  }
}

function handleUserTableSearch() {
  userTablePage.value = 1; // Reset to first page on search
}

function changeUserTableSort(prop: string) {
  if (userTableSortBy.value === prop) {
    userTableSortDir.value = userTableSortDir.value === 'asc' ? 'desc' : 'asc';
  } else {
    userTableSortBy.value = prop;
    userTableSortDir.value = 'desc'; // Default to descending
  }
  userTablePage.value = 1; // Reset to first page on sort change
}

function changeUserTablePage(delta: number) {
  const totalPages = Math.max(1, Math.ceil(sortedUserTableRows.value.length / userTablePageSize.value));
  const nextPage = userTablePage.value + delta;
  if (nextPage < 1 || nextPage > totalPages) return;
  userTablePage.value = nextPage;
}

function changeUserTablePageSize(size: number) {
  userTablePageSize.value = size;
  userTablePage.value = 1; // Reset to first page on size change
}

function getUserTableCell(row: any, col: any): string {
  const value = row[col.prop];
  if (value === null || value === undefined) return '';
  
  if (col.isPercent && typeof value === 'number') {
    return `${value.toFixed(1)}%`;
  }
  
  if (typeof value === 'number') {
    return value.toString();
  }
  
  return String(value);
}

async function exportUserTableCsv() {
  if (!props.communityId || sortedUserTableRows.value.length === 0) {
    const toast = await toastController.create({
      message: 'No data available to export',
      duration: 2000,
      color: 'warning',
    });
    await toast.present();
    return;
  }

  try {
    const headers = visibleUserTableColumns.value.map(col => col.name).join(',');
    const rows = sortedUserTableRows.value.map(row => {
      return visibleUserTableColumns.value.map(col => {
        const value = row[col.prop];
        if (value === null || value === undefined) return '';
        if (col.isPercent && typeof value === 'number') {
          return `${value.toFixed(1)}%`;
        }
        // Escape commas and quotes in CSV
        const str = String(value);
        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      }).join(',');
    });
    
    const csv = [headers, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    adminService.downloadCSV(blob, `user_actions_${props.communityId}_${Date.now()}.csv`);
    
    const toast = await toastController.create({
      message: 'User table exported successfully',
      duration: 2000,
      color: 'success',
    });
    await toast.present();
  } catch (error) {
    console.error('Error exporting user table:', error);
    const toast = await toastController.create({
      message: 'Failed to export user table',
      duration: 2000,
      color: 'danger',
    });
    await toast.present();
  }
}

// Consolidated data for charts (consolidateResults=true)
const dashboardData = ref<Record<string, AttributeModel[]>>({});
// Raw data for CSV export (consolidateResults=false)
const dashboardDataAll = ref<Record<string, AttributeModel[]>>({});
// Loading states per dashboard
const dashboardLoading = ref<Set<string>>(new Set());
// Custom field loading states
const customFieldLoading = ref<Set<number>>(new Set());
// Collapsible selector state
const isSelectorCollapsed = ref(true); // Default to collapsed

const defaultDashboards = [
  'interests',
  'activities',
  'businessTopics',
  'skills',
  'mentors',
  'mentees',
];

// Additional Dashboards - Removed for now, can be restored later if needed
const additionalDashboards: string[] = [];

// Dashboards that were removed and should be filtered out from localStorage
const removedDashboards = [
  'intention',
  'movies',
  'music',
  'occupation',
  'organization',
  'university',
  'location',
];

// Initialize dashboard options with defaults
function initializeDashboardOptions() {
  if (!props.communityId) return;

  const storageKey = `admin_dashboards_${props.communityId}`;
  const saved = localStorage.getItem(storageKey);
  if (saved) {
    try {
      const loaded = JSON.parse(saved);
      // Filter out removed dashboards
      const filtered = loaded.filter((dashboard: string) => 
        !removedDashboards.includes(dashboard)
      );
      
      // If any were removed, save the cleaned list back to localStorage
      if (filtered.length !== loaded.length) {
        visibleDashboards.value = filtered;
        saveVisibleDashboards();
      } else {
        visibleDashboards.value = filtered;
      }
    } catch (e) {
      visibleDashboards.value = [...defaultDashboards];
    }
  } else {
    visibleDashboards.value = [...defaultDashboards];
  }

  // Load selector collapse state (default to collapsed)
  const collapseKey = `admin_dashboards_collapsed_${props.communityId}`;
  const collapseSaved = localStorage.getItem(collapseKey);
  if (collapseSaved !== null) {
    isSelectorCollapsed.value = JSON.parse(collapseSaved);
  } else {
    isSelectorCollapsed.value = true; // Default to collapsed
  }
}

function toggleSelectorCollapse() {
  isSelectorCollapsed.value = !isSelectorCollapsed.value;
  if (props.communityId) {
    const collapseKey = `admin_dashboards_collapsed_${props.communityId}`;
    localStorage.setItem(collapseKey, JSON.stringify(isSelectorCollapsed.value));
  }
}

function saveVisibleDashboards() {
  if (!props.communityId) return;
  const storageKey = `admin_dashboards_${props.communityId}`;
  localStorage.setItem(storageKey, JSON.stringify(visibleDashboards.value));
}

async function loadAllDashboardData() {
  if (!props.communityId) return;

  isLoading.value = true;
  hasLoadedData.value = false;

  try {
    // Load all default and additional dashboards in parallel
    const promises: Promise<void>[] = [];

    // Default dashboards
    promises.push(loadInterestsData());
    promises.push(loadActivitiesData());
    promises.push(loadBusinessTopicsData());
    promises.push(loadSkillsData());
    promises.push(loadMentorsData());
    promises.push(loadMenteesData());

    // Additional dashboards - Removed for now, can be restored later if needed
    // promises.push(loadIntentionData());
    // promises.push(loadMovieData());
    // promises.push(loadMusicData());
    // promises.push(loadOccupationData());
    // promises.push(loadOrganizationData());
    // promises.push(loadUniversityData());
    // promises.push(loadLocationData());

    await Promise.all(promises);
    hasLoadedData.value = true;
  } catch (error) {
    console.error('Error loading dashboard data:', error);
  } finally {
    isLoading.value = false;
  }
}

// Load interests data
async function loadInterestsData() {
  if (!props.communityId) return;
  dashboardLoading.value.add('interests');
  try {
    const [consolidated, raw] = await Promise.all([
      adminService.getAttributeChartData(props.communityId, 'interest', true, true),
      adminService.getAttributeChartData(props.communityId, 'interest', false, true),
    ]);
    adminService.verifyConsolidatedData(consolidated, 'interests');
    dashboardData.value['interests'] = consolidated;
    dashboardDataAll.value['interests'] = raw;
  } catch (error) {
    console.error('Error loading interests:', error);
    dashboardData.value['interests'] = [];
    dashboardDataAll.value['interests'] = [];
  } finally {
    dashboardLoading.value.delete('interests');
  }
}

// Load activities data
async function loadActivitiesData() {
  if (!props.communityId) return;
  dashboardLoading.value.add('activities');
  try {
    const [consolidated, raw] = await Promise.all([
      adminService.getAttributeChartData(props.communityId, 'activity', true, true),
      adminService.getAttributeChartData(props.communityId, 'activity', false, true),
    ]);
    adminService.verifyConsolidatedData(consolidated, 'activities');
    dashboardData.value['activities'] = consolidated;
    dashboardDataAll.value['activities'] = raw;
  } catch (error) {
    console.error('Error loading activities:', error);
    dashboardData.value['activities'] = [];
    dashboardDataAll.value['activities'] = [];
  } finally {
    dashboardLoading.value.delete('activities');
  }
}

// Load business topics data
async function loadBusinessTopicsData() {
  if (!props.communityId) return;
  dashboardLoading.value.add('businessTopics');
  try {
    const [consolidated, raw] = await Promise.all([
      adminService.getBusinessTopicsChartData(props.communityId, true, true),
      adminService.getBusinessTopicsChartData(props.communityId, false, true),
    ]);
    adminService.verifyConsolidatedData(consolidated, 'businessTopics');
    dashboardData.value['businessTopics'] = consolidated;
    dashboardDataAll.value['businessTopics'] = raw;
  } catch (error) {
    console.error('Error loading business topics:', error);
    dashboardData.value['businessTopics'] = [];
    dashboardDataAll.value['businessTopics'] = [];
  } finally {
    dashboardLoading.value.delete('businessTopics');
  }
}

// Load skills data
async function loadSkillsData() {
  if (!props.communityId) return;
  dashboardLoading.value.add('skills');
  try {
    const [consolidated, raw] = await Promise.all([
      adminService.getSkillsChartData(props.communityId, 'general', true, true),
      adminService.getSkillsChartData(props.communityId, 'general', false, true),
    ]);
    adminService.verifyConsolidatedData(consolidated, 'skills');
    dashboardData.value['skills'] = consolidated;
    dashboardDataAll.value['skills'] = raw;
  } catch (error) {
    console.error('Error loading skills:', error);
    dashboardData.value['skills'] = [];
    dashboardDataAll.value['skills'] = [];
  } finally {
    dashboardLoading.value.delete('skills');
  }
}

// Load mentors data
async function loadMentorsData() {
  if (!props.communityId) return;
  dashboardLoading.value.add('mentors');
  try {
    const [consolidated, raw] = await Promise.all([
      adminService.getSkillsChartData(props.communityId, 'mentor', true, true),
      adminService.getSkillsChartData(props.communityId, 'mentor', false, true),
    ]);
    adminService.verifyConsolidatedData(consolidated, 'mentors');
    dashboardData.value['mentors'] = consolidated;
    dashboardDataAll.value['mentors'] = raw;
  } catch (error) {
    console.error('Error loading mentors:', error);
    dashboardData.value['mentors'] = [];
    dashboardDataAll.value['mentors'] = [];
  } finally {
    dashboardLoading.value.delete('mentors');
  }
}

// Load mentees data
async function loadMenteesData() {
  if (!props.communityId) return;
  dashboardLoading.value.add('mentees');
  try {
    const [consolidated, raw] = await Promise.all([
      adminService.getSkillsChartData(props.communityId, 'mentee', true, true),
      adminService.getSkillsChartData(props.communityId, 'mentee', false, true),
    ]);
    adminService.verifyConsolidatedData(consolidated, 'mentees');
    dashboardData.value['mentees'] = consolidated;
    dashboardDataAll.value['mentees'] = raw;
  } catch (error) {
    console.error('Error loading mentees:', error);
    dashboardData.value['mentees'] = [];
    dashboardDataAll.value['mentees'] = [];
  } finally {
    dashboardLoading.value.delete('mentees');
  }
}

// Load intention data
async function loadIntentionData() {
  if (!props.communityId) return;
  dashboardLoading.value.add('intention');
  try {
    const [consolidated, raw] = await Promise.all([
      adminService.getAttributeChartData(props.communityId, 'intention', true, true),
      adminService.getAttributeChartData(props.communityId, 'intention', false, true),
    ]);
    adminService.verifyConsolidatedData(consolidated, 'intention');
    dashboardData.value['intention'] = consolidated;
    dashboardDataAll.value['intention'] = raw;
  } catch (error) {
    console.error('Error loading intention:', error);
    dashboardData.value['intention'] = [];
    dashboardDataAll.value['intention'] = [];
  } finally {
    dashboardLoading.value.delete('intention');
  }
}

// Load movie data
async function loadMovieData() {
  if (!props.communityId) return;
  dashboardLoading.value.add('movies');
  try {
    const [consolidated, raw] = await Promise.all([
      adminService.getAttributeChartData(props.communityId, 'movie', true, true),
      adminService.getAttributeChartData(props.communityId, 'movie', false, true),
    ]);
    adminService.verifyConsolidatedData(consolidated, 'movies');
    dashboardData.value['movies'] = consolidated;
    dashboardDataAll.value['movies'] = raw;
  } catch (error) {
    console.error('Error loading movies:', error);
    dashboardData.value['movies'] = [];
    dashboardDataAll.value['movies'] = [];
  } finally {
    dashboardLoading.value.delete('movies');
  }
}

// Load music data
async function loadMusicData() {
  if (!props.communityId) return;
  dashboardLoading.value.add('music');
  try {
    const [consolidated, raw] = await Promise.all([
      adminService.getAttributeChartData(props.communityId, 'music', true, true),
      adminService.getAttributeChartData(props.communityId, 'music', false, true),
    ]);
    adminService.verifyConsolidatedData(consolidated, 'music');
    dashboardData.value['music'] = consolidated;
    dashboardDataAll.value['music'] = raw;
  } catch (error) {
    console.error('Error loading music:', error);
    dashboardData.value['music'] = [];
    dashboardDataAll.value['music'] = [];
  } finally {
    dashboardLoading.value.delete('music');
  }
}

// Load occupation data
async function loadOccupationData() {
  if (!props.communityId) return;
  dashboardLoading.value.add('occupation');
  try {
    const [consolidated, raw] = await Promise.all([
      adminService.getAttributeChartData(props.communityId, 'occupation', true, true),
      adminService.getAttributeChartData(props.communityId, 'occupation', false, true),
    ]);
    adminService.verifyConsolidatedData(consolidated, 'occupation');
    dashboardData.value['occupation'] = consolidated;
    dashboardDataAll.value['occupation'] = raw;
  } catch (error) {
    console.error('Error loading occupation:', error);
    dashboardData.value['occupation'] = [];
    dashboardDataAll.value['occupation'] = [];
  } finally {
    dashboardLoading.value.delete('occupation');
  }
}

// Load organization data
async function loadOrganizationData() {
  if (!props.communityId) return;
  dashboardLoading.value.add('organization');
  try {
    const [consolidated, raw] = await Promise.all([
      adminService.getAttributeChartData(props.communityId, 'organization', true, true),
      adminService.getAttributeChartData(props.communityId, 'organization', false, true),
    ]);
    adminService.verifyConsolidatedData(consolidated, 'organization');
    dashboardData.value['organization'] = consolidated;
    dashboardDataAll.value['organization'] = raw;
  } catch (error) {
    console.error('Error loading organization:', error);
    dashboardData.value['organization'] = [];
    dashboardDataAll.value['organization'] = [];
  } finally {
    dashboardLoading.value.delete('organization');
  }
}

// Load university data
async function loadUniversityData() {
  if (!props.communityId) return;
  dashboardLoading.value.add('university');
  try {
    const [consolidated, raw] = await Promise.all([
      adminService.getAttributeChartData(props.communityId, 'university', true, true),
      adminService.getAttributeChartData(props.communityId, 'university', false, true),
    ]);
    adminService.verifyConsolidatedData(consolidated, 'university');
    dashboardData.value['university'] = consolidated;
    dashboardDataAll.value['university'] = raw;
  } catch (error) {
    console.error('Error loading university:', error);
    dashboardData.value['university'] = [];
    dashboardDataAll.value['university'] = [];
  } finally {
    dashboardLoading.value.delete('university');
  }
}

// Load location data
async function loadLocationData() {
  if (!props.communityId) return;
  dashboardLoading.value.add('location');
  try {
    const [consolidated, raw] = await Promise.all([
      adminService.getAttributeChartData(props.communityId, 'location', true, true),
      adminService.getAttributeChartData(props.communityId, 'location', false, true),
    ]);
    adminService.verifyConsolidatedData(consolidated, 'location');
    dashboardData.value['location'] = consolidated;
    dashboardDataAll.value['location'] = raw;
  } catch (error) {
    console.error('Error loading location:', error);
    dashboardData.value['location'] = [];
    dashboardDataAll.value['location'] = [];
  } finally {
    dashboardLoading.value.delete('location');
  }
}

// Load custom fields
async function loadCustomFields() {
  if (!props.communityId) return;

  try {
    const fields = await adminService.getCustomFieldsForCharts(props.communityId);
    customFields.value = fields || [];
    
    // Only fetch chart data for custom fields that are in visibleDashboards
    // This ensures we don't make unnecessary API calls for fields that aren't displayed
    ensureCustomFieldDataLoaded();
  } catch (error) {
    console.error('Error loading custom fields:', error);
    customFields.value = [];
  }
}

// Ensure custom field data is loaded for selected dashboards
function ensureCustomFieldDataLoaded() {
  if (!props.communityId) return;

  // Clean up any bad keys with double "custom-" prefix and fix them
  const badKeys: string[] = [];
  const fixedKeys: string[] = [];
  visibleDashboards.value.forEach(dashboard => {
    if (dashboard.startsWith('custom-custom-')) {
      // Fix double prefix: "custom-custom-480" -> "custom-480"
      const fixed = dashboard.replace('custom-custom-', 'custom-');
      badKeys.push(dashboard);
      if (!visibleDashboards.value.includes(fixed)) {
        fixedKeys.push(fixed);
      }
    }
  });
  
  // Remove bad keys and add fixed keys
  if (badKeys.length > 0) {
    console.log(`[AnalyticsDashboard] Fixing ${badKeys.length} bad custom field keys:`, badKeys);
    badKeys.forEach(badKey => {
      const index = visibleDashboards.value.indexOf(badKey);
      if (index > -1) {
        visibleDashboards.value.splice(index, 1);
      }
    });
    fixedKeys.forEach(fixedKey => {
      if (!visibleDashboards.value.includes(fixedKey)) {
        visibleDashboards.value.push(fixedKey);
      }
    });
    saveVisibleDashboards(); // Save the corrected keys
  }
  
  const selectedCustomFields = visibleDashboards.value
    .filter(d => d.startsWith('custom-') && !d.startsWith('custom-custom-')) // Exclude any remaining bad keys
    .map(d => {
      // Handle both "custom-480" and "custom-custom-480" (just in case)
      const cleaned = d.replace(/^custom-custom-/, 'custom-').replace(/^custom-/, '');
      const id = parseInt(cleaned, 10);
      return isNaN(id) ? null : id;
    })
    .filter((id): id is number => id !== null);

  selectedCustomFields.forEach((customFieldId) => {
    const dashboardKey = `custom-${customFieldId}`;
    const hasData = dashboardData.value[dashboardKey] && dashboardData.value[dashboardKey].length > 0;
    const isLoading = customFieldLoading.value.has(customFieldId);
    
    if (!hasData && !isLoading) {
      fetchCustomFieldChartData(customFieldId);
    }
  });
}

// Fetch custom field chart data
async function fetchCustomFieldChartData(customFieldId: number) {
  if (!props.communityId) return;

  customFieldLoading.value.add(customFieldId);
  try {
    const [consolidatedResponse, rawResponse] = await Promise.all([
      adminService.getCustomFieldChartData(props.communityId, customFieldId, true, true),
      adminService.getCustomFieldChartData(props.communityId, customFieldId, false, true),
    ]);
    
    // Extract data and metadata from responses
    // Backend now returns: { results: [...], fieldName: "...", customFieldName: "...", fieldId: ... }
    // Or legacy format: { data: [...] } or direct array
    const getDataArray = (response: any): AttributeModel[] => {
      if (Array.isArray(response)) {
        return response;
      } else if (response && Array.isArray(response.results)) {
        // New format: { results: [...] }
        return response.results;
      } else if (response && Array.isArray(response.data)) {
        // Legacy format: { data: [...] }
        return response.data;
      }
      console.warn(`[AnalyticsDashboard] Unexpected response format for custom field ${customFieldId}:`, response);
      return [];
    };
    
    const consolidated: AttributeModel[] = getDataArray(consolidatedResponse);
    const raw: AttributeModel[] = getDataArray(rawResponse);
    
    // Extract fieldName from response (backend includes fieldName, customFieldName, fieldId)
    const fieldName = (typeof consolidatedResponse === 'object' && !Array.isArray(consolidatedResponse) && (consolidatedResponse?.fieldName || consolidatedResponse?.customFieldName))
      || (typeof rawResponse === 'object' && !Array.isArray(rawResponse) && (rawResponse?.fieldName || rawResponse?.customFieldName));
    if (fieldName && typeof fieldName === 'string') {
      // Replace the entire Map to ensure Vue reactivity detects the change
      const newMap = new Map(customFieldNames.value);
      newMap.set(customFieldId, fieldName);
      customFieldNames.value = newMap;
      console.log(`[AnalyticsDashboard] Custom field ${customFieldId} fieldName stored:`, fieldName);
      console.log(`[AnalyticsDashboard] customFieldNames Map now has:`, Array.from(customFieldNames.value.entries()));
    } else {
      console.warn(`[AnalyticsDashboard] Could not extract fieldName for custom field ${customFieldId} from responses:`, { consolidatedResponse, rawResponse });
    }
    
    adminService.verifyConsolidatedData(consolidated, `custom-field-${customFieldId}`);
    dashboardData.value[`custom-${customFieldId}`] = consolidated;
    dashboardDataAll.value[`custom-${customFieldId}`] = raw;
  } catch (error) {
    console.error(`Error loading custom field ${customFieldId}:`, error);
    dashboardData.value[`custom-${customFieldId}`] = [];
    dashboardDataAll.value[`custom-${customFieldId}`] = [];
  } finally {
    customFieldLoading.value.delete(customFieldId);
  }
}

function toggleDashboard(dashboard: string) {
  const index = visibleDashboards.value.indexOf(dashboard);
  if (index > -1) {
    visibleDashboards.value.splice(index, 1);
  } else {
    visibleDashboards.value.push(dashboard);
    // Load data if not already loaded
    if (!dashboardData.value[dashboard] && !dashboardLoading.value.has(dashboard)) {
      loadDashboardData(dashboard);
    }
  }
  saveVisibleDashboards();
}

// Helper function to extract numeric custom field ID from field object
function extractCustomFieldId(field: any): number | null {
  // Try different ways to extract the ID
  if (typeof field.id === 'number') {
    return field.id;
  } else if (typeof field.customFieldId === 'number') {
    return field.customFieldId;
  } else if (typeof field.id === 'string') {
    // Handle string IDs like "custom-480" or just "480"
    if (field.id.startsWith('custom-')) {
      const parsed = parseInt(field.id.replace('custom-', ''), 10);
      return isNaN(parsed) ? null : parsed;
    } else {
      const parsed = parseInt(field.id, 10);
      return isNaN(parsed) ? null : parsed;
    }
  }
  return null;
}

// Helper function to get the dashboard key for a custom field
function getCustomFieldDashboardKey(field: CustomField): string {
  const customFieldId = extractCustomFieldId(field);
  if (!customFieldId || customFieldId <= 0) {
    return `custom-invalid-${field.id}`; // Fallback for invalid IDs
  }
  return `custom-${customFieldId}`;
}

function toggleCustomFieldDashboard(field: CustomField) {
  const customFieldId = extractCustomFieldId(field);
  if (!customFieldId || customFieldId <= 0) {
    console.warn(`[AnalyticsDashboard] Could not extract customFieldId from field:`, field);
    return;
  }
  const dashboardKey = `custom-${customFieldId}`;
  toggleDashboard(dashboardKey);
  // Ensure data is loaded
  ensureCustomFieldDataLoaded();
}

async function loadDashboardData(dashboard: string) {
  // Map dashboard names to load functions
  const loaders: Record<string, () => Promise<void>> = {
    interests: loadInterestsData,
    activities: loadActivitiesData,
    businessTopics: loadBusinessTopicsData,
    skills: loadSkillsData,
    mentors: loadMentorsData,
    mentees: loadMenteesData,
    // Additional dashboards - Removed for now, can be restored later if needed
    // intention: loadIntentionData,
    // movies: loadMovieData,
    // music: loadMusicData,
    // occupation: loadOccupationData,
    // organization: loadOrganizationData,
    // university: loadUniversityData,
    // location: loadLocationData,
  };

  if (loaders[dashboard]) {
    await loaders[dashboard]();
  } else if (dashboard.startsWith('custom-')) {
    const customFieldId = parseInt(dashboard.replace('custom-', ''), 10);
    if (!isNaN(customFieldId) && customFieldId > 0) {
      await fetchCustomFieldChartData(customFieldId);
    }
  }
}

function getDashboardData(dashboard: string): AttributeModel[] {
  const data = dashboardData.value[dashboard];
  if (dashboard.startsWith('custom-')) {
    const customFieldId = parseInt(dashboard.replace(/^custom-custom-/, 'custom-').replace(/^custom-/, ''), 10);
    if (!isNaN(customFieldId)) {
      // Debug logging for custom fields
      if (!data || data.length === 0) {
        console.log(`[AnalyticsDashboard] getDashboardData('${dashboard}') returning empty - data exists:`, !!dashboardData.value[dashboard], 'length:', dashboardData.value[dashboard]?.length);
      }
    }
  }
  return data || [];
}

// Get appropriate message when no data is available
function getNoDataMessage(dashboard: string): string {
  // Check if data was successfully loaded but is empty (vs error/not loaded)
  const data = dashboardData.value[dashboard];
  const wasLoaded = data !== undefined; // If data exists (even if empty array), it was loaded
  const isLoading = dashboardLoading.value.has(dashboard) || (dashboard.startsWith('custom-') && customFieldLoading.value.has(parseInt(dashboard.replace(/^custom-custom-/, 'custom-').replace(/^custom-/, ''), 10)));
  
  // If it's a custom field and data was loaded but is empty, it means no users have this datapoint
  if (dashboard.startsWith('custom-') && wasLoaded && !isLoading && Array.isArray(data) && data.length === 0) {
    return 'No users have this datapoint';
  }
  
  // Otherwise, it's a loading error or data not yet loaded
  return 'No data available';
}

function getDashboardTitle(dashboard: string): string {
  if (dashboard.startsWith('custom-')) {
    // Handle both "custom-480" and "custom-custom-480" (legacy bad keys)
    const cleaned = dashboard.replace(/^custom-custom-/, 'custom-').replace(/^custom-/, '');
    const customFieldId = parseInt(cleaned, 10);
    if (isNaN(customFieldId) || customFieldId <= 0) {
      console.warn(`[AnalyticsDashboard] Invalid custom field ID in dashboard: ${dashboard} (cleaned: ${cleaned})`);
      return 'Custom Field';
    }
    // Priority 1: Use fieldName from chart response (most reliable, from backend)
    const chartFieldName = customFieldNames.value.get(customFieldId);
    if (chartFieldName) {
      console.log(`[AnalyticsDashboard] getDashboardTitle('${dashboard}') using chartFieldName: ${chartFieldName}`);
      return chartFieldName;
    }
    // Priority 2: Try to find the field in the customFields array (from custom-fields-for-charts endpoint)
    const field = customFields.value.find(f => f.id === customFieldId);
    if (field?.name) {
      console.log(`[AnalyticsDashboard] getDashboardTitle('${dashboard}') using field.name: ${field.name}`);
      return field.name;
    }
    if (field?.label) {
      console.log(`[AnalyticsDashboard] getDashboardTitle('${dashboard}') using field.label: ${field.label}`);
      return field.label;
    }
    // Fallback: use generic name if field not found
    return `Custom Field ${customFieldId}`;
  }
  return formatDashboardName(dashboard);
}

function formatDashboardName(name: string): string {
  return name
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (str) => str.toUpperCase())
    .trim();
}

function maxValue(dashboard: string): number {
  const data = getDashboardData(dashboard);
  if (!data || data.length === 0) return 1;
  return Math.max(...data.map((item) => item.value));
}

function isLoadingDashboard(dashboard: string): boolean {
  if (dashboard.startsWith('custom-')) {
    const customFieldId = parseInt(dashboard.replace('custom-', ''), 10);
    if (isNaN(customFieldId) || customFieldId <= 0) {
      return false;
    }
    return customFieldLoading.value.has(customFieldId);
  }
  return dashboardLoading.value.has(dashboard);
}

// Convert AttributeModel[] to CSV format
function convertToCSV(data: AttributeModel[], dashboardName: string): string {
  const headers = ['Name', 'Count'];
  const rows = data.map(item => [item.name, item.value.toString()]);
  return [headers, ...rows].map(row => row.join(',')).join('\n');
}

async function exportDashboard(dashboardName: string) {
  if (!props.communityId) return;

  try {
    // Use raw data (consolidateResults=false) for CSV export
    const rawData = dashboardDataAll.value[dashboardName] || dashboardData.value[dashboardName] || [];
    
    if (rawData.length === 0) {
      const toast = await toastController.create({
        message: 'No data available to export',
        duration: 2000,
        color: 'warning',
      });
      await toast.present();
      return;
    }

    const csv = convertToCSV(rawData, dashboardName);
    const blob = new Blob([csv], { type: 'text/csv' });
    adminService.downloadCSV(blob, `${dashboardName}_${props.communityId}_${Date.now()}.csv`);
    
    const toast = await toastController.create({
      message: 'Dashboard exported successfully',
      duration: 2000,
      color: 'success',
    });
    await toast.present();
  } catch (error) {
    console.error('Error exporting dashboard:', error);
    const toast = await toastController.create({
      message: 'Failed to export dashboard',
      duration: 2000,
      color: 'danger',
    });
    await toast.present();
  }
}

async function exportAllDashboards() {
  if (!props.communityId) return;

  try {
    // Collect all raw data from visible dashboards
    const allData: Array<{ dashboard: string; data: AttributeModel[] }> = [];
    
    visibleDashboards.value.forEach(dashboard => {
      const rawData = dashboardDataAll.value[dashboard] || dashboardData.value[dashboard] || [];
      if (rawData.length > 0) {
        allData.push({ dashboard, data: rawData });
      }
    });

    if (allData.length === 0) {
      const toast = await toastController.create({
        message: 'No data available to export',
        duration: 2000,
        color: 'warning',
      });
      await toast.present();
      return;
    }

    // Create CSV with all dashboards
    const csvLines: string[] = [];
    allData.forEach(({ dashboard, data }) => {
      csvLines.push(`\n=== ${getDashboardTitle(dashboard)} ===`);
      csvLines.push('Name,Count');
      data.forEach(item => {
        csvLines.push(`${item.name},${item.value}`);
      });
    });

    const csv = csvLines.join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    adminService.downloadCSV(blob, `insights_${props.communityId}_${Date.now()}.csv`);
    
    const toast = await toastController.create({
      message: 'All dashboards exported successfully',
      duration: 2000,
      color: 'success',
    });
    await toast.present();
  } catch (error) {
    console.error('Error exporting dashboards:', error);
    const toast = await toastController.create({
      message: 'Failed to export dashboards',
      duration: 2000,
      color: 'danger',
    });
    await toast.present();
  }
}

onMounted(async () => {
  if (props.communityId) {
    initializeDashboardOptions();
    await loadAllDashboardData();
    await loadCustomFields(); // Wait for custom fields to load, then ensure data is loaded for visible ones
    // Final check to ensure all visible custom fields have data loaded
    ensureCustomFieldDataLoaded();
    loadUserTableData();
  }
});

watch(() => props.communityId, (newId, oldId) => {
  if (newId && newId !== oldId) {
    // Reset state when community changes
    dashboardData.value = {};
    dashboardDataAll.value = {};
    customFields.value = [];
    customFieldNames.value.clear();
    visibleDashboards.value = [];
    dashboardLoading.value.clear();
    customFieldLoading.value.clear();
    hasLoadedData.value = false;
    userTableRows.value = [];
    userTableColumns.value = [];
    userTableTotal.value = 0;
    
    // Initialize and load (matching production setCommunity pattern)
    initializeDashboardOptions();
    loadAllDashboardData();
    loadCustomFields();
    loadUserTableData();
  }
}, { immediate: false });

// Watch for visible dashboards changes to ensure custom field data is loaded
watch(() => visibleDashboards.value, () => {
  ensureCustomFieldDataLoaded();
}, { deep: true });

// Open user modal for a specific attribute value
async function openUserModal(dashboard: string, value: string) {
  if (!props.communityId) return;

  currentModalContext.value = { dashboard, value };
  modalTitle.value = `${getDashboardTitle(dashboard)}: ${value}`;
  isUserModalOpen.value = true;
  isLoadingUsers.value = true;
  modalUsers.value = [];

  try {
    let users: CommunityMember[] = [];

    // Determine the attribute type based on dashboard name
    if (dashboard === 'interests') {
      users = await adminService.getUsersByAttribute(props.communityId, 'interest', value, true);
    } else if (dashboard === 'activities') {
      users = await adminService.getUsersByAttribute(props.communityId, 'activity', value, true);
    } else if (dashboard === 'businessTopics') {
      users = await adminService.getUsersByBusinessTopic(props.communityId, value, true);
    } else if (dashboard === 'skills') {
      users = await adminService.getUsersBySkill(props.communityId, 'general', value, true);
    } else if (dashboard === 'mentors') {
      users = await adminService.getUsersBySkill(props.communityId, 'mentor', value, true);
    } else if (dashboard === 'mentees') {
      users = await adminService.getUsersBySkill(props.communityId, 'mentee', value, true);
    } 
    // Additional dashboards - Removed for now, can be restored later if needed
    // else if (dashboard === 'intention') {
    //   users = await adminService.getUsersByAttribute(props.communityId, 'intention', value, true);
    // } else if (dashboard === 'movies') {
    //   users = await adminService.getUsersByAttribute(props.communityId, 'movie', value, true);
    // } else if (dashboard === 'music') {
    //   users = await adminService.getUsersByAttribute(props.communityId, 'music', value, true);
    // } else if (dashboard === 'occupation') {
    //   users = await adminService.getUsersByAttribute(props.communityId, 'occupation', value, true);
    // } else if (dashboard === 'organization') {
    //   users = await adminService.getUsersByAttribute(props.communityId, 'organization', value, true);
    // } else if (dashboard === 'university') {
    //   users = await adminService.getUsersByAttribute(props.communityId, 'university', value, true);
    // } else if (dashboard === 'location') {
    //   users = await adminService.getUsersByAttribute(props.communityId, 'location', value, true);
    // } 
    else if (dashboard.startsWith('custom-')) {
      const customFieldId = parseInt(dashboard.replace('custom-', ''), 10);
      if (!isNaN(customFieldId) && customFieldId > 0) {
        users = await adminService.getUsersByCustomField(props.communityId, customFieldId, value, true);
      } else {
        console.warn(`[AnalyticsDashboard] Invalid customFieldId extracted from dashboard: "${dashboard}"`);
      }
    }

    // Check if the returned user count matches the expected count from the dashboard
    // If there's a mismatch, use fallback to get all users from raw dashboard data
    const dashboardData = getDashboardData(dashboard);
    const expectedItem = dashboardData.find((item: any) => {
      const normalize = (s: any) => (s == null ? '' : String(s)).trim().toLowerCase();
      return normalize(item.name || item.label || item.valueName || item.value_name) === normalize(value);
    });
    const expectedCount = expectedItem?.value || 0;
    const actualCount = users?.length || 0;
    
    // If we got users but the count doesn't match, or if we got 0 users, use fallback
    const shouldUseFallback = !users || users.length === 0 || (expectedCount > 0 && actualCount < expectedCount);
    
    if (shouldUseFallback) {
      if (actualCount > 0 && actualCount < expectedCount) {
        console.warn(`[AnalyticsDashboard] Count mismatch: expected ${expectedCount} users but got ${actualCount}, using fallback`);
      }
      const raw = (dashboardDataAll.value[dashboard] as any[]) || [];
      
      const normalize = (s: any) => (s == null ? '' : String(s)).trim().toLowerCase();
      const needle = normalize(value);
      const getRowLabel = (r: any) =>
        r?.name ??
        r?.label ??
        r?.valueName ??
        r?.value_name ??
        r?.attribute ??
        r?.attributeName ??
        r?.attribute_name ??
        r?.skill ??
        r?.topic ??
        '';
      const isLocation = dashboard === 'location';
      const matching = raw.filter((r) => {
        const label = normalize(getRowLabel(r));
        if (!label) return false;
        return isLocation ? label.includes(needle) : label === needle;
      });


      // Enhanced user ID extraction function
      const extractUserIdFromRow = (row: any): number | null => {
        // Check top-level fields
        const topLevelCandidates = [
          row?.userId,
          row?.user_id,
          row?.profileId,
          row?.profile_id,
          row?.memberId,
          row?.member_id,
          row?.id,
          row?.slackUserId,
          row?.slack_user_id,
        ];
        
        for (const c of topLevelCandidates) {
          const n = typeof c === 'string' ? parseInt(c, 10) : c;
          if (typeof n === 'number' && Number.isFinite(n) && n > 0) return n;
        }
        
        // Check nested user object
        if (row?.user) {
          const userCandidates = [
            row.user.id,
            row.user.userId,
            row.user.user_id,
            row.user.memberId,
            row.user.member_id,
          ];
          for (const c of userCandidates) {
            const n = typeof c === 'string' ? parseInt(c, 10) : c;
            if (typeof n === 'number' && Number.isFinite(n) && n > 0) return n;
          }
        }
        
        // Check nested profile object
        if (row?.profile) {
          const profileCandidates = [
            row.profile.userId,
            row.profile.user_id,
            row.profile.id,
            row.profile.memberId,
            row.profile.member_id,
          ];
          for (const c of profileCandidates) {
            const n = typeof c === 'string' ? parseInt(c, 10) : c;
            if (typeof n === 'number' && Number.isFinite(n) && n > 0) return n;
          }
        }
        
        // Check nested member object
        if (row?.member) {
          const memberCandidates = [
            row.member.userId,
            row.member.user_id,
            row.member.id,
            row.member.memberId,
            row.member.member_id,
          ];
          for (const c of memberCandidates) {
            const n = typeof c === 'string' ? parseInt(c, 10) : c;
            if (typeof n === 'number' && Number.isFinite(n) && n > 0) return n;
          }
        }
        
        // Check if there's a users array
        if (Array.isArray(row?.users)) {
          for (const user of row.users) {
            const userCandidates = [
              user?.id,
              user?.userId,
              user?.user_id,
              user?.memberId,
              user?.member_id,
            ];
            for (const c of userCandidates) {
              const n = typeof c === 'string' ? parseInt(c, 10) : c;
              if (typeof n === 'number' && Number.isFinite(n) && n > 0) return n;
            }
          }
        }
        
        // Check join table fields (for business topics and skills)
        if (row?.join_user_business_topic) {
          const joinCandidates = [
            row.join_user_business_topic.userId,
            row.join_user_business_topic.user_id,
            row.join_user_business_topic.memberId,
            row.join_user_business_topic.member_id,
          ];
          for (const c of joinCandidates) {
            const n = typeof c === 'string' ? parseInt(c, 10) : c;
            if (typeof n === 'number' && Number.isFinite(n) && n > 0) return n;
          }
        }
        
        if (row?.join_user_skill) {
          const joinCandidates = [
            row.join_user_skill.userId,
            row.join_user_skill.user_id,
            row.join_user_skill.memberId,
            row.join_user_skill.member_id,
          ];
          for (const c of joinCandidates) {
            const n = typeof c === 'string' ? parseInt(c, 10) : c;
            if (typeof n === 'number' && Number.isFinite(n) && n > 0) return n;
          }
        }
        
        return null;
      };
      
      const userIds = new Set<number>();
      for (const r of matching) {
        const uid = extractUserIdFromRow(r);
        if (uid) {
          userIds.add(uid);
        }
      }


      if (userIds.size > 0) {
        const profiles = await profileService.getProfilesForUserAndCommunity(props.communityId);
        const byId = new Map<number, any>();
        for (const p of profiles as any[]) {
          const id = p?.userId || p?.id;
          if (typeof id === 'number') byId.set(id, p);
        }

        users = Array.from(userIds)
          .map((id) => byId.get(id))
          .filter(Boolean)
          .map((p: any) => ({
            id: p.userId || p.id,
            fname: p.fname,
            lname: p.lname,
            fullName: p.fullName || `${p.fname || ''} ${p.lname || ''}`.trim(),
            email: p.email || '',
            profilePicture: p.profilePicture,
            enabled: p.enabled ?? true,
          }));
        
      } else {
        console.warn(`[AnalyticsDashboard] ⚠️ No user IDs found in raw dashboard data for ${dashboard}: "${value}"`);
        
        // Third fallback: For business topics, mentor/mentee, interests, and activities, try fetching fresh unconsolidated data
        if (dashboard === 'businessTopics' || dashboard === 'mentors' || dashboard === 'mentees' || dashboard === 'interests' || dashboard === 'activities') {
          try {
            let unconsolidatedData: any[] = [];
            
            if (dashboard === 'businessTopics') {
              unconsolidatedData = await adminService.getBusinessTopicsChartData(props.communityId, false, true);
            } else if (dashboard === 'mentors') {
              unconsolidatedData = await adminService.getSkillsChartData(props.communityId, 'mentor', false, true);
            } else if (dashboard === 'mentees') {
              unconsolidatedData = await adminService.getSkillsChartData(props.communityId, 'mentee', false, true);
            } else if (dashboard === 'interests') {
              unconsolidatedData = await adminService.getAttributeChartData(props.communityId, 'interest', false, true);
            } else if (dashboard === 'activities') {
              unconsolidatedData = await adminService.getAttributeChartData(props.communityId, 'activity', false, true);
            }
            
            // Enhanced user ID extraction - check more deeply nested structures
            const normalize = (s: any) => (s == null ? '' : String(s)).trim().toLowerCase();
            const needle = normalize(value);
            const getRowLabel = (r: any) =>
              r?.name ??
              r?.label ??
              r?.valueName ??
              r?.value_name ??
              r?.attribute ??
              r?.skill ??
              r?.topic ??
              '';
            
            const matching = unconsolidatedData.filter((r) => {
              const label = normalize(getRowLabel(r));
              if (!label) return false;
              return label === needle;
            });
            
            
            const userIds = new Set<number>();
            
            // Enhanced extraction function that checks deeply nested structures
            const extractUserId = (row: any): number | null => {
              // Check top-level fields
              const topLevelCandidates = [
                row?.userId,
                row?.user_id,
                row?.memberId,
                row?.member_id,
                row?.profileId,
                row?.profile_id,
                row?.id,
                row?.slackUserId,
                row?.slack_user_id,
              ];
              
              for (const c of topLevelCandidates) {
                const n = typeof c === 'string' ? parseInt(c, 10) : c;
                if (typeof n === 'number' && Number.isFinite(n) && n > 0) return n;
              }
              
              // Check nested user object
              if (row?.user) {
                const userCandidates = [
                  row.user.id,
                  row.user.userId,
                  row.user.user_id,
                  row.user.memberId,
                  row.user.member_id,
                ];
                for (const c of userCandidates) {
                  const n = typeof c === 'string' ? parseInt(c, 10) : c;
                  if (typeof n === 'number' && Number.isFinite(n) && n > 0) return n;
                }
              }
              
              // Check nested profile object
              if (row?.profile) {
                const profileCandidates = [
                  row.profile.userId,
                  row.profile.user_id,
                  row.profile.id,
                  row.profile.memberId,
                  row.profile.member_id,
                ];
                for (const c of profileCandidates) {
                  const n = typeof c === 'string' ? parseInt(c, 10) : c;
                  if (typeof n === 'number' && Number.isFinite(n) && n > 0) return n;
                }
              }
              
              // Check nested member object
              if (row?.member) {
                const memberCandidates = [
                  row.member.userId,
                  row.member.user_id,
                  row.member.id,
                  row.member.memberId,
                  row.member.member_id,
                ];
                for (const c of memberCandidates) {
                  const n = typeof c === 'string' ? parseInt(c, 10) : c;
                  if (typeof n === 'number' && Number.isFinite(n) && n > 0) return n;
                }
              }
              
              // Check if there's a users array
              if (Array.isArray(row?.users)) {
                for (const user of row.users) {
                  const userCandidates = [
                    user?.id,
                    user?.userId,
                    user?.user_id,
                    user?.memberId,
                    user?.member_id,
                  ];
                  for (const c of userCandidates) {
                    const n = typeof c === 'string' ? parseInt(c, 10) : c;
                    if (typeof n === 'number' && Number.isFinite(n) && n > 0) return n;
                  }
                }
              }
              
              // Check join table fields (for business topics and skills)
              if (row?.join_user_business_topic) {
                const joinCandidates = [
                  row.join_user_business_topic.userId,
                  row.join_user_business_topic.user_id,
                  row.join_user_business_topic.memberId,
                  row.join_user_business_topic.member_id,
                ];
                for (const c of joinCandidates) {
                  const n = typeof c === 'string' ? parseInt(c, 10) : c;
                  if (typeof n === 'number' && Number.isFinite(n) && n > 0) return n;
                }
              }
              
              if (row?.join_user_skill) {
                const joinCandidates = [
                  row.join_user_skill.userId,
                  row.join_user_skill.user_id,
                  row.join_user_skill.memberId,
                  row.join_user_skill.member_id,
                ];
                for (const c of joinCandidates) {
                  const n = typeof c === 'string' ? parseInt(c, 10) : c;
                  if (typeof n === 'number' && Number.isFinite(n) && n > 0) return n;
                }
              }
              
              return null;
            };
            
            for (const row of matching) {
              const uid = extractUserId(row);
              if (uid) {
                userIds.add(uid);
              } else {
                // Log for debugging
                console.log(`[AnalyticsDashboard] ⚠️ Matched row but no user ID found:`, {
                  keys: Object.keys(row),
                  hasUser: !!row?.user,
                  hasProfile: !!row?.profile,
                  hasMember: !!row?.member,
                  hasUsers: Array.isArray(row?.users),
                  stringified: JSON.stringify(row).substring(0, 500),
                });
              }
            }
            
            
            if (userIds.size > 0) {
              const profiles = await profileService.getProfilesForUserAndCommunity(props.communityId);
              const byId = new Map<number, any>();
              for (const p of profiles as any[]) {
                const id = p?.userId || p?.id;
                if (typeof id === 'number') byId.set(id, p);
              }

              users = Array.from(userIds)
                .map((id) => byId.get(id))
                .filter(Boolean)
                .map((p: any) => ({
                  id: p.userId || p.id,
                  fname: p.fname,
                  lname: p.lname,
                  fullName: p.fullName || `${p.fname || ''} ${p.lname || ''}`.trim(),
                  email: p.email || '',
                  profilePicture: p.profilePicture,
                  enabled: p.enabled ?? true,
                }));
              
              console.log(`[AnalyticsDashboard] ✅ Fresh unconsolidated endpoint recovered ${users.length} users for ${dashboard}: "${value}"`);
            }
          } catch (error) {
            console.error(`[AnalyticsDashboard] Error fetching fresh unconsolidated data for ${dashboard}:`, error);
          }
        }
      }
    }

    modalUsers.value = users;
  } catch (error) {
    console.error(`[AnalyticsDashboard] Error loading users for ${dashboard}: "${value}":`, error);
    // Don't show toast on 404s - it's expected that endpoints might not exist
    // Just set empty users array
    modalUsers.value = [];
  } finally {
    isLoadingUsers.value = false;
  }
}

function closeUserModal() {
  // Immediately close the modal
  isUserModalOpen.value = false;
  // Clear data immediately
  modalUsers.value = [];
  currentModalContext.value = null;
  isLoadingUsers.value = false;
}

function navigateToUser(userId: number) {
  router.push(`/tabs/profile/${userId}`);
  closeUserModal();
}
</script>

<style scoped>
.analytics-dashboard-section {
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

.dashboard-selector {
  margin-bottom: 24px;
  padding: 20px;
  background: #f9fafb;
  border-radius: 12px;
  border: 1px solid #e5e7eb;
}

.dashboard-selector-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  cursor: pointer;
  user-select: none;
  padding: 4px 0;
  transition: opacity 0.2s;
}

.dashboard-selector-header:hover {
  opacity: 0.7;
}

.subsection-title {
  font-size: 18px;
  font-weight: 600;
  color: #1a1a1a;
  margin: 0;
}

.collapse-icon {
  font-size: 20px;
  color: #64748b;
  transition: transform 0.2s;
}

.dashboard-selector-content {
  margin-top: 16px;
}

.dashboard-group {
  margin-bottom: 20px;
}

.dashboard-group:last-child {
  margin-bottom: 0;
}

.group-title {
  font-size: 14px;
  font-weight: 600;
  color: #64748b;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin: 0 0 12px 0;
}

.dashboard-checkboxes {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 12px;
}

.dashboard-checkbox-item {
  display: flex;
  align-items: center;
  gap: 8px;
}

.loading-state {
  text-align: center;
  padding: 48px 16px;
  color: #64748b;
}

.loading-mini {
  text-align: center;
  padding: 24px;
  color: #64748b;
}

.dashboards-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(400px, 1fr));
  gap: 24px;
}

.dashboard-card {
  padding: 20px;
  background: #f9fafb;
  border-radius: 12px;
  border: 1px solid #e5e7eb;
}

.dashboard-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.dashboard-title {
  font-size: 18px;
  font-weight: 600;
  color: #1a1a1a;
  margin: 0;
}

.dashboard-chart {
  display: flex;
  flex-direction: column;
}

.chart-items-container {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.chart-items-container.chart-scrollable {
  max-height: 400px; /* Approximately 10 items at ~40px each */
  overflow-y: auto;
  padding-right: 8px;
}

/* Custom scrollbar styling */
.chart-items-container.chart-scrollable::-webkit-scrollbar {
  width: 6px;
}

.chart-items-container.chart-scrollable::-webkit-scrollbar-track {
  background: #f1f1f1;
  border-radius: 3px;
}

.chart-items-container.chart-scrollable::-webkit-scrollbar-thumb {
  background: #cbd5e1;
  border-radius: 3px;
}

.chart-items-container.chart-scrollable::-webkit-scrollbar-thumb:hover {
  background: #94a3b8;
}

.chart-item {
  display: grid;
  grid-template-columns: 1fr auto auto;
  gap: 12px;
  align-items: center;
  cursor: pointer;
  padding: 8px;
  border-radius: 8px;
  transition: background-color 0.2s;
}

.chart-item:hover {
  background-color: #f1f5f9;
}

.chart-bar-container {
  width: 100%;
  height: 24px;
  background: #e5e7eb;
  border-radius: 12px;
  overflow: hidden;
}

.chart-bar {
  height: 100%;
  background: linear-gradient(90deg, var(--color-primary) 0%, var(--color-secondary) 100%);
  border-radius: 12px;
  transition: width 0.3s ease;
}

.chart-label {
  font-size: 14px;
  color: #1a1a1a;
  font-weight: 500;
  min-width: 120px;
}

.chart-value {
  font-size: 14px;
  color: #64748b;
  font-weight: 600;
  min-width: 40px;
  text-align: right;
}

.no-data {
  text-align: center;
  padding: 32px;
  color: #64748b;
}

/* User Modal Styles */
.user-modal-content {
  --padding-start: 0;
  --padding-end: 0;
  --padding-top: 0;
  --padding-bottom: 0;
}

.users-list {
  padding: 16px;
}

.user-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  border-bottom: 1px solid #e5e7eb;
  cursor: pointer;
  transition: background-color 0.2s;
}

.user-item:hover {
  background-color: #f9fafb;
}

.user-item:last-child {
  border-bottom: none;
}

.user-avatar {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  overflow: hidden;
  flex-shrink: 0;
  background: #e5e7eb;
  display: flex;
  align-items: center;
  justify-content: center;
}

.user-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.avatar-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, var(--color-primary) 0%, var(--color-secondary) 100%);
  color: white;
  font-weight: 600;
  font-size: 18px;
}

.user-info {
  flex: 1;
  min-width: 0;
}

.user-name {
  font-size: 16px;
  font-weight: 600;
  color: #1a1a1a;
  margin-bottom: 4px;
}

.user-email {
  font-size: 14px;
  color: #64748b;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.chevron-icon {
  font-size: 20px;
  color: #cbd5e1;
  flex-shrink: 0;
}

.no-users {
  text-align: center;
  padding: 48px 16px;
  color: #64748b;
}

.no-users-icon {
  font-size: 64px;
  color: #cbd5e1;
  margin-bottom: 16px;
}

.no-users-hint {
  font-size: 12px;
  color: #94a3b8;
  margin-top: 8px;
}

/* User Stats Table Section */
.user-stats-table-section {
  margin-top: 32px;
  background: white;
  border-radius: 16px;
  padding: 24px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
}

.section-header.secondary {
  margin-bottom: 20px;
  padding-bottom: 16px;
  border-bottom: 1px solid #e5e7eb;
}

.section-title-small {
  font-size: 20px;
  font-weight: 600;
  color: #1a1a1a;
  margin: 0;
}

.user-table-actions {
  display: flex;
  gap: 8px;
  align-items: center;
}

.user-table-controls {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: center;
  margin-bottom: 20px;
  padding: 16px;
  background: #f9fafb;
  border-radius: 8px;
}

.control-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.control-field label {
  font-size: 12px;
  font-weight: 600;
  color: #64748b;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.control-field input[type="date"],
.control-field input[type="search"],
.control-field select {
  padding: 8px 12px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  font-size: 14px;
  background: white;
}

.control-field.search {
  flex: 1;
  min-width: 200px;
}

.control-field.search input {
  width: 100%;
}

.control-summary {
  margin-left: auto;
  font-size: 13px;
  color: #475569;
  font-weight: 500;
}

.user-table-wrapper {
  overflow-x: auto;
}

.table-scroll {
  overflow-x: auto;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
}

.user-table {
  width: 100%;
  border-collapse: collapse;
  background: white;
}

.user-table thead {
  background: #f9fafb;
}

.user-table th {
  padding: 12px 16px;
  text-align: left;
  font-size: 12px;
  font-weight: 700;
  color: #475569;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  border-bottom: 2px solid #e5e7eb;
  white-space: nowrap;
}

.user-table th.sortable {
  cursor: pointer;
  user-select: none;
  transition: background-color 0.2s;
}

.user-table th.sortable:hover {
  background-color: #f1f5f9;
}

.user-table th.active {
  color: var(--color-primary);
}

.user-table th span {
  margin-left: 4px;
  font-size: 10px;
}

.user-table td {
  padding: 12px 16px;
  border-bottom: 1px solid #e5e7eb;
  font-size: 14px;
  color: #1a1a1a;
}

.user-table tbody tr:hover {
  background-color: #f9fafb;
}

.user-table tbody tr:last-child td {
  border-bottom: none;
}

.pagination-row {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: 12px;
  padding: 16px 0 0 0;
  margin-top: 16px;
  border-top: 1px solid #e5e7eb;
}

.pager {
  padding: 8px 12px;
  border: 1px solid #e5e7eb;
  background: #fff;
  border-radius: 8px;
  cursor: pointer;
  font-size: 13px;
  transition: all 0.2s;
}

.pager:hover:not(:disabled) {
  background: #f9fafb;
  border-color: #cbd5e1;
}

.pager:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

.pager-status {
  font-size: 13px;
  color: #475569;
}

/* Responsive */
@media (max-width: 768px) {
  .dashboards-grid {
    grid-template-columns: 1fr;
  }

  .user-table-controls {
    flex-direction: column;
    align-items: stretch;
  }

  .control-field.search {
    min-width: 100%;
  }

  .control-summary {
    margin-left: 0;
  }
}
</style>





