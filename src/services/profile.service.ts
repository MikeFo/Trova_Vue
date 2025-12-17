import { apiService } from './api.service';
import { useAuthStore } from '@/stores/auth.store';

export interface DataThing {
  id: number;
  name: string;
  photo: string;
  type: string;
  altNames: string;
}

export interface ProfileData {
  firstName: string;
  lastName: string;
  passions: Array<string | DataThing>;
  interests: Array<string | DataThing>;
  photo: string | null;
  locations: Array<{
    type: string;
    primaryName: string;
    secondaryName: string;
    lat: number;
    lng: number;
    googlePlaceId: string;
  }>;
  currentEmployer: string | null;
  pastEmployers: string[];
  jobTitle: string;
  school: string;
  degree: string;
  intentions: Array<string | DataThing>;
}

function extractThingName(thing: string | DataThing): string {
  return typeof thing === 'string' ? thing : thing.name;
}

function extractThingIds(things: Array<string | DataThing>): Array<number | string> {
  return things.map(t => typeof t === 'string' ? t : t.id);
}

export interface ProfilesInit {
  id: number;
  userId: number;
  fname: string;
  lname: string;
  fullName?: string;
  profilePicture?: string;
  bio?: string;
  interests?: string[];
  passions?: string[];
  // Location data for map display (from production)
  currentLat?: number;
  currentLong?: number;
  currentLocationName?: string;
  // Legacy locations array (for profile setup)
  locations?: Array<{
    type: string;
    primaryName: string;
    secondaryName: string;
    lat: number;
    lng: number;
    googlePlaceId: string;
  }>;
  education?: string[];
  organizations?: string[];
  currentEmployer?: string;
  pastEmployers?: string[];
  jobTitle?: string;
  school?: string;
  degree?: string;
  intentions?: string[];
  hometowns?: string[];
  sportsTeams?: string[];
  pets?: string[];
  matchReasons?: Record<string, any>;
  isCurrentUser?: boolean; // For map highlighting
  skills?: string[] | Array<{ name: string; type?: string }> | Record<string, any> | string; // Skills data - can be array, object, or string
}

export class ProfileService {
  async saveProfile(profileData: ProfileData): Promise<any> {
    const authStore = useAuthStore();
    const userId = authStore.user?.id;
    
    if (!userId) {
      throw new Error('User not authenticated');
    }

    // Build payload with only fields that have values
    const payload: any = {};
    
    // Use fname/lname to match backend API (not firstName/lastName)
    if (profileData.firstName) payload.fname = profileData.firstName;
    if (profileData.lastName) payload.lname = profileData.lastName;
    if (profileData.passions && profileData.passions.length > 0) {
      payload.passions = profileData.passions.map(extractThingName);
      payload.passionIds = profileData.passions.map(t => typeof t === 'string' ? null : t.id).filter((id): id is number => id !== null);
    }
    if (profileData.interests && profileData.interests.length > 0) {
      payload.interests = profileData.interests.map(extractThingName);
      payload.interestIds = profileData.interests.map(t => typeof t === 'string' ? null : t.id).filter((id): id is number => id !== null);
    }
    if (profileData.photo) payload.photo = profileData.photo;
    if (profileData.locations && profileData.locations.length > 0) payload.locations = profileData.locations;
    if (profileData.currentEmployer) payload.currentEmployer = profileData.currentEmployer;
    if (profileData.pastEmployers && profileData.pastEmployers.length > 0) payload.pastEmployers = profileData.pastEmployers;
    if (profileData.jobTitle) payload.jobTitle = profileData.jobTitle;
    if (profileData.school) payload.school = profileData.school;
    if (profileData.degree) payload.degree = profileData.degree;
    if (profileData.intentions && profileData.intentions.length > 0) {
      payload.intentions = profileData.intentions.map(extractThingName);
      payload.intentionIds = profileData.intentions.map(t => typeof t === 'string' ? null : t.id).filter((id): id is number => id !== null);
    }

    // Save profile data to backend
    // Use PATCH /profile/edit (matches backend API - uses authenticated user from token)
    return apiService.patch('/profile/edit', payload);
  }

  async completeSetup(): Promise<any> {
    const authStore = useAuthStore();
    const user = authStore.user;
    
    if (!user || !user.id) {
      console.error('completeSetup: User not authenticated. User object:', user);
      throw new Error('User not authenticated. Please log in again.');
    }

    console.log(`completeSetup: Updating setup step for user ${user.id}`);
    
    try {
      // Update user setup step to complete
      // Use PATCH /users/${userId}/edit?background=false (matches backend API)
      // Send user object with setupStep updated (matches old Angular implementation)
      const userPayload = {
        ...user,
        setupStep: 'complete',
      };
      
      // Remove fields that don't exist in database (matching old implementation)
      delete (userPayload as any).isOnline;
      delete (userPayload as any).profilePictureThumbnail;
      delete (userPayload as any).profilePicture175x175;
      
      const updatedUser = await apiService.patch(`/users/${user.id}/edit?background=false`, userPayload);
      
      console.log('completeSetup: Setup step updated successfully', updatedUser);
      
      // Update auth store with updated user
      if (updatedUser) {
        authStore.setUser(updatedUser);
      } else {
        // If backend doesn't return user, update locally so user can proceed
        authStore.updateSetupStep('complete');
      }
      
      return updatedUser;
    } catch (error: any) {
      console.error('completeSetup: Error updating setup step:', error);
      // Even if API call fails, update locally so user can proceed
      authStore.updateSetupStep('complete');
      throw error;
    }
  }

  /**
   * Get all community member profiles for directory/search
   * POST /communities/getProfilesForUserAndCommunity
   * @param communityId - The community ID
   * @param secretId - Optional secret ID from Slack link (for 60-second expiration validation)
   */
  async getProfilesForUserAndCommunity(communityId: number, secretId?: string): Promise<ProfilesInit[]> {
    try {
      const payload: any = { communityId };
      if (secretId) {
        payload.s = secretId;
      }
      
      const profiles = await apiService.post<ProfilesInit[]>(
        '/communities/getProfilesForUserAndCommunity',
        payload
      );
      return profiles || [];
    } catch (error) {
      console.error('[ProfileService] Failed to fetch profiles:', error);
      throw error; // Re-throw to allow caller to handle errors (e.g., expired secretId)
    }
  }
}

export const profileService = new ProfileService();

