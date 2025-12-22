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
  skills?: string[];
  [key: string]: any;
}

export interface AttributeModel {
  name: string;
  value: number;
}

export interface PaginatedUsersResult {
  data: CommunityMember[];
  total: number;
  page: number;
  pageSize: number;
}

export interface DrilldownQuery {
  metric: string; // e.g., interest, activity, businessTopic, skill, customField
  value: string;
  page?: number;
  pageSize?: number;
  search?: string;
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
  onlyActive?: boolean;
  skillType?: string; // general | mentor | mentee
  customFieldId?: number;
  useCache?: boolean;
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
  cityStateCountry?: string; // Location distribution (could be a summary)
  
  // Engagement Attribution
  trovaMagicEngagements?: number; // Engagements from Trova Magic
  channelPairingOnDemand?: number; // Channel pairing on-demand engagements
  channelPairingCadence?: number; // Channel pairing cadence engagements
  
  // Skills Metrics (from All Skills report)
  totalSkills?: number; // Total unique skills in community
  usersWithSkills?: number; // Users who have at least one skill
  usersCanMentor?: number; // Users who can mentor
  usersWantMentor?: number; // Users who want to be mentored
  
  // Match Metrics (from Matches report)
  trovaMagicMatches?: number; // Trova Magic matches
  channelPairingMatches?: number; // Channel Pairing matches
  allMatchesEngaged?: number; // Matches where all users engaged
  matchEngagementRate?: number; // Percentage of matches that led to engagement
  connectionsPerUser?: Array<{ userId: number; fullName: string; email?: string; count: number; profilePicture?: string }>;
  
  // Channel Pairing Metrics
  channelPairingGroups?: number; // Channel pairing groups created
  channelPairingUsers?: number; // Users in channel pairing groups
  
  [key: string]: any;
}

export class AdminService {
  // Cache for expensive operations
  private matchesCache = new Map<string, { data: any[]; timestamp: number }>();
  private conversationsCache = new Map<string, { data: any; timestamp: number }>();
  private drilldownCache = new Map<string, { value: PaginatedUsersResult; timestamp: number }>();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes
  private readonly FIREBASE_CACHE_TTL = 10 * 60 * 1000; // 10 minutes for Firebase queries
  private readonly DRILLDOWN_CACHE_TTL = 2 * 60 * 1000; // 2 minutes for drilldown lists
  
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
   * Cache key for drilldown queries
   */
  private getDrilldownCacheKey(communityId: number, query: DrilldownQuery): string {
    const {
      metric,
      value,
      page = 1,
      pageSize = 25,
      search = '',
      sortBy = 'fullName',
      sortDir = 'asc',
      onlyActive = true,
      skillType = '',
      customFieldId = '',
    } = query;

    return [
      'drilldown',
      communityId,
      metric,
      value,
      page,
      pageSize,
      search,
      sortBy,
      sortDir,
      onlyActive ? '1' : '0',
      skillType,
      customFieldId,
    ].join('|');
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
    for (const [key, value] of this.drilldownCache.entries()) {
      if (!this.isCacheValid(value.timestamp, this.DRILLDOWN_CACHE_TTL)) {
        this.drilldownCache.delete(key);
      }
    }
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
          // Try POST endpoint that might exist
          const { profileService } = await import('./profile.service');
          const profiles = await profileService.getProfilesForUserAndCommunity(communityId);
          // Convert ProfilesInit to CommunityMember format
          return profiles.map(profile => ({
            id: profile.userId || profile.id,
            fname: profile.fname,
            lname: profile.lname,
            fullName: profile.fullName || `${profile.fname} ${profile.lname}`,
            email: '', // Profiles don't include email
            profilePicture: profile.profilePicture,
            isManager: false,
            enabled: true,
            joinDate: undefined,
          }));
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
      console.log(`[AdminService] Calling: ${url}`);
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
      console.log(`[AdminService] Calling: ${url}`);
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
      console.log(`[AdminService] Calling: ${url}`);
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
      console.log(`[AdminService] Calling: ${url}`);
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
  ): Promise<AttributeModel[]> {
    try {
      const url = `/communities/${communityId}/custom-field-chart/${customFieldId}?consolidateResults=${consolidateResults}&onlyActive=${onlyActive}`;
      console.log(`[AdminService] Calling: ${url}`);
      const data = await apiService.get<AttributeModel[]>(url);
      return data || [];
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
  async getDrilldownUsers(
    communityId: number,
    query: DrilldownQuery
  ): Promise<PaginatedUsersResult> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 25;
    const onlyActive = query.onlyActive ?? true;
    const sortBy = query.sortBy || 'fullName';
    const sortDir = query.sortDir || 'asc';
    const search = query.search || '';
    const useCache = query.useCache !== false;

    const cacheKey = this.getDrilldownCacheKey(communityId, {
      ...query,
      page,
      pageSize,
      onlyActive,
      sortBy,
      sortDir,
      search,
    });

    // Serve from cache if present
    if (useCache) {
      const cached = this.drilldownCache.get(cacheKey);
      if (cached && this.isCacheValid(cached.timestamp, this.DRILLDOWN_CACHE_TTL)) {
        return cached.value;
      }
    }

    const metricParam = query.metric;
    const params: Record<string, string | number | boolean> = {
      metric: metricParam,
      value: query.value,
      page,
      pageSize,
      onlyActive,
      search,
      sortBy,
      sortDir,
    };

    if (query.skillType) {
      params.skillType = query.skillType;
    }
    if (query.customFieldId) {
      params.customFieldId = query.customFieldId;
    }

    const queryString = Object.entries(params)
      .filter(([, v]) => v !== undefined && v !== null)
      .map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`)
      .join('&');

    const url = `/communities/${communityId}/analytics/drilldown?${queryString}`;

    try {
      console.log(`[AdminService] Drilldown -> ${url}`);
      const result = await apiService.get<PaginatedUsersResult>(url);
      const normalized: PaginatedUsersResult = {
        data: result?.data || [],
        total: result?.total ?? (result?.data?.length || 0),
        page: result?.page ?? page,
        pageSize: result?.pageSize ?? pageSize,
      };

      if (useCache) {
        this.drilldownCache.set(cacheKey, { value: normalized, timestamp: Date.now() });
      }
      return normalized;
    } catch (error: any) {
      const status = error?.status || error?.response?.status;
      if (status !== 404) {
        console.warn('[AdminService] Drilldown endpoint failed, using fallback:', error);
      } else {
        console.log('[AdminService] Drilldown endpoint missing, using fallback');
      }
      const fallbackResult = await this.getDrilldownUsersFallback(communityId, {
        ...query,
        page,
        pageSize,
        onlyActive,
        sortBy,
        sortDir,
        search,
      });
      if (useCache) {
        this.drilldownCache.set(cacheKey, { value: fallbackResult, timestamp: Date.now() });
      }
      return fallbackResult;
    }
  }

  /**
   * Fallback drilldown when backend endpoint is absent
   */
  private async getDrilldownUsersFallback(
    communityId: number,
    query: DrilldownQuery
  ): Promise<PaginatedUsersResult> {
    const {
      metric,
      value,
      page = 1,
      pageSize = 25,
      search = '',
      sortBy = 'fullName',
      sortDir = 'asc',
      onlyActive = true,
      skillType,
      customFieldId,
    } = query;

    let users: CommunityMember[] = [];

    const attributeMetrics = [
      'interest',
      'activity',
      'intention',
      'movie',
      'music',
      'occupation',
      'organization',
      'university',
      'location',
    ];

    if (attributeMetrics.includes(metric)) {
      users = await this.getUsersByAttribute(communityId, metric, value, onlyActive);
    } else if (metric === 'businessTopic') {
      users = await this.getUsersByBusinessTopic(communityId, value, onlyActive);
    } else if (metric === 'skill') {
      const type = skillType || 'general';
      users = await this.getUsersBySkill(communityId, type, value, onlyActive);
    } else if (metric === 'customField' && customFieldId) {
      users = await this.getUsersByCustomField(communityId, customFieldId, value, onlyActive);
    }

    // Client-side search
    const searchLower = search.trim().toLowerCase();
    if (searchLower) {
      users = users.filter((u) => {
        const fields = [
          u.fullName,
          u.fname,
          u.lname,
          u.email,
          u.jobTitle,
          u.currentEmployer,
        ]
          .filter(Boolean)
          .map((f) => String(f).toLowerCase());
        return fields.some((f) => f.includes(searchLower));
      });
    }

    // Client-side sort
    const sortKey = sortBy || 'fullName';
    users = users.slice().sort((a, b) => {
      const dir = sortDir === 'desc' ? -1 : 1;
      const aVal = (a as any)[sortKey] || '';
      const bVal = (b as any)[sortKey] || '';
      return String(aVal).localeCompare(String(bVal)) * dir;
    });

    const total = users.length;
    const start = (page - 1) * pageSize;
    const data = users.slice(start, start + pageSize);

    return { data, total, page, pageSize };
  }

  async getUsersByAttribute(
    communityId: number,
    attributeType: string,
    attributeValue: string,
    onlyActive: boolean = true
  ): Promise<CommunityMember[]> {
    try {
      const url = `/communities/${communityId}/attribute/users?type=${attributeType}&value=${encodeURIComponent(attributeValue)}&onlyActive=${onlyActive}`;
      console.log(`[AdminService] Calling: ${url}`);
      const data = await apiService.get<CommunityMember[]>(url);
      return data || [];
    } catch (error: any) {
      // If 404, endpoint doesn't exist - fall back to client-side filtering
      if (error?.status === 404 || error?.response?.status === 404) {
        console.log(`[AdminService] Endpoint not found, falling back to client-side filtering for ${attributeType}:${attributeValue}`);
        return this.getUsersByAttributeFallback(communityId, attributeType, attributeValue, onlyActive);
      }
      console.error(`Failed to fetch users for attribute ${attributeType}:${attributeValue}:`, error);
      return [];
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
      const { profileService } = await import('./profile.service');
      const profiles = await profileService.getProfilesForUserAndCommunity(communityId);

      const filtered = profiles
        .map(profile => ({
          id: profile.userId || profile.id,
          fname: profile.fname,
          lname: profile.lname,
          fullName: profile.fullName || `${profile.fname} ${profile.lname}`,
          email: (profile as any).email || (profile as any).emailAddress || (profile as any).email_address || '',
          profilePicture: profile.profilePicture,
          isManager: false,
          enabled: (profile as any).enabled !== false,
          joinDate: undefined,
          _profile: profile, // keep original for attribute inspection
        }))
        .filter(member => {
          if (onlyActive && member.enabled === false) {
            return false;
          }

          const profile = (member as any)._profile;
          const attributeValues = this.getAttributeValuesFromProfile(profile, attributeType);

          return attributeValues.some(
            (attr) => attr.toLowerCase() === attributeValue.toLowerCase()
          );
        })
        .map(member => {
          delete (member as any)._profile;
          return member;
        });

      if (filtered.length > 0) {
        return filtered;
      }

      // Secondary fallback: use community members payload if profiles lack the attribute
      const members = await this.getCommunityMembers(communityId);
      const memberFiltered = members.filter(member => {
        if (onlyActive && member.enabled === false) {
          return false;
        }
        const attributeValues = this.getAttributeValuesFromMember(member, attributeType);
        return attributeValues.some(
          (attr) => attr.toLowerCase() === attributeValue.toLowerCase()
        );
      });

      return memberFiltered;
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
   * Normalize raw attribute values from profiles to comparable strings
   */
  private normalizeAttributeValues(attribute: any): string[] {
    if (!attribute) return [];

    if (Array.isArray(attribute)) {
      return attribute.flatMap(value => this.normalizeAttributeValues(value));
    }

    if (typeof attribute === 'string') {
      return [attribute];
    }

    if (typeof attribute === 'object') {
      const candidates = [
        (attribute as any).name,
        (attribute as any).primaryName,
        (attribute as any).secondaryName,
        (attribute as any).title,
      ].filter(Boolean);

      if (candidates.length > 0) {
        return candidates as string[];
      }
    }

    return [];
  }

  /**
   * Extract attribute values from a profile for fallback filtering
   */
  private getAttributeValuesFromProfile(profile: any, attributeType: string): string[] {
    const primaryField = this.getAttributeFieldName(attributeType);

    const attributeSources: Record<string, any[]> = {
      interest: [...(profile?.interests || []), ...(profile?.passions || [])],
      activity: profile?.activities || [],
      intention: profile?.intentions || [],
      movie: profile?.movies || [],
      music: profile?.music || [],
      occupation: [profile?.occupation, profile?.jobTitle].filter(Boolean),
      organization: [
        ...(profile?.organizations || []),
        profile?.currentEmployer,
        ...(profile?.pastEmployers || []),
      ].filter(Boolean),
      university: [
        ...(profile?.education || []),
        profile?.school,
        profile?.degree,
        profile?.university,
      ].filter(Boolean),
      location: [
        ...(Array.isArray(profile?.locations)
          ? profile.locations.map((loc: any) => loc?.primaryName || loc?.secondaryName)
          : []),
        ...(profile?.hometowns || []),
        profile?.currentLocationName,
      ].filter(Boolean),
    };

    if (primaryField && !(attributeSources as any)[attributeType]) {
      (attributeSources as any)[attributeType] = [profile?.[primaryField]];
    }

    const rawValues = attributeSources[attributeType] || [];
    const normalized = this.normalizeAttributeValues(rawValues)
      .map(value => value.toString().trim())
      .filter(Boolean);

    // Deduplicate while preserving original casing
    const seen = new Set<string>();
    const unique: string[] = [];
    normalized.forEach(value => {
      const lower = value.toLowerCase();
      if (!seen.has(lower)) {
        seen.add(lower);
        unique.push(value);
      }
    });

    return unique;
  }

  /**
   * Extract attribute values from a community member payload
   */
  private getAttributeValuesFromMember(member: any, attributeType: string): string[] {
    const fieldMap: Record<string, any> = {
      interest: member?.interests || member?.passions,
      activity: member?.activities,
      intention: member?.intention || member?.intentions,
      movie: member?.movies,
      music: member?.music,
      occupation: member?.occupation || member?.jobTitle,
      organization: member?.organizations || member?.organization || member?.currentEmployer,
      university: member?.university || member?.school || member?.degree,
      location: member?.locations,
    };

    const raw = fieldMap[attributeType];
    const normalized = this.normalizeAttributeValues(raw)
      .map(value => value.toString().trim())
      .filter(Boolean);

    // Deduplicate
    const seen = new Set<string>();
    const unique: string[] = [];
    normalized.forEach(value => {
      const lower = value.toLowerCase();
      if (!seen.has(lower)) {
        seen.add(lower);
        unique.push(value);
      }
    });

    return unique;
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
    ];

    for (const url of endpoints) {
      try {
        console.log(`[AdminService] 🎓 Calling: ${url}`);
        const data = await apiService.get<CommunityMember[]>(url);
        if (data && Array.isArray(data) && data.length > 0) {
          console.log(`[AdminService] ✅ Found ${data.length} users with skill "${skillValue}"`);

          const enriched = data.map((user: any) => {
            const skillSources = [
              user.skills,
              user.skillList,
              user.skillsList,
              user.skillNames,
              user.skill_names,
              user.skillsString,
              user.skills_string,
            ];

            const normalizedSkills = Array.from(
              new Set(
                skillSources.flatMap((src: any) => this.normalizeSkills(src))
              )
            );

            return normalizedSkills.length > 0 ? { ...user, skills: normalizedSkills } : user;
          });

          return enriched;
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

    // If all endpoints fail, try fallback
    console.log(`[AdminService] ⚠️ All endpoints failed, trying fallback for skill ${skillType}:${skillValue}`);
    return this.getUsersBySkillFallback(communityId, skillType, skillValue, onlyActive);
  }

  /**
   * Fallback: Get all members and filter by skill client-side
   * Uses profiles endpoint which contains skills data
   */
  private async getUsersBySkillFallback(
    communityId: number,
    skillType: string,
    skillValue: string,
    onlyActive: boolean = true
  ): Promise<CommunityMember[]> {
    try {
      // First, try mentor/mentee users (they often include skills data)
      try {
        const mentorUsers = await this.getMentorMenteeUsers(communityId, 'can');
        const menteeUsers = await this.getMentorMenteeUsers(communityId, 'want');
        const combined = [...mentorUsers, ...menteeUsers];

        const filteredMentorMentee = combined
          .map(user => {
            const normalizedSkills = this.normalizeSkills((user as any).skills);
            return normalizedSkills.length > 0 ? { ...user, skills: normalizedSkills } : user;
          })
          .filter(user => {
            const skills = (user as any).skills;
            if (!skills || skills.length === 0) return false;
            return skills.some((s: string) => s.toLowerCase() === skillValue.toLowerCase());
          });

        if (filteredMentorMentee.length > 0) {
          console.log(`[AdminService] ✅ Fallback (mentor/mentee): Found ${filteredMentorMentee.length} users with skill "${skillValue}"`);
          return filteredMentorMentee;
        }
      } catch (mmError) {
        console.warn('[AdminService] Mentor/mentee fallback failed, continuing to profiles:', mmError);
      }

      // Use profiles endpoint which contains skills data
      const { profileService } = await import('./profile.service');
      const profiles = await profileService.getProfilesForUserAndCommunity(communityId);
      
      console.log(`[AdminService] Fallback: Filtering ${profiles.length} profiles for skill "${skillValue}"`);
      
      const filtered = profiles
        .map(profile => {
          const normalizedSkills = this.normalizeSkills((profile as any).skills);

          return {
            id: profile.userId || profile.id,
            fname: profile.fname,
            lname: profile.lname,
            fullName: profile.fullName || `${profile.fname} ${profile.lname}`,
            email: (profile as any).email || (profile as any).emailAddress || (profile as any).email_address || '',
            profilePicture: profile.profilePicture,
            isManager: false,
            enabled: (profile as any).enabled !== false,
            joinDate: undefined,
            jobTitle: profile.jobTitle,
            currentEmployer: profile.currentEmployer,
            skills: normalizedSkills.length > 0 ? normalizedSkills : undefined,
            // Include original profile data for skill checking
            _profile: profile,
          };
        })
        .filter(member => {
          const profile = (member as any)._profile;
          if (onlyActive && member.enabled === false) {
            return false;
          }
          
          // Check skills field - profiles have skills data
          const skills = profile.skills;
          if (!skills) {
            return false;
          }

          // Handle array format (most common)
          if (Array.isArray(skills)) {
            return skills.some((skill: any) => {
              const skillName = typeof skill === 'string' 
                ? skill 
                : skill?.name || skill?.skill || skill?.value;
              const skillTypeMatch = !skillType || skillType === 'general' || 
                (typeof skill === 'object' && (skill?.type === skillType || skill?.skillType === skillType));
              return skillName?.toLowerCase() === skillValue.toLowerCase() && skillTypeMatch;
            });
          }

          // Handle object format (skills as object with keys)
          if (typeof skills === 'object' && !Array.isArray(skills)) {
            return Object.keys(skills).some(key => {
              const skill = skills[key];
              const skillName = typeof skill === 'string' 
                ? skill 
                : skill?.name || skill?.skill || key;
              return skillName?.toLowerCase() === skillValue.toLowerCase();
            });
          }

          // Handle string format (comma-separated)
          if (typeof skills === 'string') {
            return skills.split(',').some(s => 
              s.trim().toLowerCase() === skillValue.toLowerCase()
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
    try {
      const url = `/communities/${communityId}/businessTopics/users?value=${encodeURIComponent(topicValue)}&onlyActive=${onlyActive}`;
      console.log(`[AdminService] Calling: ${url}`);
      const data = await apiService.get<CommunityMember[]>(url);
      return data || [];
    } catch (error: any) {
      // If 404, endpoint doesn't exist - fall back to client-side filtering
      if (error?.status === 404 || error?.response?.status === 404) {
        console.log(`[AdminService] Endpoint not found, falling back to client-side filtering for business topic ${topicValue}`);
        return this.getUsersByBusinessTopicFallback(communityId, topicValue, onlyActive);
      }
      console.error(`Failed to fetch users for business topic ${topicValue}:`, error);
      return [];
    }
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
      // Try profiles first (often richer than members)
      try {
        const { profileService } = await import('./profile.service');
        const profiles = await profileService.getProfilesForUserAndCommunity(communityId);
        const fromProfiles = profiles
          .map(profile => ({
            id: profile.userId || profile.id,
            fname: profile.fname,
            lname: profile.lname,
            fullName: profile.fullName || `${profile.fname} ${profile.lname}`,
            email: (profile as any).email || (profile as any).emailAddress || (profile as any).email_address || '',
            profilePicture: profile.profilePicture,
            isManager: false,
            enabled: (profile as any).enabled !== false,
            joinDate: undefined,
            _profile: profile,
          }))
          .filter(member => {
            if (onlyActive && member.enabled === false) return false;
            const profile = (member as any)._profile;
            const topicsRaw = (profile as any).businessTopics || (profile as any).businessTopic;
            const topics = this.normalizeAttributeValues(topicsRaw).map(v => v.toLowerCase());
            return topics.includes(topicValue.toLowerCase());
          })
          .map(member => {
            delete (member as any)._profile;
            return member;
          });

        if (fromProfiles.length > 0) {
          return fromProfiles;
        }
      } catch (profileErr) {
        console.warn('[AdminService] Profiles-based business topic fallback failed:', profileErr);
      }

      const allMembers = await this.getCommunityMembers(communityId);
      const filtered = allMembers.filter(member => {
        if (onlyActive && member.enabled === false) {
          return false;
        }

        const businessTopics = (member as any).businessTopics || (member as any).businessTopic;
        if (!businessTopics) return false;

        if (Array.isArray(businessTopics)) {
          return businessTopics.some((topic: string) =>
            topic?.toLowerCase() === topicValue.toLowerCase()
          );
        } else if (typeof businessTopics === 'string') {
          return businessTopics.toLowerCase() === topicValue.toLowerCase();
        }

        return false;
      });

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
      const url = `/communities/${communityId}/custom-field/${customFieldId}/users?value=${encodeURIComponent(fieldValue)}&onlyActive=${onlyActive}`;
      console.log(`[AdminService] Calling: ${url}`);
      const data = await apiService.get<CommunityMember[]>(url);
      return data || [];
    } catch (error: any) {
      if (error?.status === 404 || error?.response?.status === 404) {
        console.log(`[AdminService] Endpoint not found for custom field ${customFieldId}:${fieldValue}, using fallback`);
        return this.getUsersByCustomFieldFallback(communityId, customFieldId, fieldValue, onlyActive);
      }
      console.error(`Failed to fetch users for custom field ${customFieldId}:${fieldValue}:`, error);
      return [];
    }
  }

  /**
   * Fallback: filter custom fields client-side when possible
   */
  private async getUsersByCustomFieldFallback(
    communityId: number,
    customFieldId: number,
    fieldValue: string,
    onlyActive: boolean = true
  ): Promise<CommunityMember[]> {
    try {
      const { profileService } = await import('./profile.service');
      const profiles = await profileService.getProfilesForUserAndCommunity(communityId);

      const filtered = profiles
        .map(profile => ({
          id: profile.userId || profile.id,
          fname: profile.fname,
          lname: profile.lname,
          fullName: profile.fullName || `${profile.fname} ${profile.lname}`,
          email: (profile as any).email || (profile as any).emailAddress || (profile as any).email_address || '',
          profilePicture: profile.profilePicture,
          isManager: false,
          enabled: (profile as any).enabled !== false,
          joinDate: undefined,
          _profile: profile,
        }))
        .filter(member => {
          if (onlyActive && member.enabled === false) return false;
          const profile = (member as any)._profile;
          const customFields = (profile as any).customFields || (profile as any).custom_fields || [];
          if (!Array.isArray(customFields)) return false;
          return customFields.some((field: any) => {
            const fieldId = field?.id || field?.customFieldId || field?.custom_field_id;
            if (Number(fieldId) !== Number(customFieldId)) return false;
            const value = field?.value || field?.displayValue || field?.name || field?.label;
            if (!value) return false;
            return String(value).toLowerCase() === fieldValue.toLowerCase();
          });
        })
        .map(member => {
          delete (member as any)._profile;
          return member;
        });

      return filtered;
    } catch (error) {
      console.warn('[AdminService] Custom field fallback failed:', error);
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
    console.error(`[AdminService] 🚀🚀🚀 getEngagementStats CALLED for community ${communityId}, dates: ${startDate || 'none'} to ${endDate || 'none'}`);
    
    // Try backend endpoint with timeout to avoid long waits
    const backendPromise = apiService.get<UserStats>(
      `/communities/${communityId}/stats/engagement${startDate && endDate ? `?startDate=${startDate}&endDate=${endDate}` : ''}`
    ).catch((error: any) => {
      if (error?.status === 404 || error?.response?.status === 404) {
        console.error(`[AdminService] Backend endpoint 404, will use calculated stats`);
        return null; // Endpoint doesn't exist
      }
      throw error;
    });

    // Calculate from existing data in parallel (don't wait for backend)
    console.error(`[AdminService] 🚀 About to call calculateEngagementStatsFromData (which will call getMatchesForCommunity)`);
    const calculatedPromise = this.calculateEngagementStatsFromData(communityId, startDate, endDate);

    // Use whichever completes first, prefer backend if available
    try {
      const [backendStats, calculatedStats] = await Promise.allSettled([
        backendPromise,
        calculatedPromise,
      ]);

      const backendValue = backendStats.status === 'fulfilled' ? backendStats.value : null;
      const calculatedValue = calculatedStats.status === 'fulfilled' ? calculatedStats.value : null;

      console.error('[AdminService] Backend stats status:', backendStats.status, 'has value:', !!backendValue);
      console.error('[AdminService] Calculated stats status:', calculatedStats.status, 'has value:', !!calculatedValue);
      
      // Prefer calculated stats when backend returns zeroed connections but client can calculate real data
      const backendConnections = backendValue?.connectionsMade ?? 0;
      const calculatedConnections = calculatedValue?.connectionsMade ?? 0;

      if (backendValue && calculatedValue) {
        if (backendConnections === 0 && calculatedConnections > 0) {
          console.error('[AdminService] ✅ Using calculated stats because backend connectionsMade is 0 but calculated has data');
          return calculatedValue;
        }
        console.error('[AdminService] ⚠️ Using backend stats (calculated also available)');
        return backendValue;
      }

      if (backendValue) {
        console.error('[AdminService] ⚠️ Using backend stats (calculated not available)');
        return backendValue;
      }

      if (calculatedValue) {
        console.error('[AdminService] ✅ Using calculated stats (backend unavailable)');
        return calculatedValue;
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
    console.error(`[AdminService] 🎯🎯🎯 calculateEngagementStatsFromData CALLED for community ${communityId}`);
    try {
      const start = startDate ? new Date(startDate) : null;
      const end = endDate ? new Date(endDate) : null;

      // Log date range for debugging
      if (start && end) {
        console.error(`[AdminService] 📅 Date filter: ${start.toISOString()} to ${end.toISOString()}`);
      } else {
        console.error(`[AdminService] 📅 No date filter (all-time)`);
      }

      // Fetch data from existing endpoints in parallel
      console.error(`[AdminService] 🔵 Starting data fetch for community ${communityId}, date range: ${startDate || 'all-time'} to ${endDate || 'all-time'}`);
      console.error(`[AdminService] 🔵 About to call getMatchesForCommunity(${communityId})...`);
      const [
        profiles,
        events,
        groups,
        matches,
      ] = await Promise.allSettled([
        this.getProfilesForCommunity(communityId),
        this.getEventsForCommunity(communityId),
        this.getGroupsForCommunity(communityId),
        (async () => {
          console.error(`[AdminService] 🔵🔵🔵 CALLING getMatchesForCommunity NOW for community ${communityId}`);
          return await this.getMatchesForCommunity(communityId, startDate, endDate);
        })(),
      ]);
      
      console.error('[AdminService] 🔵 Data fetch results:', {
        profiles: profiles.status,
        events: events.status,
        groups: groups.status,
        matches: matches.status,
      });
      
      // Explicit logging for matches to debug - using console.error so it shows even if filtered
      if (matches.status === 'fulfilled') {
        const matchCount = matches.value?.length || 0;
        console.error(`[AdminService] ✅✅✅ Matches fetch SUCCESS: ${matchCount} matches returned`);
        if (matchCount > 0) {
          console.error('[AdminService] First match structure:', JSON.stringify(matches.value[0], null, 2));
        } else {
          console.error('[AdminService] ⚠️⚠️⚠️ Matches array is EMPTY - this is why Connections Made is 0');
        }
      } else {
        console.error('[AdminService] ❌❌❌ Matches fetch FAILED - this is why Connections Made is 0');
        console.error('[AdminService] Matches error reason:', matches.reason);
        console.error('[AdminService] Matches error details:', {
          message: matches.reason?.message,
          status: matches.reason?.status,
          response: matches.reason?.response?.data,
        });
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
        console.error(`[AdminService] 📅 Fetched ${eventList.length} events for community ${communityId}`);
        if (eventList.length > 0) {
          console.error('[AdminService] 📅 Sample event data:', {
            id: eventList[0].id,
            name: eventList[0].name,
            startDate: eventList[0].startDate,
            startDateTimeUTC: eventList[0].startDateTimeUTC,
            attendeeCount: eventList[0].attendeeCount,
            hasAttendees: !!eventList[0].attendees,
            attendeesLength: eventList[0].attendees?.length,
          });
        }
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
        console.error(`[AdminService] 📅 Events: ${createdCount} created, ${attendedCount} attendances, ${excludedByDate} excluded by date, ${noDateField} with no date field`);
      } else {
        const errorReason = events.status === 'rejected' ? events.reason : 'unknown';
        console.warn('[AdminService] Events fetch failed:', errorReason);
        if (events.status === 'rejected') {
          console.error('[AdminService] Events error details:', errorReason);
        }
      }

      // Groups Created/Joined
      if (groups.status === 'fulfilled') {
        const groupList = groups.value || [];
        console.error(`[AdminService] 👥 Fetched ${groupList.length} groups for community ${communityId}`);
        if (groupList.length > 0) {
          console.error('[AdminService] 👥 Sample group data:', {
            id: groupList[0].id,
            name: groupList[0].name,
            createdAt: groupList[0].createdAt,
            memberCount: groupList[0].memberCount,
            hasUsers: !!groupList[0].users,
            usersLength: groupList[0].users?.length,
          });
        }
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
        console.error(`[AdminService] 👥 Groups: ${createdCount} created, ${totalMembers} total memberships, ${uniqueMembers.size} unique members, ${excludedByDate} excluded by date, ${noDateField} with no date field`);
      } else {
        const errorReason = groups.status === 'rejected' ? groups.reason : 'unknown';
        console.warn('[AdminService] Groups fetch failed:', errorReason);
        if (groups.status === 'rejected') {
          console.error('[AdminService] Groups error details:', errorReason);
        }
      }

      // Connections Made (Matches)
      if (matches.status === 'fulfilled') {
        // Use the original string params passed into calculateEngagementStatsFromData
        const summary = await this.getMatchSummary(communityId, startDate, endDate);
        stats.connectionsMade = summary.totalPairs;
        (stats as any).connectionsPerUser = summary.perUser;
        console.log(`[AdminService] 🔗 Connections made (community ${communityId}): ${summary.totalPairs}`);
        // Calculate response rate (matches that led to conversations)
        try {
          const responseRate = await this.calculateMatchResponseRate(communityId, matches.value || [], startDate, endDate);
          stats.matchResponseRate = responseRate;
        } catch (error) {
          console.warn('[AdminService] Could not calculate match response rate:', error);
          stats.matchResponseRate = 0;
        }
      } else {
        const errorReason = matches.status === 'rejected' ? matches.reason : 'unknown';
        console.error('[AdminService] Matches fetch FAILED - this is why Connections Made is 0');
        console.error('[AdminService] Matches error status:', matches.status);
        console.error('[AdminService] Matches error reason:', errorReason);
        if (matches.status === 'rejected') {
          console.error('[AdminService] Matches error details:', {
            message: errorReason?.message,
            status: errorReason?.status,
            response: errorReason?.response,
            stack: errorReason?.stack,
          });
        }
        // Set to 0 explicitly since fetch failed
        stats.connectionsMade = 0;
      }

      // Messages Sent
      try {
        console.log(`[AdminService] 📨 Fetching message stats for community ${communityId}...`);
        const messageStats = await this.getMessageStats(communityId, startDate, endDate);
        if (messageStats) {
          stats.totalMessagesSent = messageStats.totalMessagesSent;
          console.log(`[AdminService] 📨 Message stats: ${messageStats.totalMessagesSent} messages`);
        } else {
          console.warn('[AdminService] 📨 Message stats returned null');
        }
      } catch (error) {
        console.error('[AdminService] Error calculating message stats:', error);
      }

      // Daily/Weekly Active Users
      try {
        console.log(`[AdminService] 👥 Fetching active user stats for community ${communityId}...`);
        const activeUserStats = await this.getActiveUserStats(communityId, startDate, endDate);
        if (activeUserStats) {
          stats.dailyActiveUsers = activeUserStats.dailyActiveUsers;
          stats.weeklyActiveUsers = activeUserStats.weeklyActiveUsers;
          console.log(`[AdminService] 👥 Active user stats: ${activeUserStats.dailyActiveUsers} daily, ${activeUserStats.weeklyActiveUsers} weekly`);
        } else {
          console.warn('[AdminService] 👥 Active user stats returned null');
        }
      } catch (error) {
        console.error('[AdminService] Error calculating active user stats:', error);
      }

      console.error('[AdminService] 📊📊📊 FINAL CALCULATED STATS:', {
        profilesCreated: stats.profilesCreated,
        connectionsMade: stats.connectionsMade,
        eventsCreated: stats.eventsCreated,
        eventsAttended: stats.eventsAttended,
        groupsCreated: stats.groupsCreated,
        groupsJoined: stats.groupsJoined,
        profileCompletionRate: stats.profileCompletionRate,
        totalMessagesSent: stats.totalMessagesSent,
        dailyActiveUsers: stats.dailyActiveUsers,
        weeklyActiveUsers: stats.weeklyActiveUsers,
        matchResponseRate: stats.matchResponseRate,
        dateRange: start && end ? `${start.toISOString()} to ${end.toISOString()}` : 'all-time',
      });

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
          // If matches have communityId field, verify they're for the right community
          if (matches[0].communityId !== undefined || matches[0].community_id !== undefined) {
            const filtered = matches.filter((match: any) => {
              const matchCommunityId = match.communityId || match.community_id;
              return matchCommunityId === communityId;
            });
            if (filtered.length !== matches.length) {
              console.log(`[AdminService] ⚠️ Endpoint returned ${matches.length} matches, but only ${filtered.length} are for community ${communityId}`);
              const result = filtered;
              if (cacheKey) {
                this.matchesCache.set(cacheKey, { data: result, timestamp: Date.now() });
              }
              return result;
            }
          }
          
          // Cache the result
          if (cacheKey) {
            this.matchesCache.set(cacheKey, { data: matches, timestamp: Date.now() });
          }
          return matches;
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
   * Calculate match summary scoped to a community using memberships
   * - Counts unique unordered pairs where both users are active members
   * - Filters matches: is_active = true, removed IS NULL, snoozed_on IS NULL
   */
  async getMatchSummary(
    communityId: number,
    startDate?: string,
    endDate?: string
  ): Promise<{ totalPairs: number; perUser: Array<{ userId: number; fullName: string; email?: string; profilePicture?: string; count: number }> }> {
    const [matches, members] = await Promise.all([
      this.getMatchesForCommunity(communityId, startDate, endDate),
      this.getCommunityMembers(communityId),
    ]);

    const memberMap = new Map<number, CommunityMember>();
    members.forEach(m => {
      if (m.id) {
        memberMap.set(m.id, m);
      }
    });

    // Filter matches by active flags and membership
    const filtered = matches.filter((m: any) => {
      if (m.is_active === false) return false;
      if (m.removed) return false;
      if (m.snoozed_on) return false;
      const u1 = m.userId ?? m.left_user_id ?? m.user_id;
      const u2 = m.matchedUserId ?? m.right_user_id ?? m.matched_user_id;
      if (!u1 || !u2) return false;
      return memberMap.has(u1) && memberMap.has(u2);
    });

    const pairSet = new Set<string>();
    const perUserPartners = new Map<number, Set<number>>();

    filtered.forEach((m: any) => {
      const u1 = m.userId ?? m.left_user_id ?? m.user_id;
      const u2 = m.matchedUserId ?? m.right_user_id ?? m.matched_user_id;
      const key = [u1, u2].sort((a: number, b: number) => a - b).join('-');
      pairSet.add(key);

      if (!perUserPartners.has(u1)) perUserPartners.set(u1, new Set());
      if (!perUserPartners.has(u2)) perUserPartners.set(u2, new Set());
      perUserPartners.get(u1)!.add(u2);
      perUserPartners.get(u2)!.add(u1);
    });

    const perUser = Array.from(perUserPartners.entries()).map(([userId, partners]) => {
      const member = memberMap.get(userId);
      return {
        userId,
        fullName: member?.fullName || `${member?.fname || ''} ${member?.lname || ''}`.trim() || `User ${userId}`,
        email: member?.email,
        profilePicture: member?.profilePicture,
        count: partners.size,
      };
    }).sort((a, b) => b.count - a.count || a.fullName.localeCompare(b.fullName));

    return { totalPairs: pairSet.size, perUser };
  }

  /**
   * Get partners for a user within a community using the same filters
   */
  async getUserMatchPartners(
    communityId: number,
    userId: number,
    startDate?: string,
    endDate?: string
  ): Promise<CommunityMember[]> {
    const [matches, members] = await Promise.all([
      this.getMatchesForCommunity(communityId, startDate, endDate),
      this.getCommunityMembers(communityId),
    ]);

    const memberMap = new Map<number, CommunityMember>();
    members.forEach(m => {
      if (m.id) memberMap.set(m.id, m);
    });

    const partners = new Set<number>();

    matches.forEach((m: any) => {
      if (m.is_active === false) return;
      if (m.removed) return;
      if (m.snoozed_on) return;
      const u1 = m.userId ?? m.left_user_id ?? m.user_id;
      const u2 = m.matchedUserId ?? m.right_user_id ?? m.matched_user_id;
      if (!u1 || !u2) return;
      if (!memberMap.has(u1) || !memberMap.has(u2)) return;
      if (u1 === userId) partners.add(u2);
      else if (u2 === userId) partners.add(u1);
    });

    return Array.from(partners)
      .map(id => memberMap.get(id))
      .filter(Boolean) as CommunityMember[];
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
        console.log(`[AdminService] 🎯 Trying user actions endpoint: ${url}`);
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
          if (aggregatedStats && Object.keys(aggregatedStats).length > 0) {
            console.log(`[AdminService] ✅ User actions stats aggregated from slack-user-stats:`, aggregatedStats);
            return aggregatedStats;
          } else {
            console.warn(`[AdminService] ⚠️ aggregateSlackUserStats returned null/empty`);
          }
        }
        
        // Handle direct stats format
        if (response && typeof response === 'object' && !response.rows) {
          const stats = response as Partial<UserStats>;
          if (stats && Object.keys(stats).length > 0) {
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
    console.log('[AdminService] All user actions endpoints failed, trying client-side calculation');
    return this.calculateUserActionsStats(communityId, startDate, endDate);
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
      console.warn('[AdminService] ⚠️ aggregateSlackUserStats: response.rows is missing or not an array');
      return null;
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
      openedTrova += this.getNumericValue(row, ['homepageViews', 'openedTrova', 'opened_trova', 'Opened Trova']);
      generalActions += this.getNumericValue(row, ['profileActions', 'generalActions', 'general_actions', 'General Actions']);
      spotlightsCreated += this.getNumericValue(row, ['spotlightsCreated', 'spotlights_created', 'Spotlights Created']);
      recWallsGiven += this.getNumericValue(row, ['recWallsGiven', 'rec_walls_given', 'Rec Walls Given']);
      recWallsReceived += this.getNumericValue(row, ['recWallsReceived', 'rec_walls_received', 'Rec Walls Received']);
      introsLedToConvos += this.getNumericValue(row, ['introsLedToConvos', 'intros_led_to_convos', 'Intros Led To Convos']);
      trovaMagicEngagements += this.getNumericValue(row, ['introsAttributedToTrovaMagic', 'intros_attributed_to_trova_magic', 'Trova Magic']);
      channelPairingOnDemand += this.getNumericValue(row, ['introsAttributedToChannelPairingOnDemand', 'intros_attributed_to_channel_pairing_on_demand', 'Channel Pairing On Demand']);
      channelPairingCadence += this.getNumericValue(row, ['introsAttributedToChannelPairingCadence', 'intros_attributed_to_channel_pairing_cadence', 'Channel Pairing Cadence']);
    });

    // Map to UserStats interface fields - always set values (even if 0) so they appear in UI
    stats.openedTrova = openedTrova;
    stats.generalActions = generalActions;
    stats.spotlightsCreated = spotlightsCreated;
    stats.recWallsGiven = recWallsGiven;
    stats.recWallsReceived = recWallsReceived;
    stats.introsLedToConvos = introsLedToConvos;
    stats.trovaMagicEngagements = trovaMagicEngagements;
    stats.channelPairingOnDemand = channelPairingOnDemand;
    stats.channelPairingCadence = channelPairingCadence;

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
      console.log(`[AdminService] 📋 Sample row keys:`, Object.keys(rows[0]));
      console.log(`[AdminService] 📋 Sample row:`, rows[0]);
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
  private async getMentorMenteeStats(communityId: number): Promise<Partial<UserStats> | null> {
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

    // If no endpoint found, return null (will use fallback calculation)
    return null;
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
      // New primary endpoint that returns users with skills and intent
      `/communities/${communityId}/mentor-mentee/users?type=${type}`,
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
          console.log('[AdminService] 🧪 mentor/mentee sample', users.slice(0, 3).map((u: any) => ({
            id: u.id,
            skills: u.skills,
            mentorsOn: u.mentorsOn,
            wantsMentorOn: u.wantsMentorOn,
          })));

          // First, try to use skills provided by the endpoint (skills, mentorsOn, wantsMentorOn)
          let enriched = users.map((user: any) => {
            const skillSources = [
              user.skills,
              type === 'can' ? user.mentorsOn : user.wantsMentorOn,
              user.skillList,
              user.skillsList,
              user.skillNames,
              user.skill_names,
              user.skillsString,
            ];

            const endpointSkills = Array.from(
              new Set(
                skillSources.flatMap((src: any) => this.normalizeSkills(src))
              )
            );

            return endpointSkills.length > 0 ? { ...user, skills: endpointSkills } : user;
          });

          // If any user still lacks skills, try enriching from profiles
          const needsProfileEnrichment = enriched.some((u: any) => !u.skills || u.skills.length === 0);
          if (needsProfileEnrichment) {
            try {
              const { profileService } = await import('./profile.service');
              const profiles = await profileService.getProfilesForUserAndCommunity(communityId);
              const profileMap = new Map<number, any>();
              profiles.forEach((p: any) => {
                const userId = p.userId || p.id || p.user_id;
                if (userId) profileMap.set(userId, p);
              });

              enriched = enriched.map((user: any) => {
                if (user.skills && user.skills.length > 0) return user;
                const profile = profileMap.get(user.id);
                if (!profile) return user;
                const skills = this.normalizeSkills(profile.skills);
                return skills.length > 0 ? { ...user, skills } : user;
              });
            } catch (profileError) {
              console.warn('[AdminService] Could not enrich mentor/mentee users with skills from profiles:', profileError);
            }
          }

          return enriched;
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

    // Fallback: derive from profiles using possible mentor/mentee flags
    try {
      const { profileService } = await import('./profile.service');
      const profiles = await profileService.getProfilesForUserAndCommunity(communityId);
      console.warn(`[AdminService] No mentor/mentee user endpoint; using profiles fallback (${profiles.length} profiles)`);

      const filtered: CommunityMember[] = profiles
        .map((p: any) => {
          const userId = p.userId || p.id || p.user_id;
          if (!userId) return null;

          // Heuristic flags
          const isMentor =
            p.is_active_mentor === true ||
            p.isActiveMentor === true ||
            p.canMentor === true ||
            p.isMentor === true;
          const isMentee =
            p.is_active_mentee === true ||
            p.isActiveMentee === true ||
            p.wantMentor === true ||
            p.isMentee === true ||
            p.wantsMentor === true;

          const matchesType = type === 'can' ? isMentor : isMentee;
          if (!matchesType) return null;

          const skills = this.normalizeSkills(p.skills);

          const member: CommunityMember = {
            id: userId,
            fname: p.fname || p.firstName || '',
            lname: p.lname || p.lastName || '',
            fullName: p.fullName || `${p.fname || ''} ${p.lname || ''}`.trim() || p.name || `User ${userId}`,
            email: p.email || p.mail || '',
            profilePicture: p.profilePicture || p.avatarUrl || p.photoUrl,
            skills: skills.length > 0 ? skills : undefined,
          };
          return member;
        })
        .filter(Boolean) as CommunityMember[];

      console.log(`[AdminService] ✅ Profiles fallback found ${filtered.length} ${type === 'can' ? 'mentors' : 'mentees'}`);
      return filtered;
    } catch (fallbackError) {
      console.warn('[AdminService] Mentor/mentee profiles fallback failed:', fallbackError);
      return [];
    }
  }

  /**
   * Normalize skills payload into a simple string array
   */
  private normalizeSkills(skills: any): string[] {
    if (!skills) return [];

    // Comma-separated string
    if (typeof skills === 'string') {
      return skills
        .split(',')
        .map(s => s.trim())
        .filter(s => s.length > 0);
    }

    // Already an array of strings
    if (Array.isArray(skills)) {
      const normalized = skills
        .map((s: any) => {
          if (!s) return '';
          if (typeof s === 'string') return s.trim();
          if (typeof s === 'object') {
            const candidate =
              s.name ||
              s.skill ||
              s.skillName ||
              s.skill_name ||
              s.skillId ||
              s.skill_id ||
              s.displayName ||
              s.label ||
              s.title ||
              (s.skill && (s.skill.name || s.skill.skillName)) ||
              (s.meta && s.meta.name);
            if (candidate) return String(candidate).trim();
          }
          return String(s).trim();
        })
        .filter((s: string) => s.length > 0);
      return Array.from(new Set(normalized));
    }

    // Object map { skillName: true } or { skillName: level }
    if (typeof skills === 'object') {
      return Array.from(
        new Set(
          Object.keys(skills)
            .map(k => k.trim())
            .filter(k => k.length > 0)
        )
      );
    }

    return [];
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

        // Try to get users with skills by querying profiles
        try {
          const { profileService } = await import('./profile.service');
          const profiles = await profileService.getProfilesForUserAndCommunity(communityId);
          console.log(`[AdminService] 🎓 Processing ${profiles.length} profiles for skills calculation`);
          
          profiles.forEach((profile: any) => {
            const userId = profile.userId || profile.id || profile.user_id;
            if (!userId) return;
            
            // Check if profile has skills (could be array, object, or string)
            const skills = profile.skills;
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
   */
  private async calculateMatchEngagementStats(
    communityId: number,
    startDate?: string,
    endDate?: string
  ): Promise<Partial<UserStats> | null> {
    try {
      const stats: Partial<UserStats> = {
        trovaMagicMatches: 0,
        channelPairingMatches: 0,
        allMatchesEngaged: 0,
        matchEngagementRate: 0,
      };

      // Get matches by type for efficiency (backend can filter)
      const [trovaMagicMatches, channelPairingMatches] = await Promise.all([
        this.getMatchesForCommunity(communityId, startDate, endDate, 'trova_magic'),
        this.getMatchesForCommunity(communityId, startDate, endDate, 'channel_pairing'),
      ]);

      stats.trovaMagicMatches = trovaMagicMatches?.length || 0;
      stats.channelPairingMatches = channelPairingMatches?.length || 0;
      
      const totalMatches = stats.trovaMagicMatches + stats.channelPairingMatches;
      
      // Calculate engagement (matches that led to conversations)
      if (totalMatches > 0) {
        try {
          const allMatches = [...(trovaMagicMatches || []), ...(channelPairingMatches || [])];
          const engagedCount = await this.countEngagedMatches(communityId, allMatches);
          stats.allMatchesEngaged = engagedCount;
          stats.matchEngagementRate = (engagedCount / totalMatches) * 100;
          
          // Calculate Trova Magic Engagements (Trova Magic matches that led to conversations)
          if (trovaMagicMatches && trovaMagicMatches.length > 0) {
            const trovaMagicEngaged = await this.countEngagedMatches(communityId, trovaMagicMatches);
            stats.trovaMagicEngagements = trovaMagicEngaged;
          }
        } catch (error) {
          console.warn('[AdminService] Could not calculate match engagement:', error);
        }
      }
      
      console.log(`[AdminService] 🔗 Match engagement: ${stats.trovaMagicMatches} Trova Magic, ${stats.channelPairingMatches} Channel Pairing, ${stats.allMatchesEngaged}/${totalMatches} engaged`);

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

      // Group matches by date (using createdAt or created_at)
      const matchesByDate = new Map<string, any[]>();
      
      matches.forEach((match) => {
        const createdAt = match.createdAt || match.created_at;
        if (!createdAt) return;
        
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
        
        // Get date string in YYYY-MM-DD format
        const dateStr = date.toISOString().split('T')[0];
        
        if (!matchesByDate.has(dateStr)) {
          matchesByDate.set(dateStr, []);
        }
        matchesByDate.get(dateStr)!.push(match);
      });

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

        // Deduplicate pairings by normalized pair key and track engagement
        const uniquePairs = new Map<string, { isEngaged: boolean }>();
        for (const match of dateMatches) {
          const userId = match.userId || match.user_id;
          const matchedUserId = match.matchedUserId || match.matched_user_id;
          
          if (!userId || !matchedUserId) continue;

          const pairKey = [userId, matchedUserId].sort((a, b) => a - b).join('-');
          const engaged = conversationPairs.has(pairKey);

          if (!uniquePairs.has(pairKey)) {
            uniquePairs.set(pairKey, { isEngaged: engaged });
          } else if (engaged) {
            // If any match for this pair is engaged, mark the pair engaged
            uniquePairs.get(pairKey)!.isEngaged = true;
          }
        }

        const totalPairings = uniquePairs.size;
        const engagedCount = Array.from(uniquePairs.values()).filter(p => p.isEngaged).length;
        const engagementRate = totalPairings > 0 
          ? (engagedCount / totalPairings) * 100 
          : 0;

        result.push({
          date: dateStr,
          dateDisplay,
          totalPairings,
          engagedPairings: engagedCount,
          engagementRate: Math.round(engagementRate * 10) / 10, // Round to 1 decimal
        });
      }

      // Sort by date descending (most recent first)
      result.sort((a, b) => b.date.localeCompare(a.date));

      console.log(`[AdminService] ✨ Found ${result.length} magic intro dates`);
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

      // Deduplicate pairings by normalizing user pairs (sort user IDs)
      // Keep the first match for each unique pair
      const seenPairs = new Map<string, any>();
      
      for (const match of dateMatches) {
        const userId = match.userId || match.user_id;
        const matchedUserId = match.matchedUserId || match.matched_user_id;
        
        if (!userId || !matchedUserId) continue;
        
        // Create normalized pair key (sorted IDs)
        const normalizedPair = [userId, matchedUserId].sort((a, b) => a - b);
        const pairKey = normalizedPair.join('-');
        
        // Check if we've seen this pair before
        if (!seenPairs.has(pairKey)) {
          // Determine which user is "user" and which is "matchedUser" based on original match
          // Keep the original order from the match
          const pairKeyEngaged = pairKey;
          const isEngaged = conversationPairs.has(pairKeyEngaged);
          
          seenPairs.set(pairKey, {
            ...match,
            userId: normalizedPair[0], // Always use smaller ID as userId
            matchedUserId: normalizedPair[1], // Larger ID as matchedUserId
            isEngaged,
            // Preserve original order for display purposes
            originalUserId: userId,
            originalMatchedUserId: matchedUserId,
          });
        }
      }

      // Convert to array
      const uniquePairings = Array.from(seenPairs.values());

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
}

export const adminService = new AdminService();






