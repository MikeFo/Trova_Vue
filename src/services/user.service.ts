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
   */
  async getUsersByIds(userIds: number[]): Promise<Map<number, User>> {
    const usersMap = new Map<number, User>();
    
    // Fetch users in parallel
    const promises = userIds.map(async (userId) => {
      try {
        const user = await this.getUserById(userId);
        usersMap.set(userId, user);
      } catch (error) {
        console.warn(`Failed to fetch user ${userId}:`, error);
      }
    });

    await Promise.all(promises);
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
