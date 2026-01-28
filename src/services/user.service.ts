import { apiService } from './api.service';
import type { User } from '../stores/auth.store';

export interface UserProfile {
  id: number;
  fname: string;
  lname: string;
  email: string;
  profilePicture: string;
  [key: string]: any;
}

export class UserService {
  async fetchCurrentUserProfile(): Promise<User | null> {
    try {
      // API call to get the current user profile
      const user = await apiService.get<User>('/users/me');
      return user;
    } catch (error) {
      console.error('Failed to fetch user profile:', error);
      return null;
    }
  }

  async getUserById(userId: number | string): Promise<User> {
    return apiService.get<User>(`/users/${userId}`);
  }

  async updateUser(user: Partial<User>, userId: number, backgroundEdit: boolean = false): Promise<User> {
    // Backend uses PATCH /users/${userId}/edit?background=${backgroundEdit}
    // Need to delete fields that don't exist in the database
    const userPayload: any = { ...user };
    delete userPayload.isOnline;
    delete userPayload.profilePictureThumbnail;
    delete userPayload.profilePicture175x175;
    userPayload.id = userId;
    
    return apiService.patch<User>(`/users/${userId}/edit?background=${backgroundEdit}`, userPayload);
  }

  async searchUsers(query: string): Promise<User[]> {
    return apiService.get<User[]>(`/users/search?q=${encodeURIComponent(query)}`);
  }

  /**
   * Get multiple users by IDs
   * Optimized to use batch endpoint if available, otherwise falls back to parallel individual calls
   */
  async getUsersByIds(userIds: number[]): Promise<Map<number, User>> {
    if (!userIds || userIds.length === 0) {
      return new Map<number, User>();
    }

    const usersMap = new Map<number, User>();
    
    // Try batch endpoint first (fastest option)
    try {
      const ids = userIds.join(',');
      const batchUrl = `/users/batch?ids=${ids}`;
      console.log(`[UserService] 🚀 Using batch endpoint for ${userIds.length} users`);
      const batchUsers = await apiService.get<User[]>(batchUrl);
      
      if (batchUsers && Array.isArray(batchUsers)) {
        batchUsers.forEach((user) => {
          if (user && user.id) {
            usersMap.set(user.id, user);
          }
        });
        console.log(`[UserService] ✅ Batch endpoint returned ${usersMap.size} users`);
        return usersMap;
      }
    } catch (batchError: any) {
      const status = batchError?.status || batchError?.response?.status;
      if (status === 404) {
        console.log(`[UserService] Batch endpoint not available (404), falling back to individual calls`);
      } else {
        console.warn(`[UserService] Batch endpoint failed (${status}), falling back to individual calls:`, batchError);
      }
    }
    
    // Fallback: Fetch users in parallel (but limit concurrency to avoid overwhelming the server)
    console.log(`[UserService] Fetching ${userIds.length} users individually in parallel`);
    const BATCH_SIZE = 20; // Process in batches to avoid too many concurrent requests
    for (let i = 0; i < userIds.length; i += BATCH_SIZE) {
      const batch = userIds.slice(i, i + BATCH_SIZE);
      const promises = batch.map(async (userId) => {
        try {
          const user = await this.getUserById(userId);
          usersMap.set(userId, user);
        } catch (error) {
          console.warn(`Failed to fetch user ${userId}:`, error);
        }
      });
      await Promise.all(promises);
    }
    
    return usersMap;
  }

  /**
   * Set user profile picture URL
   */
  async setUserImageUrl(url: string, userId: number): Promise<User> {
    return apiService.post<User>(
      `/users/${userId}/set-profile-picture`,
      { profilePicture: url }
    );
  }
}

export const userService = new UserService();
