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
        <div class="dashboard-group">
          <h4 class="group-title">Additional Dashboards</h4>
          <div class="dashboard-checkboxes">
            <div
              v-for="dashboard in additionalDashboards"
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
                :checked="visibleDashboards.includes(`custom-${field.id}`)"
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
        <div v-else class="no-data">No data available</div>
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
      <div v-else>
        <div class="user-modal-controls">
          <input
            type="search"
            class="control-input"
            placeholder="Search name or email"
            v-model="userSearchTerm"
            @input="handleUserSearch"
          />
          <label class="control-checkbox">
            <input
              type="checkbox"
              v-model="userOnlyActive"
              @change="handleActiveToggle"
            />
            Active only
          </label>
          <div class="control-select">
            <label>Sort</label>
            <select v-model="userSortBy" @change="handleSortChange">
              <option value="fullName">Name</option>
              <option value="email">Email</option>
            </select>
            <select v-model="userSortDir" @change="handleSortChange">
              <option value="asc">Asc</option>
              <option value="desc">Desc</option>
            </select>
          </div>
          <div class="control-select">
            <label>Page size</label>
            <select
              :value="userPageSize"
              @change="changePageSize(parseInt(($event.target as HTMLSelectElement).value))"
            >
              <option :value="10">10</option>
              <option :value="25">25</option>
              <option :value="50">50</option>
            </select>
          </div>
          <div class="control-summary">{{ userRangeLabel }}</div>
        </div>

        <div class="users-list">
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

        <div class="pagination-row">
          <button class="pager" :disabled="userPage === 1" @click="changePage(-1)">Prev</button>
          <span class="pager-status">Page {{ userPage }} / {{ Math.max(1, Math.ceil(userTotal / userPageSize)) }}</span>
          <button
            class="pager"
            :disabled="userPage >= Math.max(1, Math.ceil(userTotal / userPageSize))"
            @click="changePage(1)"
          >
            Next
          </button>
        </div>
      </div>
    </ion-content>
  </ion-modal>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { adminService, type AttributeModel } from '@/services/admin.service';
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

// User modal state
const isUserModalOpen = ref(false);
const modalTitle = ref('');
const modalUsers = ref<CommunityMember[]>([]);
const isLoadingUsers = ref(false);
const currentModalContext = ref<{ dashboard: string; value: string } | null>(null);
const userSearchTerm = ref('');
const userSortBy = ref<'fullName' | 'email'>('fullName');
const userSortDir = ref<'asc' | 'desc'>('asc');
const userOnlyActive = ref(true);
const userPage = ref(1);
const userPageSize = ref(25);
const userTotal = ref(0);
const userRangeLabel = computed(() => {
  if (userTotal.value === 0) return 'Showing 0';
  const start = (userPage.value - 1) * userPageSize.value + 1;
  const end = Math.min(userTotal.value, start + userPageSize.value - 1);
  return `Showing ${start}-${end} of ${userTotal.value}`;
});

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

const additionalDashboards = [
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
      visibleDashboards.value = JSON.parse(saved);
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

    // Additional dashboards
    promises.push(loadIntentionData());
    promises.push(loadMovieData());
    promises.push(loadMusicData());
    promises.push(loadOccupationData());
    promises.push(loadOrganizationData());
    promises.push(loadUniversityData());
    promises.push(loadLocationData());

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
    // Ensure custom field data is loaded for visible custom field dashboards
    ensureCustomFieldDataLoaded();
  } catch (error) {
    console.error('Error loading custom fields:', error);
    customFields.value = [];
  }
}

// Ensure custom field data is loaded for selected dashboards
function ensureCustomFieldDataLoaded() {
  if (!props.communityId) return;

  const selectedCustomFields = visibleDashboards.value
    .filter(d => d.startsWith('custom-'))
    .map(d => parseInt(d.replace('custom-', '')));

  selectedCustomFields.forEach((customFieldId) => {
    if (
      !dashboardData.value[`custom-${customFieldId}`] &&
      !customFieldLoading.value.has(customFieldId)
    ) {
      fetchCustomFieldChartData(customFieldId);
    }
  });
}

// Fetch custom field chart data
async function fetchCustomFieldChartData(customFieldId: number) {
  if (!props.communityId) return;

  customFieldLoading.value.add(customFieldId);
  try {
    const [consolidated, raw] = await Promise.all([
      adminService.getCustomFieldChartData(props.communityId, customFieldId, true, true),
      adminService.getCustomFieldChartData(props.communityId, customFieldId, false, true),
    ]);
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

function toggleCustomFieldDashboard(field: CustomField) {
  const dashboardKey = `custom-${field.id}`;
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
    intention: loadIntentionData,
    movies: loadMovieData,
    music: loadMusicData,
    occupation: loadOccupationData,
    organization: loadOrganizationData,
    university: loadUniversityData,
    location: loadLocationData,
  };

  if (loaders[dashboard]) {
    await loaders[dashboard]();
  } else if (dashboard.startsWith('custom-')) {
    const customFieldId = parseInt(dashboard.replace('custom-', ''));
    if (!isNaN(customFieldId)) {
      await fetchCustomFieldChartData(customFieldId);
    }
  }
}

function getDashboardData(dashboard: string): AttributeModel[] {
  return dashboardData.value[dashboard] || [];
}

function getDashboardTitle(dashboard: string): string {
  if (dashboard.startsWith('custom-')) {
    const customFieldId = parseInt(dashboard.replace('custom-', ''));
    const field = customFields.value.find(f => f.id === customFieldId);
    return field?.name || field?.label || `Custom Field ${customFieldId}`;
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
    const customFieldId = parseInt(dashboard.replace('custom-', ''));
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

onMounted(() => {
  if (props.communityId) {
    initializeDashboardOptions();
    loadAllDashboardData();
    loadCustomFields();
  }
});

watch(() => props.communityId, (newId, oldId) => {
  if (newId && newId !== oldId) {
    // Reset state when community changes
    dashboardData.value = {};
    dashboardDataAll.value = {};
    customFields.value = [];
    visibleDashboards.value = [];
    dashboardLoading.value.clear();
    customFieldLoading.value.clear();
    hasLoadedData.value = false;
    
    // Initialize and load (matching production setCommunity pattern)
    initializeDashboardOptions();
    loadAllDashboardData();
    loadCustomFields();
  }
}, { immediate: false });

// Watch for visible dashboards changes to ensure custom field data is loaded
watch(() => visibleDashboards.value, () => {
  ensureCustomFieldDataLoaded();
}, { deep: true });

function resetUserModalQuery() {
  userSearchTerm.value = '';
  userSortBy.value = 'fullName';
  userSortDir.value = 'asc';
  userOnlyActive.value = true;
  userPage.value = 1;
  userPageSize.value = 25;
  userTotal.value = 0;
  modalUsers.value = [];
}

function getDrilldownQueryForDashboard(dashboard: string, value: string) {
  if (dashboard === 'interests') return { metric: 'interest', value };
  if (dashboard === 'activities') return { metric: 'activity', value };
  if (dashboard === 'businessTopics') return { metric: 'businessTopic', value };
  if (dashboard === 'skills') return { metric: 'skill', value, skillType: 'general' };
  if (dashboard === 'mentors') return { metric: 'skill', value, skillType: 'mentor' };
  if (dashboard === 'mentees') return { metric: 'skill', value, skillType: 'mentee' };
  if (dashboard === 'intention') return { metric: 'intention', value };
  if (dashboard === 'movies') return { metric: 'movie', value };
  if (dashboard === 'music') return { metric: 'music', value };
  if (dashboard === 'occupation') return { metric: 'occupation', value };
  if (dashboard === 'organization') return { metric: 'organization', value };
  if (dashboard === 'university') return { metric: 'university', value };
  if (dashboard === 'location') return { metric: 'location', value };
  if (dashboard.startsWith('custom-')) {
    const customFieldId = parseInt(dashboard.replace('custom-', ''));
    if (!isNaN(customFieldId)) {
      return { metric: 'customField', value, customFieldId };
    }
  }
  return null;
}

async function fetchModalUsers() {
  if (!props.communityId || !currentModalContext.value) return;

  isLoadingUsers.value = true;
  try {
    const baseQuery = getDrilldownQueryForDashboard(
      currentModalContext.value.dashboard,
      currentModalContext.value.value
    );
    if (!baseQuery) {
      modalUsers.value = [];
      userTotal.value = 0;
      return;
    }

    const result = await adminService.getDrilldownUsers(props.communityId, {
      ...baseQuery,
      page: userPage.value,
      pageSize: userPageSize.value,
      search: userSearchTerm.value,
      sortBy: userSortBy.value,
      sortDir: userSortDir.value,
      onlyActive: userOnlyActive.value,
    });

    modalUsers.value = result.data;
    userTotal.value = result.total;
    userPage.value = result.page;
    userPageSize.value = result.pageSize;
  } catch (error) {
    console.error('Error loading users:', error);
    modalUsers.value = [];
    userTotal.value = 0;
  } finally {
    isLoadingUsers.value = false;
  }
}

function handleUserSearch() {
  userPage.value = 1;
  fetchModalUsers();
}

function handleSortChange() {
  userPage.value = 1;
  fetchModalUsers();
}

function handleActiveToggle() {
  userPage.value = 1;
  fetchModalUsers();
}

function changePage(delta: number) {
  const totalPages = Math.max(1, Math.ceil(userTotal.value / userPageSize.value));
  const nextPage = userPage.value + delta;
  if (nextPage < 1 || nextPage > totalPages) return;
  userPage.value = nextPage;
  fetchModalUsers();
}

function changePageSize(size: number) {
  userPageSize.value = size;
  userPage.value = 1;
  fetchModalUsers();
}

// Open user modal for a specific attribute value
async function openUserModal(dashboard: string, value: string) {
  if (!props.communityId) return;

  resetUserModalQuery();
  currentModalContext.value = { dashboard, value };
  modalTitle.value = `${getDashboardTitle(dashboard)}: ${value}`;
  isUserModalOpen.value = true;
  await fetchModalUsers();
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

.user-modal-controls {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  padding: 12px 16px 0 16px;
  align-items: center;
}

.control-input {
  flex: 1;
  min-width: 160px;
  padding: 10px 12px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  font-size: 14px;
}

.control-checkbox {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: #475569;
}

.control-select {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: #475569;
}

.control-select select {
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 8px 10px;
  background: #fff;
  font-size: 13px;
}

.control-summary {
  margin-left: auto;
  font-size: 13px;
  color: #475569;
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

.pagination-row {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: 12px;
  padding: 12px 16px 16px 16px;
}

.pager {
  padding: 8px 12px;
  border: 1px solid #e5e7eb;
  background: #fff;
  border-radius: 8px;
  cursor: pointer;
  font-size: 13px;
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
}
</style>





