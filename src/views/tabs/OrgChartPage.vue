<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-title>{{ communityName || 'Org Chart' }}</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content :fullscreen="true" class="org-chart-page-content">
      <!-- Search Bar -->
      <div class="org-chart-search-container">
        <div class="org-chart-search-wrapper">
          <ion-icon :icon="search" class="search-icon"></ion-icon>
          <input
            v-model="searchQuery"
            @input="onSearchInput"
            type="text"
            class="org-chart-search-input"
            placeholder="Search by name, department, team or role"
          />
          <button
            v-if="searchQuery"
            @click="clearSearch"
            class="search-clear-button"
          >
            <ion-icon :icon="close"></ion-icon>
          </button>
        </div>

        <!-- Search Results Dropdown -->
        <div
          v-if="searchResults.length > 0 && searchQuery.length >= 3"
          class="search-results-dropdown"
        >
          <div
            v-for="result in searchResults"
            :key="result.user.id"
            class="search-result-item"
            @click="selectSearchResult(result.user)"
          >
            <img
              v-if="result.user.profilePicture"
              :src="result.user.profilePicture"
              :alt="result.user.name"
              class="search-result-avatar"
            />
            <div v-else class="search-result-avatar-placeholder">
              {{ result.user.name.charAt(0).toUpperCase() }}
            </div>
            <div class="search-result-info">
              <div class="search-result-name">{{ result.user.name }}</div>
              <div class="search-result-meta">
                <span v-if="result.user.department">{{ result.user.department }}</span>
                <span v-if="result.user.role">{{ result.user.role }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Loading State -->
      <div v-if="loading" class="org-chart-loading">
        <ion-spinner></ion-spinner>
        <p>Loading org chart...</p>
      </div>

      <!-- Error State -->
      <div v-else-if="error" class="org-chart-error">
        <ion-icon :icon="alertCircle" class="error-icon"></ion-icon>
        <h3>Authentication Expired</h3>
        <p>{{ error }}</p>
        <ion-button @click="retryLoad">Retry</ion-button>
      </div>

      <!-- Org Chart -->
      <div v-if="orgChartData" class="org-chart-wrapper">
        <OrgChartContainer
          ref="chartContainerRef"
          :scale="chartScale"
          :translate-x="chartTranslateX"
          :translate-y="chartTranslateY"
          @update:scale="chartScale = $event"
          @update:translate-x="chartTranslateX = $event"
          @update:translate-y="chartTranslateY = $event"
        >
              <OrgChartNode
                :datasource="orgChartData"
                :display-flags="displayFlags"
                :group-scale="groupScale"
                :is-highlighted="highlightedSlackId === orgChartData.slackId"
                :highlighted-slack-id="highlightedSlackId"
                @node-click="handleNodeClick"
                @select-node="handleSelectNode"
              />
        </OrgChartContainer>
      </div>

      <!-- Empty State (for testing when API is not available) -->
      <div v-else-if="!loading && !error" class="org-chart-empty">
        <p>Org chart will appear here once data is loaded.</p>
        <p class="org-chart-empty-note">Note: During testing, the API endpoint may not be available.</p>
      </div>

      <!-- User Popup -->
      <OrgChartUserPopup
        :is-open="isPopupOpen"
        :user="selectedUser"
        :position="popupPosition"
        @close="closePopup"
      />
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { IonPage, IonHeader, IonToolbar, IonTitle, IonContent, IonIcon, IonButton, IonSpinner, alertController } from '@ionic/vue';
import { search, close, alertCircle } from 'ionicons/icons';
import { communityService } from '@/services/community.service';
import { orgChartAuthService } from '@/services/org-chart-auth.service';
import { slackSessionService } from '@/services/slack-session.service';
import { useAuthStore } from '@/stores/auth.store';
import { useCommunityStore } from '@/stores/community.store';
import OrgChartContainer from '@/components/org-chart/OrgChartContainer.vue';
import OrgChartNode from '@/components/org-chart/OrgChartNode.vue';
import OrgChartUserPopup from '@/components/org-chart/OrgChartUserPopup.vue';
import type { OrgNode, OrgUser, OrgChartResponse, SearchMatch } from '@/models/org-chart';

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();
const communityStore = useCommunityStore();

// Query params
const communityId = ref<number | null>(null);
const slackUserId = ref<string>('');
const otherSlackUserId = ref<string | null>(null);
const communityName = ref<string>('');
const slackTeamId = ref<string>('');
const groupScale = ref<number>(3);
const secretId = ref<string>('');

// State
const loading = ref(true);
const error = ref<string | null>(null);
const orgChartData = ref<OrgNode | null>(null);
const allUsers = ref<OrgUser[]>([]);
const slackIdsInChain = ref<string[]>([]);
const displayFlags = ref({
  showTitle: true,
  showLocation: true,
  showRole: true,
  showDepartment: true,
  showTeam: true,
});

// Chart state
const chartScale = ref(1.0);
const chartTranslateX = ref(0);
const chartTranslateY = ref(0);

// Search
const searchQuery = ref('');
const searchResults = ref<SearchMatch[]>([]);
const searchTimeout = ref<number | null>(null);

// User popup
const isPopupOpen = ref(false);
const selectedUser = ref<OrgUser | null>(null);
const popupPosition = ref<{ x: number; y: number } | undefined>(undefined);
const highlightedSlackId = ref<string | null>(null);

// Chart container ref for centering
const chartContainerRef = ref<InstanceType<typeof OrgChartContainer> | null>(null);

function extractQueryParams() {
  const params = route.query;
  
  // Get from query params first (for Slack links), then fall back to stores or validated session
  // Query params take priority because they come from Slack with specific values
  communityId.value = params.communityId 
    ? Number(params.communityId) 
    : (communityStore.currentCommunityId || null);
  
  // Slack links provide slackUserId in query params - use that first
  slackUserId.value = (params.slackUserId as string) || 
    (authStore.user?.slackId as string) || 
    (authStore.user?.slackUserId as string) || 
    '';
  
  // Get secretId from URL first
  secretId.value = (params.s as string) || '';
  
  // If query params are missing, try to get from validated session
  if (!communityId.value || !slackUserId.value || !secretId.value) {
    const validatedSession = slackSessionService.getCurrentValidation();
    if (validatedSession) {
      if (!communityId.value) {
        communityId.value = validatedSession.communityId;
        console.log('[OrgChartPage] Using communityId from validated session:', validatedSession.communityId);
      }
      if (!slackUserId.value) {
        slackUserId.value = validatedSession.slackUserId;
        console.log('[OrgChartPage] Using slackUserId from validated session:', validatedSession.slackUserId);
      }
      // Also get secretId from validated session if not in URL
      if (!secretId.value) {
        secretId.value = validatedSession.secretId;
        console.log('[OrgChartPage] Using secretId from validated session');
      }
    }
  }
  
  otherSlackUserId.value = (params.otherSlackUserId as string) || null;
  
  communityName.value = (params.communityName as string) || 
    communityStore.currentCommunityName || 
    '';
  
  slackTeamId.value = (params.slackTeamId as string) || '';
  groupScale.value = params.scale ? Number(params.scale) : 3;

  // Check if user is fully authenticated (has Firebase auth + user profile)
  const isFullyAuthenticated = authStore.isAuthenticated && authStore.user?.id;
  
  // For authenticated users without Slack ID, use user ID as fallback
  if (isFullyAuthenticated && !slackUserId.value && authStore.user?.id) {
    // Use user ID as slackUserId fallback for authenticated users
    slackUserId.value = String(authStore.user.id);
    console.log('[OrgChartPage] Authenticated user without Slack ID, using user ID as fallback:', slackUserId.value);
  }

  console.log('[OrgChartPage] Extracted query params:', {
    communityId: communityId.value,
    slackUserId: slackUserId.value,
    otherSlackUserId: otherSlackUserId.value,
    secretId: secretId.value,
    hasQueryParams: Object.keys(params).length > 0,
    queryParams: params,
    isFullyAuthenticated
  });
  console.log('[OrgChartPage] Raw route.query:', JSON.stringify(route.query, null, 2));

  // Validate required parameters
  // For authenticated users, slackUserId is optional (we'll use user ID as fallback)
  // For Slack link users, slackUserId is required
  if (!communityId.value) {
    error.value = 'Missing required parameters: communityId';
    console.error('[OrgChartPage] Missing required parameters:', {
      communityId: communityId.value,
      slackUserId: slackUserId.value,
      secretId: secretId.value,
      queryParams: params,
      userSlackId: authStore.user?.slackId,
      currentCommunityId: communityStore.currentCommunityId,
      hasValidatedSession: !!slackSessionService.getCurrentValidation(),
      isFullyAuthenticated
    });
    loading.value = false;
    return false;
  }
  
  // Only require slackUserId if user is not fully authenticated (i.e., coming from Slack link)
  if (!isFullyAuthenticated && !slackUserId.value) {
    error.value = 'Missing required parameters: slackUserId';
    console.error('[OrgChartPage] Missing required parameters (not authenticated):', {
      communityId: communityId.value,
      slackUserId: slackUserId.value,
      secretId: secretId.value,
      queryParams: params,
      userSlackId: authStore.user?.slackId,
      currentCommunityId: communityStore.currentCommunityId,
      hasValidatedSession: !!slackSessionService.getCurrentValidation()
    });
    loading.value = false;
    return false;
  }

  // If secretId is present but not validated, we'll validate it
  // If secretId is not present, that's okay - might be direct access or session already validated
  return true;
}

/**
 * Show alert when Slack session expires with options to auth in or go back to Slack
 */
async function showSlackSessionExpiredAlert() {
  const alert = await alertController.create({
    header: 'Session Expired',
    message: 'For security purposes, your session has expired after 60 seconds. Would you like to sign in to continue, or go back to Slack to create a new session?',
    buttons: [
      {
        text: 'Go Back to Slack',
        role: 'cancel',
        handler: () => {
          // User can manually go back or we could try to detect Slack
          window.history.back();
        }
      },
      {
        text: 'Sign In',
        handler: () => {
          router.push('/login');
        }
      }
    ]
  });
  await alert.present();
}

async function initOrg(isInitialPageLoad: boolean = true) {
  if (!extractQueryParams()) {
    return;
  }

  loading.value = true;
  error.value = null;

  // Check if user is fully authenticated (has Firebase auth + user profile)
  const isFullyAuthenticated = authStore.isAuthenticated && authStore.user?.id;
  
  // Only check Slack session expiration if user came from Slack link
  if (!isFullyAuthenticated && slackSessionService.isSlackLinkUser()) {
    if (slackSessionService.isSessionExpired()) {
      loading.value = false;
      await showSlackSessionExpiredAlert();
      return;
    }
  }

  try {
    // ALWAYS create a Firebase document for keyDocRefId (even when coming from Slack)
    // This matches the Angular implementation which always creates a Firestore document
    // The backend validates this document exists and is recent (< 3 seconds old)
    console.log('[OrgChartPage] Creating Firebase document for keyDocRefId...');
    const keyDocRefId = await orgChartAuthService.createSecretCode(
      communityId.value!,
      slackUserId.value
    );
    console.log('[OrgChartPage] Created keyDocRefId:', keyDocRefId);
    
    // The secretId from URL (s parameter) is separate - it's validated against slack_user_outbound table
    // Only check secretId if user came from Slack link
    // Fully authenticated users don't need secretId
    const slackSecretId = secretId.value || '';
    let secretIdToSend = '';
    
    if (isFullyAuthenticated) {
      // Fully authenticated user - no secretId needed
      console.log('[OrgChartPage] User is fully authenticated, not sending secretId');
      secretIdToSend = '';
    } else if (slackSecretId) {
      // User came from Slack link - check if already validated
      const isValidated = slackSessionService.isSecretIdValidated(slackSecretId);
      if (isValidated) {
        console.log('[OrgChartPage] SecretId already validated for this session, not sending in request');
        // Don't send secretId - session is established
        secretIdToSend = '';
      } else {
        // Not yet validated, send it (will be validated by backend)
        // This handles the case where App.vue validation didn't run yet
        console.log('[OrgChartPage] Using secretId from Slack URL (s parameter):', slackSecretId);
        secretIdToSend = slackSecretId;
      }
    } else {
      // No secretId in URL - check if we have a validated session
      const hasSession = slackSessionService.hasValidatedSession();
      if (hasSession) {
        console.log('[OrgChartPage] No secretId in URL but session is validated, not sending secretId');
        secretIdToSend = '';
      } else {
        console.log('[OrgChartPage] No secretId in URL (direct access, not from Slack)');
        secretIdToSend = '';
      }
    }
    
    const apiCallParams = {
      communityId: communityId.value,
      slackUserId: slackUserId.value,
      otherSlackUserId: otherSlackUserId.value,
      keyDocRefId: keyDocRefId, // Firebase document ID (always created)
      searchStrings: [],
      isInitialPageLoad,
      s: secretIdToSend // Secret ID from Slack URL (if present and not yet validated)
    };
    
    console.log('[OrgChartPage] Making API call with:', apiCallParams);
    console.log('[OrgChartPage] Full API request body:', JSON.stringify(apiCallParams, null, 2));
    
    const response = await communityService.getOrgDataForCommunity(
      communityId.value!,
      slackUserId.value,
      otherSlackUserId.value,
      keyDocRefId,
      [],
      isInitialPageLoad,
      secretIdToSend
    );

    console.log('[OrgChartPage] API response received:', response);
    
    // If API response doesn't have profile pictures, try to fetch them
    // This is a fallback for when the API doesn't include profile pictures
    await enrichWithProfilePictures(response);
    
    handleOrgDataResponse(response);
  } catch (err: any) {
    console.error('[OrgChartPage] Failed to load org chart:', err);
    
    const errorMessage = err.message || err.response?.data?.message || '';
    const status = err.status || err.response?.status;
    
    // Check if error is due to expired secretId from Slack link
    // Only show Slack expiration alert if user came from Slack link
    if ((status === 401 || 
         errorMessage.toLowerCase().includes('expired') || 
         errorMessage.toLowerCase().includes('invalid') || 
         errorMessage.toLowerCase().includes('secret')) 
        && slackSessionService.isSlackLinkUser()) {
      loading.value = false;
      await showSlackSessionExpiredAlert();
    } else {
      error.value = errorMessage || 'Failed to load org chart. Authentication may have expired.';
      loading.value = false;
    }
  }
}

function handleOrgDataResponse(response: OrgChartResponse) {
  console.log('[OrgChartPage] Received org chart response:', response);
  console.log('[OrgChartPage] Root node:', response.dataSource);
  console.log('[OrgChartPage] Root node children:', response.dataSource?.children?.length || 0);
  
  allUsers.value = response.users || [];
  slackIdsInChain.value = response.slackIdsInChain || [];
  
  displayFlags.value = {
    showTitle: response.showTitle ?? true,
    showLocation: response.showLocation ?? true,
    showRole: response.showRole ?? true,
    showDepartment: response.showDepartment ?? true,
    showTeam: response.showTeam ?? true,
  };

  // If viewing a specific user, restructure the tree to show full context
  // (manager, teammates/siblings, and direct reports)
  if (otherSlackUserId.value) {
    orgChartData.value = restructureTreeForUser(response.dataSource, otherSlackUserId.value);
    console.log('[OrgChartPage] Restructured tree for user:', otherSlackUserId.value);
  } else {
    orgChartData.value = response.dataSource;
  }

  loading.value = false;
  console.log('[OrgChartPage] Org chart data set, loading complete');
  
  // Center the chart after data loads
  // Wait for DOM to update, then center
  setTimeout(() => {
    if (otherSlackUserId.value) {
      // Center on specific user from Slack
      centerOnUser(otherSlackUserId.value);
      highlightedSlackId.value = otherSlackUserId.value;
    } else {
      // Center on root node by default
      centerOnRoot();
    }
  }, 200);
}

/**
 * Restructure the tree to show full context around a specific user:
 * - Their manager (parent)
 * - Their teammates (siblings - other people reporting to same manager)
 * - Their direct reports (children)
 * 
 * The key is to clear expandedChildrenSlackIds on the parent node so all siblings are shown,
 * and ensure the target node shows all its children.
 */
function restructureTreeForUser(rootNode: OrgNode, targetSlackId: string): OrgNode {
  // Deep clone to avoid mutating the original
  function cloneNode(node: OrgNode): OrgNode {
    return {
      ...node,
      children: node.children ? node.children.map(cloneNode) : undefined,
      originalChildren: node.originalChildren ? node.originalChildren.map(cloneNode) : undefined,
    };
  }

  const clonedRoot = cloneNode(rootNode);

  // Find the target user in the tree
  function findNode(node: OrgNode, slackId: string): OrgNode | null {
    if (node.slackId === slackId) {
      return node;
    }
    if (node.children) {
      for (const child of node.children) {
        const found = findNode(child, slackId);
        if (found) return found;
      }
    }
    return null;
  }

  // Find the target user node
  const targetNode = findNode(clonedRoot, targetSlackId);
  if (!targetNode) {
    console.warn('[OrgChartPage] Target user not found in tree, returning original structure');
    return clonedRoot;
  }

  // Find the parent node (manager)
  function findParent(node: OrgNode, targetSlackId: string, parent: OrgNode | null = null): OrgNode | null {
    if (node.slackId === targetSlackId) {
      return parent;
    }
    if (node.children) {
      for (const child of node.children) {
        const found = findParent(child, targetSlackId, node);
        if (found !== null) return found;
      }
    }
    return null;
  }

  const parentNode = findParent(clonedRoot, targetSlackId);
  
  // If target user is the root, ensure all their children are visible
  if (!parentNode) {
    console.log('[OrgChartPage] Target user is root, showing all direct reports');
    // Clear expandedChildrenSlackIds to show all children
    if (targetNode.expandedChildrenSlackIds) {
      delete targetNode.expandedChildrenSlackIds;
    }
    // Restore from originalChildren if available
    if (targetNode.originalChildren && targetNode.originalChildren.length > 0) {
      targetNode.children = targetNode.originalChildren.map(cloneNode);
    }
    return clonedRoot;
  }

  // Clear expandedChildrenSlackIds on parent to show ALL siblings (teammates)
  // This is the key - we want to see all people who report to the same manager
  if (parentNode.expandedChildrenSlackIds) {
    console.log('[OrgChartPage] Clearing expandedChildrenSlackIds on parent to show all siblings');
    delete parentNode.expandedChildrenSlackIds;
  }

  // Restore all siblings (teammates) from originalChildren if they were filtered
  if (parentNode.originalChildren && parentNode.originalChildren.length > 0) {
    parentNode.children = parentNode.originalChildren.map(cloneNode);
    console.log('[OrgChartPage] Restored', parentNode.children.length, 'siblings (teammates) for', parentNode.name);
  }

  // Ensure target user's direct reports are all visible
  // Clear expandedChildrenSlackIds on target node
  if (targetNode.expandedChildrenSlackIds) {
    delete targetNode.expandedChildrenSlackIds;
  }
  
  // Restore from originalChildren if available
  if (targetNode.originalChildren && targetNode.originalChildren.length > 0) {
    targetNode.children = targetNode.originalChildren.map(cloneNode);
    console.log('[OrgChartPage] Restored', targetNode.children.length, 'direct reports for', targetNode.name);
  }

  // Return the restructured tree
  return clonedRoot;
}

function centerOnRoot() {
  if (chartContainerRef.value) {
    chartContainerRef.value.centerOnRoot();
  }
}

function centerOnUser(slackId: string) {
  // Find the node element with this slackId
  setTimeout(() => {
    const nodeElement = document.querySelector(`[data-slack-id="${slackId}"]`) as HTMLElement;
    if (nodeElement && chartContainerRef.value) {
      chartContainerRef.value.centerOnNode(nodeElement);
      console.log('[OrgChartPage] Centered on user:', slackId);
    } else {
      // If user node not found, center on root
      console.warn('[OrgChartPage] User node not found, centering on root');
      centerOnRoot();
    }
  }, 300);
}

function onSearchInput() {
  if (searchTimeout.value) {
    clearTimeout(searchTimeout.value);
  }

  searchTimeout.value = window.setTimeout(() => {
    if (searchQuery.value.length >= 3) {
      performSearch();
    } else {
      searchResults.value = [];
    }
  }, 200);
}

function clearSearch() {
  searchQuery.value = '';
  searchResults.value = [];
}

async function performSearch() {
  const query = searchQuery.value.trim();
  if (query.length < 3) {
    searchResults.value = [];
    return;
  }

  const searchTerms = query.split(' ').filter(term => term.length > 0);
  let matches: SearchMatch[] = [];

  for (const term of searchTerms) {
    const termMatches = await findUsersForTerm(term.toLowerCase());
    
    if (matches.length === 0) {
      matches = termMatches;
    } else {
      // AND logic: intersect matches
      matches = intersectMatches(matches, termMatches);
    }
  }

  // Sort by number of matches
  searchResults.value = matches.sort((a, b) => b.matchedOn.length - a.matchedOn.length);
}

async function findUsersForTerm(term: string): Promise<SearchMatch[]> {
  const matches: SearchMatch[] = [];

  for (const user of allUsers.value) {
    const matchedOn: string[] = [];

    // Name search
    if (user.name?.toLowerCase().includes(term) ||
        user.fname?.toLowerCase().includes(term) ||
        user.lname?.toLowerCase().includes(term)) {
      matchedOn.push('name');
    }

    // Department search
    if (user.department?.toLowerCase().includes(term)) {
      matchedOn.push('department');
    }

    // Team search
    if (user.team?.toLowerCase().includes(term)) {
      matchedOn.push('team');
    }

    // Role search
    if (user.role?.toLowerCase().includes(term)) {
      matchedOn.push('role');
    }

    // Email search (exact match)
    if (user.email?.toLowerCase() === term) {
      matchedOn.push('email');
    }

    if (matchedOn.length > 0) {
      matches.push({ user, matchedOn });
    }
  }

  return matches;
}

function intersectMatches(matches1: SearchMatch[], matches2: SearchMatch[]): SearchMatch[] {
  const userMap = new Map<string, SearchMatch>();
  
  // Add all matches from first set
  for (const match of matches1) {
    userMap.set(match.user.id, { ...match });
  }
  
  // Intersect with second set
  const result: SearchMatch[] = [];
  for (const match of matches2) {
    const existing = userMap.get(match.user.id);
    if (existing) {
      // Merge matchedOn arrays
      const combinedMatchedOn = [...new Set([...existing.matchedOn, ...match.matchedOn])];
      result.push({
        user: match.user,
        matchedOn: combinedMatchedOn,
      });
    }
  }
  
  return result;
}

function selectSearchResult(user: OrgUser) {
  // Update URL to center on this user
  router.replace({
    query: {
      ...route.query,
      otherSlackUserId: user.slackId,
    },
  });

  highlightedSlackId.value = user.slackId;
  otherSlackUserId.value = user.slackId;
  searchQuery.value = '';
  searchResults.value = [];

  // Center on the selected user
  centerOnUser(user.slackId);
}

function handleNodeClick(node: OrgNode) {
  // Find user in allUsers
  const user = allUsers.value.find(u => u.slackId === node.slackId || u.id === node.id);
  
  if (user) {
    selectedUser.value = user;
    // Position popup near click (simplified - would calculate from node position)
    popupPosition.value = {
      x: window.innerWidth / 2,
      y: window.innerHeight / 2,
    };
    isPopupOpen.value = true;
  }
}

function handleSelectNode(nodeId: string) {
  // Handle node selection if needed
}

function closePopup() {
  isPopupOpen.value = false;
  selectedUser.value = null;
}

function retryLoad() {
  initOrg(true);
}

// Helper function to enrich org chart data with profile pictures from users
async function enrichWithProfilePictures(response: OrgChartResponse) {
  // Try to get profile pictures from the users array
  const userPictureMap = new Map<string, string>();
  
  // Build map of slackId -> profilePicture from users array
  for (const user of response.users || []) {
    if (user.profilePicture && user.slackId) {
      userPictureMap.set(user.slackId, user.profilePicture);
    }
  }
  
  // Recursively add profile pictures to nodes
  function addPicturesToNode(node: OrgNode) {
    if (node.slackId && userPictureMap.has(node.slackId) && !node.profilePicture) {
      node.profilePicture = userPictureMap.get(node.slackId);
    }
    
    if (node.children) {
      for (const child of node.children) {
        addPicturesToNode(child);
      }
    }
  }
  
  addPicturesToNode(response.dataSource);
}

// SECURITY: Mock data function for testing - remove in production
function createMockOrgChartData(): OrgChartResponse {
  // Use placeholder images for testing - in production, these come from the API
  const mikeProfilePic = 'https://i.pravatar.cc/150?img=12';
  const jonathonProfilePic = 'https://i.pravatar.cc/150?img=33';
  const mattProfilePic = 'https://i.pravatar.cc/150?img=47';
  
  return {
    dataSource: {
      id: '1',
      name: 'Mike Fodera',
      title: 'CEO',
      slackId: 'U12345',
      profilePicture: mikeProfilePic,
      department: 'Operations',
      location: 'Belfast',
      role: 'CEO',
      children: [
        {
          id: '2',
          name: 'Jonathon Parsons',
          title: 'Engineer',
          slackId: 'U23456',
          profilePicture: jonathonProfilePic,
          department: 'Sandwiches!',
          location: 'Belfast',
          role: 'engineer',
          children: [],
        },
        {
          id: '3',
          name: 'Matt Bailey',
          title: 'Business Analyst',
          slackId: 'U34567',
          profilePicture: mattProfilePic,
          department: 'Research & Development',
          location: 'Belfast',
          role: 'Business Analyst',
          children: [],
        },
      ],
      expandedChildrenSlackIds: ['U23456', 'U34567'],
    },
    users: [
      {
        id: '1',
        name: 'Mike Fodera',
        title: 'CEO',
        slackId: 'U12345',
        profilePicture: mikeProfilePic,
        department: 'Operations',
        location: 'Belfast',
        role: 'CEO',
        email: 'mfodera@example.com',
      },
      {
        id: '2',
        name: 'Jonathon Parsons',
        title: 'Engineer',
        slackId: 'U23456',
        profilePicture: jonathonProfilePic,
        department: 'Sandwiches!',
        location: 'Belfast',
        role: 'engineer',
        email: 'jparsons@example.com',
      },
      {
        id: '3',
        name: 'Matt Bailey',
        title: 'Business Analyst',
        slackId: 'U34567',
        profilePicture: mattProfilePic,
        department: 'Research & Development',
        location: 'Belfast',
        role: 'Business Analyst',
        email: 'mbailey@example.com',
      },
    ],
    slackIdsInChain: ['U12345', 'U23456'],
    showTitle: true,
    showLocation: true,
    showRole: true,
    showDepartment: true,
    showTeam: true,
  };
}

onMounted(async () => {
  // Wait a bit for auth to be ready if needed
  if (!authStore.isAuthenticated) {
    console.log('[OrgChartPage] Waiting for authentication...');
    // Wait up to 2 seconds for auth to initialize
    let attempts = 0;
    while (!authStore.isAuthenticated && attempts < 20) {
      await new Promise(resolve => setTimeout(resolve, 100));
      attempts++;
    }
  }
  
  console.log('[OrgChartPage] Route query params:', route.query);
  console.log('[OrgChartPage] Auth state:', {
    isAuthenticated: authStore.isAuthenticated,
    userId: authStore.user?.id,
    slackId: authStore.user?.slackId,
    slackUserId: authStore.user?.slackUserId,
    communityId: communityStore.currentCommunityId,
  });
  
  initOrg(true);
});

// Watch for route changes
watch(() => route.query, () => {
  if (route.path === '/tabs/org-chart') {
    initOrg(false);
  }
}, { deep: true });
</script>

<style scoped>
.org-chart-page-content {
  --background: #f8fafc;
}

.org-chart-search-container {
  position: sticky;
  top: 0;
  z-index: 100;
  background: #ffffff;
  padding: 16px;
  border-bottom: 1px solid #e5e7eb;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
}

.org-chart-search-wrapper {
  position: relative;
  display: flex;
  align-items: center;
  max-width: 600px;
  margin: 0 auto;
}

.search-icon {
  position: absolute;
  left: 12px;
  font-size: 20px;
  color: #9ca3af;
  z-index: 1;
}

.org-chart-search-input {
  width: 100%;
  padding: 12px 40px 12px 44px;
  border: 2px solid #e5e7eb;
  border-radius: 8px;
  font-size: 14px;
  transition: all 0.2s ease;
}

.org-chart-search-input:focus {
  outline: none;
  border-color: #2d7a4e;
  box-shadow: 0 0 0 3px rgba(45, 122, 78, 0.1);
}

.search-clear-button {
  position: absolute;
  right: 8px;
  width: 28px;
  height: 28px;
  border: none;
  background: transparent;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  border-radius: 50%;
  transition: background 0.2s ease;
}

.search-clear-button:hover {
  background: #f3f4f6;
}

.search-clear-button ion-icon {
  font-size: 18px;
  color: #6b7280;
}

.search-results-dropdown {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  max-width: 600px;
  margin: 8px auto 0;
  background: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  max-height: 400px;
  overflow-y: auto;
  z-index: 200;
}

.search-result-item {
  display: flex;
  align-items: center;
  padding: 12px 16px;
  cursor: pointer;
  transition: background 0.2s ease;
  border-bottom: 1px solid #f3f4f6;
}

.search-result-item:last-child {
  border-bottom: none;
}

.search-result-item:hover {
  background: #f8fafc;
}

.search-result-avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  object-fit: cover;
  margin-right: 12px;
}

.search-result-avatar-placeholder {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: linear-gradient(135deg, #2d7a4e 0%, #1db98a 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #ffffff;
  font-size: 16px;
  font-weight: 600;
  margin-right: 12px;
}

.search-result-info {
  flex: 1;
}

.search-result-name {
  font-size: 14px;
  font-weight: 600;
  color: #1a1a1a;
  margin-bottom: 4px;
}

.search-result-meta {
  font-size: 12px;
  color: #6b7280;
}

.search-result-meta span {
  margin-right: 8px;
}

.org-chart-loading,
.org-chart-error {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  text-align: center;
}

.org-chart-loading p {
  margin-top: 16px;
  color: #6b7280;
}

.error-icon {
  font-size: 48px;
  color: #ef4444;
  margin-bottom: 16px;
}

.org-chart-error h3 {
  font-size: 20px;
  font-weight: 600;
  color: #1a1a1a;
  margin-bottom: 8px;
}

.org-chart-error p {
  color: #6b7280;
  margin-bottom: 24px;
}

.org-chart-wrapper {
  width: 100%;
  height: calc(100vh - 200px);
  min-height: 500px;
  position: relative;
  background: #f8fafc;
}

.org-chart-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  text-align: center;
  color: #6b7280;
}

.org-chart-empty-note {
  margin-top: 12px;
  font-size: 12px;
  color: #9ca3af;
  font-style: italic;
}

@media (max-width: 768px) {
  .org-chart-search-container {
    padding: 12px;
  }

  .org-chart-search-input {
    padding: 10px 36px 10px 40px;
    font-size: 13px;
  }

  .org-chart-wrapper {
    height: calc(100vh - 180px);
    min-height: 400px;
  }
}
</style>

