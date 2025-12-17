import { apiService } from './api.service';

export interface ActivityItem {
  id: number | string;
  type: 'message' | 'update' | 'event' | 'group';
  content: string;
  author?: {
    id: number;
    fname: string;
    lname: string;
    fullName: string;
    profilePicture?: string;
  };
  communityId: number;
  communityName?: string;
  timestamp: string | Date;
  groupId?: number;
  groupName?: string;
  eventId?: number;
  eventName?: string;
}

export class ActivityService {
  /**
   * Get community activity feed
   * @param communityId - Community ID
   */
  async getCommunityActivity(communityId: number): Promise<ActivityItem[]> {
    try {
      const activity = await apiService.get<ActivityItem[]>(
        `/communities/${communityId}/activity`
      );
      // Sort by timestamp (most recent first)
      return (activity || []).sort((a, b) => {
        const timeA = new Date(a.timestamp).getTime();
        const timeB = new Date(b.timestamp).getTime();
        return timeB - timeA;
      });
    } catch (error: any) {
      // Silently handle 404s (endpoint not implemented yet)
      if (error.status === 404 || error.response?.status === 404) {
        return [];
      }
      console.error('Failed to fetch community activity:', error);
      return [];
    }
  }

  /**
   * Get activity from all user's communities (aggregated)
   * @param userId - User ID
   */
  async getAllCommunitiesActivity(userId: number): Promise<ActivityItem[]> {
    try {
      const activity = await apiService.get<ActivityItem[]>(
        `/users/${userId}/activity/all`
      );
      // Sort by timestamp (most recent first)
      return (activity || []).sort((a, b) => {
        const timeA = new Date(a.timestamp).getTime();
        const timeB = new Date(b.timestamp).getTime();
        return timeB - timeA;
      });
    } catch (error: any) {
      // Silently handle 404s (endpoint not implemented yet)
      if (error.status === 404 || error.response?.status === 404) {
        return [];
      }
      console.error('Failed to fetch all communities activity:', error);
      return [];
    }
  }
}

export const activityService = new ActivityService();

