import { apiService } from './api.service';
import type { User } from '../stores/auth.store';
import type { Community } from './community.service';
import { 
  collection, 
  query, 
  where, 
  getDocs,
  Timestamp,
  collectionGroup,
  doc,
  getDoc
} from 'firebase/firestore';
import { useFirebase } from '../composables/useFirebase';
import { environment } from '../environments/environment';

export interface CommunityMember {
  id: number;
  fname: string;
  lname: string;
  fullName: string;
  email: string;
  profilePicture?: string;
  isManager?: boolean;
  enabled?: boolean;
  joinDate?: string;
  [key: string]: any;
}

export interface AttributeModel {
  name: string;
  value: number;
}

export interface DashboardData {
  name: string;
  data: AttributeModel[];
}

export interface UserStats {
  // Existing
  totalUsers: number;
  activeUsers: number;
  newUsersThisMonth: number;
  
  // Core Engagement Metrics
  profilesCreated?: number;
  connectionsMade?: number; // Total matches
  trovaChatsStarted?: number; // MPIM + Channel Breakout + Directory messages
  totalMessagesSent?: number;
  eventsCreated?: number;
  eventsAttended?: number;
  groupsCreated?: number;
  groupsJoined?: number;
  dailyActiveUsers?: number;
  weeklyActiveUsers?: number;
  userOnboardingIntros?: number; // Users introduced via Weekly Introductions (Onboarding)
  profileCompletionRate?: number; // Percentage
  profileCompletionCompleted?: number; // Number of completed profiles
  profileCompletionTotal?: number; // Total number of profiles
  matchResponseRate?: number; // Percentage

  // User Actions Metrics (from User Actions report)
  openedTrova?: number; // Users who opened Trova
  introsLedToConvos?: number; // Intros that led to conversations
  profileScore?: number; // Average profile score
  generalActions?: number; // Total general actions (user events)
  spotlightsCreated?: number; // Total spotlights created
  recWallsGiven?: number; // Recommendation walls given
  recWallsReceived?: number; // Recommendation walls received
  selfIntroduced?: number; // Users who self-introduced (profile spotlights/introductions)
  cityStateCountry?: string; // Location distribution (could be a summary)
  
  // Engagement Attribution
  trovaMagicEngagements?: number; // Engagements from Trova Magic
  channelPairingEngagements?: number; // Engagements from Channel Pairing
  mentorMenteeEngagements?: number; // Engagements from Mentor/Mentee matches
  mentorMenteeUniquePairs?: number; // Unique pairs from Mentor/Mentee matches (deduplicated)
  channelPairingOnDemand?: number; // Channel pairing on-demand engagements
  channelPairingCadence?: number; // Channel pairing cadence engagements
  
  // Skills Metrics (from All Skills report)
  totalSkills?: number; // Total unique skills in community
  usersWithSkills?: number; // Users who have at least one skill
  usersCanMentor?: number; // Users who can mentor
  usersWantMentor?: number; // Users who want to be mentored
  
  // Match Metrics (from Matches report)
  trovaMagicMatches?: number; // Trova Magic unique pairs
  trovaMagicSessions?: number; // Trova Magic total sessions (match records)
  channelPairingMatches?: number; // Channel Pairing unique groups
  channelPairingSessions?: number; // Channel Pairing total sessions (match records)
  mentorMenteeMatches?: number; // Mentor/Mentee sessions (match records)
  allMatchesEngaged?: number; // Matches where all users engaged
  matchEngagementRate?: number; // Percentage of matches that led to engagement
  
  // Channel Pairing Metrics
  channelPairingGroups?: number; // Channel pairing groups created
  channelPairingUsers?: number; // Users in channel pairing groups
  
  [key: string]: any;
}

export interface WeeklyIntroductionsUserRow {
  id: number;
  name: string;
  email?: string;
  profilePicture?: string;
  introMessageSentAt?: string; // ISO date string
}

export interface SelfIntroducedUserRow {
  id: number;
  name: string;
  email?: string;
  profilePicture?: string;
  introducedAt?: string; // ISO date string
  channelName?: string;
  channelId?: string;
}

export interface ConversationStarted {
  conversationType: 'magic_intro' | 'channel_pairing' | 'mentor_match';
  channelId: string;
  createdAt: string;
  messageCount: number;
  participants: string;
}

export interface ConversationsStartedResponse {
  totalConversations: number;
  totalMessages: number;
  conversations: ConversationStarted[];
}

export class AdminService {
  // Cache for expensive operations
  private matchesCache = new Map<string, { data: any[]; timestamp: number }>();
  private conversationsCache = new Map<string, { data: any; timestamp: number }>();
  private profilesCache = new Map<number, { data: any[]; timestamp: number }>();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes
  private readonly FIREBASE_CACHE_TTL = 10 * 60 * 1000; // 10 minutes for Firebase queries
  
  // Request deduplication - prevent parallel duplicate requests
  private pendingRequests = new Map<string, Promise<any>>();

  /**
   * Get cache key for matches
   */
  private getMatchesCacheKey(communityId: number, startDate?: string, endDate?: string, type?: string): string {
    return `matches_${communityId}_${startDate || 'all'}_${endDate || 'all'}_${type || 'all'}`;
  }

  /**
   * Get cache key for Firebase conversations
   */
  private getConversationsCacheKey(communityId: number): string {
    return `conversations_${communityId}`;
  }

  /**
   * Check if cache entry is valid
   */
  private isCacheValid(timestamp: number, ttl: number = this.CACHE_TTL): boolean {
    return Date.now() - timestamp < ttl;
  }

  /**
   * Clear expired cache entries
   */
  private clearExpiredCache(): void {
    const now = Date.now();
    for (const [key, value] of this.matchesCache.entries()) {
      if (!this.isCacheValid(value.timestamp)) {
        this.matchesCache.delete(key);
      }
    }
    for (const [key, value] of this.conversationsCache.entries()) {
      if (!this.isCacheValid(value.timestamp, this.FIREBASE_CACHE_TTL)) {
        this.conversationsCache.delete(key);
      }
    }
    for (const [key, value] of this.profilesCache.entries()) {
      if (!this.isCacheValid(value.timestamp)) {
        this.profilesCache.delete(key);
      }
    }
  }

  /**
   * Get cached or fetch profiles for a community
   */
  private async getCachedProfiles(communityId: number): Promise<any[]> {
    const cached = this.profilesCache.get(communityId);
    
    if (cached && this.isCacheValid(cached.timestamp)) {
      console.log(`[AdminService] ✅ Using cached profiles for community ${communityId}`);
      return cached.data;
    }

    // Fetch profiles
    const { profileService } = await import('./profile.service');
    const profiles = await profileService.getProfilesForUserAndCommunity(communityId);
    
    // Cache the result
    this.profilesCache.set(communityId, { data: profiles, timestamp: Date.now() });
    return profiles;
  }

  /**
   * Check if user is a manager/admin of a community
   * A user is an admin if:
   * 1. They are the leader (leaderId matches userId), OR
   * 2. They are in the communities_managers table for that community
   */
  async isManager(communityId: number, userId: number, community?: Community): Promise<boolean> {
    // First check: if user is the leader (fast client-side check)
    if (community && community.leaderId === userId) {
      return true;
    }

    // Second check: check communities_managers table via API
    try {
      const response = await apiService.get<{ isManager: boolean }>(
        `/communities/${communityId}/managers/${userId}/check`
      );
      return response?.isManager || false;
    } catch (error) {
      // If endpoint doesn't exist or fails, fall back to leader check
      if (community && community.leaderId === userId) {
        return true;
      }
      console.error('Failed to check manager status:', error);
      return false;
    }
  }

  /**
   * Check if user is a super admin
   * Super admin IDs:
   * Production: [4147, 3113, 4136, 14453]
   * Non-production: [3434, 3296, 3422, 2920, 2583, 2935]
   */
  isSuperAdmin(userId: number): boolean {
    const isProduction = environment.production;
    const productionSuperAdmins = [4147, 3113, 4136, 14453];
    const nonProductionSuperAdmins = [3434, 3296, 3422, 2920, 2583, 2935];
    
    const superAdminIds = isProduction ? productionSuperAdmins : nonProductionSuperAdmins;
    return superAdminIds.includes(userId);
  }

  /**
   * Get all communities for super admins
   * Uses /users/:user_id/all-communities-manager-of endpoint
   * For super admins, this returns all communities ordered by name
   */
  async getAllCommunitiesForSuperAdmin(userId: number): Promise<Community[]> {
    try {
      const communities = await apiService.get<Community[]>(
        `/users/${userId}/all-communities-manager-of`
      );
      return communities || [];
    } catch (error) {
      console.error('Failed to fetch all communities for super admin:', error);
      return [];
    }
  }

  /**
   * Get all community members
   * Tries multiple endpoint patterns to find the correct one
   */
  async getCommunityMembers(communityId: number): Promise<CommunityMember[]> {
    // Try primary endpoint first
    try {
      const members = await apiService.get<CommunityMember[]>(
        `/communities/${communityId}/members`
      );
      return members || [];
    } catch (error: any) {
      // If 404, try alternative endpoints
      if (error?.status === 404 || error?.response?.status === 404) {
        // Try alternative endpoint patterns
        try {
          // Try POST endpoint that might exist (use cached if available)
          const profiles = await this.getCachedProfiles(communityId);
          
          // Fetch user emails by batch fetching user data
          const userIds = profiles
            .map(profile => profile.userId || profile.id)
            .filter((id): id is number => typeof id === 'number' && id > 0);
          
          let usersMap = new Map<number, any>();
          if (userIds.length > 0) {
            try {
              const { userService } = await import('./user.service');
              usersMap = await userService.getUsersByIds(userIds);
            } catch (userError) {
              console.warn('[AdminService] Failed to fetch user emails:', userError);
              // Continue without emails if user service fails
            }
          }
          
          // Convert ProfilesInit to CommunityMember format with email data
          return profiles.map(profile => {
            const userId = profile.userId || profile.id;
            const user = usersMap.get(userId);
            return {
              id: userId,
              fname: profile.fname,
              lname: profile.lname,
              fullName: profile.fullName || `${profile.fname} ${profile.lname}`,
              email: user?.email || '', // Get email from user data if available
              profilePicture: profile.profilePicture,
              isManager: false,
              enabled: true,
              joinDate: undefined,
            };
          });
        } catch (fallbackError) {
          // Both endpoints failed, return empty array
          console.log(`[AdminService] Members endpoint not found for community ${communityId}, using empty array`);
          return [];
        }
      }
      console.error('Failed to fetch community members:', error);
      return [];
    }
  }

  /**
   * Search community members
   */
  async searchMembers(communityId: number, query: string): Promise<CommunityMember[]> {
    try {
      const members = await apiService.get<CommunityMember[]>(
        `/communities/${communityId}/members/search?q=${encodeURIComponent(query)}`
      );
      return members || [];
    } catch (error) {
      console.error('Failed to search members:', error);
      return [];
    }
  }

  /**
   * Enable/disable a user
   */
  async toggleUserStatus(userId: number, enabled: boolean): Promise<void> {
    try {
      await apiService.put(`/users/${userId}/status`, { enabled });
    } catch (error) {
      console.error('Failed to toggle user status:', error);
      throw error;
    }
  }

  /**
   * Add/remove manager
   */
  async toggleManager(communityId: number, userId: number, isManager: boolean): Promise<void> {
    try {
      if (isManager) {
        await apiService.post(`/communities/${communityId}/managers`, { userId });
      } else {
        await apiService.delete(`/communities/${communityId}/managers/${userId}`);
      }
    } catch (error) {
      console.error('Failed to toggle manager:', error);
      throw error;
    }
  }

  /**
   * Update community bio/description
   */
  async updateCommunityBio(communityId: number, bio: string): Promise<Community> {
    try {
      return await apiService.patch<Community>(`/communities/${communityId}`, { bio });
    } catch (error) {
      console.error('Failed to update community bio:', error);
      throw error;
    }
  }

  /**
   * Update community logo
   */
  async updateCommunityLogo(communityId: number, logoUrl: string): Promise<Community> {
    try {
      return await apiService.patch<Community>(`/communities/${communityId}`, { logo: logoUrl });
    } catch (error) {
      console.error('Failed to update community logo:', error);
      throw error;
    }
  }

  /**
   * Send message to users
   */
  async sendMessage(communityId: number, userIds: number[], message: string): Promise<void> {
    try {
      await apiService.post(`/communities/${communityId}/messages`, {
        userIds,
        message,
      });
    } catch (error) {
      console.error('Failed to send message:', error);
      throw error;
    }
  }

  /**
   * Upload driver data CSV
   */
  async uploadDriverData(communityId: number, file: File): Promise<void> {
    try {
      const formData = new FormData();
      formData.append('file', file);
      await apiService.post(`/communities/${communityId}/data/drivers`, formData);
    } catch (error) {
      console.error('Failed to upload driver data:', error);
      throw error;
    }
  }

  /**
   * Upload reports-to data CSV
   */
  async uploadReportsToData(communityId: number, file: File): Promise<void> {
    try {
      const formData = new FormData();
      formData.append('file', file);
      await apiService.post(`/communities/${communityId}/data/reports-to`, formData);
    } catch (error) {
      console.error('Failed to upload reports-to data:', error);
      throw error;
    }
  }

  /**
   * Upload mapped pairings CSV
   */
  async uploadMappedPairings(communityId: number, file: File): Promise<void> {
    try {
      const formData = new FormData();
      formData.append('file', file);
      await apiService.post(`/communities/${communityId}/data/pairings`, formData);
    } catch (error) {
      console.error('Failed to upload mapped pairings:', error);
      throw error;
    }
  }

  /**
   * Get attribute chart data (interests, activities, etc.)
   */
  async getAttributeChartData(
    communityId: number,
    type: string,
    consolidateResults: boolean = true,
    onlyActive: boolean = true
  ): Promise<AttributeModel[]> {
    try {
      const url = `/communities/${communityId}/attribute?type=${type}&consolidateResults=${consolidateResults}&onlyActive=${onlyActive}`;
      const data = await apiService.get<AttributeModel[]>(url);
      return data || [];
    } catch (error) {
      console.error(`Failed to fetch attribute data for ${type}:`, error);
      return [];
    }
  }

  /**
   * Get skills chart data
   */
  async getSkillsChartData(
    communityId: number,
    type: string,
    consolidateResults: boolean = true,
    onlyActive: boolean = true
  ): Promise<AttributeModel[]> {
    try {
      const url = `/communities/${communityId}/skills?type=${type}&consolidateResults=${consolidateResults}&onlyActive=${onlyActive}`;
      const data = await apiService.get<AttributeModel[]>(url);
      return data || [];
    } catch (error) {
      console.error(`Failed to fetch skills data for ${type}:`, error);
      return [];
    }
  }

  /**
   * Get business topics chart data
   */
  async getBusinessTopicsChartData(
    communityId: number,
    consolidateResults: boolean = true,
    onlyActive: boolean = true
  ): Promise<AttributeModel[]> {
    try {
      const url = `/communities/${communityId}/businessTopics?consolidateResults=${consolidateResults}&onlyActive=${onlyActive}`;
      const data = await apiService.get<AttributeModel[]>(url);
      return data || [];
    } catch (error) {
      console.error('Failed to fetch business topics data:', error);
      return [];
    }
  }

  /**
   * Get custom fields available for charts
   */
  async getCustomFieldsForCharts(communityId: number): Promise<any[]> {
    try {
      const url = `/communities/${communityId}/custom-fields-for-charts`;
      const data = await apiService.get<any[]>(url);
      return data || [];
    } catch (error) {
      console.error('Failed to fetch custom fields for charts:', error);
      return [];
    }
  }

  /**
   * Get custom field chart data
   */
  async getCustomFieldChartData(
    communityId: number,
    customFieldId: number,
    consolidateResults: boolean = true,
    onlyActive: boolean = true
  ): Promise<AttributeModel[] | { results: AttributeModel[]; fieldName?: string; customFieldName?: string; fieldId?: number; data?: AttributeModel[] }> {
    try {
      const url = `/communities/${communityId}/custom-field-chart/${customFieldId}?consolidateResults=${consolidateResults}&onlyActive=${onlyActive}`;
      const response = await apiService.get<any>(url);
      
      // Backend may return either:
      // 1. Direct array: AttributeModel[]
      // 2. Old wrapped object: { data: AttributeModel[], fieldName?: string, customFieldName?: string, fieldId?: number }
      // 3. New wrapped object: { results: AttributeModel[], fieldName?: string, customFieldName?: string, fieldId?: number }
      if (Array.isArray(response)) {
        return response;
      } else if (response && Array.isArray(response.results)) {
        // New format: { results: [...], fieldName, customFieldName, fieldId }
        return response;
      } else if (response && Array.isArray(response.data)) {
        // Old format: { data: [...], fieldName, customFieldName, fieldId }
        // Convert to new format for consistency
        return {
          results: response.data,
          fieldName: response.fieldName,
          customFieldName: response.customFieldName,
          fieldId: response.fieldId
        };
      } else {
        console.warn(`[AdminService] Unexpected response format for custom field ${customFieldId}:`, response);
        return [];
      }
    } catch (error) {
      console.error(`Failed to fetch custom field ${customFieldId} data:`, error);
      return [];
    }
  }

  /**
   * Get users by attribute value
   * e.g., get users who have "Affiliate Marketing" as an interest
   * Falls back to filtering members client-side if endpoint doesn't exist
   */
  async getUsersByAttribute(
    communityId: number,
    attributeType: string,
    attributeValue: string,
    onlyActive: boolean = true,
    skillType?: string // For skills: 'mentor', 'mentee', or 'general'
  ): Promise<CommunityMember[]> {
    try {
      let url = `/communities/${communityId}/attribute/users?type=${attributeType}&value=${encodeURIComponent(attributeValue)}&onlyActive=${onlyActive}`;
      // Add skillType parameter for skills
      if (attributeType === 'skill' && skillType) {
        url += `&skillType=${skillType}`;
      }
      // Add full=true parameter for business_topic
      if (attributeType === 'business_topic') {
        url += `&full=true`;
      }
      // Add pagination support - start with first page, can be extended for waterfall loading
      // Default limit of 200 should cover most cases, but can be increased if needed
      url += `&limit=200`;
      const response = await apiService.get<any>(url);
      
      // Handle paginated response (if endpoint returns { data: [...], pagination: {...} })
      // or direct array response
      let data: any[];
      let pagination: any = null;
      
      if (Array.isArray(response)) {
        // Direct array response
        data = response;
      } else if (response && Array.isArray(response.data)) {
        // Paginated response
        data = response.data;
        pagination = response.pagination;
      } else {
        // Unexpected format
        console.warn(`[AdminService] Unexpected response format for ${attributeType}:${attributeValue}`);
        data = [];
      }
      
      if (!data || data.length === 0) {
        return [];
      }
      
      // If pagination exists and there are more pages, load them all before returning
      if (pagination && pagination.totalPages > 1) {
        const allUsers = [...data];
        const totalPages = pagination.totalPages || 1;
        const currentPage = pagination.currentPage || 1;
        
        // Load all remaining pages sequentially (await all before returning)
        for (let page = currentPage + 1; page <= totalPages; page++) {
          try {
            let pageUrl = `/communities/${communityId}/attribute/users?type=${attributeType}&value=${encodeURIComponent(attributeValue)}&onlyActive=${onlyActive}&limit=200&page=${page}`;
            if (attributeType === 'skill' && skillType) {
              pageUrl += `&skillType=${skillType}`;
            }
            if (attributeType === 'business_topic') {
              pageUrl += `&full=true`;
            }
            
            const pageResponse = await apiService.get<any>(pageUrl);
            const pageData = Array.isArray(pageResponse) ? pageResponse : (pageResponse?.data || []);
            allUsers.push(...pageData);
          } catch (error) {
            console.warn(`[AdminService] Failed to load page ${page} for ${attributeType}:${attributeValue}:`, error);
            // Continue loading other pages even if one fails
          }
        }
        
        // Update data to include all pages
        data = allUsers;
      }
      
      // Map response to CommunityMember format, ensuring id is set (use userId if id is missing)
      const users: CommunityMember[] = data.map((user: any) => ({
        id: user.id || user.userId,
        userId: user.userId || user.id,
        fname: user.fname || '',
        lname: user.lname || '',
        fullName: user.fullName || `${user.fname || ''} ${user.lname || ''}`.trim(),
        email: user.email || '',
        profilePicture: user.profilePicture,
        bio: user.bio,
        pronouns: user.pronouns,
        isManager: user.isManager,
        enabled: user.enabled,
        joinDate: user.joinDate,
        ...user, // Include any additional fields
      }));
      
      return users;
    } catch (error: any) {
      const status = error?.status || error?.response?.status;
      const statusText = error?.statusText || error?.response?.statusText;
      
      console.error(`[AdminService] ❌ Error fetching users for ${attributeType}:${attributeValue}:`, {
        status,
        statusText,
        message: error?.message,
        response: error?.response?.data,
        fullError: error,
      });
      
      // If 404, endpoint doesn't exist - fall back to client-side filtering
      if (status === 404) {
        return this.getUsersByAttributeFallback(communityId, attributeType, attributeValue, onlyActive);
      }
      
      // For 400 errors, it might be an unsupported type - try fallback
      if (status === 400) {
        console.warn(`[AdminService] 400 Bad Request for ${attributeType}:${attributeValue}, attempting fallback`);
        return this.getUsersByAttributeFallback(communityId, attributeType, attributeValue, onlyActive);
      }
      
      // For 500 errors, it's a backend SQL issue - log it clearly and try fallback
      if (status === 500) {
        console.error(`[AdminService] 500 Internal Server Error - Backend SQL query failed for ${attributeType}:${attributeValue}`, error?.response?.data);
        // Still try fallback in case it can recover some data
        return this.getUsersByAttributeFallback(communityId, attributeType, attributeValue, onlyActive);
      }
      
      // For other errors, still try fallback but log the error
      console.warn(`[AdminService] Error ${status} for ${attributeType}:${attributeValue}, attempting fallback`);
      return this.getUsersByAttributeFallback(communityId, attributeType, attributeValue, onlyActive);
    }
  }

  /**
   * Fallback: Get all members and filter by attribute client-side
   */
  private async getUsersByAttributeFallback(
    communityId: number,
    attributeType: string,
    attributeValue: string,
    onlyActive: boolean = true
  ): Promise<CommunityMember[]> {
    try {
      // Use profiles for fallback filtering. Community member endpoints often do not
      // include rich profile attributes (interests, intentions, etc.), which would
      // cause the modal to incorrectly show "No users found".
      const profiles = await this.getCachedProfiles(communityId);

      const needle = (attributeValue || '').trim().toLowerCase();
      const matchesNeedle = (value: string) => (value || '').trim().toLowerCase() === needle;
      const includesNeedle = (value: string) => (value || '').trim().toLowerCase().includes(needle);

      const toStringValues = (input: any): string[] => {
        if (!input) return [];
        const arr = Array.isArray(input) ? input : [input];
        return arr
          .map((v: any) => {
            if (!v) return '';
            if (typeof v === 'string') return v;
            if (typeof v === 'number') return String(v);
            // Common shapes: { name }, { label }, { primaryName }, { value }
            if (typeof v?.name === 'string') return v.name;
            if (typeof v?.label === 'string') return v.label;
            if (typeof v?.primaryName === 'string') return v.primaryName;
            if (typeof v?.secondaryName === 'string') return v.secondaryName;
            if (typeof v?.value === 'string') return v.value;
            return '';
          })
          .map((s) => s.trim())
          .filter(Boolean);
      };

      const extractValues = (profile: any): string[] => {
        const p = profile || {};
        const d = p.data || p.profileData || p.profile || {};

        // Prefer explicit fields, but be defensive: data shape differs between envs.
        switch (attributeType) {
          case 'interest':
            // Check all possible locations for interests
            // Also check userThings which is an array of arrays like [["interest", ["Technology"]]]
            const interests: string[] = [
              ...toStringValues(p.interests),
              ...toStringValues(d.interests),
              ...toStringValues(p.dataInterests),
              ...toStringValues(d.dataInterests),
              // Some environments store interests under passions
              ...toStringValues(p.passions),
              ...toStringValues(d.passions),
              // Check if interests are nested in other objects
              ...toStringValues(p.profile?.interests),
              ...toStringValues(p.profileData?.interests),
              ...toStringValues(p.userProfile?.interests),
            ];
            
            // Check userThings for interests (format: [["interest", ["Technology", "Cooking"]]])
            if (p.userThings && Array.isArray(p.userThings)) {
              for (const thing of p.userThings) {
                if (Array.isArray(thing) && thing.length >= 2) {
                  const thingType = thing[0];
                  if (thingType === 'interest' || thingType === 'interests') {
                    const thingValues = thing[1];
                    if (Array.isArray(thingValues)) {
                      interests.push(...toStringValues(thingValues));
                    } else if (typeof thingValues === 'string') {
                      interests.push(thingValues.trim());
                    }
                  }
                }
              }
            }
            
            // Also check data.userThings
            if (d.userThings && Array.isArray(d.userThings)) {
              for (const thing of d.userThings) {
                if (Array.isArray(thing) && thing.length >= 2) {
                  const thingType = thing[0];
                  if (thingType === 'interest' || thingType === 'interests') {
                    const thingValues = thing[1];
                    if (Array.isArray(thingValues)) {
                      interests.push(...toStringValues(thingValues));
                    } else if (typeof thingValues === 'string') {
                      interests.push(thingValues.trim());
                    }
                  }
                }
              }
            }
            
            return interests;
          case 'activity':
            // "Activities" varies by backend; often corresponds to passions.
            // Also check userThings which is an array of arrays like [["activity", ["Basketball"]]]
            const activities: string[] = [
              ...toStringValues(p.activities),
              ...toStringValues(d.activities),
              ...toStringValues(p.dataActivities),
              ...toStringValues(d.dataActivities),
              ...toStringValues(p.passions),
              ...toStringValues(d.passions),
              // Check nested locations
              ...toStringValues(p.profile?.activities),
              ...toStringValues(p.profileData?.activities),
              ...toStringValues(p.userProfile?.activities),
            ];
            
            // Check userThings for activities (format: [["activity", ["Basketball", "Running"]]])
            if (p.userThings && Array.isArray(p.userThings)) {
              for (const thing of p.userThings) {
                if (Array.isArray(thing) && thing.length >= 2) {
                  const thingType = thing[0];
                  if (thingType === 'activity' || thingType === 'activities') {
                    const thingValues = thing[1];
                    if (Array.isArray(thingValues)) {
                      activities.push(...toStringValues(thingValues));
                    } else if (typeof thingValues === 'string') {
                      activities.push(thingValues.trim());
                    }
                  }
                }
              }
            }
            
            // Also check data.userThings
            if (d.userThings && Array.isArray(d.userThings)) {
              for (const thing of d.userThings) {
                if (Array.isArray(thing) && thing.length >= 2) {
                  const thingType = thing[0];
                  if (thingType === 'activity' || thingType === 'activities') {
                    const thingValues = thing[1];
                    if (Array.isArray(thingValues)) {
                      activities.push(...toStringValues(thingValues));
                    } else if (typeof thingValues === 'string') {
                      activities.push(thingValues.trim());
                    }
                  }
                }
              }
            }
            
            return activities;
          case 'intention':
            // Profile uses plural `intentions`
            return [
              ...toStringValues(p.intentions),
              ...toStringValues(d.intentions),
              ...toStringValues(p.intention),
              ...toStringValues(d.intention),
            ];
          case 'movie':
            return [...toStringValues(p.movies), ...toStringValues(d.movies)];
          case 'music':
            return [...toStringValues(p.music), ...toStringValues(d.music)];
          case 'occupation':
            // Try explicit occupation first, then job title.
            return [
              ...toStringValues(p.occupation),
              ...toStringValues(d.occupation),
              ...toStringValues(p.jobTitle),
              ...toStringValues(d.jobTitle),
            ];
          case 'organization': {
            const out: string[] = [];
            out.push(...toStringValues(p.organizations));
            out.push(...toStringValues(d.organizations));
            out.push(...toStringValues(p.currentEmployer));
            out.push(...toStringValues(d.currentEmployer));
            out.push(...toStringValues(p.pastEmployers));
            out.push(...toStringValues(d.pastEmployers));
            return out;
          }
          case 'university': {
            const out: string[] = [];
            out.push(...toStringValues(p.university));
            out.push(...toStringValues(d.university));
            out.push(...toStringValues(p.school));
            out.push(...toStringValues(d.school));
            out.push(...toStringValues(p.education));
            out.push(...toStringValues(d.education));
            return out;
          }
          case 'location': {
            const out: string[] = [];
            out.push(...toStringValues(p.currentLocationName));
            out.push(...toStringValues(d.currentLocationName));
            out.push(...toStringValues(p.locations));
            out.push(...toStringValues(d.locations));
            return out;
          }
          case 'businessTopic':
          case 'business_topic':
          case 'businessTopics': {
            // Business topics might be stored in various locations
            const topics: string[] = [
              ...toStringValues(p.businessTopics),
              ...toStringValues(d.businessTopics),
              ...toStringValues(p.business_topics),
              ...toStringValues(d.business_topics),
              ...toStringValues(p.topics),
              ...toStringValues(d.topics),
              ...toStringValues(p.businessTopicsList),
              ...toStringValues(d.businessTopicsList),
              ...toStringValues(p.businessTopic),
              ...toStringValues(d.businessTopic),
            ];
            
            // Check userThings for business topics (format: [["businessTopic", ["5g Technology"]]])
            if (p.userThings && Array.isArray(p.userThings)) {
              for (const thing of p.userThings) {
                if (Array.isArray(thing) && thing.length >= 2) {
                  const thingType = thing[0];
                  if (thingType === 'businessTopic' || thingType === 'business_topic' || thingType === 'businessTopics' || thingType === 'topic') {
                    const thingValues = thing[1];
                    if (Array.isArray(thingValues)) {
                      topics.push(...toStringValues(thingValues));
                    } else if (typeof thingValues === 'string') {
                      topics.push(thingValues.trim());
                    }
                  }
                }
              }
            }
            
            // Also check data.userThings
            if (d.userThings && Array.isArray(d.userThings)) {
              for (const thing of d.userThings) {
                if (Array.isArray(thing) && thing.length >= 2) {
                  const thingType = thing[0];
                  if (thingType === 'businessTopic' || thingType === 'business_topic' || thingType === 'businessTopics' || thingType === 'topic') {
                    const thingValues = thing[1];
                    if (Array.isArray(thingValues)) {
                      topics.push(...toStringValues(thingValues));
                    } else if (typeof thingValues === 'string') {
                      topics.push(thingValues.trim());
                    }
                  }
                }
              }
            }
            
            return topics;
          }
          default:
            // Unknown attribute type - can't reliably fall back
            return [];
        }
      };

      
      const normalize = (s: any) => (s == null ? '' : String(s)).trim().toLowerCase();

      const filteredProfiles = profiles.filter((profile: any) => {
        // We don't have reliable "enabled" on profiles; if the caller requests onlyActive,
        // we still keep everything (better than showing empty results) unless the profile
        // explicitly provides an enabled/disabled signal.
        if (onlyActive) {
          const enabled = (profile as any)?.enabled;
          const disabled = (profile as any)?.disabled;
          if (enabled === false || disabled === true) return false;
        }

        const values = extractValues(profile);
        if (!values || values.length === 0) return false;

        // Most attributes are exact matches; location tends to be verbose so allow contains.
        const isLocation = attributeType === 'location';
        return values.some((v: string) => (isLocation ? includesNeedle(v) : matchesNeedle(v)));
      });


      // If profiles don't contain this attribute (common when charts are backed by a separate table),
      // try to recover user ids from the unconsolidated attribute endpoint and map those ids back
      // to the cached profiles we already have.
      if (filteredProfiles.length === 0) {
        try {
          const raw = await this.getAttributeChartData(communityId, attributeType, false, onlyActive);

          const normalize = (s: any) => (s == null ? '' : String(s)).trim().toLowerCase();
          const target = normalize(attributeValue);
          const isLocation = attributeType === 'location';

          const getAttrLabel = (row: any): string => {
            // Prefer explicit attribute label fields, but fall back to "name".
            return (
              row?.attribute ||
              row?.attributeName ||
              row?.attribute_name ||
              row?.label ||
              row?.valueName ||
              row?.value_name ||
              row?.skill ||
              row?.topic ||
              row?.name ||
              ''
            );
          };

          const extractUserId = (row: any): number | null => {
            const candidates = [
              row?.userId,
              row?.user_id,
              row?.memberId,
              row?.member_id,
              row?.profileId,
              row?.profile_id,
              row?.slackUserId,
              row?.slack_user_id,
              row?.id, // sometimes row id is user id in unconsolidated endpoints
              row?.user?.id,
              row?.user?.userId,
              row?.user?.user_id,
            ];
            for (const c of candidates) {
              const n = typeof c === 'string' ? parseInt(c, 10) : c;
              if (typeof n === 'number' && Number.isFinite(n) && n > 0) return n;
            }
            return null;
          };
          

          const matchingUserIds = new Set<number>();
          let matchedRows = 0;
          let rowsWithUserIds = 0;
          let noLabelRows = 0;
          let noMatchRows = 0;
          
          
          for (const row of raw as any[]) {
            const label = normalize(getAttrLabel(row));
            if (!label) {
              noLabelRows++;
              continue;
            }
            const match = isLocation ? label.includes(target) : label === target;
            if (!match) {
              noMatchRows++;
              continue;
            }
            matchedRows++;
            const uid = extractUserId(row);
            if (uid) {
              matchingUserIds.add(uid);
              rowsWithUserIds++;
            } else {
              // Log ALL rows that matched but had no user ID for debugging
              console.log(`[AdminService] ⚠️ Matched row for "${attributeValue}" but no user ID found:`, {
                label: getAttrLabel(row),
                normalizedLabel: label,
                keys: Object.keys(row),
                fullRow: row,
                stringified: JSON.stringify(row),
              });
            }
          }


          if (matchingUserIds.size > 0) {
            const byId = new Map<number, any>();
            for (const p of profiles as any[]) {
              const id = typeof p?.userId === 'string' ? parseInt(p.userId, 10) : (p?.userId ?? p?.id);
              if (typeof id === 'number' && Number.isFinite(id)) byId.set(id, p);
            }

            const recovered = Array.from(matchingUserIds)
              .map((id) => byId.get(id))
              .filter(Boolean);

            console.log(`[AdminService] Recovered ${recovered.length} profiles from ${matchingUserIds.size} user IDs`);

            if (recovered.length > 0) {
              // Double-check: filter recovered users to ensure they actually have this attribute
              // (in case the unconsolidated endpoint had stale or incorrect data)
              const verified = recovered.filter((profile: any) => {
                const values = extractValues(profile);
                return values.some((v: string) => (isLocation ? includesNeedle(v) : matchesNeedle(v)));
              });

              if (verified.length > 0) {
                return verified.map((profile: any) => ({
                  id: profile.userId || profile.id,
                  fname: profile.fname,
                  lname: profile.lname,
                  fullName: profile.fullName || `${profile.fname || ''} ${profile.lname || ''}`.trim(),
                  email: profile.email || '',
                  profilePicture: profile.profilePicture,
                  isManager: false,
                  enabled: profile.enabled ?? true,
                  joinDate: undefined,
                }));
              } else {
                // If verification filtered everyone out, return unverified (better than empty)
                console.warn(`[AdminService] ⚠️ Verification filtered all users, returning unverified list`);
                return recovered.map((profile: any) => ({
                  id: profile.userId || profile.id,
                  fname: profile.fname,
                  lname: profile.lname,
                  fullName: profile.fullName || `${profile.fname || ''} ${profile.lname || ''}`.trim(),
                  email: profile.email || '',
                  profilePicture: profile.profilePicture,
                  isManager: false,
                  enabled: profile.enabled ?? true,
                  joinDate: undefined,
                }));
              }
            }
          } else {
            console.warn(`[AdminService] ⚠️ No user IDs found in unconsolidated data for ${attributeType}:${attributeValue} (matched ${matchedRows} rows but none had user IDs)`);
          }
        } catch (e) {
          // If this recovery path fails, continue to return the profile-filter result (empty)
          console.warn(`[AdminService] Attribute fallback recovery via unconsolidated endpoint failed for ${attributeType}:${attributeValue}`, e);
        }
      }

      // Map profiles to CommunityMember shape used by the modal
      return filteredProfiles.map((profile: any) => ({
        id: profile.userId || profile.id,
        fname: profile.fname,
        lname: profile.lname,
        fullName: profile.fullName || `${profile.fname || ''} ${profile.lname || ''}`.trim(),
        email: profile.email || '', // Some envs include email on profile payload
        profilePicture: profile.profilePicture,
        isManager: false,
        enabled: true,
        joinDate: undefined,
      }));
    } catch (error) {
      console.error('Error in fallback user filtering:', error);
      return [];
    }
  }

  /**
   * Map attribute type to member field name
   */
  private getAttributeFieldName(attributeType: string): string | null {
    const fieldMap: Record<string, string> = {
      'interest': 'interests',
      'activity': 'activities',
      'intention': 'intention',
      'movie': 'movies',
      'music': 'music',
      'occupation': 'occupation',
      'organization': 'organizations',
      'university': 'university',
      'location': 'locations',
    };
    return fieldMap[attributeType] || null;
  }

  /**
   * Get users by skill value
   */
  async getUsersBySkill(
    communityId: number,
    skillType: string,
    skillValue: string,
    onlyActive: boolean = true
  ): Promise<CommunityMember[]> {
    const endpoints = [
      `/communities/${communityId}/skills/users?type=${skillType}&value=${encodeURIComponent(skillValue)}&onlyActive=${onlyActive}`,
      `/communities/${communityId}/skills/${encodeURIComponent(skillValue)}/users?onlyActive=${onlyActive}`,
      `/communities/${communityId}/users/skills?skill=${encodeURIComponent(skillValue)}&onlyActive=${onlyActive}`,
      // Try attribute endpoint as skills might be treated as attributes
      `/communities/${communityId}/attribute/users?type=skill&value=${encodeURIComponent(skillValue)}&onlyActive=${onlyActive}`,
      `/communities/${communityId}/attribute/users?type=general&value=${encodeURIComponent(skillValue)}&onlyActive=${onlyActive}`,
    ];

    for (const url of endpoints) {
      try {
        const data = await apiService.get<CommunityMember[]>(url);
        if (data && Array.isArray(data) && data.length > 0) {
          return data;
        }
        // If empty array, continue to next endpoint
      } catch (error: any) {
        const status = error?.status || error?.response?.status;
        if (status === 404) {
          // Try next endpoint
          continue;
        } else {
          console.warn(`[AdminService] Error fetching users for skill ${skillType}:${skillValue} from ${url}:`, error);
        }
      }
    }

    // If all endpoints fail, try attribute endpoint (backend now supports skill type with skillType parameter)
    console.log(`[AdminService] ⚠️ All skill endpoints failed, trying attribute endpoint for skill ${skillType}:${skillValue}`);
    try {
      // Backend supports type=skill with skillType parameter (mentor/mentee/general)
      // Pass skillType to the attribute endpoint so it can filter correctly
      const attributeUsers = await this.getUsersByAttribute(communityId, 'skill', skillValue, onlyActive, skillType || 'general');
      if (attributeUsers && attributeUsers.length > 0) {
        console.log(`[AdminService] ✅ Attribute endpoint found ${attributeUsers.length} users with skill "${skillValue}" (type: ${skillType || 'general'})`);
        return attributeUsers;
      }
    } catch (error: any) {
      const status = error?.status || error?.response?.status;
      if (status === 400) {
        console.log(`[AdminService] Attribute endpoint returned 400 - skill type might not be fully supported yet`);
      } else {
        console.log(`[AdminService] Attribute endpoint also failed (${status}), trying profile fallback`);
      }
    }

    // Last resort: try profile-based fallback
    return this.getUsersBySkillFallback(communityId, skillType, skillValue, onlyActive);
  }

  /**
   * Get all individual skills from profiles (expands "Other" category)
   */
  async getAllIndividualSkills(communityId: number, onlyActive: boolean = true): Promise<AttributeModel[]> {
    const profiles = await this.getCachedProfiles(communityId);
    const skillCounts = new Map<string, number>();
    
    profiles.forEach(profile => {
      // Extract skills from profile
      const skills = (profile as any).dataSkills || profile.skills || (profile as any).userSkills;
      let skillsArray: string[] = [];
      
      if (Array.isArray(skills)) {
        skillsArray = skills.map((s: any) => typeof s === 'string' ? s : s?.name || s?.skill || s?.value || '').filter(Boolean);
      } else if (typeof skills === 'string') {
        skillsArray = skills.split(',').map(s => s.trim()).filter(Boolean);
      }
      
      // Count each skill
      skillsArray.forEach(skill => {
        if (skill) {
          skillCounts.set(skill, (skillCounts.get(skill) || 0) + 1);
        }
      });
    });
    
    // Convert to AttributeModel format
    const allSkills: AttributeModel[] = Array.from(skillCounts.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
    
    console.log(`[AdminService] ✅ Extracted ${allSkills.length} individual skills from profiles`);
    return allSkills;
  }

  /**
   * Get all users with their skills displayed (for "Other" category)
   */
  private async getAllUsersWithSkills(communityId: number, onlyActive: boolean = true): Promise<CommunityMember[]> {
    const profiles = await this.getCachedProfiles(communityId);
    
    const users = profiles
      .map(profile => {
        // Extract skills from profile
        const skills = (profile as any).dataSkills || profile.skills || (profile as any).userSkills;
        let skillsArray: string[] = [];
        
        if (Array.isArray(skills)) {
          skillsArray = skills.map((s: any) => typeof s === 'string' ? s : s?.name || s?.skill || s?.value || '');
        } else if (typeof skills === 'string') {
          skillsArray = skills.split(',').map(s => s.trim()).filter(Boolean);
        }
        
        return {
          id: profile.userId || profile.id,
          fname: profile.fname,
          lname: profile.lname,
          fullName: profile.fullName || `${profile.fname} ${profile.lname}`,
          email: '',
          profilePicture: profile.profilePicture,
          isManager: false,
          enabled: true,
          joinDate: undefined,
          jobTitle: profile.jobTitle,
          currentEmployer: profile.currentEmployer,
          // Include skills for display
          skills: skillsArray,
          skillsDisplay: skillsArray.length > 0 ? skillsArray.join(', ') : 'No skills listed'
        };
      })
      .filter(member => {
        if (onlyActive && member.enabled === false) {
          return false;
        }
        return true;
      });

    console.log(`[AdminService] ✅ Found ${users.length} users with skills for "Other" category`);
    return users;
  }

  /**
   * Fallback: Get all members and filter by skill client-side
   * Tries multiple approaches:
   * 1. Try skills endpoint with consolidateResults=false to get per-user data
   * 2. Use profiles endpoint which might contain skills data
   * 3. Use community members and try to match with skills from other sources
   */
  private async getUsersBySkillFallback(
    communityId: number,
    skillType: string,
    skillValue: string,
    onlyActive: boolean = true
  ): Promise<CommunityMember[]> {
    try {
      // First, try getting unconsolidated skills data which might include user info
      try {
        const unconsolidatedSkills = await this.getSkillsChartData(communityId, skillType || 'all', false, onlyActive);
        console.log(`[AdminService] Fallback: Got ${unconsolidatedSkills.length} unconsolidated skill entries`);
        
        
        // Check if unconsolidated data has user information
        // The unconsolidated data might have different structures:
        // 1. { name: "Asana", userId: 123, ... }
        // 2. { name: "Asana|userId:123", value: 1, ... }
        // 3. { skill: "Asana", user_id: 123, ... }
        // 4. { name: "userId:123|Asana", ... }
        const skillEntries = unconsolidatedSkills.filter((skill: any) => {
          const skillName = skill.name || skill.skill || skill.value;
          // Check if name contains the skill (might be in format "skill|userId" or "userId|skill")
          if (typeof skillName === 'string') {
            return skillName.toLowerCase().includes(skillValue.toLowerCase());
          }
          return skillName?.toLowerCase() === skillValue.toLowerCase();
        });
        
        console.log(`[AdminService] Found ${skillEntries.length} entries matching skill "${skillValue}"`);
        
        if (skillEntries.length > 0) {
          // Try to extract user IDs from various possible fields
          const userIds: number[] = [];
          
          skillEntries.forEach((entry: any) => {
            // Try different possible field names for user ID
            const candidates = [
              entry.userId,
              entry.user_id,
              entry.memberId,
              entry.member_id,
              entry.profileId,
              entry.profile_id,
              entry.slackUserId,
              entry.slack_user_id,
              entry.id,
            ];
            for (const c of candidates) {
              const n = typeof c === 'string' ? parseInt(c, 10) : c;
              if (typeof n === 'number' && Number.isFinite(n) && n > 0) {
                userIds.push(n);
                break;
              }
            }
            
            // Check if name contains user ID (format: "skill|userId" or "userId|skill" or "userId:123")
            if (entry.name && typeof entry.name === 'string') {
              // Try to extract from pipe-separated format
              const parts = entry.name.split('|');
              parts.forEach((part: string) => {
                // Check for "userId:123" format
                const userIdMatch = part.match(/userId[:\s]*(\d+)/i) || part.match(/user[:\s]*(\d+)/i);
                if (userIdMatch && userIdMatch[1]) {
                  const id = parseInt(userIdMatch[1], 10);
                  if (!isNaN(id)) userIds.push(id);
                }
                // Check if part is just a number (might be user ID)
                const numPart = parseInt(part.trim(), 10);
                if (!isNaN(numPart) && numPart > 0 && numPart < 1000000) {
                  userIds.push(numPart);
                }
              });
            }
          });
          
          // Remove duplicates
          const uniqueUserIds = [...new Set(userIds)];
          console.log(`[AdminService] Extracted ${uniqueUserIds.length} unique user IDs from unconsolidated data:`, uniqueUserIds);
          
          if (uniqueUserIds.length > 0) {
            try {
              const allMembers = await this.getCommunityMembers(communityId);
              const filtered = allMembers.filter(member => uniqueUserIds.includes(member.id));
              if (onlyActive) {
                const activeFiltered = filtered.filter(m => m.enabled !== false);
                console.log(`[AdminService] ✅ Found ${activeFiltered.length} active members with skill "${skillValue}"`);
                return activeFiltered;
              }
              console.log(`[AdminService] ✅ Found ${filtered.length} members with skill "${skillValue}"`);
              return filtered;
            } catch (memberError) {
              console.warn(`[AdminService] Failed to fetch community members:`, memberError);
            }
          }
        }
      } catch (error) {
        console.log(`[AdminService] Unconsolidated skills approach failed:`, error);
      }

      // Try getting community members and check if they have skills data
      try {
        const allMembers = await this.getCommunityMembers(communityId);
        console.log(`[AdminService] Fallback: Checking ${allMembers.length} community members for skill "${skillValue}"`);
        
        // Check if members have skills in any field
        const membersWithSkill = allMembers.filter((member: any) => {
          // Check various possible fields for skills
          const skills = member.skills || member.skill || member.userSkills || member.dataSkills || member.attributes?.skills;
          if (!skills) return false;
          
          // Handle different skill formats
          if (Array.isArray(skills)) {
            return skills.some((skill: any) => {
              const skillName = typeof skill === 'string' ? skill : skill?.name || skill?.skill || skill?.value;
              return skillName?.toLowerCase() === skillValue.toLowerCase();
            });
          }
          if (typeof skills === 'string') {
            return skills.toLowerCase().includes(skillValue.toLowerCase());
          }
          return false;
        });
        
        if (membersWithSkill.length > 0) {
          console.log(`[AdminService] ✅ Found ${membersWithSkill.length} members with skill "${skillValue}" from community members`);
          if (onlyActive) {
            return membersWithSkill.filter(m => m.enabled !== false);
          }
          return membersWithSkill;
        }
      } catch (memberError) {
        console.log(`[AdminService] Community members approach failed:`, memberError);
      }

      // Fallback to profiles endpoint (use cached if available)
      const profiles = await this.getCachedProfiles(communityId);
      const normalize = (s: any) => (s == null ? '' : String(s)).trim().toLowerCase();
      const normalizedSkillValue = normalize(skillValue);
      
      console.log(`[AdminService] Fallback: Filtering ${profiles.length} profiles for skill "${skillValue}" (type: ${skillType})`);
      
      
      const filtered = profiles
        .map(profile => ({
          id: profile.userId || profile.id,
          fname: profile.fname,
          lname: profile.lname,
          fullName: profile.fullName || `${profile.fname} ${profile.lname}`,
          email: '', // Profiles don't include email
          profilePicture: profile.profilePicture,
          isManager: false,
          enabled: true,
          joinDate: undefined,
          jobTitle: profile.jobTitle,
          currentEmployer: profile.currentEmployer,
          // Include original profile data for skill checking
          _profile: profile,
        }))
        .filter(member => {
          const profile = (member as any)._profile;
          
          // Check skills field - profiles might have skills in different fields
          // Try: skills, dataSkills, userSkills, or any field containing "skill"
          // Also check all fields in case skills are stored elsewhere
          let skills = profile.skills || (profile as any).dataSkills || (profile as any).userSkills;
          
          // If not found, check all fields that might contain skills
          if (!skills) {
            // Check all fields for skill-related data
            for (const key of Object.keys(profile)) {
              if (key.toLowerCase().includes('skill')) {
                const value = (profile as any)[key];
                if (value) {
                  skills = value;
                  break;
                }
              }
            }
          }
          
          if (!skills) {
            return false;
          }

          // Handle array format (most common)
          if (Array.isArray(skills)) {
            return skills.some((skill: any) => {
              const skillName = typeof skill === 'string' 
                ? skill 
                : skill?.name || skill?.skill || skill?.value || skill?.skillName;
              const normalizedSkillName = normalize(skillName);
              
              // For mentor/mentee types, we need to check if the skill matches AND the type matches
              // But if skillType is 'general' or empty, just match the name
              if (skillType && skillType !== 'general') {
                // Check if this skill has the right type (for mentor/mentee filtering)
                // The profile might have mentor/mentee info in separate fields
                // For now, if skillType is specified, we'll match the skill name
                // The type filtering might need to be done at a different level
                const skillTypeMatch = typeof skill === 'object' 
                  ? (skill?.type === skillType || skill?.skillType === skillType || skill?.can_be_mentor || skill?.wants_to_be_mentee)
                  : true; // If it's a string, we can't check type, so match anyway
                
                return normalizedSkillName === normalizedSkillValue && (skillTypeMatch || skillType === 'general');
              }
              
              // For general skills or when no type specified, just match the name
              return normalizedSkillName === normalizedSkillValue;
            });
          }

          // Handle object format (skills as object with keys)
          if (typeof skills === 'object' && !Array.isArray(skills)) {
            return Object.keys(skills).some(key => {
              const skill = skills[key];
              const skillName = typeof skill === 'string' 
                ? skill 
                : skill?.name || skill?.skill || skill?.value || skill?.skillName || key;
              return skillName?.toLowerCase() === skillValue.toLowerCase();
            });
          }

          // Handle string format (comma-separated) - this is how skills appear on profile pages
          if (typeof skills === 'string') {
            // Split by comma and check each skill
            const skillList = skills.split(',').map(s => s.trim());
            return skillList.some(s => 
              s.toLowerCase() === skillValue.toLowerCase()
            );
          }

          return false;
        });

      // Remove the temporary _profile field
      filtered.forEach(member => {
        delete (member as any)._profile;
      });

      console.log(`[AdminService] ✅ Fallback: Found ${filtered.length} users with skill "${skillValue}"`);
      return filtered;
    } catch (error) {
      console.error('[AdminService] Error in fallback skill filtering:', error);
      return [];
    }
  }

  /**
   * Get users by business topic
   */
  async getUsersByBusinessTopic(
    communityId: number,
    topicValue: string,
    onlyActive: boolean = true
  ): Promise<CommunityMember[]> {
    // Try the attribute endpoint first (backend now fixed to handle JSON fields properly)
    // This is the preferred method since it queries the join table directly and returns individual user rows
    try {
      const attributeUsers = await this.getUsersByAttribute(communityId, 'business_topic', topicValue, onlyActive);
      if (attributeUsers && attributeUsers.length > 0) {
        console.log(`[AdminService] ✅ Attribute endpoint found ${attributeUsers.length} users for business topic "${topicValue}"`);
        return attributeUsers;
      } else {
        console.log(`[AdminService] ⚠️ Attribute endpoint returned 0 users for business topic "${topicValue}"`);
      }
    } catch (attrError: any) {
      const attrStatus = attrError?.status || attrError?.response?.status;
      // If it's still a 500 error, the backend fix might not be deployed yet
      if (attrStatus === 500) {
        console.error(`[AdminService] ❌ Attribute endpoint still returning 500 for business_topic "${topicValue}"`);
        console.error(`[AdminService] Backend fix may not be deployed yet, or there may be another issue.`);
      } else {
        console.error(`[AdminService] ❌ Attribute endpoint failed for business_topic "${topicValue}":`, {
          status: attrStatus,
          message: attrError?.message,
          response: attrError?.response?.data,
        });
      }
    }

    // Fallback: Try alternative business topics endpoints
    const endpoints = [
      `/communities/${communityId}/businessTopics/users?value=${encodeURIComponent(topicValue)}&onlyActive=${onlyActive}`,
      `/communities/${communityId}/businessTopics/${encodeURIComponent(topicValue)}/users?onlyActive=${onlyActive}`,
      `/communities/${communityId}/users/businessTopics?topic=${encodeURIComponent(topicValue)}&onlyActive=${onlyActive}`,
    ];

    for (const url of endpoints) {
      try {
        const data = await apiService.get<CommunityMember[]>(url);
        if (data && Array.isArray(data) && data.length > 0) {
          console.log(`[AdminService] ✅ Found ${data.length} users with business topic "${topicValue}" from alternative endpoint`);
          return data;
        }
      } catch (error: any) {
        const status = error?.status || error?.response?.status;
        if (status === 404) {
          // Try next endpoint
          continue;
        } else {
          console.warn(`[AdminService] Error fetching users for business topic ${topicValue} from ${url}:`, error);
        }
      }
    }
    
    // Last resort: try client-side filtering from profiles
    return this.getUsersByBusinessTopicFallback(communityId, topicValue, onlyActive);
  }

  /**
   * Fallback: Get all members and filter by business topic client-side
   */
  private async getUsersByBusinessTopicFallback(
    communityId: number,
    topicValue: string,
    onlyActive: boolean = true
  ): Promise<CommunityMember[]> {
    try {
      // Use profiles instead of community members for better data access
      const profiles = await this.getCachedProfiles(communityId);
      const normalize = (s: any) => (s == null ? '' : String(s)).trim().toLowerCase();
      const target = normalize(topicValue);
      
      console.log(`[AdminService] 🔍 Business topic fallback: Checking ${profiles.length} profiles for "${topicValue}"`);
      
      // Debug: Log sample profile structure to understand data format
      
      const filtered = profiles
        .map(profile => ({
          id: profile.userId || profile.id,
          fname: profile.fname,
          lname: profile.lname,
          fullName: profile.fullName || `${profile.fname || ''} ${profile.lname || ''}`.trim(),
          email: profile.email || '',
          profilePicture: profile.profilePicture,
          isManager: false,
          enabled: profile.enabled ?? true,
          joinDate: undefined,
          _profile: profile, // Keep original for filtering
        }))
        .filter(member => {
          if (onlyActive && member.enabled === false) {
            return false;
          }

          const profile = (member as any)._profile;
          const p = profile || {};
          const d = p.data || p.profileData || p.profile || {};

          // Check all possible locations for business topics
          const businessTopics = 
            p.businessTopics ||
            d.businessTopics ||
            p.business_topics ||
            d.business_topics ||
            p.topics ||
            d.topics ||
            p.businessTopicsList ||
            d.businessTopicsList ||
            p.businessTopic ||
            d.businessTopic ||
            p.business_topic ||
            d.business_topic;

          // Also check userThings array for business topics
          // Format: [["businessTopic", ["Angel Investing", "AI"]]] or [["topic", ["Angel Investing"]]]
          const userThings = p.userThings || d.userThings;
          if (userThings && Array.isArray(userThings)) {
            for (const thing of userThings) {
              if (Array.isArray(thing) && thing.length >= 2) {
                const thingType = thing[0];
                if (thingType === 'businessTopic' || thingType === 'business_topic' || thingType === 'businessTopics' || thingType === 'topic') {
                  const thingValues = thing[1];
                  if (Array.isArray(thingValues)) {
                    const found = thingValues.some((val: any) => {
                      const valStr = typeof val === 'string' ? val : val?.name || val?.topic || val?.value || val?.label || '';
                      return normalize(valStr) === target;
                    });
                    if (found) return true;
                  } else if (typeof thingValues === 'string') {
                    if (normalize(thingValues) === target) return true;
                  }
                }
              }
            }
          }

          if (!businessTopics) {
            return false;
          }

          // Handle array format
          if (Array.isArray(businessTopics)) {
            return businessTopics.some((topic: any) => {
              const topicName = typeof topic === 'string' 
                ? topic 
                : topic?.name || topic?.topic || topic?.value || topic?.label;
              return normalize(topicName) === target;
            });
          }
          
          // Handle string format (comma-separated)
          if (typeof businessTopics === 'string') {
            const topics = businessTopics.split(',').map(t => normalize(t));
            return topics.includes(target);
          }

          return false;
        });

      // Remove temporary _profile field
      filtered.forEach(member => {
        delete (member as any)._profile;
      });

      console.log(`[AdminService] ✅ Business topic fallback: Found ${filtered.length} users with topic "${topicValue}"`);
      
      // If profile-based filtering found 0 users, try multiple recovery approaches
      if (filtered.length === 0) {
        // First, try using the attribute endpoint (backend now supports business_topic type)
        try {
          console.log(`[AdminService] Trying attribute endpoint for business topic "${topicValue}"...`);
          // Use business_topic (with underscore) as that's what the backend expects
          const attributeUsers = await this.getUsersByAttribute(communityId, 'business_topic', topicValue, onlyActive);
          if (attributeUsers && attributeUsers.length > 0) {
            console.log(`[AdminService] ✅ Attribute endpoint found ${attributeUsers.length} users for business topic "${topicValue}"`);
            return attributeUsers;
          } else {
            console.log(`[AdminService] ⚠️ Attribute endpoint returned 0 users for business topic "${topicValue}"`);
          }
        } catch (error: any) {
          const status = error?.status || error?.response?.status;
          console.error(`[AdminService] ❌ Attribute endpoint failed for business_topic "${topicValue}":`, {
            status,
            message: error?.message,
            response: error?.response?.data,
          });
        }
        
        // Second, try querying all community members and checking their business topics via a different endpoint
        // Since business topics are in a join table, we need to query them differently
        try {
          console.log(`[AdminService] Trying to get business topic users via community members endpoint...`);
          // Try to get all members and then filter - but this won't work if business topics aren't in profiles
          // Instead, let's try a direct query endpoint if it exists
          const memberUrl = `/communities/${communityId}/members?onlyActive=${onlyActive}`;
          try {
            const allMembers = await apiService.get<any[]>(memberUrl);
            console.log(`[AdminService] Got ${allMembers?.length || 0} members, but business topics aren't in member data`);
          } catch (e) {
            console.log(`[AdminService] Members endpoint not available or failed`);
          }
        } catch (e) {
          console.warn(`[AdminService] Member query approach failed:`, e);
        }

        // Third, try unconsolidated endpoint recovery (but this returns aggregated data, not user rows)
        try {
          console.log(`[AdminService] Profile-based filtering found 0 users for business topic "${topicValue}", trying unconsolidated endpoint recovery...`);
          const raw = await this.getBusinessTopicsChartData(communityId, false, onlyActive);
          console.log(`[AdminService] Got ${raw.length} rows from unconsolidated business topics endpoint`);
          
          // The unconsolidated endpoint returns aggregated data like {label: "Angel Investing", value: 2}
          // This doesn't have user IDs, so we can't extract users from it
          // But we can log it for debugging
          if (raw.length > 0) {
            console.log(`[AdminService] 🔍 First 3 rows from unconsolidated business topics:`, raw.slice(0, 3).map((r: any, i: number) => ({
              index: i,
              fullRow: r,
              keys: Object.keys(r),
              name: r?.name,
              label: r?.label,
              value: r?.value,
              count: r?.count,
              // Note: unconsolidated data is aggregated and doesn't contain user IDs
            })));
          }
          
          // Since unconsolidated data is aggregated, we can't extract user IDs from it
          // We need a backend endpoint that returns the actual join table data
          console.log(`[AdminService] ⚠️ Unconsolidated endpoint returns aggregated data without user IDs. Need backend endpoint fix.`);
        } catch (e) {
          console.warn(`[AdminService] Business topic unconsolidated endpoint recovery failed:`, e);
        }

        // Fourth: Since we can't get user IDs from aggregated data, we need to inform the user
        // that the backend endpoint needs to be fixed, OR we need to query profiles differently
        // For now, return empty array - the backend SQL query needs to be fixed
        console.error(`[AdminService] ❌ Cannot retrieve users for business topic "${topicValue}" - backend endpoint returns 500 error and unconsolidated data is aggregated without user IDs.`);
        console.error(`[AdminService] The backend SQL query is failing: "could not identify an equality operator for type json"`);
        console.error(`[AdminService] This indicates data_business_topic.name is a JSON field and needs proper JSON query syntax.`);
      }
      
      return filtered;
    } catch (error) {
      console.error('Error in fallback business topic filtering:', error);
      return [];
    }
  }

  /**
   * Get users by custom field value
   */
  async getUsersByCustomField(
    communityId: number,
    customFieldId: number,
    fieldValue: string,
    onlyActive: boolean = true
  ): Promise<CommunityMember[]> {
    try {
      // Use the standard attribute/users endpoint with type=custom
      const url = `/communities/${communityId}/attribute/users?type=custom&customFieldId=${customFieldId}&value=${encodeURIComponent(fieldValue)}&onlyActive=${onlyActive}&limit=200`;
      const response = await apiService.get<any>(url);
      
      // Handle paginated response (if endpoint returns { data: [...], pagination: {...} })
      // or direct array response
      let data: any[];
      let pagination: any = null;
      
      if (Array.isArray(response)) {
        data = response;
      } else if (response && Array.isArray(response.data)) {
        data = response.data;
        pagination = response.pagination;
      } else {
        console.warn(`[AdminService] Unexpected response format for custom field ${customFieldId}:${fieldValue}`);
        data = [];
      }
      
      if (!data || data.length === 0) {
        return [];
      }
      
      // If pagination exists and there are more pages, load them all before returning
      if (pagination && pagination.totalPages > 1) {
        const allUsers = [...data];
        const totalPages = pagination.totalPages || 1;
        const currentPage = pagination.currentPage || 1;
        
        for (let page = currentPage + 1; page <= totalPages; page++) {
          try {
            const pageUrl = `/communities/${communityId}/attribute/users?type=custom&customFieldId=${customFieldId}&value=${encodeURIComponent(fieldValue)}&onlyActive=${onlyActive}&limit=200&page=${page}`;
            const pageResponse = await apiService.get<any>(pageUrl);
            const pageData = Array.isArray(pageResponse) ? pageResponse : (pageResponse?.data || []);
            allUsers.push(...pageData);
          } catch (error) {
            console.warn(`[AdminService] Failed to load page ${page} for custom field ${customFieldId}:${fieldValue}:`, error);
          }
        }
        
        data = allUsers;
      }
      
      // Map response to CommunityMember format
      const users: CommunityMember[] = data.map((user: any) => ({
        id: user.id || user.userId,
        userId: user.userId || user.id,
        fname: user.fname || '',
        lname: user.lname || '',
        fullName: user.fullName || `${user.fname || ''} ${user.lname || ''}`.trim(),
        email: user.email || '',
        profilePicture: user.profilePicture,
        bio: user.bio,
        pronouns: user.pronouns,
        isManager: user.isManager,
        enabled: user.enabled,
        joinDate: user.joinDate,
        ...user,
      }));
      
      return users;
    } catch (error: any) {
      const status = error?.status || error?.response?.status;
      
      // If 404, endpoint doesn't exist - return empty
      if (status === 404) {
        return [];
      }
      
      console.error(`[AdminService] Error fetching users for custom field ${customFieldId}:${fieldValue}:`, {
        status,
        message: error?.message,
        response: error?.response?.data,
      });
      return [];
    }
  }

  /**
   * Verify consolidated data is properly aggregated
   */
  verifyConsolidatedData(data: AttributeModel[], type: string): void {
    if (!data || data.length === 0) {
      return;
    }

    // Check if data looks like it's per-user (contains pipe-separated values or user-specific patterns)
    const suspiciousPatterns = data.filter(item => {
      const name = item.name || '';
      // Check for pipe-separated values (like "Claude|midjourney|runway")
      if (name.includes('|')) {
        return true;
      }
      // Check for patterns that look like user-specific data
      if (name.includes(':') && name.split(':').length > 2) {
        return true;
      }
      return false;
    });

    if (suspiciousPatterns.length > 0) {
      console.warn(
        `[AdminService] ⚠️ Potential issue: ${type} data appears to contain per-user responses instead of consolidated data.`,
        `Found ${suspiciousPatterns.length} items with suspicious patterns:`,
        suspiciousPatterns.slice(0, 3)
      );
      console.warn(
        `[AdminService] Expected format: [{ name: "ChatGPT", value: 5 }] (cumulative count)`,
        `Found format: Items with pipe-separated or user-specific values`
      );
    } else {
      // Check if values are reasonable (should be counts, not just 1s)
      const singleValueItems = data.filter(item => item.value === 1);
      if (singleValueItems.length === data.length && data.length > 1) {
        console.warn(
          `[AdminService] ⚠️ Potential issue: All ${type} data items have value=1.`,
          `This might indicate per-user data instead of consolidated counts.`
        );
      } else {
        console.log(
          `[AdminService] ✓ ${type} data appears to be properly consolidated.`,
          `Total items: ${data.length}, Total count: ${data.reduce((sum, item) => sum + item.value, 0)}`
        );
      }
    }
  }

  /**
   * Get user statistics
   */
  async getUserStats(communityId: number, startDate?: string, endDate?: string): Promise<UserStats | null> {
    try {
      let url = `/communities/${communityId}/stats/users`;
      if (startDate && endDate) {
        url += `?startDate=${startDate}&endDate=${endDate}`;
      }
      const stats = await apiService.get<UserStats>(url);
      return stats;
    } catch (error: any) {
      // Silently handle 404s - endpoint might not exist
      if (error?.status === 404 || error?.response?.status === 404) {
        console.log(`[AdminService] Stats endpoint not found for community ${communityId}`);
        return null;
      }
      console.error('Failed to fetch user stats:', error);
      return null;
    }
  }

  /**
   * Get comprehensive engagement statistics
   * Tries backend endpoint first, then calculates from existing data sources
   */
  async getEngagementStats(communityId: number, startDate?: string, endDate?: string): Promise<UserStats | null> {
    // Try backend endpoint with timeout to avoid long waits
    const backendPromise = apiService.get<UserStats>(
      `/communities/${communityId}/stats/engagement${startDate && endDate ? `?startDate=${startDate}&endDate=${endDate}` : ''}`
    ).catch((error: any) => {
      if (error?.status === 404 || error?.response?.status === 404) {
        return null; // Endpoint doesn't exist
      }
      throw error;
    });

    // Calculate from existing data in parallel (don't wait for backend)
    const calculatedPromise = this.calculateEngagementStatsFromData(communityId, startDate, endDate);

    // Use whichever completes first, prefer backend if available
    try {
      const [backendStats, calculatedStats] = await Promise.allSettled([
        backendPromise,
        calculatedPromise,
      ]);
      
      if (backendStats.status === 'fulfilled' && backendStats.value) {
        // Note: calculatedStats should still have run in parallel, so matches fetch should have happened
        return backendStats.value;
      }

      if (calculatedStats.status === 'fulfilled' && calculatedStats.value) {
        return calculatedStats.value;
      }

      return null;
    } catch (error) {
      console.error('[AdminService] Error getting engagement stats:', error);
      // Fallback to calculated stats
      try {
        return await this.calculateEngagementStatsFromData(communityId, startDate, endDate);
      } catch (calcError) {
        console.error('[AdminService] Error calculating stats:', calcError);
        return null;
      }
    }
  }

  /**
   * Calculate engagement stats from existing data sources
   * This provides real data even when backend stats endpoints don't exist
   */
  private async calculateEngagementStatsFromData(
    communityId: number,
    startDate?: string,
    endDate?: string
  ): Promise<UserStats | null> {
    try {
      const start = startDate ? new Date(startDate) : null;
      const end = endDate ? new Date(endDate) : null;

      // Fetch data from existing endpoints in parallel
      const [
        profiles,
        events,
        groups,
        matches,
      ] = await Promise.allSettled([
        this.getProfilesForCommunity(communityId),
        this.getEventsForCommunity(communityId),
        this.getGroupsForCommunity(communityId),
        this.getMatchesForCommunity(communityId, startDate, endDate),
      ]);
      
      // Log matches fetch errors only
      if (matches.status === 'rejected') {
        console.error('[AdminService] Matches fetch failed:', matches.reason);
      }

      // Calculate metrics
      const stats: UserStats = {
        totalUsers: 0,
        activeUsers: 0,
        newUsersThisMonth: 0,
        profilesCreated: 0,
        connectionsMade: 0,
        trovaChatsStarted: 0,
        totalMessagesSent: 0,
        eventsCreated: 0,
        eventsAttended: 0,
        groupsCreated: 0,
        groupsJoined: 0,
        dailyActiveUsers: 0,
        weeklyActiveUsers: 0,
        profileCompletionRate: 0,
        matchResponseRate: 0,
      };

      // Profiles Created
      if (profiles.status === 'fulfilled') {
        const profileList = profiles.value || [];
        console.log(`[AdminService] Fetched ${profileList.length} profiles for community ${communityId}`);
        
        // Note: ProfilesInit model doesn't have createdAt field, so we can't filter by date client-side
        // Profiles Created is NOT filtered by the selected time period - it shows all profiles
        // If date filtering is needed, it must be done on the backend
        stats.profilesCreated = profileList.length;
        stats.totalUsers = profileList.length;
        console.log(`[AdminService] Calculated ${profileList.length} profiles for community ${communityId} (date filtering not available - ProfilesInit has no createdAt field)`);

        // Calculate profile completion: profiles with completion > 0 (at least one field filled)
        let completedProfiles = 0;
        profileList.forEach((profile: any) => {
          // Count profiles with completion > 0: profiles that have at least one of bio, interests, or location
          const hasBio = profile.bio && typeof profile.bio === 'string' && profile.bio.trim().length > 0;
          const hasInterests = profile.interests && Array.isArray(profile.interests) && profile.interests.length > 0;
          const hasLocation = (profile.locations && Array.isArray(profile.locations) && profile.locations.length > 0) ||
                             (profile.currentLocationName && profile.currentLocationName.trim().length > 0);
          // Profile has completion > 0 if it has at least one field filled
          if (hasBio || hasInterests || hasLocation) {
            completedProfiles++;
          }
        });
        stats.profileCompletionRate = profileList.length > 0 
          ? (completedProfiles / profileList.length) * 100 
          : 0;
        stats.profileCompletionCompleted = completedProfiles;
        stats.profileCompletionTotal = profileList.length;
        console.log(`[AdminService] Profile completion: ${completedProfiles}/${profileList.length} (${stats.profileCompletionRate.toFixed(1)}%)`);
      } else {
        const errorReason = profiles.status === 'rejected' ? profiles.reason : 'unknown';
        console.warn('[AdminService] Profiles fetch failed:', errorReason);
        if (profiles.status === 'rejected') {
          console.error('[AdminService] Profiles error details:', errorReason);
        }
      }

      // Events Created/Attended
      if (events.status === 'fulfilled') {
        const eventList = events.value || [];
        let createdCount = 0;
        let attendedCount = 0;
        let excludedByDate = 0;
        let noDateField = 0;

        eventList.forEach((event: any, index: number) => {
          // For "all-time", don't filter by date
          if (!start && !end) {
            createdCount++;
            if (event.attendeeCount !== undefined && event.attendeeCount !== null) {
              attendedCount += event.attendeeCount;
            } else if (event.attendees && Array.isArray(event.attendees)) {
              attendedCount += event.attendees.length;
            }
          } else {
            // Filter by date using startDate or startDateTimeUTC (Event model doesn't have createdAt)
            const eventDateStr = event.startDateTimeUTC || event.startDate;
            if (eventDateStr) {
              const eventDate = new Date(eventDateStr);
              if (!isNaN(eventDate.getTime())) {
                const isInRange = (!start || eventDate >= start) && (!end || eventDate <= end);
                if (isInRange) {
                  createdCount++;
                  if (event.attendeeCount !== undefined && event.attendeeCount !== null) {
                    attendedCount += event.attendeeCount;
                  } else if (event.attendees && Array.isArray(event.attendees)) {
                    attendedCount += event.attendees.length;
                  }
                } else {
                  excludedByDate++;
                  if (index < 3) { // Log first 3 excluded events for debugging
                    console.error(`[AdminService] 📅 Event "${event.name}" excluded: date ${eventDate.toISOString()} not in range ${start?.toISOString()} to ${end?.toISOString()}`);
                  }
                }
              } else {
                noDateField++;
                if (index < 3) {
                  console.error(`[AdminService] 📅 Event "${event.name}" has invalid date: ${eventDateStr}`);
                }
              }
            } else {
              // If no date field, include it for "all-time" calculations
              noDateField++;
              if (index < 3) {
                console.error(`[AdminService] 📅 Event "${event.name}" has no date field (startDate/startDateTimeUTC)`);
              }
              createdCount++;
              if (event.attendeeCount !== undefined && event.attendeeCount !== null) {
                attendedCount += event.attendeeCount;
              } else if (event.attendees && Array.isArray(event.attendees)) {
                attendedCount += event.attendees.length;
              }
            }
          }
        });

        stats.eventsCreated = createdCount;
        stats.eventsAttended = attendedCount;
      }

      // Groups Created/Joined
      if (groups.status === 'fulfilled') {
        const groupList = groups.value || [];
        let createdCount = 0;
        let totalMembers = 0;
        let excludedByDate = 0;
        let noDateField = 0;
        const uniqueMembers = new Set<number>();

        groupList.forEach((group: any, index: number) => {
          // For "all-time", don't filter by date
          if (!start && !end) {
            createdCount++;
            // Count unique members across all groups
            if (group.memberCount !== undefined && group.memberCount !== null) {
              totalMembers += group.memberCount;
            } else if (group.users && Array.isArray(group.users)) {
              totalMembers += group.users.length;
              // Track unique users
              group.users.forEach((user: any) => {
                if (user.id) uniqueMembers.add(user.id);
              });
            }
          } else {
            // Filter by date if provided
            if (group.createdAt) {
              const groupDate = new Date(group.createdAt);
              if (!isNaN(groupDate.getTime())) {
                const isInRange = (!start || groupDate >= start) && (!end || groupDate <= end);
                if (isInRange) {
                  createdCount++;
                  if (group.memberCount !== undefined && group.memberCount !== null) {
                    totalMembers += group.memberCount;
                  } else if (group.users && Array.isArray(group.users)) {
                    totalMembers += group.users.length;
                    group.users.forEach((user: any) => {
                      if (user.id) uniqueMembers.add(user.id);
                    });
                  }
                } else {
                  excludedByDate++;
                  if (index < 3) {
                    console.error(`[AdminService] 👥 Group "${group.name}" excluded: date ${groupDate.toISOString()} not in range ${start?.toISOString()} to ${end?.toISOString()}`);
                  }
                }
              } else {
                noDateField++;
                if (index < 3) {
                  console.error(`[AdminService] 👥 Group "${group.name}" has invalid createdAt: ${group.createdAt}`);
                }
              }
            } else {
              // If no createdAt, include it for "all-time" calculations
              noDateField++;
              if (index < 3) {
                console.error(`[AdminService] 👥 Group "${group.name}" has no createdAt field`);
              }
              createdCount++;
              if (group.memberCount !== undefined && group.memberCount !== null) {
                totalMembers += group.memberCount;
              } else if (group.users && Array.isArray(group.users)) {
                totalMembers += group.users.length;
                group.users.forEach((user: any) => {
                  if (user.id) uniqueMembers.add(user.id);
                });
              }
            }
          }
        });

        stats.groupsCreated = createdCount;
        // Use unique members count if available, otherwise use total memberships
        stats.groupsJoined = uniqueMembers.size > 0 ? uniqueMembers.size : totalMembers;
      } else if (groups.status === 'rejected') {
        console.warn('[AdminService] Groups fetch failed:', groups.reason);
      }

      // Connections Made (Matches)
      if (matches.status === 'fulfilled') {
        const matchList = matches.value || [];
        if (matchList.length === 0) {
          console.warn('[AdminService] No matches returned from endpoint');
        }
        
        // Filter matches by community if needed
        // The /matches endpoint should already filter by community, but verify if communityId field exists
        let communityMatches = matchList;
        
        if (matchList.length > 0) {
          const firstMatch = matchList[0];
          
          // If matches have communityId field, filter by it to be safe
          if (firstMatch.communityId !== undefined || firstMatch.community_id !== undefined) {
            const communityIdField = firstMatch.communityId !== undefined ? 'communityId' : 'community_id';
            communityMatches = matchList.filter((match: any) => {
              const matchCommunityId = match.communityId || match.community_id;
              return matchCommunityId === communityId;
            });
            console.log(`[AdminService] Filtered by ${communityIdField}: ${communityMatches.length} matches for community ${communityId}`);
          } else {
            // No communityId field - matches are already filtered by endpoint middleware
            console.log('[AdminService] Matches already filtered by endpoint middleware, using all matches');
            communityMatches = matchList;
          }
        }
        
        // Connections Made: Try backend endpoint first, then fall back to client-side calculation
        let connectionsMade = 0;
        let useBackendResult = false;
        try {
          console.log(`[AdminService] 🔗 Fetching connections count from backend endpoint...`);
          const params: string[] = [];
          if (startDate) params.push(`startDate=${encodeURIComponent(startDate)}`);
          if (endDate) params.push(`endDate=${encodeURIComponent(endDate)}`);
          const query = params.length ? `?${params.join('&')}` : '';
          const url = `/communities/${communityId}/connections-count${query}`;
          
          const backendResult = await apiService.get<{ connectionsMade: number }>(url);
          if (backendResult && typeof backendResult.connectionsMade === 'number') {
            // If backend returns 0 but we have matches, it's likely incorrect - use client-side fallback
            if (backendResult.connectionsMade === 0 && communityMatches && communityMatches.length > 0) {
              console.warn(`[AdminService] ⚠️ Backend returned 0 connections but we have ${communityMatches.length} matches - using client-side calculation`);
            } else {
              connectionsMade = backendResult.connectionsMade;
              useBackendResult = true;
              console.log(`[AdminService] ✅ Connections count from backend: ${connectionsMade}`);
            }
          }
        } catch (error: any) {
          // If backend endpoint fails, fall back to client-side calculation
          if (error?.status === 404 || error?.response?.status === 404) {
            console.log(`[AdminService] Connections count endpoint not found, using client-side calculation`);
          } else {
            console.warn(`[AdminService] Failed to fetch connections count from backend, using client-side calculation:`, error);
          }
        }
        
        // If backend didn't return a valid result (or returned 0 when we have matches), use client-side calculation
        if (!useBackendResult) {
          // Client-side fallback: Count unique connections by unique sets of people (Option 2)
        // IMPORTANT: Same people matched multiple times = 1 connection
        // We group matches by group_id, collect all unique users, then count unique sets
        // This prevents counting the same 4 people matched 3 times as 3 connections
        
        // Step 1: Group matches by group_id and collect all unique users in each group
        const groupsByUsers = new Map<string, Set<number>>(); // Map of group_id -> Set of user IDs
        
        communityMatches.forEach((match: any) => {
          // Get the group identifier
          const groupId = match.groupId || match.group_id || 
                         (match.matchIndicesId && match.matchIndicesId !== 0 ? match.matchIndicesId : null);
          
          if (groupId !== null && groupId !== undefined) {
            const groupKey = String(groupId);
            
            // Initialize the set if it doesn't exist
            if (!groupsByUsers.has(groupKey)) {
              groupsByUsers.set(groupKey, new Set<number>());
            }
            
            // Add both userId and matchedUserId to the set for this group
            const userSet = groupsByUsers.get(groupKey)!;
            if (match.userId !== undefined && match.userId !== null) {
              userSet.add(match.userId);
            }
            if (match.matchedUserId !== undefined && match.matchedUserId !== null) {
              userSet.add(match.matchedUserId);
            }
          }
        });
        
        // Step 2: Create a sorted array representation of each user set and count unique sets
        const uniqueUserSets = new Set<string>();
        
        groupsByUsers.forEach((userSet, groupKey) => {
          // Convert Set to sorted array and create a string key
          const sortedUsers = Array.from(userSet).sort((a, b) => a - b);
          const setKey = sortedUsers.join(',');
          uniqueUserSets.add(setKey);
        });
        
        // Step 3: If we couldn't use group_id, fall back to unique pairs
        let connectionCount = uniqueUserSets.size;
        if (connectionCount === 0) {
          // Fallback: Count unique pairs of users (userId, matchedUserId)
          const uniquePairs = new Set<string>();
          communityMatches.forEach((match: any) => {
            if (match.userId !== undefined && match.matchedUserId !== undefined) {
              const pairKey = [match.userId, match.matchedUserId].sort().join('-');
              uniquePairs.add(pairKey);
            }
          });
          connectionCount = uniquePairs.size;
        }
        
        console.log(`[AdminService] Found ${connectionCount} unique connections (unique sets of people) from ${communityMatches.length} match records`);
        console.log(`[AdminService] Note: ${communityMatches.length} total match records = ${communityMatches.length} intros, but only ${connectionCount} unique connections (unique sets of people)`);
        
        // Filter by date if provided
        let finalConnectionCount = connectionCount;
        let excludedByDate = 0;
        let noDateField = 0;
        
        if (start || end) {
          // Filter matches by date, then get unique connections
          const dateFilteredMatches = communityMatches.filter((match: any) => {
            // Handle both createdAt and created_at field names
            const createdAt = match.createdAt || match.created_at;
            if (createdAt) {
              const matchDate = new Date(createdAt);
              if (!isNaN(matchDate.getTime())) {
                const isInRange = (!start || matchDate >= start) && (!end || matchDate <= end);
                if (!isInRange) {
                  excludedByDate++;
                }
                return isInRange;
              } else {
                noDateField++;
                return false; // Exclude matches with invalid dates when filtering
              }
            } else {
              noDateField++;
              return false; // Exclude matches without valid dates when filtering
            }
          });
          
          console.error(`[AdminService] 🔗 After date filter: ${dateFilteredMatches.length} matches in range, ${excludedByDate} excluded, ${noDateField} with no/invalid date`);
          
          // Recalculate unique connections from date-filtered matches using Option 2 (unique sets of people)
          const dateFilteredGroupsByUsers = new Map<string, Set<number>>();
          
          dateFilteredMatches.forEach((match: any) => {
            const groupId = match.groupId || match.group_id || 
                           (match.matchIndicesId && match.matchIndicesId !== 0 ? match.matchIndicesId : null);
            
            if (groupId !== null && groupId !== undefined) {
              const groupKey = String(groupId);
              
              if (!dateFilteredGroupsByUsers.has(groupKey)) {
                dateFilteredGroupsByUsers.set(groupKey, new Set<number>());
              }
              
              const userSet = dateFilteredGroupsByUsers.get(groupKey)!;
              if (match.userId !== undefined && match.userId !== null) {
                userSet.add(match.userId);
              }
              if (match.matchedUserId !== undefined && match.matchedUserId !== null) {
                userSet.add(match.matchedUserId);
              }
            }
          });
          
          const dateFilteredUniqueSets = new Set<string>();
          dateFilteredGroupsByUsers.forEach((userSet) => {
            const sortedUsers = Array.from(userSet).sort((a, b) => a - b);
            const setKey = sortedUsers.join(',');
            dateFilteredUniqueSets.add(setKey);
          });
          
          finalConnectionCount = dateFilteredUniqueSets.size > 0 ? dateFilteredUniqueSets.size : 0;
          console.error(`[AdminService] 🔗 After date filter: ${finalConnectionCount} unique connections`);
        } else {
          console.error(`[AdminService] 🔗 No date filter applied - using all ${communityMatches.length} matches`);
        }
        
          connectionsMade = finalConnectionCount;
          console.error(`[AdminService] 🔗 Final (client-side): ${connectionsMade} unique connections (from ${communityMatches.length} match records, ${excludedByDate} excluded by date, ${noDateField} with no date)`);
        }
        
        stats.connectionsMade = connectionsMade;
        
        // Calculate response rate (matches that led to conversations)
        // This requires checking if conversations exist for matches
        try {
          const responseRate = await this.calculateMatchResponseRate(communityId, communityMatches, startDate, endDate);
          stats.matchResponseRate = responseRate;
        } catch (error) {
          console.warn('[AdminService] Could not calculate match response rate:', error);
          stats.matchResponseRate = 0;
        }
      } else if (matches.status === 'rejected') {
        console.error('[AdminService] Matches fetch failed:', matches.reason);
        // Set to 0 explicitly since fetch failed
        stats.connectionsMade = 0;
      }

      // Messages Sent
      try {
        const messageStats = await this.getMessageStats(communityId, startDate, endDate);
        if (messageStats) {
          stats.totalMessagesSent = messageStats.totalMessagesSent;
        }
      } catch (error) {
        console.error('[AdminService] Error calculating message stats:', error);
      }

      // Daily/Weekly Active Users
      try {
        const activeUserStats = await this.getActiveUserStats(communityId, startDate, endDate);
        if (activeUserStats) {
          stats.dailyActiveUsers = activeUserStats.dailyActiveUsers;
          stats.weeklyActiveUsers = activeUserStats.weeklyActiveUsers;
        }
      } catch (error) {
        console.error('[AdminService] Error calculating active user stats:', error);
      }

      // Also calculate match engagement stats (Trova Magic, Channel Pairing, Mentor/Mentee)
      // This ensures channelPairingMatches, channelPairingEngagements, mentorMenteeMatches, etc. are set
      try {
        const matchEngagementStats = await this.calculateMatchEngagementStats(communityId, startDate, endDate);
        if (matchEngagementStats) {
          // Merge match engagement stats into the main stats object
          Object.assign(stats, matchEngagementStats);
        } else {
          console.error('[AdminService] ⚠️⚠️⚠️ calculateMatchEngagementStats returned null/undefined - initializing to 0');
          // Initialize to 0 so UI can still display the cards (even if empty)
          stats.channelPairingMatches = stats.channelPairingMatches ?? 0;
          stats.channelPairingEngagements = stats.channelPairingEngagements ?? 0;
          stats.mentorMenteeMatches = stats.mentorMenteeMatches ?? 0;
          stats.mentorMenteeUniquePairs = stats.mentorMenteeUniquePairs ?? 0;
          stats.trovaMagicMatches = stats.trovaMagicMatches ?? 0;
          stats.trovaMagicEngagements = stats.trovaMagicEngagements ?? 0;
        }
      } catch (error) {
        console.error('[AdminService] Could not calculate match engagement stats:', error);
        // Initialize to 0 so UI can still display the cards (even if empty)
        stats.channelPairingMatches = stats.channelPairingMatches ?? 0;
        stats.channelPairingEngagements = stats.channelPairingEngagements ?? 0;
        stats.mentorMenteeMatches = stats.mentorMenteeMatches ?? 0;
        stats.mentorMenteeUniquePairs = stats.mentorMenteeUniquePairs ?? 0;
        stats.trovaMagicMatches = stats.trovaMagicMatches ?? 0;
        stats.trovaMagicEngagements = stats.trovaMagicEngagements ?? 0;
      }

      // Note: Trova chats will be fetched separately in the component to avoid blocking

      return stats;
    } catch (error) {
      console.error('[AdminService] Error calculating engagement stats:', error);
      return null;
    }
  }

  /**
   * Helper: Get profiles for community
   */
  private async getProfilesForCommunity(communityId: number): Promise<any[]> {
    try {
      const { profileService } = await import('./profile.service');
      return await profileService.getProfilesForUserAndCommunity(communityId);
    } catch (error) {
      console.warn('[AdminService] Could not fetch profiles:', error);
      return [];
    }
  }

  /**
   * Helper: Get events for community
   */
  private async getEventsForCommunity(communityId: number): Promise<any[]> {
    try {
      const { eventService } = await import('./event.service');
      const { useAuthStore } = await import('../stores/auth.store');
      const authStore = useAuthStore();
      if (authStore.user?.id) {
        return await eventService.getEvents(communityId, authStore.user.id);
      }
      return [];
    } catch (error) {
      console.warn('[AdminService] Could not fetch events:', error);
      return [];
    }
  }

  /**
   * Helper: Get groups for community
   */
  private async getGroupsForCommunity(communityId: number): Promise<any[]> {
    try {
      const { groupService } = await import('./group.service');
      const { useAuthStore } = await import('../stores/auth.store');
      const authStore = useAuthStore();
      if (authStore.user?.id) {
        return await groupService.getGroups(communityId, authStore.user.id);
      }
      return [];
    } catch (error) {
      console.warn('[AdminService] Could not fetch groups:', error);
      return [];
    }
  }

  /**
   * Helper: Get matches for community
   * Tries multiple endpoint patterns to find one that accepts communityId
   * Uses caching to avoid redundant API calls
   * @param communityId - The community ID to fetch matches for
   * @param startDate - Optional start date filter (ISO 8601 string)
   * @param endDate - Optional end date filter (ISO 8601 string)
   * @param type - Optional match type filter ('trova_magic' or 'channel_pairing')
   */
  private async getMatchesForCommunity(
    communityId: number,
    startDate?: string,
    endDate?: string,
    type?: string
  ): Promise<any[]> {
    // Clear expired cache entries periodically
    this.clearExpiredCache();

    // Check cache first
    const cacheKey = this.getMatchesCacheKey(communityId, startDate, endDate, type);
    const cached = this.matchesCache.get(cacheKey);
    if (cached && this.isCacheValid(cached.timestamp)) {
      console.log(`[AdminService] ✅ Using cached matches for ${cacheKey} (${cached.data.length} matches)`);
      return cached.data;
    }

    // Check if there's already a pending request for this data
    const pendingRequest = this.pendingRequests.get(cacheKey);
    if (pendingRequest) {
      console.log(`[AdminService] ⏳ Reusing pending request for ${cacheKey}`);
      return pendingRequest;
    }

    console.log(`[AdminService] 🔍 Fetching matches for community ${communityId}`, {
      startDate,
      endDate,
      type,
    });

    // Create the request promise and store it
    const requestPromise = this.fetchMatchesForCommunity(communityId, startDate, endDate, type, cacheKey);
    this.pendingRequests.set(cacheKey, requestPromise);

    try {
      const result = await requestPromise;
      return result;
    } finally {
      // Remove from pending requests once complete
      this.pendingRequests.delete(cacheKey);
    }
  }

  /**
   * Internal method to actually fetch matches (separated for deduplication)
   */
  private async fetchMatchesForCommunity(
    communityId: number,
    startDate?: string,
    endDate?: string,
    type?: string,
    cacheKey?: string
  ): Promise<any[]> {
    // Build query parameters for the new endpoint
    const queryParams = new URLSearchParams();
    if (startDate) queryParams.append('startDate', startDate);
    if (endDate) queryParams.append('endDate', endDate);
    if (type) queryParams.append('type', type);
    const queryString = queryParams.toString();
    const primaryUrl = `/communities/${communityId}/matches${queryString ? `?${queryString}` : ''}`;
    
    // Try endpoints in order of preference (matching patterns used by events/groups)
    // Primary endpoint: /communities/{id}/matches (✅ NOW IMPLEMENTED!)
    const endpointsToTry = [
      { url: primaryUrl, name: `/communities/${communityId}/matches${queryString ? `?${queryString}` : ''}` },
      { url: `/matches?communityId=${communityId}`, name: `/matches?communityId=${communityId}` },
      // Note: The /matches endpoint uses middleware that filters by user's session community
      // This works in normal app flow but not in admin console when viewing different communities
      { url: `/matches`, name: `/matches (middleware - user's session community)`, useHeader: true },
    ];
    
    for (const endpoint of endpointsToTry) {
      try {
        console.log(`[AdminService] 📡 Trying GET ${endpoint.name}...`);
        
        const config = endpoint.useHeader ? {
          headers: { 'X-Community-Id': String(communityId) }
        } : undefined;
        
        const matches = await apiService.get<any[]>(endpoint.url, config);
        console.log(`[AdminService] ✅ Fetched ${matches?.length || 0} matches from ${endpoint.name}`);
        
        if (matches && matches.length > 0) {
          // Filter by communityId first if available
          let filteredMatches = matches;
          if (matches[0].communityId !== undefined || matches[0].community_id !== undefined) {
            filteredMatches = filteredMatches.filter((match: any) => {
              const matchCommunityId = match.communityId || match.community_id;
              return matchCommunityId === communityId;
            });
            if (filteredMatches.length !== matches.length) {
              console.log(`[AdminService] ⚠️ Endpoint returned ${matches.length} matches, but only ${filteredMatches.length} are for community ${communityId}`);
            }
          }
          
          // Cache the result
          if (cacheKey) {
            this.matchesCache.set(cacheKey, { data: filteredMatches, timestamp: Date.now() });
          }
          return filteredMatches;
        } else if (matches && matches.length === 0) {
          // Empty array - endpoint worked but no data
          console.log(`[AdminService] ⚠️ ${endpoint.name} returned empty array (0 matches)`);
          // Cache empty result too
          if (cacheKey) {
            this.matchesCache.set(cacheKey, { data: [], timestamp: Date.now() });
          }
          // Continue to next endpoint if this one returned 0
          if (endpoint.url !== `/matches`) {
            continue;
          }
        }
        
        const result = matches || [];
        // Cache even empty results
        if (cacheKey) {
          this.matchesCache.set(cacheKey, { data: result, timestamp: Date.now() });
        }
        return result;
      } catch (error: any) {
        // 404 means endpoint doesn't exist, try next one
        if (error.response?.status === 404) {
          console.log(`[AdminService] ⚠️ ${endpoint.name} returned 404, trying next endpoint...`);
          continue;
        }
        // Other errors - log and try next
        console.warn(`[AdminService] ⚠️ ${endpoint.name} failed:`, error.response?.status || error.message);
        continue;
      }
    }
    
    // If all endpoints failed or returned 0, return empty array
    console.warn('[AdminService] ❌ All match endpoints failed or returned 0 matches');
    const emptyResult: any[] = [];
    if (cacheKey) {
      this.matchesCache.set(cacheKey, { data: emptyResult, timestamp: Date.now() });
    }
    return emptyResult;
  }

  /**
   * Get User Actions stats (spotlights, user events, etc.)
   * Tries multiple endpoint patterns since this works in other frontend
   */
  async getUserActionsStats(
    communityId: number,
    startDate?: string,
    endDate?: string
  ): Promise<Partial<UserStats> | null> {
    const dateParams = startDate && endDate ? `startDate=${startDate}&endDate=${endDate}` : '';
    const queryParams = dateParams ? `?${dateParams}` : '';
    const queryParamsWithAmp = dateParams ? `&${dateParams}` : '';
    
    // Try multiple endpoint patterns (expanded list based on common console patterns)
    // Primary endpoint from other frontend: /communities/{communityId}/slack-user-stats
    const endpoints = [
      // Primary endpoint from other frontend (slack-user-stats)
      `/communities/${communityId}/slack-user-stats${queryParams}`,
      // Standard community endpoints
      `/communities/${communityId}/stats/user-actions${queryParams}`,
      `/communities/${communityId}/user-actions${queryParams}`,
      `/communities/${communityId}/stats/userActions${queryParams}`,
      // Console endpoints (common pattern for admin/console)
      `/console/user-actions?communityId=${communityId}${queryParamsWithAmp}`,
      `/console/stats/user-actions?communityId=${communityId}${queryParamsWithAmp}`,
      `/console/stats/userActions?communityId=${communityId}${queryParamsWithAmp}`,
      `/console/communities/${communityId}/user-actions${queryParams}`,
      `/console/communities/${communityId}/stats/user-actions${queryParams}`,
      // Alternative patterns
      `/stats/user-actions?communityId=${communityId}${queryParamsWithAmp}`,
      `/api/console/user-actions?communityId=${communityId}${queryParamsWithAmp}`,
    ];

    for (const url of endpoints) {
      try {
        const response = await apiService.get<any>(url);
        
        // Handle slack-user-stats format (has rows and columns)
        if (response && response.rows && Array.isArray(response.rows)) {
          console.log(`[AdminService] 📊 Processing slack-user-stats format with ${response.rows.length} rows`);
          console.log(`[AdminService] 📊 Response structure:`, {
            hasRows: !!response.rows,
            rowCount: response.rows?.length,
            hasColumns: !!response.columns,
            totalUserCount: response.totalUserCount,
            sampleRow: response.rows?.[0],
          });
          const aggregatedStats = this.aggregateSlackUserStats(response);
          if (aggregatedStats) {
            // Use introsLedToConvos from backend (sum of per-user values)
            // Backend already provides accurate per-user introsLedToConvos values
            // No need to calculate separately - the aggregated sum from rows is correct
            console.log(`[AdminService] ✅ User actions stats aggregated from slack-user-stats (using backend introsLedToConvos):`, aggregatedStats);
            return aggregatedStats;
          } else {
            console.warn(`[AdminService] ⚠️ aggregateSlackUserStats returned null, continuing to next endpoint`);
          }
        }
        
        // Handle direct stats format
        if (response && typeof response === 'object' && !response.rows) {
          const stats = response as Partial<UserStats>;
          if (stats && Object.keys(stats).length > 0) {
            // Use introsLedToConvos from backend if provided
            // Backend already provides accurate per-user introsLedToConvos values
            // Only calculate if backend doesn't provide it
            if (stats.introsLedToConvos === undefined || stats.introsLedToConvos === null) {
              console.log(`[AdminService] Backend didn't provide introsLedToConvos, calculating from matches...`);
              const calculatedIntros = await this.calculateIntrosLedToConvos(communityId, startDate, endDate);
              stats.introsLedToConvos = calculatedIntros;
            } else {
              console.log(`[AdminService] Using introsLedToConvos from backend: ${stats.introsLedToConvos}`);
            }
            
            // Check if stats actually have meaningful values (not all zeros)
            const hasNonZeroValues = Object.values(stats).some((val: any) => 
              typeof val === 'number' && val > 0
            );
            if (hasNonZeroValues || Object.keys(stats).length > 0) {
              console.log(`[AdminService] ✅ User actions stats fetched from: ${url}`, stats);
              return stats;
            } else {
              console.log(`[AdminService] ⚠️ Endpoint ${url} returned empty stats, trying next...`);
            }
          }
        }
      } catch (error: any) {
        // Log all errors for debugging, but only warn on non-404s
        const status = error?.status || error?.response?.status;
        if (status === 404) {
          // Silently continue for 404s
        } else {
          console.warn(`[AdminService] Error fetching user actions from ${url}:`, {
            status,
            message: error?.message,
            response: error?.response?.data,
          });
        }
        // Continue to next endpoint
      }
    }

    // If all endpoints fail, try to calculate from available data
    const calculatedStats = await this.calculateUserActionsStats(communityId, startDate, endDate);
    
    // Calculate introsLedToConvos from matches only if backend didn't provide it
    // Backend now provides accurate per-user introsLedToConvos, so prefer that
    if (calculatedStats) {
      // Only calculate if backend didn't provide it
      if (calculatedStats.introsLedToConvos === undefined || calculatedStats.introsLedToConvos === null) {
        const calculatedIntros = await this.calculateIntrosLedToConvos(communityId, startDate, endDate);
        calculatedStats.introsLedToConvos = calculatedIntros;
      }
      return calculatedStats;
    }
    
    // Fallback: return zeros if calculation also fails
    const calculatedIntros = await this.calculateIntrosLedToConvos(communityId, startDate, endDate);
    return {
      openedTrova: 0,
      generalActions: 0,
      spotlightsCreated: 0,
      recWallsGiven: 0,
      recWallsReceived: 0,
      introsLedToConvos: calculatedIntros, // Still calculate from matches as last resort
    };
  }

  /**
   * Calculate "Intros Led To Convos" from all intro matches where both users engaged
   * This counts unique pairs/groups (same logic as displayed cards), not individual match records
   * Sums: Trova Magic engaged + Channel Pairing engaged + Mentor/Mentee engaged
   */
  private async calculateIntrosLedToConvos(
    communityId: number,
    startDate?: string,
    endDate?: string
  ): Promise<number> {
    try {
      // Use the same logic as calculateMatchEngagementStats to ensure consistency with displayed numbers
      
      // 1. Trova Magic: Use daily breakdown (same as displayed card)
      let trovaMagicEngaged = 0;
      try {
        const magicIntrosByDate = await this.getMagicIntrosByDate(communityId, startDate, endDate);
        // Filter out dates with >1000 pairings (data issues)
        const validDates = magicIntrosByDate.filter(day => day.totalPairings <= 1000);
        // Sum engaged pairings from valid dates
        trovaMagicEngaged = validDates.reduce((sum, day) => sum + day.engagedPairings, 0);
      } catch (error) {
        console.warn('[AdminService] Could not fetch Trova Magic engaged count:', error);
      }
      
      // 2. Channel Pairing: Count unique groups (same as displayed card)
      let channelPairingEngaged = 0;
      try {
        const channelPairingMatches = await this.getMatchesForCommunity(communityId, startDate, endDate, 'channel_pairing');
        if (channelPairingMatches && channelPairingMatches.length > 0) {
          // Count unique groups (same logic as calculateMatchEngagementStats)
          const channelPairingGroups = new Set<number>();
          for (const match of channelPairingMatches) {
            const groupId = match.groupId || match.group_id || 
                           (match.matchIndicesId && match.matchIndicesId !== 0 ? match.matchIndicesId : null);
            if (groupId !== null && groupId !== undefined) {
              channelPairingGroups.add(groupId);
            }
          }
          // Calculate engagement for unique groups
          if (channelPairingGroups.size > 0) {
            channelPairingEngaged = await this.countEngagedMatchesByGroup(communityId, channelPairingMatches, channelPairingGroups);
          }
        }
      } catch (error) {
        console.warn('[AdminService] Could not calculate Channel Pairing engaged count:', error);
      }
      
      // 3. Mentor/Mentee: Count unique pairs (same logic as other types)
      let mentorMenteeEngaged = 0;
      let mentorMenteeTotalUniquePairs = 0;
      try {
        const mentorMenteeMatches = await this.getMatchesForCommunity(communityId, startDate, endDate, 'mentor-mentee');
        if (mentorMenteeMatches && mentorMenteeMatches.length > 0) {
          // Count unique pairs (same logic as Trova Magic)
          const uniquePairs = new Set<string>();
          const pairDetails = new Map<string, { userId: number; matchedUserId: number; isEngaged: boolean }>();
          const conversationPairs = await this.getConversationPairs(communityId);
          for (const match of mentorMenteeMatches) {
            const userId = match.userId || match.user_id;
            const matchedUserId = match.matchedUserId || match.matched_user_id;
            
            if (userId && matchedUserId) {
              // Create normalized pair key (sorted IDs to handle A-B and B-A as same pair)
              const pairKey = [userId, matchedUserId].sort((a, b) => a - b).join('-');
              
              // Only count each unique pair once
              if (!uniquePairs.has(pairKey)) {
                uniquePairs.add(pairKey);
                const isEngaged = conversationPairs.has(pairKey);
                pairDetails.set(pairKey, { userId, matchedUserId, isEngaged });
                if (isEngaged) {
                  mentorMenteeEngaged++;
                }
              }
            }
          }
          
          mentorMenteeTotalUniquePairs = uniquePairs.size;
          console.log(`[AdminService] 🎓 Mentor/Mentee breakdown:`);
          console.log(`[AdminService]   - Total match records: ${mentorMenteeMatches.length}`);
          console.log(`[AdminService]   - Unique pairs: ${mentorMenteeTotalUniquePairs}`);
          console.log(`[AdminService]   - Engaged pairs: ${mentorMenteeEngaged}`);
          if (mentorMenteeTotalUniquePairs > 0 && mentorMenteeTotalUniquePairs < 10) {
            console.log(`[AdminService]   - Pair details:`, Array.from(pairDetails.entries()).map(([key, details]) => 
              `${details.userId}-${details.matchedUserId} (engaged: ${details.isEngaged})`
            ));
          }
        }
      } catch (error) {
        console.warn('[AdminService] Could not calculate Mentor/Mentee engaged count:', error);
      }
      
      const totalEngaged = trovaMagicEngaged + channelPairingEngaged + mentorMenteeEngaged;
      
      console.log(`[AdminService] 💬 Intros Led To Convos breakdown (unique pairs/groups):`);
      console.log(`[AdminService]   - Trova Magic: ${trovaMagicEngaged} engaged unique pairs`);
      console.log(`[AdminService]   - Channel Pairing: ${channelPairingEngaged} engaged unique groups`);
      console.log(`[AdminService]   - Mentor/Mentee: ${mentorMenteeEngaged} engaged unique pairs (out of ${mentorMenteeTotalUniquePairs} total unique pairs)`);
      console.log(`[AdminService]   - TOTAL: ${totalEngaged} (sum of engaged unique pairs/groups)`);
      
      return totalEngaged;
    } catch (error) {
      console.warn('[AdminService] Could not calculate Intros Led To Convos:', error);
      return 0;
    }
  }

  /**
   * Aggregate summary stats from slack-user-stats response
   * The backend returns rows and columns, we need to aggregate totals for summary cards
   * 
   * Based on backend implementation:
   * - homepageViews → Opened Trova
   * - profileActions → General Actions
   * - spotlightsCreated → Spotlights Created
   * - recWallsGiven → Rec Walls Given
   * - recWallsReceived → Rec Walls Received
   * - introsLedToConvos → Intros Led To Convos
   * - introsAttributedToTrovaMagic → Trova Magic Engagements
   * - introsAttributedToChannelPairingOnDemand → Channel Pairing On Demand
   * - introsAttributedToChannelPairingCadence → Channel Pairing Cadence
   */
  private aggregateSlackUserStats(response: {
    rows: any[];
    columns?: any[];
    totalUserCount?: number;
  }): Partial<UserStats> | null {
    if (!response.rows || !Array.isArray(response.rows)) {
      console.warn('[AdminService] ⚠️ aggregateSlackUserStats: response.rows is missing or not an array, returning zeros');
      // Return zeros instead of null so UI can display the section
      return {
        openedTrova: 0,
        generalActions: 0,
        spotlightsCreated: 0,
        recWallsGiven: 0,
        recWallsReceived: 0,
        introsLedToConvos: 0,
        trovaMagicEngagements: 0,
        channelPairingOnDemand: 0,
        channelPairingCadence: 0,
      };
    }
    
    // If no rows, return stats with zeros so UI can display them
    if (response.rows.length === 0) {
      console.log('[AdminService] 📊 aggregateSlackUserStats: No rows found, returning zeros');
      return {
        openedTrova: 0,
        generalActions: 0,
        spotlightsCreated: 0,
        recWallsGiven: 0,
        recWallsReceived: 0,
        introsLedToConvos: 0,
        trovaMagicEngagements: 0,
        channelPairingOnDemand: 0,
        channelPairingCadence: 0,
      };
    }

    const stats: Partial<UserStats> = {};
    const rows = response.rows;

    // Aggregate totals from rows using backend field names
    let openedTrova = 0; // homepageViews
    let generalActions = 0; // profileActions
    let spotlightsCreated = 0;
    let recWallsGiven = 0;
    let recWallsReceived = 0;
    let introsLedToConvos = 0;
    let trovaMagicEngagements = 0; // introsAttributedToTrovaMagic
    let channelPairingOnDemand = 0; // introsAttributedToChannelPairingOnDemand
    let channelPairingCadence = 0; // introsAttributedToChannelPairingCadence

    rows.forEach((row: any) => {
      // Use backend field names (from slack-user-stats endpoint)
      // IMPORTANT: Only use the primary field name to avoid double-counting
      // If backend returns the same value in multiple fields, we only count it once
      const homepageViewsValue = this.getNumericValue(row, ['homepageViews', 'openedTrova', 'opened_trova', 'Opened Trova']);
      openedTrova += homepageViewsValue;
      
      generalActions += this.getNumericValue(row, ['profileActions', 'generalActions', 'general_actions', 'General Actions']);
      spotlightsCreated += this.getNumericValue(row, ['spotlightsCreated', 'spotlights_created', 'Spotlights Created']);
      recWallsGiven += this.getNumericValue(row, ['recWallsGiven', 'rec_walls_given', 'Rec Walls Given']);
      recWallsReceived += this.getNumericValue(row, ['recWallsReceived', 'rec_walls_received', 'Rec Walls Received']);
      // Backend provides introsLedToConvos per user - sum them for aggregated stats
      introsLedToConvos += this.getNumericValue(row, ['introsLedToConvos', 'intros_led_to_convos', 'Intros Led To Convos']);
      trovaMagicEngagements += this.getNumericValue(row, ['introsAttributedToTrovaMagic', 'intros_attributed_to_trova_magic', 'Trova Magic']);
      channelPairingOnDemand += this.getNumericValue(row, ['introsAttributedToChannelPairingOnDemand', 'intros_attributed_to_channel_pairing_on_demand', 'Channel Pairing On Demand']);
      channelPairingCadence += this.getNumericValue(row, ['introsAttributedToChannelPairingCadence', 'intros_attributed_to_channel_pairing_cadence', 'Channel Pairing Cadence']);
    });

    // Map to UserStats interface fields - always set values (even if 0) so they appear in UI
    // This ensures the UI can display the cards even if values are 0
    stats.openedTrova = openedTrova;
    stats.generalActions = generalActions;
    stats.spotlightsCreated = spotlightsCreated;
    stats.recWallsGiven = recWallsGiven;
    stats.recWallsReceived = recWallsReceived;
    // Use introsLedToConvos from backend (sum of per-user values)
    // Backend provides accurate per-user introsLedToConvos values, so the aggregated sum is correct
    stats.introsLedToConvos = introsLedToConvos;
    stats.trovaMagicEngagements = trovaMagicEngagements;
    stats.channelPairingOnDemand = channelPairingOnDemand;
    stats.channelPairingCadence = channelPairingCadence;
    
    // Ensure openedTrova is always defined (critical for UI display)
    if (stats.openedTrova === undefined || stats.openedTrova === null) {
      stats.openedTrova = 0;
    }

    // Log what we found
    console.log(`[AdminService] 📊 Aggregated stats from ${rows.length} rows:`, {
      openedTrova,
      generalActions,
      spotlightsCreated,
      recWallsGiven,
      recWallsReceived,
      introsLedToConvos,
      trovaMagicEngagements,
      channelPairingOnDemand,
      channelPairingCadence,
    });

    // Log sample row structure for debugging
    if (rows.length > 0) {
    }

    return stats;
  }

  /**
   * Helper to get numeric value from row using multiple possible field names
   */
  private getNumericValue(row: any, fieldNames: string[]): number {
    for (const fieldName of fieldNames) {
      const value = row[fieldName];
      if (typeof value === 'number') {
        return value;
      }
      if (typeof value === 'string') {
        const parsed = parseFloat(value);
        if (!isNaN(parsed)) {
          return parsed;
        }
      }
    }
    return 0;
  }

  /**
   * Calculate User Actions stats from available data
   * Tries to query user events endpoint or calculate from available data
   */
  private async calculateUserActionsStats(
    communityId: number,
    startDate?: string,
    endDate?: string
  ): Promise<Partial<UserStats> | null> {
    try {
      console.log(`[AdminService] 📊 Calculating user actions stats for community ${communityId}`);
      const stats: Partial<UserStats> = {};

      // Try to get user events from various endpoints
      const dateParams = startDate && endDate ? `startDate=${startDate}&endDate=${endDate}` : '';
      const queryParams = dateParams ? `?${dateParams}` : '';
      const queryParamsWithAmp = dateParams ? `&${dateParams}` : '';
      
      const userEventsEndpoints = [
        // Standard endpoints
        `/communities/${communityId}/user-events${queryParams}`,
        `/communities/${communityId}/events/user${queryParams}`,
        `/user-events?communityId=${communityId}${queryParamsWithAmp}`,
        // Console endpoints
        `/console/user-events?communityId=${communityId}${queryParamsWithAmp}`,
        `/console/communities/${communityId}/user-events${queryParams}`,
        `/console/events/user?communityId=${communityId}${queryParamsWithAmp}`,
        // Alternative patterns
        `/api/user-events?communityId=${communityId}${queryParamsWithAmp}`,
        `/events/user?communityId=${communityId}${queryParamsWithAmp}`,
      ];

      let userEvents: any[] = [];
      for (const url of userEventsEndpoints) {
        try {
          const events = await apiService.get<any[]>(url);
          if (events && Array.isArray(events)) {
            userEvents = events;
            console.log(`[AdminService] ✅ Found ${userEvents.length} user events from ${url}`);
            break;
          }
        } catch (error: any) {
          // Continue to next endpoint
          if (error?.status !== 404 && error?.response?.status !== 404) {
            console.warn(`[AdminService] Error fetching user events from ${url}:`, error);
          }
        }
      }

      // Calculate stats from user events
      if (userEvents.length > 0) {
        const start = startDate ? new Date(startDate) : null;
        const end = endDate ? new Date(endDate) : null;

        let generalActions = 0;
        let openedTrova = 0;
        let spotlightsCreated = 0;
        let recWallsGiven = 0;
        let recWallsReceived = 0;

        userEvents.forEach((event: any) => {
          // Filter by date if provided
          if (start || end) {
            const eventDate = event.createdAt || event.timestamp || event.date;
            if (eventDate) {
              const eventTime = new Date(eventDate);
              if ((start && eventTime < start) || (end && eventTime > end)) {
                return; // Skip events outside date range
              }
            }
          }

          // Count by event type
          const eventType = event.type || event.eventType || event.action;
          const eventName = event.name || event.eventName || '';

          if (eventType === 'opened_trova' || eventName.toLowerCase().includes('opened trova') || eventName.toLowerCase().includes('open trova')) {
            openedTrova++;
          } else if (eventType === 'spotlight' || eventType === 'spotlight_created' || eventName.toLowerCase().includes('spotlight')) {
            spotlightsCreated++;
          } else if (eventType === 'rec_wall' || eventType === 'rec_wall_given' || eventName.toLowerCase().includes('rec wall given')) {
            recWallsGiven++;
          } else if (eventType === 'rec_wall_received' || eventName.toLowerCase().includes('rec wall received')) {
            recWallsReceived++;
          } else {
            // Count as general action
            generalActions++;
          }
        });

        stats.generalActions = generalActions;
        stats.openedTrova = openedTrova;
        stats.spotlightsCreated = spotlightsCreated;
        stats.recWallsGiven = recWallsGiven;
        stats.recWallsReceived = recWallsReceived;

        console.log(`[AdminService] 📊 User actions calculated:`, {
          generalActions,
          openedTrova,
          spotlightsCreated,
          recWallsGiven,
          recWallsReceived,
        });
      } else {
        // If no user events found, set to 0
        stats.generalActions = 0;
        stats.openedTrova = 0;
        stats.spotlightsCreated = 0;
        stats.recWallsGiven = 0;
        stats.recWallsReceived = 0;
        console.warn('[AdminService] No user events found, returning zeros');
      }

      return stats;
    } catch (error) {
      console.error('[AdminService] Error calculating user actions stats:', error);
      return {
        generalActions: 0,
        openedTrova: 0,
        spotlightsCreated: 0,
        recWallsGiven: 0,
        recWallsReceived: 0,
      };
    }
  }

  /**
   * Get Slack-style user stats table (used by production console)
   * startDate (ISO) is required; endDate optional.
   * Returns active users only (server default).
   */
  /**
   * Calculate unique introductions per user
   * Counts how many unique people each user was introduced to (across all match types)
   * Does not count duplicate introductions to the same person
   * For channel pairing groups, counts all unique users in the group
   */
  private async calculateUniqueIntroductionsPerUser(
    communityId: number,
    startDate?: string,
    endDate?: string
  ): Promise<Map<number, number>> {
    const userIntroCounts = new Map<number, Set<number>>(); // userId -> Set of unique matched user IDs
    
    try {
      // Get all match types: trova_magic, channel_pairing, mentor-mentee
      const matchTypes = ['trova_magic', 'channel_pairing', 'mentor-mentee'];
      
      // For channel pairing, we need to group by groupId to get all users in each group
      const channelPairingGroups = new Map<number | string, Set<number>>(); // groupId -> Set of user IDs in group
      
      for (const matchType of matchTypes) {
        try {
          const matches = await this.getMatchesForCommunity(communityId, startDate, endDate, matchType);
          
          if (matches && matches.length > 0) {
            if (matchType === 'channel_pairing') {
              // For channel pairing, collect all users in each group
              for (const match of matches) {
                const userId = match.userId || match.user_id;
                const matchedUserId = match.matchedUserId || match.matched_user_id;
                const groupId = match.groupId || match.group_id || 
                               (match.matchIndicesId && match.matchIndicesId !== 0 ? match.matchIndicesId : null);
                
                if (groupId) {
                  if (!channelPairingGroups.has(groupId)) {
                    channelPairingGroups.set(groupId, new Set());
                  }
                  if (userId) channelPairingGroups.get(groupId)!.add(userId);
                  if (matchedUserId) channelPairingGroups.get(groupId)!.add(matchedUserId);
                }
              }
            } else {
              // For trova_magic and mentor-mentee, count unique matched users directly
              for (const match of matches) {
                const userId = match.userId || match.user_id;
                const matchedUserId = match.matchedUserId || match.matched_user_id;
                
                if (userId && matchedUserId) {
                  if (!userIntroCounts.has(userId)) {
                    userIntroCounts.set(userId, new Set());
                  }
                  userIntroCounts.get(userId)!.add(matchedUserId);
                }
              }
            }
          }
        } catch (error) {
          console.warn(`[AdminService] Error fetching ${matchType} matches for unique introductions:`, error);
        }
      }
      
      // Process channel pairing groups: each user in a group is introduced to all other users in that group
      for (const [groupId, userIdsInGroup] of channelPairingGroups.entries()) {
        const userIdsArray = Array.from(userIdsInGroup);
        // For each user in the group, add all other users as introductions
        for (let i = 0; i < userIdsArray.length; i++) {
          const userId = userIdsArray[i];
          if (!userIntroCounts.has(userId)) {
            userIntroCounts.set(userId, new Set());
          }
          // Add all other users in the group as introductions
          for (let j = 0; j < userIdsArray.length; j++) {
            if (i !== j) {
              userIntroCounts.get(userId)!.add(userIdsArray[j]);
            }
          }
        }
      }
      
      // Convert Sets to counts
      const counts = new Map<number, number>();
      for (const [userId, uniqueMatchedUsers] of userIntroCounts.entries()) {
        counts.set(userId, uniqueMatchedUsers.size);
      }
      
      console.log(`[AdminService] ✅ Calculated unique introductions for ${counts.size} users`);
      if (counts.size > 0) {
        const sampleCounts = Array.from(counts.entries()).slice(0, 5);
        console.log(`[AdminService] Sample unique intro counts:`, sampleCounts);
      }
      return counts;
    } catch (error) {
      console.error('[AdminService] Error calculating unique introductions per user:', error);
      return new Map<number, number>();
    }
  }

  async getSlackUserStats(
    communityId: number,
    startDate?: string,
    endDate?: string
  ): Promise<{ rows: any[]; columns: any[]; totalUserCount: number; error?: string }> {
    const params: string[] = [];
    if (startDate) params.push(`startDate=${encodeURIComponent(startDate)}`);
    if (endDate) params.push(`endDate=${encodeURIComponent(endDate)}`);
    const query = params.length ? `?${params.join('&')}` : '';
    const url = `/communities/${communityId}/slack-user-stats${query}`;

    try {
      console.log(`[AdminService] Fetching slack-user-stats: ${url}`);
      const result = await apiService.get<any>(url);
      if (result && Array.isArray(result.rows)) {
        // Calculate unique introductions per user and add to each row
        console.log(`[AdminService] Calculating unique introductions per user...`);
        const uniqueIntroCounts = await this.calculateUniqueIntroductionsPerUser(communityId, startDate, endDate);
        
        // Update rows with unique introduction counts
        const updatedRows = result.rows.map((row: any) => {
          const userId = row.userId || row.user_id || row.id;
          const uniqueIntroCount = userId ? (uniqueIntroCounts.get(userId) || 0) : 0;
          
          return {
            ...row,
            introsLedToConvos: uniqueIntroCount, // Override with unique introduction count
          };
        });
        
        return {
          rows: updatedRows,
          columns: result.columns || [],
          totalUserCount: result.totalUserCount || result.rows?.length || 0,
        };
      }
    } catch (error: any) {
      console.error('[AdminService] Failed to fetch slack-user-stats:', error);
      
      // Try fallback: attempt to get user actions stats and convert to rows format
      // This provides a better user experience than just showing an error
      try {
        console.log('[AdminService] Attempting fallback: fetching user actions stats...');
        const userActionsStats = await this.getUserActionsStats(communityId, startDate, endDate);
        
        // If we got stats with openedTrova > 0, we can create a basic rows structure
        // However, we don't have per-user data, so we'll still show an error but with more context
        if (userActionsStats && userActionsStats.openedTrova && userActionsStats.openedTrova > 0) {
          console.log('[AdminService] Fallback found openedTrova stats, but no per-user data available');
          // Return error but indicate that stats exist (just not per-user breakdown)
          return { 
            rows: [], 
            columns: [], 
            totalUserCount: 0,
            error: 'Backend server error. User statistics are available, but per-user details cannot be loaded. Please try again later.'
          };
        }
      } catch (fallbackError) {
        console.error('[AdminService] Fallback also failed:', fallbackError);
      }
      
      // Return error information so UI can display appropriate message
      const errorMessage = error?.response?.status === 500 
        ? 'Backend server error. Please try again later.'
        : error?.message || 'Failed to fetch user statistics.';
      return { 
        rows: [], 
        columns: [], 
        totalUserCount: 0,
        error: errorMessage
      };
    }

    return { rows: [], columns: [], totalUserCount: 0 };
  }

  /**
   * Get Skills stats
   * Tries backend endpoint first, then calculates from skills data
   */
  async getSkillsStats(communityId: number): Promise<Partial<UserStats> | null> {
    // Try multiple endpoint patterns
    const endpoints = [
      // Standard endpoints
      `/communities/${communityId}/stats/skills`,
      `/communities/${communityId}/skills/stats`,
      // Console endpoints
      `/console/stats/skills?communityId=${communityId}`,
      `/console/skills/stats?communityId=${communityId}`,
      `/console/communities/${communityId}/stats/skills`,
      // Alternative patterns
      `/stats/skills?communityId=${communityId}`,
      `/api/console/stats/skills?communityId=${communityId}`,
    ];

    for (const url of endpoints) {
      try {
        console.log(`[AdminService] 🎓 Trying skills stats endpoint: ${url}`);
        const stats = await apiService.get<Partial<UserStats>>(url);
        if (stats && Object.keys(stats).length > 0) {
          // Check if stats actually have meaningful values
          const hasNonZeroValues = Object.values(stats).some((val: any) => 
            typeof val === 'number' && val > 0
          );
          if (hasNonZeroValues || Object.keys(stats).length > 0) {
            console.log(`[AdminService] ✅ Skills stats fetched from: ${url}`, stats);
            
            // If mentor/mentee stats are missing, try to fetch them separately
            if (stats.usersCanMentor === undefined || stats.usersWantMentor === undefined) {
              const mentorStats = await this.getMentorMenteeStats(communityId);
              if (mentorStats) {
                // Always set values if returned (including 0, which is a valid count)
                if (mentorStats.usersCanMentor !== undefined) {
                  stats.usersCanMentor = mentorStats.usersCanMentor;
                }
                if (mentorStats.usersWantMentor !== undefined) {
                  stats.usersWantMentor = mentorStats.usersWantMentor;
                }
              }
            }
            
            return stats;
          } else {
            console.log(`[AdminService] ⚠️ Endpoint ${url} returned empty stats, trying next...`);
          }
        }
      } catch (error: any) {
        const status = error?.status || error?.response?.status;
        if (status === 404) {
          // Silently continue for 404s
        } else {
          console.warn(`[AdminService] Error fetching skills from ${url}:`, {
            status,
            message: error?.message,
            response: error?.response?.data,
          });
        }
      }
    }

    // Calculate from available data
    console.log('[AdminService] All skills endpoints failed, trying client-side calculation');
    const calculatedStats = await this.calculateSkillsStats(communityId);
    
    // Always try to get mentor/mentee stats from backend
    const mentorStats = await this.getMentorMenteeStats(communityId);
    if (mentorStats && calculatedStats) {
      // Always set values if returned (including 0, which is a valid count)
      if (mentorStats.usersCanMentor !== undefined) {
        calculatedStats.usersCanMentor = mentorStats.usersCanMentor;
      }
      if (mentorStats.usersWantMentor !== undefined) {
        calculatedStats.usersWantMentor = mentorStats.usersWantMentor;
      }
    }
    
    return calculatedStats;
  }

  /**
   * Get Weekly Introductions (Onboarding) stats
   * Fetches counts of users introduced via "Weekly Introductions - Created by Trova Onboarding"
   * 
   * @param communityId - The community ID
   * @returns Object with userOnboardingIntros (usersIntroducedLast12Mo) or null if endpoint fails
   */
  async getWeeklyIntroductionsStats(communityId: number): Promise<Partial<UserStats> | null> {
    try {
      const url = `/communities/${communityId}/stats/weekly-introductions`;
      console.log(`[AdminService] 📧 Fetching weekly introductions stats: ${url}`);
      const response = await apiService.get<{ usersIntroducedLast12Mo: number; usersIntroducedThisYear: number }>(url);
      
      if (response && typeof response === 'object') {
        const usersIntroducedLast12Mo = response.usersIntroducedLast12Mo ?? 0;
        const usersIntroducedThisYear = response.usersIntroducedThisYear ?? 0;
        
        console.log(`[AdminService] ✅ Weekly introductions stats fetched for community ${communityId}:`, {
          usersIntroducedLast12Mo,
          usersIntroducedThisYear,
        });
        
        return {
          userOnboardingIntros: usersIntroducedLast12Mo, // Use last 12 months for the main metric
        };
      }
      
      console.warn(`[AdminService] Weekly introductions stats endpoint returned invalid response for community ${communityId}`);
      return null;
    } catch (error: any) {
      const status = error?.status || error?.response?.status;
      if (status === 404) {
        console.log(`[AdminService] Weekly introductions stats endpoint not found for community ${communityId} (404)`);
      } else if (status === 500) {
        console.warn(`[AdminService] Weekly introductions stats endpoint returned 500 error for community ${communityId}:`, error?.response?.data || error?.message);
      } else {
        console.warn(`[AdminService] Failed to fetch weekly introductions stats for community ${communityId} (status: ${status}):`, error?.response?.data || error?.message || error);
      }
      return null;
    }
  }

  /**
   * Get conversations started from matches (Magic Intros, Channel Pairings, Mentor Matches)
   * Backend endpoint: GET /communities/:id/stats/conversations-started
   * 
   * @param communityId - The community ID
   * @param startDate - ISO date string (optional)
   * @param endDate - ISO date string (optional)
   * @returns ConversationsStartedResponse or null on error
   */
  async getConversationsStarted(
    communityId: number,
    startDate?: string,
    endDate?: string
  ): Promise<ConversationsStartedResponse | null> {
    try {
      let url = `/communities/${communityId}/stats/conversations-started`;
      const params = new URLSearchParams();
      if (startDate) params.set('startDate', startDate);
      if (endDate) params.set('endDate', endDate);
      const qs = params.toString();
      if (qs) url += `?${qs}`;

      console.log(`[AdminService] 💬 Fetching conversations started: ${url}`);
      const response = await apiService.get<ConversationsStartedResponse>(url);

      if (response && typeof response === 'object') {
        console.log(`[AdminService] ✅ Conversations started fetched:`, {
          totalConversations: response.totalConversations,
          totalMessages: response.totalMessages,
          conversationsCount: response.conversations?.length || 0,
        });
        return response;
      }

      return null;
    } catch (error: any) {
      const status = error?.status || error?.response?.status;
      if (status === 404) {
        console.log(`[AdminService] Conversations started endpoint not found for community ${communityId} (404)`);
      } else if (status === 500) {
        console.warn(`[AdminService] Conversations started endpoint returned 500 error for community ${communityId}:`, error?.response?.data || error?.message);
      } else {
        console.warn(`[AdminService] Failed to fetch conversations started for community ${communityId} (status: ${status}):`, error?.response?.data || error?.message || error);
      }
      return null;
    }
  }

  /**
   * Get Weekly Introductions (Onboarding) users list
   * Backend endpoint: GET /communities/:id/stats/weekly-introductions/users
   * 
   * @param communityId - The community ID
   * @param startDate - ISO date string (required, e.g. "2025-01-01")
   * @param endDate - ISO date string (required, e.g. "2025-12-31")
   * @returns Array of user rows with userId, name, email, profilePicture, introMessageSentAt, or null on error
   * 
   * Backend response format: { rows: Array<{ userId, name, email, profilePicture, introMessageSentAt }> }
   * Backend returns 400 if startDate or endDate missing or invalid
   * introMessageSentAt is the latest intro_message_sent_at for that user in the date range (ISO string)
   */
  async getWeeklyIntroductionsUsers(
    communityId: number,
    startDate: string,
    endDate: string
  ): Promise<WeeklyIntroductionsUserRow[] | null> {
    try {
      if (!startDate || !endDate) {
        console.warn('[AdminService] startDate and endDate are required for weekly introductions users');
        return null;
      }

      const params = new URLSearchParams();
      params.set('startDate', startDate);
      params.set('endDate', endDate);
      const qs = params.toString();
      
      const url = `/communities/${communityId}/stats/weekly-introductions/users?${qs}`;
      console.log(`[AdminService] 📧 Fetching weekly introductions users: ${url}`);

      const response = await apiService.get<any>(url);
      
      // Handle both array response and { rows: [...] } response format
      const rowsRaw = Array.isArray(response) ? response : response?.rows;
      if (!Array.isArray(rowsRaw)) {
        console.warn(`[AdminService] Weekly introductions users endpoint returned unexpected format or no rows for community ${communityId}`);
        return [];
      }

      const rows: WeeklyIntroductionsUserRow[] = rowsRaw
        .map((row: any) => {
          // Handle different response formats (userId vs user_id, etc.)
          const userId = row.userId ?? row.user_id ?? row.id;
          const fname = row.fname ?? row.firstName ?? row.first_name ?? '';
          const lname = row.lname ?? row.lastName ?? row.last_name ?? '';
          const name = row.name ?? `${fname} ${lname}`.trim() ?? 'Unknown User';

          return {
            id: userId,
            name,
            email: row.email,
            profilePicture: row.profilePicture ?? row.profile_picture,
            introMessageSentAt: row.introMessageSentAt ?? row.intro_message_sent_at ?? row.mostRecentIntroMessageSentAt ?? row.most_recent_intro_message_sent_at,
          };
        })
        .filter((r: WeeklyIntroductionsUserRow) => typeof r.id === 'number' && !!r.name);

      console.log(`[AdminService] ✅ Fetched ${rows.length} weekly introductions users`);
      return rows;
    } catch (error: any) {
      const status = error?.status || error?.response?.status;
      if (status === 400) {
        console.warn(`[AdminService] Weekly introductions users endpoint returned 400 (Bad Request) for community ${communityId}:`, error?.response?.data?.error || error?.message);
      } else if (status === 404) {
        console.log(`[AdminService] Weekly introductions users endpoint not found for community ${communityId}`);
      } else {
        console.warn(`[AdminService] Failed to fetch weekly introductions users for community ${communityId} (status: ${status}):`, error?.response?.data || error?.message || error);
      }
      return null;
    }
  }

  /**
   * Get self-introduced stats (profile spotlights/introductions count)
   * @param communityId Community ID
   * @param startDate Optional start date (ISO string)
   * @param endDate Optional end date (ISO string)
   * @returns Object with selfIntroduced count or null if endpoint fails
   */
  async getSelfIntroducedStats(
    communityId: number,
    startDate?: string,
    endDate?: string
  ): Promise<Partial<UserStats> | null> {
    try {
      const params = new URLSearchParams();
      if (startDate) params.set('startDate', startDate);
      if (endDate) params.set('endDate', endDate);
      const qs = params.toString();
      const url = `/communities/${communityId}/stats/self-introduced${qs ? `?${qs}` : ''}`;
      
      console.log(`[AdminService] 📸 Fetching self-introduced stats: ${url}`);
      const response = await apiService.get<any>(url);
      
      console.log(`[AdminService] 📸 Self-introduced stats response:`, response);
      
      // Handle different response formats:
      // 1. Direct number: response = 19
      // 2. Object with total/count: response = { total: 19 } or { count: 19 }
      // 3. Object with other fields: response = { selfIntroduced: 19 } or similar
      let total = 0;
      
      if (typeof response === 'number') {
        total = response;
      } else if (response && typeof response === 'object') {
        total = response.total ?? response.count ?? response.selfIntroduced ?? response.data ?? 0;
      }
      
      console.log(`[AdminService] 📸 Parsed self-introduced count: ${total}`);
      
      if (total !== undefined && total !== null) {
        return {
          selfIntroduced: total,
        };
      }
      
      console.warn(`[AdminService] Self-introduced stats endpoint returned invalid response for community ${communityId}`);
      return null;
    } catch (error: any) {
      const status = error?.status || error?.response?.status;
      if (status === 404) {
        console.log(`[AdminService] Self-introduced stats endpoint not found for community ${communityId} (404)`);
      } else if (status === 500) {
        console.warn(`[AdminService] Self-introduced stats endpoint returned 500 for community ${communityId}`);
      } else {
        console.warn(`[AdminService] Failed to fetch self-introduced stats for community ${communityId}:`, error?.message || error);
      }
      return null;
    }
  }

  /**
   * Get self-introduced users list
   * @param communityId Community ID
   * @param startDate Start date (ISO string)
   * @param endDate End date (ISO string)
   * @param page Optional page number for pagination
   * @param limit Optional limit per page
   * @returns Array of SelfIntroducedUserRow or null if endpoint fails
   */
  async getSelfIntroducedUsers(
    communityId: number,
    startDate: string,
    endDate: string,
    page?: number,
    limit?: number
  ): Promise<SelfIntroducedUserRow[] | null> {
    try {
      if (!startDate || !endDate) {
        console.warn('[AdminService] startDate and endDate are required for self-introduced users');
        return null;
      }

      const params = new URLSearchParams();
      params.set('startDate', startDate);
      params.set('endDate', endDate);
      if (page !== undefined) params.set('page', String(page));
      if (limit !== undefined) params.set('limit', String(limit));
      const qs = params.toString();
      
      const url = `/communities/${communityId}/stats/self-introduced/users?${qs}`;
      console.log(`[AdminService] 📸 Fetching self-introduced users: ${url}`);

      const response = await apiService.get<any>(url);
      
      // Handle both array response and { rows: [...] } or { data: [...] } response format
      const rowsRaw = Array.isArray(response) 
        ? response 
        : response?.rows ?? response?.data ?? response?.users;
      
      if (!Array.isArray(rowsRaw)) {
        console.warn(`[AdminService] Self-introduced users endpoint returned unexpected format or no rows for community ${communityId}`);
        return [];
      }

      const rows: SelfIntroducedUserRow[] = rowsRaw
        .map((row: any) => {
          // Handle different response formats (userId vs user_id, etc.)
          const userId = row.userId ?? row.user_id ?? row.id;
          const fname = row.fname ?? row.firstName ?? row.first_name ?? '';
          const lname = row.lname ?? row.lastName ?? row.last_name ?? '';
          const name = row.name ?? `${fname} ${lname}`.trim() ?? 'Unknown User';

          return {
            id: userId,
            name,
            email: row.email,
            profilePicture: row.profilePicture ?? row.profile_picture,
            introducedAt: row.introducedAt ?? row.introduced_at ?? row.createdAt ?? row.created_at,
            channelName: row.channelName ?? row.channel_name,
            channelId: row.channelId ?? row.channel_id,
          };
        })
        .filter((r: SelfIntroducedUserRow) => typeof r.id === 'number' && !!r.name);

      console.log(`[AdminService] ✅ Fetched ${rows.length} self-introduced users`);
      return rows;
    } catch (error: any) {
      const status = error?.status || error?.response?.status;
      if (status === 400) {
        console.warn(`[AdminService] Self-introduced users endpoint returned 400 (Bad Request) for community ${communityId}:`, error?.response?.data?.error || error?.message);
      } else if (status === 404) {
        console.log(`[AdminService] Self-introduced users endpoint not found for community ${communityId}`);
      } else {
        console.warn(`[AdminService] Failed to fetch self-introduced users for community ${communityId} (status: ${status}):`, error?.response?.data || error?.message || error);
      }
      return null;
    }
  }

  /**
   * Get mentor/mentee stats from user_career table
   * Queries users who are active members and have mentor/mentee flags set
   * 
   * Backend should implement an endpoint (e.g., /communities/:id/stats/mentor-mentee) that:
   * - Joins user_career table with memberships table
   * - Filters memberships.is_active = true AND memberships.community_id = :communityId
   * - Counts DISTINCT users where user_career.is_active_mentor = true → usersCanMentor
   * - Counts DISTINCT users where user_career.is_active_mentee = true → usersWantMentor
   * - Returns: { usersCanMentor: number, usersWantMentor: number }
   * 
   * SQL pattern:
   * SELECT COUNT(DISTINCT uc.user_id) AS usersCanMentor
   * FROM user_career uc
   * JOIN memberships m ON m.user_id = uc.user_id
   * WHERE m.community_id = $1 AND m.is_active = TRUE AND uc.is_active_mentor = TRUE;
   * 
   * SELECT COUNT(DISTINCT uc.user_id) AS usersWantMentor
   * FROM user_career uc
   * JOIN memberships m ON m.user_id = uc.user_id
   * WHERE m.community_id = $1 AND m.is_active = TRUE AND uc.is_active_mentee = TRUE;
   */
  async getMentorMenteeStats(communityId: number): Promise<Partial<UserStats> | null> {
    const endpoints = [
      // Primary endpoint pattern (should match backend implementation)
      `/communities/${communityId}/stats/mentor-mentee`,
      `/communities/${communityId}/stats/mentors`,
      `/communities/${communityId}/mentor-mentee/stats`,
      // Console endpoints
      `/console/stats/mentor-mentee?communityId=${communityId}`,
      `/console/stats/mentors?communityId=${communityId}`,
      `/console/communities/${communityId}/stats/mentor-mentee`,
      `/console/communities/${communityId}/stats/mentors`,
      // Alternative patterns
      `/stats/mentor-mentee?communityId=${communityId}`,
      `/api/console/stats/mentor-mentee?communityId=${communityId}`,
    ];

    for (const url of endpoints) {
      try {
        console.log(`[AdminService] 🎓 Trying mentor/mentee stats endpoint: ${url}`);
        const response = await apiService.get<any>(url);
        
        // Handle different response formats
        let mentorCount = 0;
        let menteeCount = 0;
        
        if (response && typeof response === 'object') {
          // Try various field name patterns
          mentorCount = response.usersCanMentor ?? response.canMentor ?? response.mentorCount ?? response.mentors ?? 0;
          menteeCount = response.usersWantMentor ?? response.wantMentor ?? response.menteeCount ?? response.mentees ?? 0;
          
          // If response has direct counts (including 0, which is a valid count)
          if (typeof mentorCount === 'number' || typeof menteeCount === 'number') {
            console.log(`[AdminService] ✅ Mentor/mentee stats fetched from: ${url}`, {
              usersCanMentor: mentorCount,
              usersWantMentor: menteeCount,
            });
            return {
              usersCanMentor: mentorCount,
              usersWantMentor: menteeCount,
            };
          }
        }
      } catch (error: any) {
        const status = error?.status || error?.response?.status;
        if (status === 404) {
          // Silently continue for 404s
        } else {
          console.warn(`[AdminService] Error fetching mentor/mentee stats from ${url}:`, {
            status,
            message: error?.message,
          });
        }
      }
    }

    // Fallback: calculate from profiles
    console.log(`[AdminService] ⚠️ All mentor/mentee stats endpoints failed, trying profile fallback`);
    return this.getMentorMenteeStatsFallback(communityId);
  }

  /**
   * Fallback: Calculate mentor/mentee stats from profiles
   * First tries to fetch unconsolidated skills data which may include join table info,
   * then falls back to checking profile fields directly
   */
  private async getMentorMenteeStatsFallback(communityId: number): Promise<Partial<UserStats> | null> {
    try {
      const profiles = await this.getCachedProfiles(communityId);
      
      // FIRST: Try to get unconsolidated skills data which might include user IDs and join table fields
      const userMentorFlags = new Set<number>();
      const userMenteeFlags = new Set<number>();
      
      try {
        console.log(`[AdminService] Trying to fetch unconsolidated skills data for mentor/mentee stats`);
        const unconsolidatedSkills = await this.getSkillsChartData(communityId, 'all', false, true);
        
        // Check if the skills data includes user information with join table fields
        if (unconsolidatedSkills && unconsolidatedSkills.length > 0) {
          const firstSkill = unconsolidatedSkills[0] as any;
          console.log(`[AdminService] Sample unconsolidated skill entry for stats:`, firstSkill);
          
          // Check if skills data includes user IDs and join table fields
          unconsolidatedSkills.forEach((skillEntry: any) => {
            // Check various possible structures
            const userId = skillEntry.userId || skillEntry.user_id || skillEntry.id;
            if (userId) {
              const canBeMentor = skillEntry.can_be_mentor || skillEntry.canBeMentor || skillEntry.canMentor;
              const wantsToBeMentee = skillEntry.wants_to_be_mentee || skillEntry.wantsToBeMentee || skillEntry.wantMentor || skillEntry.wantsMentor;
              
              // Check for can_be_mentor
              if (canBeMentor === true || canBeMentor === 1 || canBeMentor === 'true' || canBeMentor === '1') {
                userMentorFlags.add(userId);
              }
              
              // Check for wants_to_be_mentee
              if (wantsToBeMentee === true || wantsToBeMentee === 1 || wantsToBeMentee === 'true' || wantsToBeMentee === '1') {
                userMenteeFlags.add(userId);
              }
            }
          });
          
          if (userMentorFlags.size > 0 || userMenteeFlags.size > 0) {
            console.log(`[AdminService] ✅ Found ${userMentorFlags.size} mentors and ${userMenteeFlags.size} mentees from skills data`);
            return {
              usersCanMentor: userMentorFlags.size,
              usersWantMentor: userMenteeFlags.size,
            };
          }
        }
      } catch (error) {
        console.log(`[AdminService] Could not fetch unconsolidated skills data for stats:`, error);
      }
      
      // Expanded list of possible field names (matching the users fallback)
      const canMentorFields = [
        'canMentor', 'can_mentor', 'dataCanMentor', 'data_can_mentor',
        'is_active_mentor', 'isActiveMentor', 'isMentor', 'mentor',
        'canMentorFlag', 'mentorFlag', 'isMentorActive'
      ];
      const wantMentorFields = [
        'wantMentor', 'want_mentor', 'dataWantMentor', 'data_want_mentor',
        'is_active_mentee', 'isActiveMentee', 'isMentee', 'mentee', 'wantsMentor',
        'wantMentorFlag', 'menteeFlag', 'isMenteeActive', 'wants_mentor'
      ];
      
      let canMentorCount = 0;
      let wantMentorCount = 0;
      
      profiles.forEach(profile => {
        const profileAny = profile as any;
        const userId = profile.userId || profile.id;
        
        // FIRST: Check skills array for can_be_mentor and wants_to_be_mentee from join_user_skill table
        const skills = profileAny.skills || profileAny.dataSkills || profileAny.userSkills;
        let foundCanMentorInSkills = false;
        let foundWantMentorInSkills = false;
        
        if (skills) {
          let skillsArray: any[] = [];
          
          // Normalize skills to array
          if (Array.isArray(skills)) {
            skillsArray = skills;
          } else if (typeof skills === 'object') {
            skillsArray = Object.values(skills);
          }
          
          // Check each skill object for mentor/mentee flags
          for (const skill of skillsArray) {
            if (typeof skill === 'object' && skill !== null) {
              // Check for can_be_mentor (from join_user_skill table)
              const canBeMentor = skill.can_be_mentor || skill.canBeMentor || skill.canMentor;
              if (canBeMentor === true || canBeMentor === 1 || canBeMentor === 'true' || canBeMentor === '1') {
                foundCanMentorInSkills = true;
              }
              
              // Check for wants_to_be_mentee (from join_user_skill table)
              const wantsToBeMentee = skill.wants_to_be_mentee || skill.wantsToBeMentee || skill.wantMentor || skill.wantsMentor;
              if (wantsToBeMentee === true || wantsToBeMentee === 1 || wantsToBeMentee === 'true' || wantsToBeMentee === '1') {
                foundWantMentorInSkills = true;
              }
            }
          }
        }
        
        // SECOND: Check all possible field names for canMentor at profile level
        let foundCanMentor = foundCanMentorInSkills;
        if (!foundCanMentor) {
          for (const field of canMentorFields) {
            let value = profileAny[field];
            
            // Also check nested structures
            if (value === undefined || value === null) {
              if (profileAny.data && typeof profileAny.data === 'object') {
                value = profileAny.data[field];
              }
              if ((value === undefined || value === null) && profileAny.career && typeof profileAny.career === 'object') {
                value = profileAny.career[field];
              }
              if ((value === undefined || value === null) && profileAny.userCareer && typeof profileAny.userCareer === 'object') {
                value = profileAny.userCareer[field];
              }
            }
            
            if (value !== undefined && value !== null) {
              if (typeof value === 'boolean' && value === true) {
                foundCanMentor = true;
                break;
              } else if (typeof value === 'number' && (value === 1 || value > 0)) {
                foundCanMentor = true;
                break;
              } else if (typeof value === 'string') {
                const lower = value.toLowerCase();
                if (lower === 'true' || lower === '1' || lower === 'yes') {
                  foundCanMentor = true;
                  break;
                }
              }
            }
          }
        }
        if (foundCanMentor) canMentorCount++;
        
        // THIRD: Check all possible field names for wantMentor at profile level
        let foundWantMentor = foundWantMentorInSkills;
        if (!foundWantMentor) {
          for (const field of wantMentorFields) {
            let value = profileAny[field];
            
            // Also check nested structures
            if (value === undefined || value === null) {
              if (profileAny.data && typeof profileAny.data === 'object') {
                value = profileAny.data[field];
              }
              if ((value === undefined || value === null) && profileAny.career && typeof profileAny.career === 'object') {
                value = profileAny.career[field];
              }
              if ((value === undefined || value === null) && profileAny.userCareer && typeof profileAny.userCareer === 'object') {
                value = profileAny.userCareer[field];
              }
            }
            
            if (value !== undefined && value !== null) {
              if (typeof value === 'boolean' && value === true) {
                foundWantMentor = true;
                break;
              } else if (typeof value === 'number' && (value === 1 || value > 0)) {
                foundWantMentor = true;
                break;
              } else if (typeof value === 'string') {
                const lower = value.toLowerCase();
                if (lower === 'true' || lower === '1' || lower === 'yes') {
                  foundWantMentor = true;
                  break;
                }
              }
            }
          }
        }
        if (foundWantMentor) wantMentorCount++;
      });
      
      console.log(`[AdminService] ✅ Fallback: Calculated mentor/mentee stats from profiles:`, {
        usersCanMentor: canMentorCount,
        usersWantMentor: wantMentorCount,
      });
      
      return {
        usersCanMentor: canMentorCount,
        usersWantMentor: wantMentorCount,
      };
    } catch (error) {
      console.error('[AdminService] Error in mentor/mentee stats fallback:', error);
    return null;
    }
  }

  /**
   * Get users who can mentor or want to be mentored
   * @param communityId - Community ID
   * @param type - 'can' for mentors, 'want' for mentees
   */
  async getMentorMenteeUsers(
    communityId: number,
    type: 'can' | 'want'
  ): Promise<CommunityMember[]> {
    const endpoints = [
      `/communities/${communityId}/mentors/${type === 'can' ? 'mentors' : 'mentees'}`,
      `/communities/${communityId}/mentor-mentee/${type === 'can' ? 'mentors' : 'mentees'}`,
      `/communities/${communityId}/users/mentor-mentee?type=${type}`,
      `/console/communities/${communityId}/mentors/${type === 'can' ? 'mentors' : 'mentees'}`,
    ];

    for (const url of endpoints) {
      try {
        console.log(`[AdminService] 🎓 Trying mentor/mentee users endpoint: ${url}`);
        const users = await apiService.get<CommunityMember[]>(url);
        if (users && Array.isArray(users)) {
          console.log(`[AdminService] ✅ Found ${users.length} ${type === 'can' ? 'mentors' : 'mentees'}`);
          return users;
        }
      } catch (error: any) {
        const status = error?.status || error?.response?.status;
        if (status === 404) {
          // Silently continue for 404s
        } else {
          console.warn(`[AdminService] Error fetching mentor/mentee users from ${url}:`, {
            status,
            message: error?.message,
          });
        }
      }
    }

    // Fallback: try to get from profiles (canMentor and wantMentor are fields in the profile)
    console.log(`[AdminService] ⚠️ All mentor/mentee endpoints failed, trying profile fallback for ${type === 'can' ? 'mentors' : 'mentees'}`);
    return this.getMentorMenteeUsersFallback(communityId, type);
  }

  /**
   * Fallback: Get mentor/mentee users from profiles
   * First tries to fetch unconsolidated skills data which may include join table info,
   * then falls back to checking profile fields directly
   * 
   * NOTE: This fallback has limitations because:
   * 1. The `/communities/getProfilesForUserAndCommunity` endpoint returns `dataSkills` as an array of strings (e.g., ["Vue.js"])
   * 2. The join table fields (`can_be_mentor`, `wants_to_be_mentee`) from `join_user_skill` are NOT included in the profile response
   * 3. The unconsolidated skills endpoint returns aggregated data (name + count), not per-user data with join table fields
   * 
   * To properly support this feature, the backend needs to either:
   * - Include the join table data in the profile response (e.g., `dataSkills` as array of objects with `can_be_mentor`/`wants_to_be_mentee` fields)
   * - Provide a new endpoint that returns user skills with join table data (e.g., `/communities/:id/users/skills-with-join-data`)
   */
  private async getMentorMenteeUsersFallback(
    communityId: number,
    type: 'can' | 'want'
  ): Promise<CommunityMember[]> {
    try {
      const profiles = await this.getCachedProfiles(communityId);
      
      // FIRST: Try to get unconsolidated skills data which might include user IDs and join table fields
      let userMentorFlags = new Map<number, { canMentor: boolean; wantMentor: boolean }>();
      
      try {
        console.log(`[AdminService] Trying to fetch unconsolidated skills data for mentor/mentee flags`);
        const unconsolidatedSkills = await this.getSkillsChartData(communityId, 'all', false, true);
        
        // Check if the skills data includes user information with join table fields
        if (unconsolidatedSkills && unconsolidatedSkills.length > 0) {
          const firstSkill = unconsolidatedSkills[0] as any;
          console.log(`[AdminService] Sample unconsolidated skill entry:`, firstSkill);
          
          // Check if skills data includes user IDs and join table fields
          unconsolidatedSkills.forEach((skillEntry: any) => {
            // Check various possible structures
            const userId = skillEntry.userId || skillEntry.user_id || skillEntry.id;
            if (userId) {
              const canBeMentor = skillEntry.can_be_mentor || skillEntry.canBeMentor || skillEntry.canMentor;
              const wantsToBeMentee = skillEntry.wants_to_be_mentee || skillEntry.wantsToBeMentee || skillEntry.wantMentor || skillEntry.wantsMentor;
              
              if (canBeMentor !== undefined || wantsToBeMentee !== undefined) {
                const existing = userMentorFlags.get(userId) || { canMentor: false, wantMentor: false };
                
                // Check for can_be_mentor
                if (canBeMentor === true || canBeMentor === 1 || canBeMentor === 'true' || canBeMentor === '1') {
                  existing.canMentor = true;
                }
                
                // Check for wants_to_be_mentee
                if (wantsToBeMentee === true || wantsToBeMentee === 1 || wantsToBeMentee === 'true' || wantsToBeMentee === '1') {
                  existing.wantMentor = true;
                }
                
                userMentorFlags.set(userId, existing);
              }
            }
          });
          
          if (userMentorFlags.size > 0) {
            console.log(`[AdminService] ✅ Found ${userMentorFlags.size} users with mentor/mentee flags from skills data`);
          }
        }
      } catch (error) {
        console.log(`[AdminService] Could not fetch unconsolidated skills data:`, error);
      }
      
      const fieldName = type === 'can' ? 'canMentor' : 'wantMentor';
      // Expanded list of possible field names (including variations with underscores, data prefix, etc.)
      const altFieldNames = type === 'can' 
        ? [
            'canMentor', 'can_mentor', 'dataCanMentor', 'data_can_mentor',
            'is_active_mentor', 'isActiveMentor', 'isMentor', 'mentor',
            'canMentorFlag', 'mentorFlag', 'isMentorActive'
          ]
        : [
            'wantMentor', 'want_mentor', 'dataWantMentor', 'data_want_mentor',
            'is_active_mentee', 'isActiveMentee', 'isMentee', 'mentee', 'wantsMentor',
            'wantMentorFlag', 'menteeFlag', 'isMenteeActive', 'wants_mentor'
          ];
      
      console.log(`[AdminService] Fallback: Filtering ${profiles.length} profiles for ${fieldName}`);
      
      // Enhanced debug: Log sample profile structure to understand what data is available
      if (profiles.length > 0) {
        const sampleProfile = profiles[0] as any;
        console.log(`[AdminService] 🔍 Sample profile structure for mentor/mentee detection:`, {
          userId: sampleProfile.userId || sampleProfile.id,
          hasSkills: !!sampleProfile.skills,
          hasDataSkills: !!sampleProfile.dataSkills,
          hasUserSkills: !!sampleProfile.userSkills,
          skillsType: typeof sampleProfile.skills,
          dataSkillsType: typeof sampleProfile.dataSkills,
          skillsValue: sampleProfile.skills,
          dataSkillsValue: sampleProfile.dataSkills,
          allKeys: Object.keys(sampleProfile),
          // Check for any nested objects that might contain mentor/mentee data
          hasData: !!sampleProfile.data,
          hasCareer: !!sampleProfile.career,
          hasUserCareer: !!sampleProfile.userCareer,
        });
        
        // If dataSkills is an array, check if it contains objects or just strings
        if (Array.isArray(sampleProfile.dataSkills) && sampleProfile.dataSkills.length > 0) {
          console.log(`[AdminService] 🔍 Sample dataSkills entry:`, sampleProfile.dataSkills[0], `(type: ${typeof sampleProfile.dataSkills[0]})`);
        }
      }
      
      const filtered = profiles
        .map(profile => {
          const profileAny = profile as any;
          const userId = profile.userId || profile.id;
          
          // Collect skills that have mentor/mentee flags
          const relevantSkills: string[] = [];
          const skills = profileAny.skills || profileAny.dataSkills || profileAny.userSkills;
          
          if (skills) {
            let skillsArray: any[] = [];
            
            // Normalize skills to array
            if (Array.isArray(skills)) {
              skillsArray = skills;
            } else if (typeof skills === 'object') {
              skillsArray = Object.values(skills);
            }
            
            // Check each skill object for mentor/mentee flags and collect skill names
            for (const skill of skillsArray) {
              if (typeof skill === 'object' && skill !== null) {
                const skillName = skill.name || skill.skill || skill.value || '';
                
                // Check for can_be_mentor (from join_user_skill table)
                if (type === 'can') {
                  const canBeMentor = skill.can_be_mentor || skill.canBeMentor || skill.canMentor;
                  if (canBeMentor === true || canBeMentor === 1 || canBeMentor === 'true' || canBeMentor === '1') {
                    if (skillName) {
                      relevantSkills.push(skillName);
                    }
                  }
                }
                
                // Check for wants_to_be_mentee (from join_user_skill table)
                if (type === 'want') {
                  const wantsToBeMentee = skill.wants_to_be_mentee || skill.wantsToBeMentee || skill.wantMentor || skill.wantsMentor;
                  if (wantsToBeMentee === true || wantsToBeMentee === 1 || wantsToBeMentee === 'true' || wantsToBeMentee === '1') {
                    if (skillName) {
                      relevantSkills.push(skillName);
                    }
                  }
                }
              } else if (typeof skill === 'string' && skill.trim()) {
                // If skills are just strings, we can't determine mentor/mentee status from them
                // But we'll check profile-level flags below
              }
            }
          }
          
          return {
            id: userId,
            fname: profile.fname,
            lname: profile.lname,
            fullName: profile.fullName || `${profile.fname} ${profile.lname}`,
            email: '',
            profilePicture: profile.profilePicture,
            isManager: false,
            enabled: true,
            joinDate: undefined,
            jobTitle: profile.jobTitle,
            currentEmployer: profile.currentEmployer,
            // Add skills that have mentor/mentee flags
            mentorSkills: type === 'can' ? relevantSkills : undefined,
            menteeSkills: type === 'want' ? relevantSkills : undefined,
            _profile: profile, // Store profile reference for filtering
            _relevantSkills: relevantSkills, // Store for filtering
          };
        })
        .filter(member => {
          const profile = member._profile;
          if (!profile) return false;
          
          // Ensure _relevantSkills is always an array
          if (!member._relevantSkills) {
            member._relevantSkills = [];
          }
          
          // If we found skills with mentor/mentee flags, include this user
          if (member._relevantSkills.length > 0) {
            console.log(`[AdminService] Found ${member._relevantSkills.length} skill(s) with ${type === 'can' ? 'can_be_mentor' : 'wants_to_be_mentee'}=true for user ${member.id}:`, member._relevantSkills);
            return true;
          }
          
          const profileAny = profile as any;
          
          // FIRST: Check if we found this user in the skills data with join table flags
          const mentorFlags = userMentorFlags.get(member.id);
          if (mentorFlags) {
            if (type === 'can' && mentorFlags.canMentor) {
              console.log(`[AdminService] Found can_be_mentor=true from skills data for user ${member.id}`);
              return true;
            }
            if (type === 'want' && mentorFlags.wantMentor) {
              console.log(`[AdminService] Found wants_to_be_mentee=true from skills data for user ${member.id}`);
              return true;
            }
          }
          
          // SECOND: Check skills array for can_be_mentor and wants_to_be_mentee from join_user_skill table
          const skills = profileAny.skills || profileAny.dataSkills || profileAny.userSkills;
          if (skills) {
            let skillsArray: any[] = [];
            
            // Normalize skills to array
            if (Array.isArray(skills)) {
              skillsArray = skills;
            } else if (typeof skills === 'object') {
              skillsArray = Object.values(skills);
            }
            
            // Check each skill object for mentor/mentee flags and collect skill names
            for (const skill of skillsArray) {
              if (typeof skill === 'object' && skill !== null) {
                const skillName = skill.name || skill.skill || skill.value || '';
                
                // Check for can_be_mentor (from join_user_skill table)
                if (type === 'can') {
                  const canBeMentor = skill.can_be_mentor || skill.canBeMentor || skill.canMentor;
                  if (canBeMentor === true || canBeMentor === 1 || canBeMentor === 'true' || canBeMentor === '1') {
                    if (skillName && !member._relevantSkills.includes(skillName)) {
                      member._relevantSkills.push(skillName);
                    }
                    console.log(`[AdminService] Found can_be_mentor=true in skills for user ${member.id}${skillName ? ` (skill: ${skillName})` : ''}`);
                    // Don't return yet - continue collecting all skills with this flag
                  }
                }
                
                // Check for wants_to_be_mentee (from join_user_skill table)
                if (type === 'want') {
                  const wantsToBeMentee = skill.wants_to_be_mentee || skill.wantsToBeMentee || skill.wantMentor || skill.wantsMentor;
                  if (wantsToBeMentee === true || wantsToBeMentee === 1 || wantsToBeMentee === 'true' || wantsToBeMentee === '1') {
                    if (skillName && !member._relevantSkills.includes(skillName)) {
                      member._relevantSkills.push(skillName);
                    }
                    console.log(`[AdminService] Found wants_to_be_mentee=true in skills for user ${member.id}${skillName ? ` (skill: ${skillName})` : ''}`);
                    // Don't return yet - continue collecting all skills with this flag
                  }
                }
              }
            }
            
            // If we found any skills with mentor/mentee flags, include this user
            if (member._relevantSkills.length > 0) {
              return true;
            }
          }
          
          // THIRD: Check all possible field names for mentor/mentee flags at profile level
          // If profile-level flag is true but we don't have specific skills, include all skills
          let foundProfileLevelFlag = false;
          for (const field of altFieldNames) {
            let value = profileAny[field];
            
            // Also check nested structures (e.g., data.canMentor, career.is_active_mentor)
            if (value === undefined || value === null) {
              if (profileAny.data && typeof profileAny.data === 'object') {
                value = profileAny.data[field];
              }
              if ((value === undefined || value === null) && profileAny.career && typeof profileAny.career === 'object') {
                value = profileAny.career[field];
              }
              if ((value === undefined || value === null) && profileAny.userCareer && typeof profileAny.userCareer === 'object') {
                value = profileAny.userCareer[field];
              }
            }
            
            if (value !== undefined && value !== null) {
              // Handle boolean, number (1/0), or string ('true'/'false', '1'/'0')
              let isTrue = false;
              if (typeof value === 'boolean') {
                isTrue = value === true;
              } else if (typeof value === 'number') {
                isTrue = value === 1 || value > 0;
              } else if (typeof value === 'string') {
                const lower = value.toLowerCase();
                isTrue = lower === 'true' || lower === '1' || lower === 'yes';
              }
              
              if (isTrue) {
                foundProfileLevelFlag = true;
                // If we found a profile-level flag but no specific skills, collect all skills
                if (member._relevantSkills.length === 0) {
                  const allSkills = profileAny.skills || profileAny.dataSkills || profileAny.userSkills;
                  if (allSkills) {
                    let skillsArray: any[] = [];
                    if (Array.isArray(allSkills)) {
                      skillsArray = allSkills;
                    } else if (typeof allSkills === 'object') {
                      skillsArray = Object.values(allSkills);
                    }
                    
                    skillsArray.forEach((skill: any) => {
                      if (typeof skill === 'object' && skill !== null) {
                        const skillName = skill.name || skill.skill || skill.value || '';
                        if (skillName && !member._relevantSkills.includes(skillName)) {
                          member._relevantSkills.push(skillName);
                        }
                      } else if (typeof skill === 'string' && skill.trim()) {
                        if (!member._relevantSkills.includes(skill)) {
                          member._relevantSkills.push(skill);
                        }
                      }
                    });
                  }
                }
                break; // Found a flag, no need to check other fields
              }
            }
          }
          
          if (foundProfileLevelFlag) {
            return true;
          }
          
          return false;
        })
        .map(member => {
          // Update skills fields and remove internal fields before returning
          const { _profile, _relevantSkills = [], ...cleanMember } = member;
          if (type === 'can') {
            cleanMember.mentorSkills = _relevantSkills;
          } else {
            cleanMember.menteeSkills = _relevantSkills;
          }
          return cleanMember;
        });

      console.log(`[AdminService] ✅ Fallback: Found ${filtered.length} ${type === 'can' ? 'mentors' : 'mentees'} from profiles`);
      
      // Note: If the backend stats endpoint returns a different count, it may be querying the user_career table
      // directly, which might have users that don't have the flag set in their profile dataSkills array.
      // We can only return users for whom we have profile data.
      
      return filtered;
    } catch (error) {
      console.error('[AdminService] Error in mentor/mentee fallback:', error);
    return [];
    }
  }

  /**
   * Calculate Skills stats from available data
   * Uses the skills endpoint to get all skills and calculate stats
   */
  private async calculateSkillsStats(communityId: number): Promise<Partial<UserStats> | null> {
    try {
      console.log(`[AdminService] 🎓 Calculating skills stats for community ${communityId}`);
      const stats: Partial<UserStats> = {
        totalSkills: 0,
        usersWithSkills: 0,
        // Note: usersCanMentor and usersWantMentor are NOT calculated here
        // They come from backend endpoint via getMentorMenteeStats() which queries user_career table
      };

      // Get all skills for the community
      try {
        const allSkills = await this.getSkillsChartData(communityId, 'all', true, true);
        const uniqueSkills = new Set<string>();
        const usersWithSkillsSet = new Set<number>();

        // Process skills data
        allSkills.forEach((skill: AttributeModel) => {
          uniqueSkills.add(skill.name);
          
          // The value field might represent user count for that skill
          // If value > 0, it means at least one user has this skill
          if (skill.value && skill.value > 0) {
            // We can't determine which specific users from this data alone
            // But we know at least one user has this skill
          }
        });

        stats.totalSkills = uniqueSkills.size;

        // Try to get users with skills by querying profiles (use cached if available)
        try {
          const profiles = await this.getCachedProfiles(communityId);
          console.log(`[AdminService] 🎓 Processing ${profiles.length} profiles for skills calculation`);
          
          profiles.forEach((profile: any) => {
            const userId = profile.userId || profile.id || profile.user_id;
            if (!userId) return;
            
            // Check if profile has skills (could be array, object, or string)
            // Check multiple possible field names: skills, dataSkills, userSkills
            const skills = profile.skills || profile.dataSkills || profile.userSkills;
            if (skills) {
              if (Array.isArray(skills) && skills.length > 0) {
                usersWithSkillsSet.add(userId);
              } else if (typeof skills === 'object' && Object.keys(skills).length > 0) {
                usersWithSkillsSet.add(userId);
              } else if (typeof skills === 'string' && skills.trim().length > 0) {
                usersWithSkillsSet.add(userId);
              }
            }
            
            // Note: Mentor/mentee flags (is_active_mentor, is_active_mentee) are in user_career table, not profile
            // These MUST be fetched from backend endpoint via getMentorMenteeStats()
            // Client-side calculation is not possible as profiles don't contain this data
          });

          stats.usersWithSkills = usersWithSkillsSet.size;
          
          console.log(`[AdminService] 🎓 Skills stats from profiles:`, {
            usersWithSkills: stats.usersWithSkills,
            // Note: usersCanMentor and usersWantMentor come from backend endpoint, not profiles
          });
        } catch (profileError) {
          console.warn('[AdminService] Could not get profile data for skills calculation:', profileError);
          // Fallback: estimate from skills data
          // If we have skills with values > 0, we know at least some users have skills
          const skillsWithUsers = allSkills.filter((s: AttributeModel) => s.value && s.value > 0);
          if (skillsWithUsers.length > 0) {
            // Conservative estimate: assume at least one user per unique skill
            stats.usersWithSkills = Math.max(uniqueSkills.size, skillsWithUsers.length);
          }
        }

        console.log(`[AdminService] 🎓 Skills stats calculated:`, stats);
      } catch (error) {
        console.warn('[AdminService] Could not calculate skills stats:', error);
      }

      return stats;
    } catch (error) {
      console.error('[AdminService] Error calculating skills stats:', error);
      return {
        totalSkills: 0,
        usersWithSkills: 0,
        // Note: usersCanMentor and usersWantMentor must come from backend endpoint
        // They are not calculated client-side as the data is in user_career table
      };
    }
  }

  /**
   * Get Match Engagement stats
   */
  async getMatchEngagementStats(
    communityId: number,
    startDate?: string,
    endDate?: string
  ): Promise<Partial<UserStats> | null> {
    try {
      let url = `/communities/${communityId}/stats/match-engagement`;
      if (startDate && endDate) {
        url += `?startDate=${startDate}&endDate=${endDate}`;
      }
      const stats = await apiService.get<Partial<UserStats>>(url);
      return stats;
    } catch (error: any) {
      if (error?.status === 404 || error?.response?.status === 404) {
        // Calculate from available data
        return this.calculateMatchEngagementStats(communityId, startDate, endDate);
      }
      console.warn('[AdminService] Error fetching match engagement stats:', error);
      return null;
    }
  }

  /**
   * Calculate Match Engagement stats from available data
   * Uses slack-user-stats for Trova Magic (correct MPIM + type_id=9 logic) instead of matches-based fallback
   */
  private async calculateMatchEngagementStats(
    communityId: number,
    startDate?: string,
    endDate?: string
  ): Promise<Partial<UserStats> | null> {
    try {
      const stats: Partial<UserStats> = {
        trovaMagicMatches: 0,
        trovaMagicSessions: 0,
        channelPairingMatches: 0,
        channelPairingSessions: 0,
        mentorMenteeMatches: 0,
        allMatchesEngaged: 0,
        matchEngagementRate: 0,
      };

      // Use daily breakdown for both total and engaged, excluding dates with >1000 pairings (data issues)
      // This ensures consistency and accuracy - total should be sum of all valid daily pairings
      let trovaMagicTotal = 0;
      let trovaMagicEngaged = 0;
      let trovaMagicSessions = 0;
      try {
        const magicIntrosByDate = await this.getMagicIntrosByDate(communityId, startDate, endDate);
        // Filter out dates with >1000 pairings (data issues like June 24, 2025 with 17,005)
        const validDates = magicIntrosByDate.filter(day => day.totalPairings <= 1000);
        
        // Sum total pairings from valid dates (this matches what user sees in the list: 2+2+5+2+4+5+...)
        trovaMagicTotal = validDates.reduce((sum, day) => sum + day.totalPairings, 0);
        
        // Sum engaged pairings from valid dates
        trovaMagicEngaged = validDates.reduce((sum, day) => sum + day.engagedPairings, 0);
        
        // Get total sessions (match records) by fetching all matches
        const trovaMagicMatchRecords = await this.getMatchesForCommunity(communityId, startDate, endDate, 'trova_magic');
        trovaMagicSessions = trovaMagicMatchRecords?.length || 0;
        
        console.log(`[AdminService] 🔗 Trova Magic: ${trovaMagicSessions} sessions → ${trovaMagicTotal} unique pairs, ${trovaMagicEngaged} engaged (${validDates.length} valid dates, ${magicIntrosByDate.length - validDates.length} dates excluded)`);
      } catch (error) {
        console.warn('[AdminService] Could not fetch Trova Magic from daily breakdown:', error);
      }
      
      stats.trovaMagicMatches = trovaMagicTotal;
      stats.trovaMagicSessions = trovaMagicSessions;
      stats.trovaMagicEngagements = trovaMagicEngaged;

      // Get Channel Pairing matches separately (they don't have a daily breakdown endpoint)
      const channelPairingMatches = await this.getMatchesForCommunity(communityId, startDate, endDate, 'channel_pairing');
      
      // Count unique matches by group_id (a match between 3 users = 1 match)
      // This is the same logic used for "Connections Made"
      const channelPairingGroups = new Set<number>();
      const channelPairingMatchesByGroup = new Map<number, any>(); // group_id -> match (for engagement tracking)
      
      if (channelPairingMatches && channelPairingMatches.length > 0) {
        for (const match of channelPairingMatches) {
          // Get the group identifier (same logic as Connections Made)
          const groupId = match.groupId || match.group_id || 
                         (match.matchIndicesId && match.matchIndicesId !== 0 ? match.matchIndicesId : null);
          
          if (groupId !== null && groupId !== undefined) {
            // Count each unique group_id as 1 match
            if (!channelPairingGroups.has(groupId)) {
              channelPairingGroups.add(groupId);
              // Store one match per group for engagement tracking
              channelPairingMatchesByGroup.set(groupId, match);
            }
          }
        }
      }

      stats.channelPairingMatches = channelPairingGroups.size;
      stats.channelPairingSessions = channelPairingMatches?.length || 0;
      
      // Calculate engagement for Channel Pairing matches
      // A match is "engaged" if any users in that match group have a conversation
      let channelPairingEngaged = 0;
      if (channelPairingGroups.size > 0) {
        try {
          // Check if any users in each group have conversations
          channelPairingEngaged = await this.countEngagedMatchesByGroup(communityId, channelPairingMatches, channelPairingGroups);
        } catch (error) {
          console.warn('[AdminService] Could not calculate channel pairing engagement:', error);
        }
      }
      
      // Store channel pairing engagements for display
      stats.channelPairingEngagements = channelPairingEngaged;
      
      // Get Mentor/Mentee matches - count total matches and unique pairs
      let mentorMenteeTotal = 0;
      let mentorMenteeUniquePairs = 0;
      try {
        console.log(`[AdminService] 🎓 Fetching mentor/mentee matches for stats calculation`, { startDate, endDate });
        // Use the user-based method to get total match count
        const usersWithMatches = await this.getMentorMenteeUsersWithMatches(communityId, startDate, endDate);
        mentorMenteeTotal = usersWithMatches.reduce((sum, user) => sum + user.matchCount, 0);
        
        // Calculate unique pairs by fetching matches and deduplicating
        const mentorMenteeMatches = await this.getMatchesForCommunity(communityId, startDate, endDate, 'mentor-mentee');
        if (mentorMenteeMatches && mentorMenteeMatches.length > 0) {
          const uniquePairs = new Set<string>();
          for (const match of mentorMenteeMatches) {
            const userId = match.userId || match.user_id;
            const matchedUserId = match.matchedUserId || match.matched_user_id;
            if (userId && matchedUserId) {
              const pairKey = [userId, matchedUserId].sort((a, b) => a - b).join('-');
              uniquePairs.add(pairKey);
            }
          }
          mentorMenteeUniquePairs = uniquePairs.size;
        }
        
        console.log(`[AdminService] 🎓 Mentor/Mentee: ${mentorMenteeTotal} sessions, ${mentorMenteeUniquePairs} unique pairs (from ${usersWithMatches.length} users)`);
      } catch (error) {
        console.error('[AdminService] Error fetching Mentor/Mentee matches:', error);
      }
      
      stats.mentorMenteeMatches = mentorMenteeTotal;
      stats.mentorMenteeUniquePairs = mentorMenteeUniquePairs;
      stats.mentorMenteeEngagements = 0; // Not tracking engagements for mentor/mentee matches
      
      // Calculate total engaged and engagement rate (excluding mentor/mentee engagements)
      const totalMatches = stats.trovaMagicMatches + stats.channelPairingMatches + stats.mentorMenteeMatches;
      if (totalMatches > 0) {
        stats.allMatchesEngaged = trovaMagicEngaged + channelPairingEngaged; // Not including mentor/mentee engagements
        stats.matchEngagementRate = (stats.allMatchesEngaged / totalMatches) * 100;
      }
      
      // Note: "Intros Led To Convos" is calculated in getUserActionsStats() to ensure it's always available
      // It counts ALL individual match records (not unique pairs) where both users engaged
      
      console.log(`[AdminService] 🔗 Match engagement: ${stats.trovaMagicMatches} Trova Magic (${stats.trovaMagicEngagements} engaged), ${stats.channelPairingMatches} Channel Pairing (${channelPairingEngaged} engaged), ${stats.mentorMenteeMatches} Mentor/Mentee (matches only, no engagement tracking), ${stats.allMatchesEngaged}/${totalMatches} total engaged`);

      return stats;
    } catch (error) {
      console.warn('[AdminService] Error calculating match engagement stats:', error);
      return null;
    }
  }

  /**
   * Get Channel Pairing stats
   */
  async getChannelPairingStats(
    communityId: number,
    startDate?: string,
    endDate?: string
  ): Promise<Partial<UserStats> | null> {
    try {
      let url = `/communities/${communityId}/stats/channel-pairing`;
      if (startDate && endDate) {
        url += `?startDate=${startDate}&endDate=${endDate}`;
      }
      const stats = await apiService.get<Partial<UserStats>>(url);
      return stats;
    } catch (error: any) {
      if (error?.status === 404 || error?.response?.status === 404) {
        // Calculate from available data
        return this.calculateChannelPairingStats(communityId, startDate, endDate);
      }
      console.warn('[AdminService] Error fetching channel pairing stats:', error);
      return null;
    }
  }

  /**
   * Calculate Channel Pairing stats from available data
   */
  private async calculateChannelPairingStats(
    communityId: number,
    startDate?: string,
    endDate?: string
  ): Promise<Partial<UserStats> | null> {
    try {
      const stats: Partial<UserStats> = {
        channelPairingGroups: 0,
        channelPairingUsers: 0,
        channelPairingOnDemand: 0,
        channelPairingCadence: 0,
      };

      // Get channel pairing matches
      const channelPairingMatches = await this.getMatchesForCommunity(
        communityId,
        startDate,
        endDate,
        'channel_pairing'
      );

      if (channelPairingMatches && channelPairingMatches.length > 0) {
        // Count unique groups (group_id) for channel pairing
        const uniqueGroups = new Set<number>();
        const uniqueUsers = new Set<number>();

        channelPairingMatches.forEach((match: any) => {
          const groupId = match.groupId || match.group_id;
          if (groupId) {
            uniqueGroups.add(groupId);
          }
          if (match.userId) uniqueUsers.add(match.userId);
          if (match.matchedUserId) uniqueUsers.add(match.matchedUserId);
        });

        stats.channelPairingGroups = uniqueGroups.size;
        stats.channelPairingUsers = uniqueUsers.size;
        
        // Calculate on-demand vs cadence based on match metadata
        let onDemandCount = 0;
        let cadenceCount = 0;
        
        channelPairingMatches.forEach((match: any) => {
          // Check for indicators of on-demand vs cadence
          // Common fields: isOnDemand, onDemand, cadence, scheduled, triggerType, etc.
          const isOnDemand = match.isOnDemand || match.onDemand || match.triggerType === 'on_demand' || match.triggerType === 'manual';
          const isCadence = match.isCadence || match.cadence || match.triggerType === 'cadence' || match.triggerType === 'scheduled' || match.scheduled;
          
          if (isOnDemand) {
            onDemandCount++;
          } else if (isCadence) {
            cadenceCount++;
          } else {
            // If no metadata, try to infer from other fields
            // On-demand might be triggered immediately, cadence might have a schedule
            if (match.triggeredAt || match.manualTrigger) {
              onDemandCount++;
            } else if (match.scheduledAt || match.nextRun) {
              cadenceCount++;
            } else {
              // Default: assume cadence (most channel pairings are scheduled)
              cadenceCount++;
            }
          }
        });
        
        stats.channelPairingOnDemand = onDemandCount;
        stats.channelPairingCadence = cadenceCount;
      }

      return stats;
    } catch (error) {
      console.warn('[AdminService] Error calculating channel pairing stats:', error);
      return null;
    }
  }

  /**
   * Get message statistics
   */
  async getMessageStats(communityId: number, startDate?: string, endDate?: string): Promise<{ totalMessagesSent: number } | null> {
    try {
      let url = `/communities/${communityId}/stats/messages`;
      if (startDate && endDate) {
        url += `?startDate=${startDate}&endDate=${endDate}`;
      }
      const stats = await apiService.get<{ totalMessagesSent: number }>(url);
      return stats;
    } catch (error: any) {
      if (error?.status === 404 || error?.response?.status === 404) {
        // Calculate from Firebase
        return this.calculateMessageStats(communityId, startDate, endDate);
      }
      console.error('Failed to fetch message stats:', error);
      return null;
    }
  }

  /**
   * Get cached or fetch conversations for a community
   */
  private async getConversationsForCommunity(communityId: number): Promise<Set<string>> {
    const cacheKey = this.getConversationsCacheKey(communityId);
    const cached = this.conversationsCache.get(cacheKey);
    
    if (cached && this.isCacheValid(cached.timestamp, this.FIREBASE_CACHE_TTL)) {
      console.log(`[AdminService] ✅ Using cached conversations for community ${communityId}`);
      return cached.data as Set<string>;
    }

    const firebase = useFirebase();
    const firestore = firebase.firestore;
    
    if (!firestore) {
      return new Set<string>();
    }

    const messagesRef = collection(firestore, 'messages');
    const conversationsQuery = query(
      messagesRef,
      where('communityId', '==', communityId)
    );
    
    const conversationsSnapshot = await getDocs(conversationsQuery);
    const conversationIds = new Set<string>();
    conversationsSnapshot.forEach((docSnap) => {
      conversationIds.add(docSnap.id);
    });

    // Cache the result
    this.conversationsCache.set(cacheKey, { data: conversationIds, timestamp: Date.now() });
    return conversationIds;
  }

  /**
   * Calculate message statistics from Firebase
   * Counts ALL messages from ALL conversation types:
   * - MPIM (Multi-Person Instant Messages)
   * - Magic intro threads
   * - Breakout groups
   * - Directory messages (user-to-user)
   * - Any thread/conversation started in the community
   * 
   * Uses cached conversation IDs and queries messages subcollections efficiently
   */
  private async calculateMessageStats(
    communityId: number,
    startDate?: string,
    endDate?: string
  ): Promise<{ totalMessagesSent: number } | null> {
    try {
      const firebase = useFirebase();
      const firestore = firebase.firestore;
      
      if (!firestore) {
        console.warn('[AdminService] Firestore not initialized, cannot query messages');
        return { totalMessagesSent: 0 };
      }

      console.log(`[AdminService] 📨 Starting message stats calculation for community ${communityId}`);
      
      // Get ALL conversations for this community (includes all types: MPIM, breakout groups, directory, magic intros, etc.)
      // getConversationsForCommunity queries all messages with communityId, regardless of parentType
      const communityConversationIds = await this.getConversationsForCommunity(communityId);
      
      if (communityConversationIds.size === 0) {
        console.log(`[AdminService] 📨 No conversations found for community ${communityId}`);
        return { totalMessagesSent: 0 };
      }
      const startTimestamp = startDate ? Timestamp.fromDate(new Date(startDate)) : null;
      const endTimestamp = endDate ? Timestamp.fromDate(new Date(endDate)) : null;

      let totalMessages = 0;
      
      // Query each conversation's messages directly (more efficient than collectionGroup)
      // This avoids scanning the entire database and creates fewer Firebase connections
      // Counts all messages in the 'conv' subcollection for each conversation
      const batchSize = 10; // Process conversations in batches to avoid overwhelming Firebase
      const conversationIdsArray = Array.from(communityConversationIds);
      
      console.log(`[AdminService] 📨 Querying messages from ${conversationIdsArray.length} conversations (all types: MPIM, breakout groups, directory, magic intros) in batches of ${batchSize}`);
      
      for (let i = 0; i < conversationIdsArray.length; i += batchSize) {
        const batch = conversationIdsArray.slice(i, i + batchSize);
        
        // Process batch in parallel
        const batchPromises = batch.map(async (conversationId) => {
          try {
            // Query the 'conv' subcollection for this conversation
            // This contains all messages regardless of conversation type
            const messagesSubcollection = collection(firestore, `messages/${conversationId}/conv`);
            const convQuery = startTimestamp && endTimestamp
              ? query(
                  messagesSubcollection,
                  where('timestamp', '>=', startTimestamp),
                  where('timestamp', '<=', endTimestamp)
                )
              : query(messagesSubcollection);
            
            const convSnapshot = await getDocs(convQuery);
            return convSnapshot.size;
          } catch (subcollectionError) {
            console.debug(`[AdminService] Could not query messages subcollection for ${conversationId}:`, subcollectionError);
            return 0;
          }
        });
        
        const batchResults = await Promise.all(batchPromises);
        totalMessages += batchResults.reduce((sum, count) => sum + count, 0);
        
        // Log progress for large datasets
        if (conversationIdsArray.length > 50 && (i + batchSize) % 50 === 0) {
          console.log(`[AdminService] 📨 Processed ${Math.min(i + batchSize, conversationIdsArray.length)}/${conversationIdsArray.length} conversations`);
        }
      }

      console.log(`[AdminService] 📨 Calculated ${totalMessages} total messages sent for community ${communityId} (includes all conversation types)`);
      return { totalMessagesSent: totalMessages };
    } catch (error) {
      console.error('[AdminService] Error calculating message stats:', error);
      return { totalMessagesSent: 0 };
    }
  }

  /**
   * Get unique messages sent from conversations that originated from matches
   * This filters messages to only those from conversations where user pairs match the pairs from /communities/{id}/matches
   * 
   * @param communityId - The community ID
   * @param startDate - Optional start date filter
   * @param endDate - Optional end date filter
   * @returns Object with totalMessagesSent count (unique messages from match-based conversations)
   */
  async getMessagesFromMatches(
    communityId: number,
    startDate?: string,
    endDate?: string
  ): Promise<{ totalMessagesSent: number } | null> {
    try {
      const firebase = useFirebase();
      const firestore = firebase.firestore;
      
      if (!firestore) {
        console.warn('[AdminService] Firestore not initialized, cannot query messages');
        return { totalMessagesSent: 0 };
      }

      console.log(`[AdminService] 📨 Getting messages from match-based conversations for community ${communityId}`);
      
      // Step 1: Get all matches from /communities/{id}/matches (all types)
      const allMatches = await this.getMatchesForCommunity(communityId, startDate, endDate);
      
      if (!allMatches || allMatches.length === 0) {
        console.log(`[AdminService] 📨 No matches found, returning 0 messages`);
        return { totalMessagesSent: 0 };
      }

      // Step 2: Extract unique user pairs from matches
      const matchPairs = new Set<string>();
      
      allMatches.forEach((match: any) => {
        const userId = match.userId || match.user_id;
        const matchedUserId = match.matchedUserId || match.matched_user_id;
        
        if (userId && matchedUserId) {
          const pairKey = [userId, matchedUserId].sort((a, b) => a - b).join('-');
          matchPairs.add(pairKey);
        }
      });

      console.log(`[AdminService] 📨 Found ${matchPairs.size} unique user pairs from ${allMatches.length} matches`);

      // Step 3: Get all conversations for the community
      const conversationIds = await this.getConversationsForCommunity(communityId);
      
      if (conversationIds.size === 0) {
        console.log(`[AdminService] 📨 No conversations found`);
        return { totalMessagesSent: 0 };
      }

      // Step 4: Filter conversations to only those that contain match pairs
      const matchConversationIds = new Set<string>();
      const batchSize = 10;
      const conversationIdsArray = Array.from(conversationIds);
      
      for (let i = 0; i < conversationIdsArray.length; i += batchSize) {
        const batch = conversationIdsArray.slice(i, i + batchSize);
        const batchPromises = batch.map(async (conversationId) => {
          try {
            const conversationDoc = await getDoc(doc(firestore, `messages/${conversationId}`));
            if (conversationDoc.exists()) {
              const conversationData = conversationDoc.data();
              if (conversationData.users && Array.isArray(conversationData.users)) {
                const userIds = conversationData.users.filter((id: any) => typeof id === 'number');
                
                // Check if this conversation contains any of our match pairs
                for (let i = 0; i < userIds.length; i++) {
                  for (let j = i + 1; j < userIds.length; j++) {
                    const pairKey = [userIds[i], userIds[j]].sort((a, b) => a - b).join('-');
                    if (matchPairs.has(pairKey)) {
                      return conversationId;
                    }
                  }
                }
              }
            }
            return null;
          } catch (error) {
            console.debug(`[AdminService] Error checking conversation ${conversationId}:`, error);
            return null;
          }
        });
        
        const batchResults = await Promise.all(batchPromises);
        batchResults.forEach((conversationId) => {
          if (conversationId) {
            matchConversationIds.add(conversationId);
          }
        });
      }

      console.log(`[AdminService] 📨 Found ${matchConversationIds.size} conversations from ${conversationIds.size} total that match user pairs from matches`);

      // Step 5: Count unique messages from match-based conversations
      const startTimestamp = startDate ? Timestamp.fromDate(new Date(startDate)) : null;
      const endTimestamp = endDate ? Timestamp.fromDate(new Date(endDate)) : null;
      
      let totalMessages = 0;
      const matchConversationIdsArray = Array.from(matchConversationIds);
      
      for (let i = 0; i < matchConversationIdsArray.length; i += batchSize) {
        const batch = matchConversationIdsArray.slice(i, i + batchSize);
        
        const batchPromises = batch.map(async (conversationId) => {
          try {
            const messagesSubcollection = collection(firestore, `messages/${conversationId}/conv`);
            const convQuery = startTimestamp && endTimestamp
              ? query(
                  messagesSubcollection,
                  where('timestamp', '>=', startTimestamp),
                  where('timestamp', '<=', endTimestamp)
                )
              : query(messagesSubcollection);
            
            const convSnapshot = await getDocs(convQuery);
            return convSnapshot.size;
          } catch (subcollectionError) {
            console.debug(`[AdminService] Could not query messages subcollection for ${conversationId}:`, subcollectionError);
            return 0;
          }
        });
        
        const batchResults = await Promise.all(batchPromises);
        totalMessages += batchResults.reduce((sum, count) => sum + count, 0);
      }

      console.log(`[AdminService] 📨 Calculated ${totalMessages} unique messages from match-based conversations (from ${matchConversationIds.size} conversations)`);
      return { totalMessagesSent: totalMessages };
    } catch (error) {
      console.error('[AdminService] Error getting messages from matches:', error);
      return { totalMessagesSent: 0 };
    }
  }

  /**
   * Get event statistics
   */
  async getEventStats(communityId: number, startDate?: string, endDate?: string): Promise<{ eventsCreated: number; eventsAttended: number } | null> {
    try {
      let url = `/communities/${communityId}/stats/events`;
      if (startDate && endDate) {
        url += `?startDate=${startDate}&endDate=${endDate}`;
      }
      const stats = await apiService.get<{ eventsCreated: number; eventsAttended: number }>(url);
      return stats;
    } catch (error: any) {
      if (error?.status === 404 || error?.response?.status === 404) {
        console.log(`[AdminService] Event stats endpoint not found for community ${communityId}`);
        return null;
      }
      console.error('Failed to fetch event stats:', error);
      return null;
    }
  }

  /**
   * Get group statistics
   */
  async getGroupStats(communityId: number, startDate?: string, endDate?: string): Promise<{ groupsCreated: number; groupsJoined: number } | null> {
    try {
      let url = `/communities/${communityId}/stats/groups`;
      if (startDate && endDate) {
        url += `?startDate=${startDate}&endDate=${endDate}`;
      }
      const stats = await apiService.get<{ groupsCreated: number; groupsJoined: number }>(url);
      return stats;
    } catch (error: any) {
      if (error?.status === 404 || error?.response?.status === 404) {
        console.log(`[AdminService] Group stats endpoint not found for community ${communityId}`);
        return null;
      }
      console.error('Failed to fetch group stats:', error);
      return null;
    }
  }

  /**
   * Get active user statistics (DAU/WAU)
   */
  async getActiveUserStats(communityId: number, startDate?: string, endDate?: string): Promise<{ dailyActiveUsers: number; weeklyActiveUsers: number } | null> {
    try {
      let url = `/communities/${communityId}/stats/active-users`;
      if (startDate && endDate) {
        url += `?startDate=${startDate}&endDate=${endDate}`;
      }
      const stats = await apiService.get<{ dailyActiveUsers: number; weeklyActiveUsers: number }>(url);
      return stats;
    } catch (error: any) {
      if (error?.status === 404 || error?.response?.status === 404) {
        // Calculate from available data
        return this.calculateActiveUserStats(communityId, startDate, endDate);
      }
      console.error('Failed to fetch active user stats:', error);
      return null;
    }
  }

  /**
   * Calculate active user statistics from available data
   * Active users = users who sent messages, created/attended events, joined groups, or were matched
   * Daily/Weekly are calculated based on the END date of the range (most recent activity)
   */
  private async calculateActiveUserStats(
    communityId: number,
    startDate?: string,
    endDate?: string
  ): Promise<{ dailyActiveUsers: number; weeklyActiveUsers: number } | null> {
    try {
      console.log(`[AdminService] 👥 Starting active user stats calculation for community ${communityId}`);
      const dailyActiveUsers = new Set<number>();
      const weeklyActiveUsers = new Set<number>();

      // Calculate date ranges for daily/weekly based on the END of the selected period
      // This shows "how many users were active in the last day/week of the selected period"
      const periodEnd = endDate ? new Date(endDate) : new Date();
      const oneDayAgo = new Date(periodEnd);
      oneDayAgo.setUTCDate(oneDayAgo.getUTCDate() - 1);
      oneDayAgo.setUTCHours(0, 0, 0, 0);
      const oneWeekAgo = new Date(periodEnd);
      oneWeekAgo.setUTCDate(oneWeekAgo.getUTCDate() - 7);
      oneWeekAgo.setUTCHours(0, 0, 0, 0);
      
      console.log(`[AdminService] 👥 Date ranges: daily (>= ${oneDayAgo.toISOString()}), weekly (>= ${oneWeekAgo.toISOString()})`);

      // 1. Get users from matches
      try {
        // Get all matches (not filtered by date for daily/weekly calculation)
        const allMatches = await this.getMatchesForCommunity(communityId);
        console.log(`[AdminService] 👥 Found ${allMatches.length} matches for active user calculation`);
        
        allMatches.forEach((match: any) => {
          // Check if match is within last day/week
          const matchDate = match.createdAt || match.created_at;
          if (matchDate) {
            const matchTime = new Date(matchDate);
            if (matchTime >= oneDayAgo) {
              if (match.userId) dailyActiveUsers.add(match.userId);
              if (match.matchedUserId) dailyActiveUsers.add(match.matchedUserId);
            }
            if (matchTime >= oneWeekAgo) {
              if (match.userId) weeklyActiveUsers.add(match.userId);
              if (match.matchedUserId) weeklyActiveUsers.add(match.matchedUserId);
            }
          }
        });
        console.log(`[AdminService] 👥 After matches: ${dailyActiveUsers.size} daily, ${weeklyActiveUsers.size} weekly`);
      } catch (error) {
        console.warn('[AdminService] Could not get matches for active users:', error);
      }

      // 2. Get users from events
      try {
        const events = await this.getEventsForCommunity(communityId);
        console.log(`[AdminService] 👥 Found ${events.length} events for active user calculation`);
        
        events.forEach((event: any) => {
          // Event creator
          if (event.userId || event.createdBy) {
            const userId = event.userId || event.createdBy;
            
            const eventDate = event.startDate || event.startDateTimeUTC;
            if (eventDate) {
              const eventTime = new Date(eventDate);
              if (eventTime >= oneDayAgo) dailyActiveUsers.add(userId);
              if (eventTime >= oneWeekAgo) weeklyActiveUsers.add(userId);
            }
          }
          
          // Event attendees
          if (event.attendees && Array.isArray(event.attendees)) {
            event.attendees.forEach((attendee: any) => {
              const userId = attendee.id || attendee.userId || attendee;
              if (typeof userId === 'number') {
                const eventDate = event.startDate || event.startDateTimeUTC;
                if (eventDate) {
                  const eventTime = new Date(eventDate);
                  if (eventTime >= oneDayAgo) dailyActiveUsers.add(userId);
                  if (eventTime >= oneWeekAgo) weeklyActiveUsers.add(userId);
                }
              }
            });
          }
        });
        console.log(`[AdminService] 👥 After events: ${dailyActiveUsers.size} daily, ${weeklyActiveUsers.size} weekly`);
      } catch (error) {
        console.warn('[AdminService] Could not get events for active users:', error);
      }

      // 3. Get users from groups
      try {
        const groups = await this.getGroupsForCommunity(communityId);
        console.log(`[AdminService] 👥 Found ${groups.length} groups for active user calculation`);
        
        groups.forEach((group: any) => {
          if (group.users && Array.isArray(group.users)) {
            group.users.forEach((user: any) => {
              const userId = user.id || user.userId || user;
              if (typeof userId === 'number') {
                // Use group creation date or last activity
                const groupDate = group.updatedAt || group.createdAt;
                if (groupDate) {
                  const groupTime = new Date(groupDate);
                  if (groupTime >= oneDayAgo) dailyActiveUsers.add(userId);
                  if (groupTime >= oneWeekAgo) weeklyActiveUsers.add(userId);
                }
              }
            });
          }
        });
        console.log(`[AdminService] 👥 After groups: ${dailyActiveUsers.size} daily, ${weeklyActiveUsers.size} weekly`);
      } catch (error) {
        console.warn('[AdminService] Could not get groups for active users:', error);
      }

      // 4. Get users from messages (Firebase) - use conversation updatedAt for activity
      // Use cached conversation IDs to avoid redundant queries
      try {
        const firebase = useFirebase();
        const firestore = firebase.firestore;
        
        if (firestore) {
          const conversationIds = await this.getConversationsForCommunity(communityId);
          console.log(`[AdminService] 👥 Found ${conversationIds.size} conversations for active user calculation`);
          
          // Fetch conversation data in batches
          const batchSize = 10;
          const conversationIdsArray = Array.from(conversationIds);
          
          for (let i = 0; i < conversationIdsArray.length; i += batchSize) {
            const batch = conversationIdsArray.slice(i, i + batchSize);
            const batchPromises = batch.map(async (conversationId) => {
              try {
                const conversationDoc = await getDoc(doc(firestore, `messages/${conversationId}`));
                if (conversationDoc.exists()) {
                  const conversationData = conversationDoc.data();
                  
                  // Get users from conversation
                  if (conversationData.users && Array.isArray(conversationData.users)) {
                    // Check last message time for daily/weekly
                    const lastMessageTime = conversationData.updatedAt || conversationData.timestamp;
                    if (lastMessageTime) {
                      const msgTime = lastMessageTime.toMillis ? new Date(lastMessageTime.toMillis()) : new Date(lastMessageTime.seconds * 1000);
                      const isDailyActive = msgTime >= oneDayAgo;
                      const isWeeklyActive = msgTime >= oneWeekAgo;
                      
                      conversationData.users.forEach((userId: number) => {
                        if (isDailyActive) dailyActiveUsers.add(userId);
                        if (isWeeklyActive) weeklyActiveUsers.add(userId);
                      });
                    }
                  }
                }
              } catch (error) {
                console.debug(`[AdminService] Error fetching conversation ${conversationId}:`, error);
              }
            });
            
            await Promise.all(batchPromises);
          }
        }
        console.log(`[AdminService] 👥 After messages: ${dailyActiveUsers.size} daily, ${weeklyActiveUsers.size} weekly`);
      } catch (error) {
        console.warn('[AdminService] Could not get messages for active users:', error);
      }

      const stats = {
        dailyActiveUsers: dailyActiveUsers.size,
        weeklyActiveUsers: weeklyActiveUsers.size,
      };

      console.log(`[AdminService] 👥 Final active users: ${dailyActiveUsers.size} daily, ${weeklyActiveUsers.size} weekly`);
      return stats;
    } catch (error) {
      console.error('[AdminService] Error calculating active user stats:', error);
      return { dailyActiveUsers: 0, weeklyActiveUsers: 0 };
    }
  }

  /**
   * Get profile completion statistics
   */
  async getProfileCompletionStats(communityId: number): Promise<{ profileCompletionRate: number } | null> {
    try {
      const stats = await apiService.get<{ profileCompletionRate: number }>(`/communities/${communityId}/stats/profile-completion`);
      return stats;
    } catch (error: any) {
      if (error?.status === 404 || error?.response?.status === 404) {
        console.log(`[AdminService] Profile completion stats endpoint not found for community ${communityId}`);
        return null;
      }
      console.error('Failed to fetch profile completion stats:', error);
      return null;
    }
  }

  /**
   * Get match response statistics
   */
  async getMatchResponseStats(communityId: number, startDate?: string, endDate?: string): Promise<{ matchResponseRate: number; connectionsMade: number } | null> {
    try {
      let url = `/communities/${communityId}/stats/match-response`;
      if (startDate && endDate) {
        url += `?startDate=${startDate}&endDate=${endDate}`;
      }
      const stats = await apiService.get<{ matchResponseRate: number; connectionsMade: number }>(url);
      return stats;
    } catch (error: any) {
      if (error?.status === 404 || error?.response?.status === 404) {
        console.log(`[AdminService] Match response stats endpoint not found for community ${communityId}`);
        return null;
      }
      console.error('Failed to fetch match response stats:', error);
      return null;
    }
  }

  /**
   * Calculate match response rate (percentage of matches that led to conversations)
   * Uses cached conversation pairs for performance
   */
  private async calculateMatchResponseRate(
    communityId: number,
    matches: any[],
    startDate?: string,
    endDate?: string
  ): Promise<number> {
    try {
      if (!matches || matches.length === 0) {
        return 0;
      }

      // Use cached conversation pairs
      const conversationPairs = await this.getConversationPairs(communityId);

      // Count matches that have conversations
      let matchesWithConversations = 0;
      
      matches.forEach((match: any) => {
        const userId = match.userId;
        const matchedUserId = match.matchedUserId;
        
        if (userId && matchedUserId) {
          const pairKey = [userId, matchedUserId].sort((a, b) => a - b).join('-');
          if (conversationPairs.has(pairKey)) {
            matchesWithConversations++;
          }
        }
      });

      const responseRate = matches.length > 0 
        ? (matchesWithConversations / matches.length) * 100 
        : 0;

      console.log(`[AdminService] Match response rate: ${responseRate.toFixed(1)}% (${matchesWithConversations}/${matches.length} matches led to conversations)`);
      return responseRate;
    } catch (error) {
      console.error('[AdminService] Error calculating match response rate:', error);
      return 0;
    }
  }

  /**
   * Get cached conversation pairs for a community
   */
  private async getConversationPairs(communityId: number): Promise<Set<string>> {
    const cacheKey = `conversationPairs_${communityId}`;
    const cached = this.conversationsCache.get(cacheKey);
    
    if (cached && this.isCacheValid(cached.timestamp, this.FIREBASE_CACHE_TTL)) {
      console.log(`[AdminService] ✅ Using cached conversation pairs for community ${communityId}`);
      return cached.data as Set<string>;
    }

    const firebase = useFirebase();
    const firestore = firebase.firestore;
    
    if (!firestore) {
      return new Set<string>();
    }

    // Get conversation IDs first (cached)
    const conversationIds = await this.getConversationsForCommunity(communityId);
    
    if (conversationIds.size === 0) {
      return new Set<string>();
    }

    // Build set of user pairs that have conversations
    const conversationPairs = new Set<string>();
    
    // Fetch conversation data in batches (Firestore limit is 10 per batch)
    const batchSize = 10;
    const conversationIdsArray = Array.from(conversationIds);
    
    for (let i = 0; i < conversationIdsArray.length; i += batchSize) {
      const batch = conversationIdsArray.slice(i, i + batchSize);
      const batchPromises = batch.map(async (conversationId) => {
        try {
          const conversationDoc = await getDoc(doc(firestore, `messages/${conversationId}`));
          if (conversationDoc.exists()) {
            const conversationData = conversationDoc.data();
            if (conversationData.users && Array.isArray(conversationData.users) && conversationData.users.length >= 2) {
              const userIds = conversationData.users.filter((id: any) => typeof id === 'number');
              for (let i = 0; i < userIds.length; i++) {
                for (let j = i + 1; j < userIds.length; j++) {
                  const pairKey = [userIds[i], userIds[j]].sort((a, b) => a - b).join('-');
                  conversationPairs.add(pairKey);
                }
              }
            }
          }
        } catch (error) {
          console.debug(`[AdminService] Error fetching conversation ${conversationId}:`, error);
        }
      });
      
      await Promise.all(batchPromises);
    }

    // Cache the result
    this.conversationsCache.set(cacheKey, { data: conversationPairs, timestamp: Date.now() });
    return conversationPairs;
  }

  /**
   * Count how many matches led to conversations (helper for match engagement stats)
   * Uses cached conversation pairs for performance
   */
  private async countEngagedMatches(communityId: number, matches: any[]): Promise<number> {
    try {
      if (!matches || matches.length === 0) {
        return 0;
      }

      // Get cached conversation pairs
      const conversationPairs = await this.getConversationPairs(communityId);

      // Count matches that have conversations
      let engagedCount = 0;
      matches.forEach((match: any) => {
        const userId = match.userId;
        const matchedUserId = match.matchedUserId;
        
        if (userId && matchedUserId) {
          const pairKey = [userId, matchedUserId].sort((a, b) => a - b).join('-');
          if (conversationPairs.has(pairKey)) {
            engagedCount++;
          }
        }
      });

      return engagedCount;
    } catch (error) {
      console.warn('[AdminService] Error counting engaged matches:', error);
      return 0;
    }
  }

  /**
   * Count engaged matches by group_id (for multi-user matches)
   * A match group is "engaged" if any users in that group have a conversation
   */
  private async countEngagedMatchesByGroup(
    communityId: number, 
    allMatches: any[], 
    uniqueGroups: Set<number>
  ): Promise<number> {
    try {
      if (!allMatches || allMatches.length === 0 || uniqueGroups.size === 0) {
        return 0;
      }

      // Get cached conversation pairs
      const conversationPairs = await this.getConversationPairs(communityId);

      // Group matches by group_id and collect all user pairs in each group
      const groupsByUserPairs = new Map<number, Set<string>>();
      
      allMatches.forEach((match: any) => {
        const groupId = match.groupId || match.group_id || 
                       (match.matchIndicesId && match.matchIndicesId !== 0 ? match.matchIndicesId : null);
        
        if (groupId && uniqueGroups.has(groupId)) {
          const userId = match.userId || match.user_id;
          const matchedUserId = match.matchedUserId || match.matched_user_id;
          
          if (userId && matchedUserId) {
            if (!groupsByUserPairs.has(groupId)) {
              groupsByUserPairs.set(groupId, new Set<string>());
            }
            
            // Create normalized pair key
            const pairKey = [userId, matchedUserId].sort((a, b) => a - b).join('-');
            groupsByUserPairs.get(groupId)!.add(pairKey);
          }
        }
      });

      // Count groups where at least one user pair has a conversation
      let engagedGroups = 0;
      groupsByUserPairs.forEach((userPairs, groupId) => {
        // Check if any user pair in this group has a conversation
        const hasEngagement = Array.from(userPairs).some(pairKey => conversationPairs.has(pairKey));
        if (hasEngagement) {
          engagedGroups++;
        }
      });

      return engagedGroups;
    } catch (error) {
      console.warn('[AdminService] Error counting engaged matches by group:', error);
      return 0;
    }
  }

  /**
   * Get Trova-initiated chats count from Firebase
   * Counts conversations where messages contain "Trova" identifier
   * Includes: MPIM, Channel Breakout groups, Directory messages
   * Note: This query can be slow for large datasets, consider caching results
   */
  async getTrovaChatsCount(
    communityId: number,
    startDate?: string,
    endDate?: string
  ): Promise<number> {
    try {
      const firebase = useFirebase();
      const firestore = firebase.firestore;
      
      if (!firestore) {
        console.warn('[AdminService] Firestore not initialized, cannot query Trova chats');
        return 0;
      }

      console.log(`[AdminService] 💬 Starting Trova chats calculation for community ${communityId}`);
      const startTimestamp = startDate ? Timestamp.fromDate(new Date(startDate)) : null;
      const endTimestamp = endDate ? Timestamp.fromDate(new Date(endDate)) : null;

      // Use cached conversation IDs - only query conversations for this community
      const conversationIds = await this.getConversationsForCommunity(communityId);
      
      if (conversationIds.size === 0) {
        console.log(`[AdminService] 💬 No conversations found for community ${communityId}`);
        return 0;
      }

      const uniqueConversationIds = new Set<string>();
      const conversationIdsArray = Array.from(conversationIds);
      
      // Process conversations in batches to avoid overwhelming Firebase
      const batchSize = 10;
      console.log(`[AdminService] 💬 Checking ${conversationIdsArray.length} conversations for Trova messages in batches of ${batchSize}`);

      for (let i = 0; i < conversationIdsArray.length; i += batchSize) {
        const batch = conversationIdsArray.slice(i, i + batchSize);
        
        const batchPromises = batch.map(async (conversationId) => {
          try {
            const conversationDoc = await getDoc(doc(firestore, `messages/${conversationId}`));
            if (!conversationDoc.exists()) {
              return false;
            }
            
            const data = conversationDoc.data();
            
            // Check if conversation has Trova in lastMessage or messageTitle (fast check)
            const lastMessage = (data.lastMessage || '').toLowerCase();
            const messageTitle = (data.messageTitle || '').toLowerCase();
            
            if (lastMessage.includes('trova') || messageTitle.includes('trova')) {
              // Check date filters if provided
              if (startTimestamp || endTimestamp) {
                const createdAt = data.createdAt;
                if (createdAt) {
                  const created = createdAt.toMillis ? createdAt.toMillis() : createdAt.seconds * 1000;
                  const start = startTimestamp ? startTimestamp.toMillis() : 0;
                  const end = endTimestamp ? endTimestamp.toMillis() : Date.now();
                  
                  if (created >= start && created <= end) {
                    return true;
                  }
                }
              } else {
                return true;
              }
            }
            
            // If not found in conversation metadata, check messages subcollection
            try {
              const messagesSubcollection = collection(firestore, `messages/${conversationId}/conv`);
              const messagesQuery = startTimestamp && endTimestamp
                ? query(
                    messagesSubcollection,
                    where('timestamp', '>=', startTimestamp),
                    where('timestamp', '<=', endTimestamp)
                  )
                : query(messagesSubcollection);
              
              const messagesSnapshot = await getDocs(messagesQuery);
              
              for (const msgDoc of messagesSnapshot.docs) {
                const msgData = msgDoc.data();
                const messageText = (msgData.message || '').toLowerCase();
                
                if (messageText.includes('trova')) {
                  // If date filters were applied in query, message is already in range
                  if (startTimestamp && endTimestamp) {
                    return true;
                  }
                  // Otherwise check timestamp
                  const msgTimestamp = msgData.timestamp || msgData.createdAt;
                  if (msgTimestamp) {
                    const msgTime = msgTimestamp.toMillis ? msgTimestamp.toMillis() : msgTimestamp.seconds * 1000;
                    const start = startTimestamp ? startTimestamp.toMillis() : 0;
                    const end = endTimestamp ? endTimestamp.toMillis() : Date.now();
                    
                    if (msgTime >= start && msgTime <= end) {
                      return true;
                    }
                  } else {
                    return true; // No timestamp, include it
                  }
                }
              }
            } catch (subcollectionError) {
              console.debug(`[AdminService] Could not query subcollection for ${conversationId}:`, subcollectionError);
            }
            
            return false;
          } catch (error) {
            console.debug(`[AdminService] Error checking conversation ${conversationId}:`, error);
            return false;
          }
        });
        
        const batchResults = await Promise.all(batchPromises);
        batchResults.forEach((hasTrova, index) => {
          if (hasTrova) {
            uniqueConversationIds.add(batch[index]);
          }
        });
        
        // Log progress for large datasets
        if (conversationIdsArray.length > 50 && (i + batchSize) % 50 === 0) {
          console.log(`[AdminService] 💬 Processed ${Math.min(i + batchSize, conversationIdsArray.length)}/${conversationIdsArray.length} conversations`);
        }
      }

      console.log(`[AdminService] 💬 Found ${uniqueConversationIds.size} Trova-initiated chats for community ${communityId}`);
      return uniqueConversationIds.size;
    } catch (error: any) {
      console.error('[AdminService] Error querying Trova chats from Firebase:', error);
      // Return 0 on error to prevent blocking the UI
      return 0;
    }
  }

  /**
   * Get Trova chats statistics (wrapper for getTrovaChatsCount)
   */
  async getTrovaChats(communityId: number, startDate?: string, endDate?: string): Promise<{ trovaChatsStarted: number } | null> {
    try {
      const count = await this.getTrovaChatsCount(communityId, startDate, endDate);
      return { trovaChatsStarted: count };
    } catch (error) {
      console.error('Failed to fetch Trova chats:', error);
      return null;
    }
  }

  /**
   * Export data as CSV (for stats, users, etc.)
   */
  async exportData(communityId: number, dataType: string, startDate?: string, endDate?: string): Promise<Blob> {
    try {
      let url = `/communities/${communityId}/export/${dataType}`;
      if (startDate && endDate) {
        url += `?startDate=${startDate}&endDate=${endDate}`;
      }
      // Use axios directly for blob response
      const axios = (await import('axios')).default;
      const { environment } = await import('../environments/environment');
      const { useFirebase } = await import('../composables/useFirebase');
      const firebaseAuth = useFirebase();
      
      let headers: any = {};
      if (firebaseAuth.auth?.currentUser) {
        const token = await firebaseAuth.auth.currentUser.getIdToken();
        headers.Authorization = `Bearer ${token}`;
      }
      
      const response = await axios.get(`${environment.apiUrl}${url}`, {
        headers,
        responseType: 'blob',
        withCredentials: true,
      });
      return response.data;
    } catch (error) {
      console.error('Failed to export data:', error);
      throw error;
    }
  }

  /**
   * Download CSV file
   */
  downloadCSV(data: Blob, filename: string): void {
    const url = window.URL.createObjectURL(data);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  }

  /**
   * Get magic intros grouped by date ran
   * Returns an array of objects with date and stats for each magic intro run
   */
  async getMagicIntrosByDate(communityId: number, startDate?: string, endDate?: string): Promise<Array<{
    date: string; // ISO date string (YYYY-MM-DD)
    dateDisplay: string; // Formatted date for display
    totalPairings: number;
    engagedPairings: number;
    engagementRate: number;
  }>> {
    try {
      console.log(`[AdminService] ✨ Fetching magic intros by date for community ${communityId}`);
      
      // Get all Trova Magic matches
      const matches = await this.getMatchesForCommunity(communityId, startDate, endDate, 'trova_magic');
      
      if (!matches || matches.length === 0) {
        return [];
      }

      // Parse date range for filtering
      const start = startDate ? new Date(startDate) : null;
      const end = endDate ? new Date(endDate) : null;
      
      // Group matches by date (using createdAt or created_at)
      const matchesByDate = new Map<string, any[]>();
      let skippedInvalid = 0;
      let skippedOutOfRange = 0;
      
      matches.forEach((match) => {
        const createdAt = match.createdAt || match.created_at;
        if (!createdAt) {
          skippedInvalid++;
          return;
        }
        
        // Parse date - handle both ISO strings and timestamps
        let date: Date;
        if (typeof createdAt === 'string') {
          date = new Date(createdAt);
        } else if (createdAt.toDate) {
          // Firebase Timestamp
          date = createdAt.toDate();
        } else if (createdAt.seconds) {
          // Firebase Timestamp object
          date = new Date(createdAt.seconds * 1000);
        } else {
          date = new Date(createdAt);
        }
        
        // Validate date - skip if invalid
        if (isNaN(date.getTime())) {
          skippedInvalid++;
          console.warn(`[AdminService] Invalid date for match ${match.id}:`, createdAt);
          return;
        }
        
        // Filter by date range if provided
        if (start && date < start) {
          skippedOutOfRange++;
          return;
        }
        if (end && date > end) {
          skippedOutOfRange++;
          return;
        }
        
        // Get date string in YYYY-MM-DD format
        const dateStr = date.toISOString().split('T')[0];
        
        // Additional validation: ensure date string is valid (YYYY-MM-DD format)
        if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
          skippedInvalid++;
          console.warn(`[AdminService] Invalid date string format for match ${match.id}:`, dateStr);
          return;
        }
        
        if (!matchesByDate.has(dateStr)) {
          matchesByDate.set(dateStr, []);
        }
        matchesByDate.get(dateStr)!.push(match);
      });
      
      if (skippedInvalid > 0 || skippedOutOfRange > 0) {
        console.log(`[AdminService] ✨ Filtered ${matches.length} matches: ${skippedInvalid} invalid dates, ${skippedOutOfRange} out of range`);
      }

      // Get conversation pairs for engagement calculation
      const conversationPairs = await this.getConversationPairs(communityId);

      // Build result array with stats for each date
      const result: Array<{
        date: string;
        dateDisplay: string;
        totalPairings: number;
        engagedPairings: number;
        engagementRate: number;
      }> = [];

      for (const [dateStr, dateMatches] of matchesByDate.entries()) {
        const date = new Date(dateStr);
        const dateDisplay = date.toLocaleDateString('en-US', { 
          year: 'numeric', 
          month: 'long', 
          day: 'numeric' 
        });

        // Count unique user pairs (same logic as getMagicIntroPairings)
        // Deduplicate by unique user pairs - iterate through all matches and only keep first occurrence of each pair
        const uniquePairs = new Set<string>(); // Set of pair keys
        const pairEngagement = new Map<string, boolean>(); // pairKey -> isEngaged
        
        for (const match of dateMatches) {
          const userId = match.userId || match.user_id;
          const matchedUserId = match.matchedUserId || match.matched_user_id;
          
          if (!userId || !matchedUserId) {
            continue;
          }
          
          // Create normalized pair key (sorted IDs to handle A-B and B-A as same pair)
          const pairKey = [userId, matchedUserId].sort((a, b) => a - b).join('-');
          
          // Only count each unique pair once
          if (!uniquePairs.has(pairKey)) {
            uniquePairs.add(pairKey);
            
            // Check if this pair is engaged
            const isEngaged = conversationPairs.has(pairKey);
            pairEngagement.set(pairKey, isEngaged);
          }
        }

        // Count engaged pairs
        const engagedCount = Array.from(pairEngagement.values()).filter(engaged => engaged).length;

        const engagementRate = uniquePairs.size > 0 
          ? (engagedCount / uniquePairs.size) * 100 
          : 0;

        console.log(`[AdminService] Date ${dateStr}: ${uniquePairs.size} unique pairs, ${engagedCount} engaged (from ${dateMatches.length} matches)`);

        result.push({
          date: dateStr,
          dateDisplay,
          totalPairings: uniquePairs.size, // Count unique user pairs (matches detail view)
          engagedPairings: engagedCount,
          engagementRate: Math.round(engagementRate * 10) / 10, // Round to 1 decimal place
        });
      }

      // Sort by date descending (most recent first)
      result.sort((a, b) => b.date.localeCompare(a.date));

      // Check for suspiciously high counts (likely data issues)
      const suspiciousDates = result.filter(r => r.totalPairings > 1000);
      if (suspiciousDates.length > 0) {
        console.warn(`[AdminService] ⚠️ Found ${suspiciousDates.length} dates with >1000 pairings (possible data issue):`, 
          suspiciousDates.map(d => `${d.date}: ${d.totalPairings}`));
      }

      console.log(`[AdminService] ✨ Found ${result.length} magic intro dates, total pairings: ${result.reduce((sum, r) => sum + r.totalPairings, 0)}`);
      return result;
    } catch (error: any) {
      console.error('[AdminService] Error fetching magic intros by date:', error);
      return [];
    }
  }

  /**
   * Get pairings for a specific magic intro date
   * Returns an array of match objects with user details
   * Deduplicates pairings (normalizes user pairs) and fetches user names
   */
  async getMagicIntroPairings(
    communityId: number, 
    date: string, 
    startDate?: string, 
    endDate?: string
  ): Promise<any[]> {
    try {
      console.log(`[AdminService] ✨ Fetching pairings for magic intro date ${date}`);
      
      // Get all Trova Magic matches for the date range
      const matches = await this.getMatchesForCommunity(communityId, startDate, endDate, 'trova_magic');
      
      if (!matches || matches.length === 0) {
        return [];
      }

      // Filter matches for the specific date (using UTC to avoid timezone issues)
      const dateMatches = matches.filter((match) => {
        const createdAt = match.createdAt || match.created_at;
        if (!createdAt) return false;
        
        let matchDate: Date;
        if (typeof createdAt === 'string') {
          matchDate = new Date(createdAt);
        } else if (createdAt.toDate) {
          matchDate = createdAt.toDate();
        } else if (createdAt.seconds) {
          matchDate = new Date(createdAt.seconds * 1000);
        } else {
          matchDate = new Date(createdAt);
        }
        
        // Use UTC date string to avoid timezone issues
        const matchDateStr = matchDate.toISOString().split('T')[0];
        // Also handle date string that might be in YYYY-MM-DD format already
        const targetDateStr = date.includes('T') ? date.split('T')[0] : date;
        return matchDateStr === targetDateStr;
      });

      // Get conversation pairs to mark which pairings are engaged
      const conversationPairs = await this.getConversationPairs(communityId);

      // Deduplicate by unique user pairs - iterate through all matches and only keep first occurrence of each pair
      const seenPairs = new Map<string, any>(); // pairKey -> pairing object
      
      console.log(`[AdminService] Processing ${dateMatches.length} matches for date ${date}`);
      
      for (const match of dateMatches) {
        const userId = match.userId || match.user_id;
        const matchedUserId = match.matchedUserId || match.matched_user_id;
        
        if (!userId || !matchedUserId) {
          console.log(`[AdminService] Skipping match ${match.id} - missing userId or matchedUserId`);
          continue;
        }
        
        // Create normalized pair key (sorted IDs to handle A-B and B-A as same pair)
        const pairKey = [userId, matchedUserId].sort((a, b) => a - b).join('-');
        
        // Only add if we haven't seen this pair before
        if (!seenPairs.has(pairKey)) {
          const groupId = match.groupId || match.group_id || 
                         (match.matchIndicesId && match.matchIndicesId !== 0 ? match.matchIndicesId : null);
          
          // Check if this pair is engaged
          const isEngaged = conversationPairs.has(pairKey);
          
          seenPairs.set(pairKey, {
            ...match,
            id: `pair-${pairKey}`, // Use pair-based ID for uniqueness
            groupId: groupId,
            userId: userId,
            matchedUserId: matchedUserId,
            isEngaged,
          });
        } else {
          console.log(`[AdminService] Skipping duplicate pair ${pairKey} (users ${userId} and ${matchedUserId})`);
        }
      }

      // Convert to array - these are unique user pairs (deduplicated)
      const uniquePairings = Array.from(seenPairs.values());
      
      console.log(`[AdminService] Deduplicated to ${uniquePairings.length} unique pairings from ${dateMatches.length} matches`);

      // Collect all unique user IDs to fetch
      const userIdsToFetch = new Set<number>();
      uniquePairings.forEach(pairing => {
        if (pairing.userId) userIdsToFetch.add(pairing.userId);
        if (pairing.matchedUserId) userIdsToFetch.add(pairing.matchedUserId);
      });

      // Fetch user details
      const { userService } = await import('./user.service');
      const usersMap = await userService.getUsersByIds(Array.from(userIdsToFetch));

      // Enrich pairings with user data
      const enrichedPairings = uniquePairings.map((pairing) => {
        const user = usersMap.get(pairing.userId);
        const matchedUser = usersMap.get(pairing.matchedUserId);
        
        return {
          ...pairing,
          user: user ? {
            id: user.id,
            fname: user.fname,
            lname: user.lname,
            fullName: user.fullName || `${user.fname} ${user.lname}`,
            profilePicture: user.profilePicture,
          } : null,
          matchedUser: matchedUser ? {
            id: matchedUser.id,
            fname: matchedUser.fname,
            lname: matchedUser.lname,
            fullName: matchedUser.fullName || `${matchedUser.fname} ${matchedUser.lname}`,
            profilePicture: matchedUser.profilePicture,
          } : null,
        };
      });

      console.log(`[AdminService] ✨ Found ${enrichedPairings.length} unique pairings for date ${date} (deduplicated from ${dateMatches.length} matches)`);
      return enrichedPairings;
    } catch (error: any) {
      console.error('[AdminService] Error fetching magic intro pairings:', error);
      return [];
    }
  }

  /**
   * Get channel pairings by date
   * Similar to getMagicIntrosByDate but for channel_pairing matches
   */
  async getChannelPairingsByDate(communityId: number, startDate?: string, endDate?: string): Promise<Array<{
    date: string; // ISO date string (YYYY-MM-DD)
    dateDisplay: string; // Formatted date for display
    channelName?: string | null; // Channel name if all matches on this date share the same channel
    totalPairings: number;
    engagedPairings: number;
    engagementRate: number;
  }>> {
    try {
      console.log(`[AdminService] 🔗 Fetching channel pairings by date for community ${communityId}`);
      
      // Get all Channel Pairing matches
      const matches = await this.getMatchesForCommunity(communityId, startDate, endDate, 'channel_pairing');
      
      if (!matches || matches.length === 0) {
        return [];
      }

      // Parse date range for filtering
      const start = startDate ? new Date(startDate) : null;
      const end = endDate ? new Date(endDate) : null;
      
      // Group matches by date (using createdAt or created_at)
      const matchesByDate = new Map<string, any[]>();
      let skippedInvalid = 0;
      let skippedOutOfRange = 0;
      
      matches.forEach((match) => {
        const createdAt = match.createdAt || match.created_at;
        if (!createdAt) {
          skippedInvalid++;
          return;
        }
        
        // Parse date - handle both ISO strings and timestamps
        let date: Date;
        if (typeof createdAt === 'string') {
          date = new Date(createdAt);
        } else if (createdAt.toDate) {
          // Firebase Timestamp
          date = createdAt.toDate();
        } else if (createdAt.seconds) {
          // Firebase Timestamp object
          date = new Date(createdAt.seconds * 1000);
        } else {
          date = new Date(createdAt);
        }
        
        // Validate date - skip if invalid
        if (isNaN(date.getTime())) {
          skippedInvalid++;
          console.warn(`[AdminService] Invalid date for channel pairing match ${match.id}:`, createdAt);
          return;
        }
        
        // Filter by date range if provided
        if (start && date < start) {
          skippedOutOfRange++;
          return;
        }
        if (end && date > end) {
          skippedOutOfRange++;
          return;
        }
        
        // Get date string in YYYY-MM-DD format
        const dateStr = date.toISOString().split('T')[0];
        
        // Additional validation: ensure date string is valid (YYYY-MM-DD format)
        if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
          skippedInvalid++;
          console.warn(`[AdminService] Invalid date string format for channel pairing match ${match.id}:`, dateStr);
          return;
        }
        
        if (!matchesByDate.has(dateStr)) {
          matchesByDate.set(dateStr, []);
        }
        matchesByDate.get(dateStr)!.push(match);
      });
      
      if (skippedInvalid > 0 || skippedOutOfRange > 0) {
        console.log(`[AdminService] 🔗 Filtered ${matches.length} channel pairing matches: ${skippedInvalid} invalid dates, ${skippedOutOfRange} out of range`);
      }

      // Get conversation pairs for engagement calculation
      const conversationPairs = await this.getConversationPairs(communityId);

      // Build result array with stats for each date
      const result: Array<{
        date: string;
        dateDisplay: string;
        channelName?: string | null;
        totalPairings: number;
        engagedPairings: number;
        engagementRate: number;
      }> = [];

      for (const [dateStr, dateMatches] of matchesByDate.entries()) {
        const date = new Date(dateStr);
        const dateDisplay = date.toLocaleDateString('en-US', { 
          year: 'numeric', 
          month: 'long', 
          day: 'numeric' 
        });

        // Extract channel names from matches for this date
        const channelNames = new Set<string>();
        dateMatches.forEach((match) => {
          const channelName = match.channelName || 
                             match.channel_name || 
                             match.slackChannelName || 
                             match.slack_channel_name ||
                             match.channel?.name ||
                             match.slackChannel?.name ||
                             null;
          if (channelName) {
            channelNames.add(channelName);
          }
        });
        
        // If all matches have the same channel name, use it; otherwise null
        const channelName = channelNames.size === 1 ? Array.from(channelNames)[0] : null;

        // Count unique user pairs (same logic as getChannelPairingPairings)
        // Deduplicate by unique user pairs - iterate through all matches and only keep first occurrence of each pair
        const uniquePairs = new Set<string>(); // Set of pair keys
        const pairEngagement = new Map<string, boolean>(); // pairKey -> isEngaged
        
        let skippedWrongCommunity = 0;
        
        // First, filter by communityId to ensure we only process matches for this community
        const communityFilteredMatches = dateMatches.filter((match) => {
          const matchCommunityId = match.communityId || match.community_id;
          if (matchCommunityId && matchCommunityId !== communityId) {
            skippedWrongCommunity++;
            return false;
          }
          return true;
        });
        
        if (skippedWrongCommunity > 0) {
          console.warn(`[AdminService] ⚠️ Filtered out ${skippedWrongCommunity} channel pairing matches with wrong communityId (expected ${communityId}) for date ${dateStr}`);
        }
        
        console.log(`[AdminService] After community filter for ${dateStr}: ${communityFilteredMatches.length} matches (from ${dateMatches.length} total)`);
        
        for (const match of communityFilteredMatches) {
          const userId = match.userId || match.user_id;
          const matchedUserId = match.matchedUserId || match.matched_user_id;
          
          if (!userId || !matchedUserId) {
            continue;
          }
          
          // Create normalized pair key (sorted IDs to handle A-B and B-A as same pair)
          const pairKey = [userId, matchedUserId].sort((a, b) => a - b).join('-');
          
          // Only count each unique pair once
          if (!uniquePairs.has(pairKey)) {
            uniquePairs.add(pairKey);
            
            // Check if this pair is engaged
            const isEngaged = conversationPairs.has(pairKey);
            pairEngagement.set(pairKey, isEngaged);
          }
        }
        

        // Count engaged pairs
        const engagedCount = Array.from(pairEngagement.values()).filter(engaged => engaged).length;

        const engagementRate = uniquePairs.size > 0 
          ? (engagedCount / uniquePairs.size) * 100 
          : 0;


        result.push({
          date: dateStr,
          dateDisplay,
          channelName: channelName, // Add channel name to result
          totalPairings: uniquePairs.size, // Count unique user pairs (matches detail view)
          engagedPairings: engagedCount,
          engagementRate: Math.round(engagementRate * 10) / 10, // Round to 1 decimal place
        });
      }

      // Sort by date descending (most recent first)
      result.sort((a, b) => b.date.localeCompare(a.date));

      // Check for suspiciously high counts (likely data issues)
      const suspiciousDates = result.filter(r => r.totalPairings > 1000);
      if (suspiciousDates.length > 0) {
        console.warn(`[AdminService] ⚠️ Found ${suspiciousDates.length} channel pairing dates with >1000 pairings (possible data issue):`, 
          suspiciousDates.map(d => `${d.date}: ${d.totalPairings}`));
      }

      console.log(`[AdminService] 🔗 Found ${result.length} channel pairing dates, total pairings: ${result.reduce((sum, r) => sum + r.totalPairings, 0)}`);
      return result;
    } catch (error: any) {
      console.error('[AdminService] Error fetching channel pairings by date:', error);
      return [];
    }
  }

  /**
   * Get pairings for a specific channel pairing date
   * Returns an array of match objects with user details
   * Deduplicates pairings (normalizes user pairs) and fetches user names
   */
  async getChannelPairingPairings(
    communityId: number, 
    date: string, 
    startDate?: string, 
    endDate?: string
  ): Promise<any[]> {
    try {
      console.log(`[AdminService] 🔗 Fetching pairings for channel pairing date ${date}`);
      
      // Get all Channel Pairing matches for the date range
      const matches = await this.getMatchesForCommunity(communityId, startDate, endDate, 'channel_pairing');
      
      if (!matches || matches.length === 0) {
        return [];
      }

      // Filter matches for the specific date (using UTC to avoid timezone issues)
      const dateMatches = matches.filter((match) => {
        const createdAt = match.createdAt || match.created_at;
        if (!createdAt) return false;
        
        let matchDate: Date;
        if (typeof createdAt === 'string') {
          matchDate = new Date(createdAt);
        } else if (createdAt.toDate) {
          matchDate = createdAt.toDate();
        } else if (createdAt.seconds) {
          matchDate = new Date(createdAt.seconds * 1000);
        } else {
          matchDate = new Date(createdAt);
        }
        
        // Use UTC date string to avoid timezone issues
        const matchDateStr = matchDate.toISOString().split('T')[0];
        // Also handle date string that might be in YYYY-MM-DD format already
        const targetDateStr = date.includes('T') ? date.split('T')[0] : date;
        return matchDateStr === targetDateStr;
      });

      // Get conversation pairs to mark which pairings are engaged
      const conversationPairs = await this.getConversationPairs(communityId);

      // Deduplicate by unique user pairs - iterate through all matches and only keep first occurrence of each pair
      const seenPairs = new Map<string, any>(); // pairKey -> pairing object
      
      console.log(`[AdminService] Processing ${dateMatches.length} channel pairing matches for date ${date}`);
      
      // Log sample matches to inspect structure
      if (dateMatches.length > 0) {
        console.log(`[AdminService] Sample channel pairing match:`, {
          id: dateMatches[0].id,
          userId: dateMatches[0].userId,
          user_id: dateMatches[0].user_id,
          matchedUserId: dateMatches[0].matchedUserId,
          matched_user_id: dateMatches[0].matched_user_id,
          communityId: dateMatches[0].communityId,
          community_id: dateMatches[0].community_id,
          type: dateMatches[0].type,
          matchType: dateMatches[0].matchType,
          fullMatch: dateMatches[0]
        });
      }
      
      let skippedWrongCommunity = 0;
      
      // First, filter by communityId to ensure we only process matches for this community
      const communityFilteredMatches = dateMatches.filter((match) => {
        const matchCommunityId = match.communityId || match.community_id;
        if (matchCommunityId && matchCommunityId !== communityId) {
          skippedWrongCommunity++;
          return false;
        }
        return true;
      });
      
      if (skippedWrongCommunity > 0) {
        console.warn(`[AdminService] ⚠️ Filtered out ${skippedWrongCommunity} channel pairing matches with wrong communityId (expected ${communityId})`);
      }
      
      console.log(`[AdminService] After community filter: ${communityFilteredMatches.length} matches (from ${dateMatches.length} total)`);
      
      // Log first match to see what fields are available
      if (dateMatches.length > 0) {
        console.log(`[AdminService] 🔍 Sample channel pairing match structure:`, {
          keys: Object.keys(dateMatches[0]),
          sampleMatch: dateMatches[0],
          hasChannelName: !!dateMatches[0].channelName,
          hasChannel_name: !!dateMatches[0].channel_name,
          hasSlackChannelName: !!dateMatches[0].slackChannelName,
          hasSlack_channel_name: !!dateMatches[0].slack_channel_name,
          hasChannel: !!dateMatches[0].channel,
          hasSlackChannel: !!dateMatches[0].slackChannel,
          hasSlack_channel_id: !!dateMatches[0].slack_channel_id,
          hasSlackChannelId: !!dateMatches[0].slackChannelId,
          groupId: dateMatches[0].groupId || dateMatches[0].group_id
        });
      }
      
      for (const match of communityFilteredMatches) {
        const userId = match.userId || match.user_id;
        const matchedUserId = match.matchedUserId || match.matched_user_id;
        
        if (!userId || !matchedUserId) {
          console.log(`[AdminService] Skipping channel pairing match ${match.id} - missing userId or matchedUserId`);
          continue;
        }
        
        // Create normalized pair key (sorted IDs to handle A-B and B-A as same pair)
        const pairKey = [userId, matchedUserId].sort((a, b) => a - b).join('-');
        
        // Only add if we haven't seen this pair before
        if (!seenPairs.has(pairKey)) {
          const groupId = match.groupId || match.group_id || 
                         (match.matchIndicesId && match.matchIndicesId !== 0 ? match.matchIndicesId : null);
          
          // Extract channel name from original match data (before deduplication)
          const channelName = match.channelName || 
                             match.channel_name || 
                             match.slackChannelName || 
                             match.slack_channel_name ||
                             match.channel?.name ||
                             match.slackChannel?.name ||
                             null;
          
          // Check if this pair is engaged
          const isEngaged = conversationPairs.has(pairKey);
          
          seenPairs.set(pairKey, {
            ...match,
            id: `pair-${pairKey}`, // Use pair-based ID for uniqueness
            groupId: groupId,
            userId: userId,
            matchedUserId: matchedUserId,
            isEngaged,
            channelName: channelName, // Preserve channel name from original match
          });
        } else {
          console.log(`[AdminService] Skipping duplicate channel pairing pair ${pairKey} (users ${userId} and ${matchedUserId})`);
        }
      }
      
      
      // Convert to array - these are unique user pairs (deduplicated)
      const uniquePairings = Array.from(seenPairs.values());
      
      console.log(`[AdminService] Deduplicated to ${uniquePairings.length} unique channel pairing pairings from ${dateMatches.length} matches`);

      // Log first pairing to see what fields are available for channel name
      if (uniquePairings.length > 0) {
        console.log(`[AdminService] 🔍 Sample pairing structure for channel name extraction:`, {
          keys: Object.keys(uniquePairings[0]),
          samplePairing: uniquePairings[0],
          hasChannelName: !!uniquePairings[0].channelName,
          hasChannel_name: !!uniquePairings[0].channel_name,
          hasSlackChannelName: !!uniquePairings[0].slackChannelName,
          hasSlack_channel_name: !!uniquePairings[0].slack_channel_name,
          hasChannel: !!uniquePairings[0].channel,
          hasSlackChannel: !!uniquePairings[0].slackChannel,
          hasSlack_channel_id: !!uniquePairings[0].slack_channel_id,
          hasSlackChannelId: !!uniquePairings[0].slackChannelId,
          groupId: uniquePairings[0].groupId || uniquePairings[0].group_id
        });
      }

      // Collect all unique user IDs to fetch
      const userIdsToFetch = new Set<number>();
      uniquePairings.forEach(pairing => {
        if (pairing.userId) userIdsToFetch.add(pairing.userId);
        if (pairing.matchedUserId) userIdsToFetch.add(pairing.matchedUserId);
      });

      // Fetch user details
      const { userService } = await import('./user.service');
      const usersMap = await userService.getUsersByIds(Array.from(userIdsToFetch));

      // Enrich pairings with user data and channel name
      const enrichedPairings = uniquePairings.map((pairing) => {
        const user = usersMap.get(pairing.userId);
        const matchedUser = usersMap.get(pairing.matchedUserId);
        
        // Use channel name that was preserved from original match data during deduplication
        // If not found, check other possible field names as fallback
        const channelName = pairing.channelName || 
                           pairing.channel_name || 
                           pairing.slackChannelName || 
                           pairing.slack_channel_name ||
                           pairing.channel?.name ||
                           pairing.slackChannel?.name ||
                           null;
        
        return {
          ...pairing,
          channelName: channelName, // Add channel name to pairing
          user: user ? {
            id: user.id,
            fname: user.fname,
            lname: user.lname,
            fullName: user.fullName || `${user.fname} ${user.lname}`,
            profilePicture: user.profilePicture,
          } : null,
          matchedUser: matchedUser ? {
            id: matchedUser.id,
            fname: matchedUser.fname,
            lname: matchedUser.lname,
            fullName: matchedUser.fullName || `${matchedUser.fname} ${matchedUser.lname}`,
            profilePicture: matchedUser.profilePicture,
          } : null,
        };
      });

      console.log(`[AdminService] 🔗 Found ${enrichedPairings.length} unique channel pairing pairings for date ${date} (deduplicated from ${dateMatches.length} matches)`);
      return enrichedPairings;
    } catch (error: any) {
      console.error('[AdminService] Error fetching channel pairing pairings:', error);
      return [];
    }
  }

  /**
   * Get mentor/mentee matches by date
   * Similar to getMagicIntrosByDate but for mentor-mentee matches
   * Returns matches array and a flag indicating if backend issue was detected
   */
  async getMentorMenteeMatchesByDate(communityId: number, startDate?: string, endDate?: string): Promise<{
    matches: Array<{
      date: string; // ISO date string (YYYY-MM-DD)
      dateDisplay: string; // Formatted date for display
      totalPairings: number;
      engagedPairings: number;
      engagementRate: number;
    }>;
    hasBackendIssue: boolean; // True if backend endpoint doesn't return mentor/mentee matches
  }> {
    try {
      console.log(`[AdminService] 🎓 Fetching mentor/mentee matches by date for community ${communityId}`, {
        startDate,
        endDate
      });
      
      // Backend now supports 'mentor-mentee' and 'mentor_mentee' query parameters
      // The backend was updated to include mentor/mentee matches in the /communities/:id/matches endpoint
      // Try the primary supported types first, then fallback to variations
      const typeVariations = ['mentor-mentee', 'mentor_mentee', 'mentor-match', 'mentor_mentee_match'];
      let matches: any[] = [];
      let detectedBackendIssue = false;
      let uniqueTypes: Set<string> = new Set();
      
      for (const type of typeVariations) {
        console.log(`[AdminService] 🎓 Trying type: ${type}`);
        const typeMatches = await this.getMatchesForCommunity(communityId, startDate, endDate, type);
        if (typeMatches && typeMatches.length > 0) {
          console.log(`[AdminService] ✅ Found ${typeMatches.length} matches with type: ${type}`);
          matches = typeMatches;
          break;
        } else {
          console.log(`[AdminService] ⚠️ No matches found with type: ${type}`);
        }
      }
      
      // Fallback: If no matches found with type filter, try fetching all matches and filter client-side
      if (!matches || matches.length === 0) {
        console.log(`[AdminService] 🎓 No matches found with type filter, trying fallback: fetch all matches and filter client-side`);
        
        // First try with date range
        let allMatches = await this.getMatchesForCommunity(communityId, startDate, endDate);
        
        // Always try without date range as well (app might show all-time, and mentor/mentee matches might be older)
        // This is important because mentor/mentee matches might exist outside the selected date range
        console.log(`[AdminService] 🎓 Also fetching all-time matches (no date restrictions) to check for mentor/mentee matches outside date range`);
        const allTimeMatches = await this.getMatchesForCommunity(communityId);
        
        // Combine both sets and deduplicate by ID
        const allMatchesMap = new Map();
        if (allMatches) {
          allMatches.forEach(m => allMatchesMap.set(m.id, m));
        }
        if (allTimeMatches) {
          allTimeMatches.forEach(m => allMatchesMap.set(m.id, m));
        }
        allMatches = Array.from(allMatchesMap.values());
        
        console.log(`[AdminService] 🎓 Combined ${allMatches.length} total matches (${allMatches.length - (allTimeMatches?.length || 0)} from date range, ${allTimeMatches?.length || 0} from all-time)`);
        
        if (allMatches && allMatches.length > 0) {
          console.log(`[AdminService] 🎓 Fetched ${allMatches.length} total matches, filtering for mentor/mentee types...`);
          
          // DEBUG: Log unique type values to see what's actually in the data
          const uniqueMatchTypes = new Set<string>();
          const uniqueSubTypes = new Set<string>();
          allMatches.forEach((match: any) => {
            if (match.type) uniqueTypes.add(match.type);
            if (match.matchType) uniqueMatchTypes.add(match.matchType);
            if (match.sub_type || match.subType) uniqueSubTypes.add(match.sub_type || match.subType);
          });
          console.log(`[AdminService] 🎓 DEBUG: Found unique type values:`, Array.from(uniqueTypes));
          console.log(`[AdminService] 🎓 DEBUG: Found unique matchType values:`, Array.from(uniqueMatchTypes));
          console.log(`[AdminService] 🎓 DEBUG: Found unique sub_type values:`, Array.from(uniqueSubTypes));
          
          // Check if mentor/mentee types are present in the response
          // Note: Backend was updated to support mentor/mentee matches, but if they're still not found,
          // it might indicate a data issue or the matches are outside the date range
          const hasMentorMenteeTypes = Array.from(uniqueTypes).some(t => {
            const typeLower = t.toLowerCase();
            return typeLower.includes('mentor') || typeLower.includes('mentee');
          });
          
          if (Array.from(uniqueTypes).length > 0 && !hasMentorMenteeTypes) {
            // Only flag as backend issue if we have other types but no mentor/mentee types
            // This could also mean the matches are outside the date range or don't exist
            detectedBackendIssue = true;
            console.warn(`[AdminService] ⚠️ No mentor/mentee types found in response. Found types: ${Array.from(uniqueTypes).join(', ')}`);
            console.warn(`[AdminService] ⚠️ This might indicate: (1) No mentor/mentee matches in date range, (2) Backend filtering issue, or (3) Type mismatch`);
          }
          
          // Filter for mentor/mentee matches by checking the type field and sub_type field
          matches = allMatches.filter((match: any) => {
            const matchType = match.type || match.matchType;
            const subType = match.sub_type || match.subType;
            
            // Check type field
            if (matchType) {
              const typeLower = matchType.toLowerCase();
              if (typeLower.includes('mentor') || typeLower.includes('mentee')) {
                return true;
              }
            }
            
            // Check sub_type field (mentor/mentee matches might be identified by sub_type)
            if (subType) {
              const subTypeLower = subType.toLowerCase();
              if (subTypeLower.includes('mentor') || subTypeLower.includes('mentee')) {
                return true;
              }
            }
            
            return false;
          });
          console.log(`[AdminService] 🎓 Filtered to ${matches.length} mentor/mentee matches from ${allMatches.length} total matches`);
          
          // DEBUG: Log sample matches if found
          if (matches.length > 0) {
            console.log(`[AdminService] 🎓 DEBUG: Sample mentor/mentee match:`, matches[0]);
          } else {
            // Log a few sample matches to see their structure
            console.log(`[AdminService] 🎓 DEBUG: No mentor/mentee matches found. Sample matches:`, allMatches.slice(0, 3).map(m => ({
              id: m.id,
              type: m.type,
              matchType: m.matchType,
              sub_type: m.sub_type || m.subType,
              userId: m.userId,
              matchedUserId: m.matchedUserId
            })));
          }
        }
      }
      
      if (!matches || matches.length === 0) {
        console.warn(`[AdminService] ⚠️ No mentor/mentee matches found. Tried type variations: ${typeVariations.join(', ')} and client-side filtering`);
        // If we detected a backend issue (no mentor/mentee types in response), set the flag
        if (!detectedBackendIssue && uniqueTypes.size > 0) {
          detectedBackendIssue = !Array.from(uniqueTypes).some(t => t.toLowerCase().includes('mentor') || t.toLowerCase().includes('mentee'));
        }
        return {
          matches: [],
          hasBackendIssue: detectedBackendIssue
        };
      }
      
      console.log(`[AdminService] 🎓 Processing ${matches.length} mentor/mentee matches`);

      // Parse date range for filtering
      const start = startDate ? new Date(startDate) : null;
      const end = endDate ? new Date(endDate) : null;
      
      // Group matches by date (using createdAt or created_at)
      const matchesByDate = new Map<string, any[]>();
      let skippedInvalid = 0;
      let skippedOutOfRange = 0;
      
      matches.forEach((match) => {
        const createdAt = match.createdAt || match.created_at;
        if (!createdAt) {
          skippedInvalid++;
          return;
        }
        
        // Parse date - handle both ISO strings and timestamps
        let date: Date;
        if (typeof createdAt === 'string') {
          date = new Date(createdAt);
        } else if (createdAt.toDate) {
          // Firebase Timestamp
          date = createdAt.toDate();
        } else if (createdAt.seconds) {
          // Firebase Timestamp object
          date = new Date(createdAt.seconds * 1000);
        } else {
          date = new Date(createdAt);
        }
        
        // Validate date - skip if invalid
        if (isNaN(date.getTime())) {
          skippedInvalid++;
          console.warn(`[AdminService] Invalid date for mentor/mentee match ${match.id}:`, createdAt);
          return;
        }
        
        // Filter by date range if provided
        if (start && date < start) {
          skippedOutOfRange++;
          return;
        }
        if (end && date > end) {
          skippedOutOfRange++;
          return;
        }
        
        // Get date string in YYYY-MM-DD format
        const dateStr = date.toISOString().split('T')[0];
        
        // Additional validation: ensure date string is valid (YYYY-MM-DD format)
        if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
          skippedInvalid++;
          console.warn(`[AdminService] Invalid date string format for mentor/mentee match ${match.id}:`, dateStr);
          return;
        }
        
        if (!matchesByDate.has(dateStr)) {
          matchesByDate.set(dateStr, []);
        }
        matchesByDate.get(dateStr)!.push(match);
      });
      
      if (skippedInvalid > 0 || skippedOutOfRange > 0) {
        console.log(`[AdminService] 🎓 Filtered ${matches.length} mentor/mentee matches: ${skippedInvalid} invalid dates, ${skippedOutOfRange} out of range`);
      }

      // Get conversation pairs for engagement calculation
      const conversationPairs = await this.getConversationPairs(communityId);

      // Build result array with stats for each date
      const result: Array<{
        date: string;
        dateDisplay: string;
        totalPairings: number;
        engagedPairings: number;
        engagementRate: number;
      }> = [];

      for (const [dateStr, dateMatches] of matchesByDate.entries()) {
        const date = new Date(dateStr);
        const dateDisplay = date.toLocaleDateString('en-US', { 
          year: 'numeric', 
          month: 'long', 
          day: 'numeric' 
        });

        // Count unique user pairs (same logic as getMentorMenteeMatchPairings)
        const uniquePairs = new Set<string>(); // Set of pair keys
        const pairEngagement = new Map<string, boolean>(); // pairKey -> isEngaged
        
        let skippedWrongCommunity = 0;
        
        // First, filter by communityId to ensure we only process matches for this community
        const communityFilteredMatches = dateMatches.filter((match) => {
          const matchCommunityId = match.communityId || match.community_id;
          if (matchCommunityId && matchCommunityId !== communityId) {
            skippedWrongCommunity++;
            return false;
          }
          return true;
        });
        
        if (skippedWrongCommunity > 0) {
          console.warn(`[AdminService] ⚠️ Filtered out ${skippedWrongCommunity} mentor/mentee matches with wrong communityId (expected ${communityId}) for date ${dateStr}`);
        }
        
        console.log(`[AdminService] After community filter for ${dateStr}: ${communityFilteredMatches.length} matches (from ${dateMatches.length} total)`);
        
        for (const match of communityFilteredMatches) {
          const userId = match.userId || match.user_id;
          const matchedUserId = match.matchedUserId || match.matched_user_id;
          
          if (!userId || !matchedUserId) {
            continue;
          }
          
          // Create normalized pair key (sorted IDs to handle A-B and B-A as same pair)
          const pairKey = [userId, matchedUserId].sort((a, b) => a - b).join('-');
          
          // Only count each unique pair once
          if (!uniquePairs.has(pairKey)) {
            uniquePairs.add(pairKey);
            
            // Check if this pair is engaged
            const isEngaged = conversationPairs.has(pairKey);
            pairEngagement.set(pairKey, isEngaged);
          }
        }
        

        // Count engaged pairs
        const engagedCount = Array.from(pairEngagement.values()).filter(engaged => engaged).length;

        const engagementRate = uniquePairs.size > 0 
          ? (engagedCount / uniquePairs.size) * 100 
          : 0;

        console.log(`[AdminService] Mentor/Mentee Date ${dateStr}: ${uniquePairs.size} unique pairs, ${engagedCount} engaged (from ${dateMatches.length} matches)`);

        result.push({
          date: dateStr,
          dateDisplay,
          totalPairings: uniquePairs.size,
          engagedPairings: engagedCount,
          engagementRate: Math.round(engagementRate * 10) / 10,
        });
      }

      // Sort by date descending (most recent first)
      result.sort((a, b) => b.date.localeCompare(a.date));

      console.log(`[AdminService] 🎓 Found ${result.length} mentor/mentee match dates, total pairings: ${result.reduce((sum, r) => sum + r.totalPairings, 0)}`);
      return {
        matches: result,
        hasBackendIssue: detectedBackendIssue
      };
    } catch (error: any) {
      console.error('[AdminService] Error fetching mentor/mentee matches by date:', error);
      return {
        matches: [],
        hasBackendIssue: false
      };
    }
  }

  /**
   * Get list of users with their mentor/mentee match counts
   * Returns users sorted by match count (descending)
   */
  async getMentorMenteeUsersWithMatches(
    communityId: number,
    startDate?: string,
    endDate?: string
  ): Promise<Array<{
    userId: number;
    userName: string;
    matchCount: number;
  }>> {
    try {
      console.log(`[AdminService] 🎓 Fetching users with mentor/mentee matches for community ${communityId}`);
      
      // Fetch all mentor/mentee matches
      const typeVariations = ['mentor-mentee', 'mentor_mentee', 'mentor-match', 'mentor_mentee_match'];
      let matches: any[] = [];
      
      for (const type of typeVariations) {
        const typeMatches = await this.getMatchesForCommunity(communityId, startDate, endDate, type);
        if (typeMatches && typeMatches.length > 0) {
          console.log(`[AdminService] ✅ Found ${typeMatches.length} matches with type: ${type}`);
          matches = typeMatches;
          break;
        }
      }
      
      // Fallback: fetch all matches and filter client-side
      if (!matches || matches.length === 0) {
        const allMatches = await this.getMatchesForCommunity(communityId, startDate, endDate);
        if (allMatches && allMatches.length > 0) {
          matches = allMatches.filter((match: any) => {
            const matchType = match.type || match.matchType;
            const subType = match.sub_type || match.subType;
            if (matchType) {
              const typeLower = matchType.toLowerCase();
              if (typeLower.includes('mentor') || typeLower.includes('mentee')) {
                return true;
              }
            }
            if (subType) {
              const subTypeLower = subType.toLowerCase();
              if (subTypeLower.includes('mentor') || subTypeLower.includes('mentee')) {
                return true;
              }
            }
            return false;
          });
        }
      }
      
      if (!matches || matches.length === 0) {
        console.warn(`[AdminService] ⚠️ No mentor/mentee matches found`);
        return [];
      }
      
      // Filter by communityId
      const validMatches = matches.filter((match: any) => {
        return match.communityId === communityId;
      });
      
      // Count matches per user
      const userMatchCounts = new Map<number, number>();
      validMatches.forEach((match: any) => {
        const userId = match.userId || match.user_id;
        if (userId) {
          userMatchCounts.set(userId, (userMatchCounts.get(userId) || 0) + 1);
        }
      });
      
      // Fetch user names
      const userIds = Array.from(userMatchCounts.keys());
      const { userService } = await import('./user.service');
      const userMap = await userService.getUsersByIds(userIds);
      
      // Build result array
      const result = Array.from(userMatchCounts.entries())
        .map(([userId, matchCount]) => {
          const user = userMap.get(userId);
          const userName = user ? (user.fullName || `${user.fname || ''} ${user.lname || ''}`.trim() || `User ${userId}`) : `User ${userId}`;
          return {
            userId,
            userName,
            matchCount
          };
        })
        .sort((a, b) => b.matchCount - a.matchCount); // Sort by match count descending
      
      console.log(`[AdminService] 🎓 Found ${result.length} users with mentor/mentee matches`);
      return result;
    } catch (error: any) {
      console.error('[AdminService] Error fetching users with mentor/mentee matches:', error);
      return [];
    }
  }

  /**
   * Get all mentor/mentee matches for a specific user
   * Returns matches with the matched user details and mentor/mentee roles
   */
  async getMentorMenteeMatchesForUser(
    communityId: number,
    userId: number,
    startDate?: string,
    endDate?: string
  ): Promise<Array<{
    id: number;
    matchedUserId: number;
    matchedUserName: string;
    createdAt: string;
    subType?: string;
    userWasMentor: boolean;
    userWasMentee: boolean;
  }>> {
    try {
      console.log(`[AdminService] 🎓 Fetching mentor/mentee matches for user ${userId}`);
      
      // Fetch all mentor/mentee matches
      const typeVariations = ['mentor-mentee', 'mentor_mentee', 'mentor-match', 'mentor_mentee_match'];
      let matches: any[] = [];
      
      for (const type of typeVariations) {
        const typeMatches = await this.getMatchesForCommunity(communityId, startDate, endDate, type);
        if (typeMatches && typeMatches.length > 0) {
          matches = typeMatches;
          break;
        }
      }
      
      // Fallback: fetch all matches and filter client-side
      if (!matches || matches.length === 0) {
        const allMatches = await this.getMatchesForCommunity(communityId, startDate, endDate);
        if (allMatches && allMatches.length > 0) {
          matches = allMatches.filter((match: any) => {
            const matchType = match.type || match.matchType;
            const subType = match.sub_type || match.subType;
            if (matchType) {
              const typeLower = matchType.toLowerCase();
              if (typeLower.includes('mentor') || typeLower.includes('mentee')) {
                return true;
              }
            }
            if (subType) {
              const subTypeLower = subType.toLowerCase();
              if (subTypeLower.includes('mentor') || subTypeLower.includes('mentee')) {
                return true;
              }
            }
            return false;
          });
        }
      }
      
      if (!matches || matches.length === 0) {
        return [];
      }
      
      // Filter matches for this specific user
      const userMatches = matches.filter((match: any) => {
        const matchUserId = match.userId || match.user_id;
        const matchedUserId = match.matchedUserId || match.matched_user_id || match.otherUserId || match.other_user_id;
        return matchUserId === userId && 
               matchedUserId &&
               match.communityId === communityId;
      });
      
      // Get matched user IDs and fetch their names
      const matchedUserIds = [...new Set(userMatches.map((m: any) => 
        m.matchedUserId || m.matched_user_id || m.otherUserId || m.other_user_id
      ).filter(Boolean))];
      const { userService } = await import('./user.service');
      const matchedUserMap = await userService.getUsersByIds(matchedUserIds);
      
      // Build result array with mentor/mentee role information
      const result = userMatches.map((match: any) => {
        const matchedUserId = match.matchedUserId || match.matched_user_id || match.otherUserId || match.other_user_id;
        const matchedUser = matchedUserMap.get(matchedUserId);
        const matchedUserName = matchedUser ? (matchedUser.fullName || `${matchedUser.fname || ''} ${matchedUser.lname || ''}`.trim() || `User ${matchedUserId}`) : `User ${matchedUserId}`;
        
        // Determine if the user (userId) was the mentor or mentee based on sub_type
        // sub_type values: 'mentor-did-not-request', 'mentor-that-requested' indicate the user is the mentor
        // Based on the SQL query pattern, these sub_types mean the user (userId) was the mentor
        const subType = match.sub_type || match.subType || '';
        const subTypeLower = subType.toLowerCase();
        
        // Check if user was mentor based on sub_type
        // These specific sub_types indicate the user was the mentor
        const userWasMentor = subTypeLower.includes('mentor-did-not-request') || 
                              subTypeLower.includes('mentor-that-requested');
        
        // If not clearly a mentor, assume mentee (or check for explicit mentee indicators)
        const userWasMentee = !userWasMentor;
        
        return {
          id: match.id,
          matchedUserId,
          matchedUserName,
          createdAt: match.createdAt || match.created_at,
          subType: subType,
          userWasMentor: userWasMentor, // true if the selected user was the mentor
          userWasMentee: userWasMentee // true if the selected user was the mentee
        };
      }).sort((a, b) => {
        // Sort by date descending (most recent first)
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
      
      console.log(`[AdminService] 🎓 Found ${result.length} mentor/mentee matches for user ${userId}`);
      return result;
    } catch (error: any) {
      console.error('[AdminService] Error fetching mentor/mentee matches for user:', error);
      return [];
    }
  }

  /**
   * Get all users with their connection counts
   * Counts from each person's perspective (A→B and B→A are separate)
   */
  async getUsersWithConnections(
    communityId: number,
    startDate?: string,
    endDate?: string
  ): Promise<Array<{
    userId: number;
    userName: string;
    connectionCount: number;
  }>> {
    try {
      console.log(`[AdminService] 🔗 Fetching users with connections for community ${communityId}`);
      
      // Fetch all matches (excluding mentor/mentee which are handled separately)
      const allMatches = await this.getMatchesForCommunity(communityId, startDate, endDate);
      
      if (!allMatches || allMatches.length === 0) {
        console.warn(`[AdminService] ⚠️ No matches found`);
        return [];
      }
      
      // Filter out mentor/mentee matches (they're tracked separately)
      const validMatches = allMatches.filter((match: any) => {
        const userId = match.userId || match.user_id;
        const matchedUserId = match.matchedUserId || match.matched_user_id || match.otherUserId || match.other_user_id;
        const matchType = (match.type || match.matchType || '').toLowerCase();
        
        // Exclude mentor/mentee matches (they're tracked separately)
        if (matchType.includes('mentor') || matchType.includes('mentee')) {
          return false;
        }
        
        // Only require valid user IDs (not null/undefined) and matching community
        return userId && matchedUserId && match.communityId === communityId;
      });
      
      // Count unique connections per user (from each person's perspective)
      // A→B counts as 1 for A, B→A counts as 1 for B
      // For group matches (channel pairings), deduplicate by group_id to avoid counting the same connection multiple times
      const userConnections = new Map<number, Set<number>>();
      
      // First, group matches by group_id to handle channel pairings correctly
      const matchesByGroup = new Map<string | number, any[]>();
      const matchesWithoutGroup: any[] = [];
      
      validMatches.forEach((match: any) => {
        const groupId = match.groupId || match.group_id || 
                       (match.matchIndicesId && match.matchIndicesId !== 0 ? match.matchIndicesId : null);
        
        if (groupId !== null && groupId !== undefined) {
          const groupKey = String(groupId);
          if (!matchesByGroup.has(groupKey)) {
            matchesByGroup.set(groupKey, []);
          }
          matchesByGroup.get(groupKey)!.push(match);
        } else {
          matchesWithoutGroup.push(match);
        }
      });
      
      // Process group matches: collect all unique users in each group, then count connections
      matchesByGroup.forEach((groupMatches) => {
        const usersInGroup = new Set<number>();
        groupMatches.forEach((match: any) => {
          const userId = match.userId || match.user_id;
          const matchedUserId = match.matchedUserId || match.matched_user_id || match.otherUserId || match.other_user_id;
          if (userId) usersInGroup.add(userId);
          if (matchedUserId) usersInGroup.add(matchedUserId);
        });
        
        // For each user in the group, add connections to all other users in the group
        const usersArray = Array.from(usersInGroup);
        usersArray.forEach((userId) => {
          if (!userConnections.has(userId)) {
            userConnections.set(userId, new Set());
          }
          usersArray.forEach((otherUserId) => {
            if (userId !== otherUserId) {
              userConnections.get(userId)!.add(otherUserId);
            }
          });
        });
      });
      
      // Process matches without groups (1-to-1 matches like trova_magic)
      matchesWithoutGroup.forEach((match: any) => {
        const userId = match.userId || match.user_id;
        const matchedUserId = match.matchedUserId || match.matched_user_id || match.otherUserId || match.other_user_id;
        
        if (userId && matchedUserId) {
          // Count from userId's perspective (userId → matchedUserId)
          if (!userConnections.has(userId)) {
            userConnections.set(userId, new Set());
          }
          userConnections.get(userId)!.add(matchedUserId);
          
          // Count from matchedUserId's perspective (matchedUserId → userId)
          if (!userConnections.has(matchedUserId)) {
            userConnections.set(matchedUserId, new Set());
          }
          userConnections.get(matchedUserId)!.add(userId);
        }
      });
      
      // Fetch user names in batches to reduce network noise
      const userIds = Array.from(userConnections.keys());
      const { userService } = await import('./user.service');
      
      // Batch user fetches in chunks of 50 to reduce network noise
      const BATCH_SIZE = 50;
      const userMap = new Map<number, any>();
      
      for (let i = 0; i < userIds.length; i += BATCH_SIZE) {
        const batch = userIds.slice(i, i + BATCH_SIZE);
        const batchResults = await userService.getUsersByIds(batch);
        batchResults.forEach((user, userId) => {
          userMap.set(userId, user);
        });
      }
      
      // Build result array
      const result = Array.from(userConnections.entries())
        .map(([userId, connectionsSet]) => {
          const user = userMap.get(userId);
          const userName = user ? (user.fullName || `${user.fname || ''} ${user.lname || ''}`.trim() || `User ${userId}`) : `User ${userId}`;
          return {
            userId,
            userName,
            connectionCount: connectionsSet.size
          };
        })
        .filter(user => user.connectionCount > 0) // Only include users with connections
        .sort((a, b) => b.connectionCount - a.connectionCount); // Sort by connection count descending
      
      console.log(`[AdminService] 🔗 Found ${result.length} users with connections`);
      return result;
    } catch (error: any) {
      console.error('[AdminService] Error fetching users with connections:', error);
      return [];
    }
  }

  /**
   * Get all connections for a specific user
   * Returns the list of people this user connected with
   */
  async getConnectionsForUser(
    communityId: number,
    userId: number,
    startDate?: string,
    endDate?: string
  ): Promise<Array<{
    id: number;
    connectedUserId: number;
    connectedUserName: string;
    createdAt: string;
    matchType?: string;
  }>> {
    try {
      console.log(`[AdminService] 🔗 Fetching connections for user ${userId}`);
      
      // Fetch all matches
      const allMatches = await this.getMatchesForCommunity(communityId, startDate, endDate);
      
      if (!allMatches || allMatches.length === 0) {
        return [];
      }
      
      // Filter matches where this user is involved
      const userMatches = allMatches.filter((match: any) => {
        const matchUserId = match.userId || match.user_id;
        const matchMatchedUserId = match.matchedUserId || match.matched_user_id || match.otherUserId || match.other_user_id;
        const matchType = (match.type || match.matchType || '').toLowerCase();
        
        // Exclude mentor/mentee matches
        if (matchType.includes('mentor') || matchType.includes('mentee')) {
          return false;
        }
        
        // Check if this user is involved
        const isUserInvolved = (matchUserId === userId || matchMatchedUserId === userId);
        
        return isUserInvolved &&
               matchUserId &&
               matchMatchedUserId &&
               match.communityId === communityId;
      });
      
      // Get unique connected users (deduplicate by user ID, keep earliest match)
      const connectedUsersMap = new Map<number, any>();
      
      userMatches.forEach((match: any) => {
        const matchUserId = match.userId || match.user_id;
        const matchMatchedUserId = match.matchedUserId || match.matched_user_id || match.otherUserId || match.other_user_id;
        const connectedUserId = matchUserId === userId ? matchMatchedUserId : matchUserId;
        
        if (connectedUserId && connectedUserId !== userId) {
          // Keep the earliest match for each connection
          if (!connectedUsersMap.has(connectedUserId)) {
            connectedUsersMap.set(connectedUserId, match);
          } else {
            const existingMatch = connectedUsersMap.get(connectedUserId);
            const existingDate = new Date(existingMatch.createdAt || existingMatch.created_at || 0);
            const currentDate = new Date(match.createdAt || match.created_at || 0);
            if (currentDate < existingDate) {
              connectedUsersMap.set(connectedUserId, match);
            }
          }
        }
      });
      
      // Fetch user details for connected users in batches to reduce network noise
      const connectedUserIds = Array.from(connectedUsersMap.keys());
      const { userService } = await import('./user.service');
      
      // Batch user fetches in chunks of 50 to reduce network noise
      const BATCH_SIZE = 50;
      const userMap = new Map<number, any>();
      
      for (let i = 0; i < connectedUserIds.length; i += BATCH_SIZE) {
        const batch = connectedUserIds.slice(i, i + BATCH_SIZE);
        const batchResults = await userService.getUsersByIds(batch);
        batchResults.forEach((user, userId) => {
          userMap.set(userId, user);
        });
      }
      
      // Build result array
      const result = Array.from(connectedUsersMap.entries())
        .map(([connectedUserId, match]) => {
          const user = userMap.get(connectedUserId);
          const connectedUserName = user ? (user.fullName || `${user.fname || ''} ${user.lname || ''}`.trim() || `User ${connectedUserId}`) : `User ${connectedUserId}`;
          return {
            id: match.id || `connection-${userId}-${connectedUserId}`,
            connectedUserId,
            connectedUserName,
            createdAt: match.createdAt || match.created_at || '',
            matchType: match.type || match.matchType
          };
        })
        .sort((a, b) => {
          // Sort by date (most recent first)
          const dateA = new Date(a.createdAt).getTime();
          const dateB = new Date(b.createdAt).getTime();
          return dateB - dateA;
        });
      
      console.log(`[AdminService] 🔗 Found ${result.length} connections for user ${userId}`);
      return result;
    } catch (error: any) {
      console.error('[AdminService] Error fetching connections for user:', error);
      return [];
    }
  }

  /**
   * Get pairings for a specific mentor/mentee match date
   * Returns an array of match objects with user details
   * Deduplicates pairings (normalizes user pairs) and fetches user names
   * @deprecated - Use getMentorMenteeUsersWithMatches and getMentorMenteeMatchesForUser instead
   */
  async getMentorMenteeMatchPairings(
    communityId: number, 
    date: string, 
    startDate?: string, 
    endDate?: string
  ): Promise<any[]> {
    try {
      console.log(`[AdminService] 🎓 Fetching pairings for mentor/mentee match date ${date}`);
      
      // Backend now supports 'mentor-mentee' and 'mentor_mentee' query parameters
      // Try the primary supported types first, then fallback to variations
      const typeVariations = ['mentor-mentee', 'mentor_mentee', 'mentor-match', 'mentor_mentee_match'];
      let matches: any[] = [];
      
      for (const type of typeVariations) {
        const typeMatches = await this.getMatchesForCommunity(communityId, startDate, endDate, type);
        if (typeMatches && typeMatches.length > 0) {
          console.log(`[AdminService] ✅ Found ${typeMatches.length} matches with type: ${type}`);
          matches = typeMatches;
          break;
        }
      }
      
      // Fallback: If no matches found with type filter, try fetching all matches and filter client-side
      if (!matches || matches.length === 0) {
        console.log(`[AdminService] 🎓 No matches found with type filter, trying fallback: fetch all matches and filter client-side`);
        const allMatches = await this.getMatchesForCommunity(communityId, startDate, endDate);
        if (allMatches && allMatches.length > 0) {
          // Filter for mentor/mentee matches by checking the type field and sub_type field
          matches = allMatches.filter((match: any) => {
            const matchType = match.type || match.matchType;
            const subType = match.sub_type || match.subType;
            
            // Check type field
            if (matchType) {
              const typeLower = matchType.toLowerCase();
              if (typeLower.includes('mentor') || typeLower.includes('mentee')) {
                return true;
              }
            }
            
            // Check sub_type field (mentor/mentee matches might be identified by sub_type)
            if (subType) {
              const subTypeLower = subType.toLowerCase();
              if (subTypeLower.includes('mentor') || subTypeLower.includes('mentee')) {
                return true;
              }
            }
            
            return false;
          });
          console.log(`[AdminService] 🎓 Filtered to ${matches.length} mentor/mentee matches from ${allMatches.length} total matches`);
        }
      }
      
      if (!matches || matches.length === 0) {
        console.warn(`[AdminService] ⚠️ No mentor/mentee matches found with any type variation or client-side filtering`);
        return [];
      }

      // Filter matches for the specific date
      const dateMatches = matches.filter((match) => {
        const createdAt = match.createdAt || match.created_at;
        if (!createdAt) return false;
        
        let matchDate: Date;
        if (typeof createdAt === 'string') {
          matchDate = new Date(createdAt);
        } else if (createdAt.toDate) {
          matchDate = createdAt.toDate();
        } else if (createdAt.seconds) {
          matchDate = new Date(createdAt.seconds * 1000);
        } else {
          matchDate = new Date(createdAt);
        }
        
        const matchDateStr = matchDate.toISOString().split('T')[0];
        const targetDateStr = date.includes('T') ? date.split('T')[0] : date;
        return matchDateStr === targetDateStr;
      });

      // Get conversation pairs to mark which pairings are engaged
      const conversationPairs = await this.getConversationPairs(communityId);

      // Deduplicate by unique user pairs
      const seenPairs = new Map<string, any>();
      
      console.log(`[AdminService] Processing ${dateMatches.length} mentor/mentee matches for date ${date}`);
      
      let skippedWrongCommunity = 0;
      
      // First, filter by communityId
      const communityFilteredMatches = dateMatches.filter((match) => {
        const matchCommunityId = match.communityId || match.community_id;
        if (matchCommunityId && matchCommunityId !== communityId) {
          skippedWrongCommunity++;
          return false;
        }
        return true;
      });
      
      if (skippedWrongCommunity > 0) {
        console.warn(`[AdminService] ⚠️ Filtered out ${skippedWrongCommunity} mentor/mentee matches with wrong communityId (expected ${communityId})`);
      }
      
      console.log(`[AdminService] After community filter: ${communityFilteredMatches.length} matches (from ${dateMatches.length} total)`);
      
      for (const match of communityFilteredMatches) {
        const userId = match.userId || match.user_id;
        const matchedUserId = match.matchedUserId || match.matched_user_id;
        
        if (!userId || !matchedUserId) {
          continue;
        }
        
        // Create normalized pair key
        const pairKey = [userId, matchedUserId].sort((a, b) => a - b).join('-');
        
        // Only add if we haven't seen this pair before
        if (!seenPairs.has(pairKey)) {
          const isEngaged = conversationPairs.has(pairKey);
          
          seenPairs.set(pairKey, {
            ...match,
            id: `pair-${pairKey}`,
            userId: userId,
            matchedUserId: matchedUserId,
            isEngaged,
          });
        }
      }
      
      
      // Convert to array
      const uniquePairings = Array.from(seenPairs.values());
      
      console.log(`[AdminService] Deduplicated to ${uniquePairings.length} unique mentor/mentee pairings from ${dateMatches.length} matches`);

      // Collect all unique user IDs to fetch
      const userIdsToFetch = new Set<number>();
      uniquePairings.forEach(pairing => {
        if (pairing.userId) userIdsToFetch.add(pairing.userId);
        if (pairing.matchedUserId) userIdsToFetch.add(pairing.matchedUserId);
      });

      // Fetch user details
      const { userService } = await import('./user.service');
      const usersMap = await userService.getUsersByIds(Array.from(userIdsToFetch));

      // Enrich pairings with user data
      const enrichedPairings = uniquePairings.map((pairing) => {
        const user = usersMap.get(pairing.userId);
        const matchedUser = usersMap.get(pairing.matchedUserId);
        
        return {
          ...pairing,
          user: user ? {
            id: user.id,
            fname: user.fname,
            lname: user.lname,
            fullName: user.fullName || `${user.fname} ${user.lname}`,
            profilePicture: user.profilePicture,
          } : null,
          matchedUser: matchedUser ? {
            id: matchedUser.id,
            fname: matchedUser.fname,
            lname: matchedUser.lname,
            fullName: matchedUser.fullName || `${matchedUser.fname} ${matchedUser.lname}`,
            profilePicture: matchedUser.profilePicture,
          } : null,
        };
      });

      console.log(`[AdminService] 🎓 Found ${enrichedPairings.length} unique mentor/mentee pairings for date ${date} (deduplicated from ${dateMatches.length} matches)`);
      return enrichedPairings;
    } catch (error: any) {
      console.error('[AdminService] Error fetching mentor/mentee match pairings:', error);
      return [];
    }
  }
}

export const adminService = new AdminService();








