import { apiService } from './api.service';

export interface UserMatch {
  id: number;
  userId: number;
  matchedUserId: number;
  groupId?: number; // Primary field for counting unique connections (from database group_id)
  group_id?: number; // Alternative field name
  matchIndicesId?: number; // Fallback field (exclude 0 values - 0 is a default/null)
  communityId?: number;
  community_id?: number;
  type?: string; // 'trova_magic', 'channel_pairing', etc.
  matchType?: string;
  createdAt?: string;
  created_at?: string;
  score?: number;
  reasons?: string[];
  user?: {
    id: number;
    fname: string;
    lname: string;
    fullName: string;
    profilePicture?: string;
    bio?: string;
    interests?: string[];
    location?: string;
    education?: string[];
    organizations?: string[];
  };
  matchedUser?: {
    id: number;
    fname: string;
    lname: string;
    fullName: string;
    profilePicture?: string;
    bio?: string;
    interests?: string[];
    location?: string;
    education?: string[];
    organizations?: string[];
  };
}

class MatchService {
  /**
   * Get algorithmically matched users (Intros)
   */
  async getMatches(): Promise<UserMatch[]> {
    try {
      const matches = await apiService.get<UserMatch[]>('/matches');
      return matches || [];
    } catch (error) {
      console.error('[MatchService] Failed to fetch matches:', error);
      return [];
    }
  }
}

export const matchService = new MatchService();



