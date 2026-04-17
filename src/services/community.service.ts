import { apiService } from './api.service';
import { useAuthStore } from '../stores/auth.store';
import { environment } from '@/environments/environment';

export interface Community {
  id: number;
  name: string;
  bio?: string;
  type?: string;
  leaderId: number;
  leader?: {
    id: number;
    fname: string;
    lname: string;
    profilePicture?: string;
  };
  logo?: string;
  signupToken?: string;
  accessCode?: string;
  showHome?: boolean;
  searchable?: boolean;
  /** When true, community can use custom driver CSV flows (e.g. Gemini). */
  hasCustomData?: boolean;
}

class CommunityService {
  /**
   * Get all public (searchable) communities
   * Uses /communities/all/no_restrict endpoint which returns all communities where searchable=true
   */
  async getPublicCommunities(searchTerm?: string): Promise<Community[]> {
    try {
      const url = searchTerm 
        ? `/communities/all/no_restrict?term=${encodeURIComponent(searchTerm)}`
        : '/communities/all/no_restrict';
      const communities = await apiService.get<Community[]>(url);
      return communities || [];
    } catch (error) {
      console.error('[CommunityService] Failed to fetch public communities:', error);
      throw error;
    }
  }

  /**
   * Join a community
   * Uses POST /communities/:id/assign endpoint
   */
  async joinCommunity(communityId: number): Promise<any> {
    try {
      const authStore = useAuthStore();
      const userId = authStore.user?.id;
      
      if (!userId) {
        throw new Error('User not authenticated');
      }
      
      const response = await apiService.post(`/communities/${communityId}/assign`, { userId });
      return response;
    } catch (error) {
      console.error('[CommunityService] Failed to join community:', error);
      throw error;
    }
  }

  /**
   * Get communities that the user is a member of
   * @param forceRefresh - If true, adds cache-busting to force a fresh fetch
   */
  async getUserCommunities(userId: number, forceRefresh: boolean = false): Promise<Community[]> {
    // Use the correct endpoint: /users/${userId}/all-communities
    // This is what the original frontend uses to get ALL communities a user is a member of
    // Note: /users/${userId}/communities (without "all-") only returns the currently active community
    try {
      const url = forceRefresh 
        ? `/users/${userId}/all-communities?_t=${Date.now()}`
        : `/users/${userId}/all-communities`;
      const config = forceRefresh 
        ? { headers: { 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' } }
        : undefined;
      const response = await apiService.get<any>(url, config);
      
      // Handle different response structures
      let communities: Community[] = [];
      if (Array.isArray(response)) {
        communities = response;
      } else if (response && Array.isArray(response.communities)) {
        communities = response.communities;
      } else if (response && Array.isArray(response.data)) {
        communities = response.data;
      } else if (response && typeof response === 'object') {
        console.warn('[CommunityService] Unexpected response structure:', response);
        communities = [];
      }
      
      return communities;
    } catch (error) {
      console.error('[CommunityService] Failed to fetch user communities:', error);
      throw error;
    }
  }

  /**
   * Get a single community by ID
   */
  async getCommunityById(communityId: number): Promise<Community> {
    try {
      const community = await apiService.get<Community>(`/communities/${communityId}`);
      return community;
    } catch (error) {
      console.error(`[CommunityService] Failed to fetch community ${communityId}:`, error);
      throw error;
    }
  }

  /**
   * Get org chart data for a community
   * POST /communities/getOrgDataForCommunity
   */
  async getOrgDataForCommunity(
    communityId: number,
    slackUserId: string,
    otherSlackUserId: string | null,
    keyDocRefId: string,
    searchStrings: string[],
    isInitialPageLoad: boolean,
    secretId: string
  ): Promise<any> {
    try {
      const requestBody = {
        communityId,
        slackUserId,
        otherSlackUserId,
        keyDocRefId,
        searchStrings,
        isInitialPageLoad,
        s: secretId,
      };
      const response = await apiService.post('/communities/getOrgDataForCommunity', requestBody);
      return response;
    } catch (error) {
      console.error('[CommunityService] Failed to fetch org chart data:', error);
      throw error;
    }
  }

  /**
   * Notify backend that viewer viewed a user's profile from the map (fire-and-forget).
   * Backend: POST /public/slack/publishViewProfileFromMap
   */
  async viewSlackProfileFromMap(userSlackId: string, otherUserSlackId: string): Promise<void> {
    try {
      await apiService.post('/public/slack/publishViewProfileFromMap', {
        userSlackId,
        otherUserSlackId,
      });
    } catch (error) {
      console.warn('[CommunityService] viewSlackProfileFromMap failed (non-blocking):', error);
    }
  }

  /**
   * First-time Slack workspace install: exchange OAuth code for Trova user + community (public).
   * Backend: POST /public/slack/oauth-authenticate
   */
  async oauthAuthenticateSlackApp(
    code: string,
    redirectUri: string,
    source = 'slack-install-redirect'
  ): Promise<{
    message?: string;
    user: Record<string, unknown> & { id: number; slackId?: string };
    community: Community;
    extraInfo?: { slackTeamName?: string; slackTeamId?: string };
  }> {
    return apiService.post('/public/slack/oauth-authenticate', {
      code,
      redirectUri,
      testMode: false,
      source,
    });
  }

  /**
   * Update community fields via public PATCH (no Firebase required).
   * Backend: PATCH /public/community/edit
   */
  async updateCommunityPublic(payload: {
    id: number;
    name: string;
    type: string;
    bio?: string;
  }): Promise<Community> {
    return apiService.patch('/public/community/edit', payload);
  }

  /**
   * Upload community logo (multipart field `image`).
   * Backend: POST /public/:id/community-image-upload
   */
  async uploadCommunityLogoPublic(communityId: number, file: File): Promise<Community> {
    const formData = new FormData();
    formData.append('image', file);
    const { useFirebase } = await import('@/composables/useFirebase');
    const headers: Record<string, string> = {};
    const auth = useFirebase().auth;
    if (auth?.currentUser) {
      try {
        headers['Authorization'] = await auth.currentUser.getIdToken();
      } catch {
        /* public endpoint — optional auth */
      }
    }
    const res = await fetch(
      `${environment.apiUrl}/public/${communityId}/community-image-upload`,
      {
        method: 'POST',
        body: formData,
        credentials: 'include',
        headers: Object.keys(headers).length ? headers : undefined,
      }
    );
    if (!res.ok) {
      const err = await res.text();
      throw new Error(err || `Upload failed (${res.status})`);
    }
    return res.json() as Promise<Community>;
  }
}

export const communityService = new CommunityService();

