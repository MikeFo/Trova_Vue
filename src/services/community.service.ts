import { apiService } from './api.service';
import { useAuthStore } from '../stores/auth.store';

export interface Community {
  id: number;
  name: string;
  bio?: string;
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
      
      console.log('[CommunityService] Fetching public communities from:', url);
      const communities = await apiService.get<Community[]>(url);
      console.log('[CommunityService] Received communities:', communities?.length || 0);
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
      
      console.log('[CommunityService] Joining community:', communityId, 'for user:', userId);
      const response = await apiService.post(`/communities/${communityId}/assign`, { userId });
      console.log('[CommunityService] Assign response:', response);
      console.log('[CommunityService] Successfully joined community:', communityId);
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
      
      console.log('[CommunityService] getOrgDataForCommunity request body:', JSON.stringify(requestBody, null, 2));
      
      const response = await apiService.post('/communities/getOrgDataForCommunity', requestBody);
      return response;
    } catch (error) {
      console.error('[CommunityService] Failed to fetch org chart data:', error);
      throw error;
    }
  }
}

export const communityService = new CommunityService();

