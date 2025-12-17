import { apiService } from './api.service';

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
   * Get all groups for a community
   */
  async getGroups(communityId: number, userId: number): Promise<Group[]> {
    try {
      const groups = await apiService.get<Group[]>(
        `/groups?communityId=${communityId}&userId=${userId}`
      );
      return groups || [];
    } catch (error: any) {
      // Log the actual error message from backend
      const errorMessage = error.response?.data?.error?.message || 
                          error.response?.data?.message || 
                          error.message;
      console.error('[GroupService] Failed to fetch groups:', errorMessage);
      console.error('[GroupService] Error details:', error.response?.data);
      
      // If the main endpoint fails (e.g., 500 error), try the alternative endpoint
      if (error.status === 500 || error.response?.status === 500) {
        console.log('[GroupService] Main endpoint returned 500, trying alternative endpoint...');
        try {
          // Try alternative endpoint: /communities/{communityId}/groups (no userId needed)
          const groups = await apiService.get<Group[]>(
            `/communities/${communityId}/groups`
          );
          console.log('[GroupService] Successfully fetched groups via alternative endpoint');
          return groups || [];
        } catch (altError: any) {
          const altErrorMessage = altError.response?.data?.error?.message || 
                                 altError.response?.data?.message || 
                                 altError.message;
          console.error('[GroupService] Alternative endpoint also failed:', altErrorMessage);
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
    try {
      const groups = await apiService.get<Group[]>(`/groups/user/${userId}`);
      return groups || [];
    } catch (error) {
      console.error('Failed to fetch user groups:', error);
      return [];
    }
  }

  /**
   * Join a group
   * Tries multiple endpoint patterns to match backend API
   */
  async joinGroup(userId: number, groupId: number): Promise<Group> {
    try {
      console.log('[GroupService] Joining group:', groupId, 'for user:', userId);
      
      // Try pattern 1: /groups/:id/assign (similar to communities)
      try {
        const group = await apiService.post<Group>(
          `/groups/${groupId}/assign`,
          { userId }
        );
        console.log('[GroupService] Successfully joined group (via /assign):', groupId);
        return group;
      } catch (assignError: any) {
        // If 404, try alternative endpoint
        if (assignError.status === 404 || assignError.response?.status === 404) {
          console.log('[GroupService] /assign endpoint not found, trying /join endpoint...');
          // Try pattern 2: /groups/join with body
          try {
            const group = await apiService.post<Group>(
              `/groups/join`,
              { userId, groupId }
            );
            console.log('[GroupService] Successfully joined group (via /join):', groupId);
            return group;
          } catch (joinError: any) {
            // If that also fails, try pattern 3: /groups/:id/join
            if (joinError.status === 404 || joinError.response?.status === 404) {
              console.log('[GroupService] /join endpoint not found, trying /groups/:id/join...');
              const group = await apiService.post<Group>(
                `/groups/${groupId}/join`,
                { userId }
              );
              console.log('[GroupService] Successfully joined group (via /groups/:id/join):', groupId);
              return group;
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
        // Try fallback - get all user groups and filter by isFavorite
        try {
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
          console.error('Fallback method failed:', fallbackError);
          return [];
        }
      }
      console.error('Failed to fetch starred groups:', error);
      return [];
    }
  }
}

export const groupService = new GroupService();

