import { apiService } from './api.service';
import { devLog } from '../utils/logger';

export interface Group {
  id: number;
  name: string;
  bio: string;
  leaderId: number;
  leader?: {
    id: number;
    fname: string;
    lname: string;
    fullName: string;
    profilePicture?: string;
  };
  managers?: Array<{
    id: number;
    fname: string;
    lname: string;
    fullName: string;
    profilePicture?: string;
  }>;
  managerIds?: number[];
  communityId: number;
  logo?: string;
  logoSmall?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  tags: number[];
  memberCount?: number;
  typeName?: string;
  users?: Array<{
    id: number;
    fname: string;
    lname: string;
    fullName: string;
    profilePicture?: string;
  }>;
  userFollows?: boolean; // Whether current user is a member
  isAdmin?: boolean;
  convoId?: string;
  isPrivate?: boolean;
  flag?: {
    isActive: boolean;
  };
  // For display purposes
  lastMessage?: string;
  lastMessageTime?: string;
  lastMessageAuthor?: string;
  hasNotification?: boolean;
  isFavorite?: boolean;
  members?: Array<{ id: number }>;
}

export interface CreateGroupData {
  name: string;
  bio: string;
  leaderId: number;
  communityId: number;
  cohostIds?: number[];
  isPrivate: boolean;
  tags: number[];
  logo?: string;
}

export class GroupService {
  /**
   * Cache "endpoint missing" so we don't spam the API/console.
   * These endpoints appear to be absent in some prod deployments.
   */
  private userGroupsEndpointMissing = false;
  private starredGroupsEndpointMissing = false;

  /**
   * Get all groups for a community
   */
  async getGroups(communityId: number, userId: number): Promise<Group[]> {
    try {
      const groups = await apiService.get<Group[]>(
        `/groups?communityId=${communityId}&userId=${userId}`
      );
      return groups || [];
    } catch (error: any) {
      // apiService already logs failed GETs to console.error; dev-only context here
      devLog('[GroupService] getGroups failed:', {
        status: error.response?.status ?? error.status,
        body: error.response?.data,
        message: error.message,
      });

      // Expected empty state: user is not a member of this community
      if ((error.status === 422 || error.response?.status === 422) &&
        String(error.response?.data?.error || error.message || '').toLowerCase().includes('not a member of requested community')) {
        return [];
      }

      // If the main endpoint fails (e.g., 500 error), try the alternative endpoint
      if (error.status === 500 || error.response?.status === 500) {
        try {
          const groups = await apiService.get<Group[]>(
            `/communities/${communityId}/groups`
          );
          return groups || [];
        } catch (altError: any) {
          devLog('[GroupService] Alternative /communities/.../groups also failed:', {
            status: altError.response?.status ?? altError.status,
            body: altError.response?.data,
          });
          return [];
        }
      }
      return [];
    }
  }

  /**
   * Get a single group by ID
   */
  async getGroup(groupId: number | string): Promise<Group | null> {
    try {
      const group = await apiService.get<Group>(`/groups/${groupId}`);
      return group;
    } catch (error) {
      console.error('Failed to fetch group:', error);
      return null;
    }
  }

  /**
   * Get groups that the user is a member of
   */
  async getGroupsByUser(userId: number): Promise<Group[]> {
    if (this.userGroupsEndpointMissing) return [];
    try {
      const groups = await apiService.get<Group[]>(`/groups/user/${userId}`);
      return groups || [];
    } catch (error: any) {
      if (error.status === 404 || error.response?.status === 404) {
        this.userGroupsEndpointMissing = true;
        return [];
      }
      // Keep real failures visible, but avoid duplicating ApiService logging
      devLog('[GroupService] getGroupsByUser failed:', {
        status: error.response?.status ?? error.status,
        body: error.response?.data,
        message: error.message,
      });
      return [];
    }
  }

  /**
   * Join a group
   * Tries multiple endpoint patterns to match backend API
   */
  async joinGroup(userId: number, groupId: number): Promise<Group> {
    try {
      try {
        return await apiService.post<Group>(
          `/groups/${groupId}/assign`,
          { userId }
        );
      } catch (assignError: any) {
        if (assignError.status === 404 || assignError.response?.status === 404) {
          try {
            return await apiService.post<Group>(
              `/groups/join`,
              { userId, groupId }
            );
          } catch (joinError: any) {
            if (joinError.status === 404 || joinError.response?.status === 404) {
              return await apiService.post<Group>(
                `/groups/${groupId}/join`,
                { userId }
              );
            }
            throw joinError;
          }
        }
        throw assignError;
      }
    } catch (error) {
      console.error('[GroupService] Failed to join group:', error);
      throw error;
    }
  }

  /**
   * Leave a group
   */
  async leaveGroup(userId: number, groupId: number): Promise<void> {
    try {
      await apiService.post(`/groups/leave`, { userId, groupId });
    } catch (error) {
      console.error('Failed to leave group:', error);
      throw error;
    }
  }

  /**
   * Create a new group
   */
  async createGroup(data: CreateGroupData): Promise<Group> {
    try {
      const group = await apiService.post<Group>('/groups/new', data);
      return group;
    } catch (error) {
      console.error('Failed to create group:', error);
      throw error;
    }
  }

  /**
   * Update a group
   */
  async updateGroup(groupId: number, data: Partial<CreateGroupData>): Promise<Group> {
    try {
      // Backend expects body to include groupId and uses PATCH /groups/edit
      const body = {
        ...data,
        id: groupId,
      };
      const group = await apiService.patch<Group>('/groups/edit', body);
      return group;
    } catch (error) {
      console.error('Failed to update group:', error);
      throw error;
    }
  }

  /**
   * Get or create conversation for a group
   */
  async getOrCreateConvo(groupId: number): Promise<{ conversationId: string }> {
    try {
      const result = await apiService.post<{ conversationId?: string; convoId?: string }>(
        `/groups/get-or-create-convo-id`,
        { groupId }
      );
      // Handle both response formats: {conversationId} or {convoId}
      return {
        conversationId: result.conversationId || result.convoId || ''
      };
    } catch (error) {
      console.error('Failed to get/create group conversation:', error);
      throw error;
    }
  }

  /**
   * Share a group
   */
  async shareGroup(groupId: number): Promise<{ shareUrl: string }> {
    try {
      const result = await apiService.post<{ shareUrl: string }>(
        `/groups/${groupId}/share`
      );
      return result;
    } catch (error) {
      console.error('Failed to share group:', error);
      throw error;
    }
  }

  /**
   * Get starred/favorited groups for a user
   * @param userId - User ID
   * @param communityId - Optional community ID to filter by. If null, returns groups from all communities
   */
  async getStarredGroups(userId: number, communityId?: number | null): Promise<Group[]> {
    if (this.starredGroupsEndpointMissing) {
      // Fall back to user groups only if that endpoint exists
      if (this.userGroupsEndpointMissing) return [];
      const allGroups = await this.getGroupsByUser(userId);
      let filtered = allGroups.filter(g => g.isFavorite === true);
      if (communityId !== null && communityId !== undefined) {
        filtered = filtered.filter(g => g.communityId === communityId);
      }
      return filtered;
    }
    try {
      let url = `/groups/user/${userId}/starred`;
      if (communityId !== null && communityId !== undefined) {
        url += `?communityId=${communityId}`;
      }
      const groups = await apiService.get<Group[]>(url);
      return groups || [];
    } catch (error: any) {
      // Silently handle 404s (endpoint not implemented yet)
      if (error.status === 404 || error.response?.status === 404) {
        this.starredGroupsEndpointMissing = true;
        // Try fallback - get all user groups and filter by isFavorite
        try {
          if (this.userGroupsEndpointMissing) return [];
          const allGroups = await this.getGroupsByUser(userId);
          let filtered = allGroups.filter(g => g.isFavorite === true);
          if (communityId !== null && communityId !== undefined) {
            filtered = filtered.filter(g => g.communityId === communityId);
          }
          return filtered;
        } catch (fallbackError: any) {
          // Also silently handle 404s on fallback
          if (fallbackError.status === 404 || fallbackError.response?.status === 404) {
            return [];
          }
          devLog('[GroupService] getStarredGroups fallback failed:', {
            status: fallbackError.response?.status ?? fallbackError.status,
            body: fallbackError.response?.data,
            message: fallbackError.message,
          });
          return [];
        }
      }
      devLog('[GroupService] getStarredGroups failed:', {
        status: error.response?.status ?? error.status,
        body: error.response?.data,
        message: error.message,
      });
      return [];
    }
  }
}

export const groupService = new GroupService();

