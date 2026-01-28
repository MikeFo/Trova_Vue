import { apiService } from './api.service';

export interface Event {
  id: number;
  name: string;
  description?: string;
  startTime: string;
  endTime?: string;
  location?: string;
  photo?: string;
  communityId: number;
  groupId?: number;
  createdBy: number;
  isPrivate: boolean;
  attendeeCount?: number;
  userAttending?: boolean;
  userSaved?: boolean;
  attendees?: Array<{
    id: number;
    fname: string;
    lname: string;
    fullName: string;
    profilePicture?: string;
  }>;
  hasNotification?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateEventData {
  name: string;
  description?: string;
  startTime: string;
  endTime?: string;
  location?: string;
  photo?: string;
  communityId: number;
  groupId?: number;
  isPrivate: boolean;
}

export class EventService {
  /**
   * Get all events for a community
   */
  async getEvents(communityId: number, userId: number): Promise<Event[]> {
    try {
      // Backend uses /events/all/${communityId} (no userId param needed)
      const events = await apiService.get<Event[]>(
        `/events/all/${communityId}`
      );
      return events || [];
    } catch (error) {
      console.error('Failed to fetch events:', error);
      return [];
    }
  }

  /**
   * Get a single event by ID
   */
  async getEvent(eventId: number | string): Promise<Event | null> {
    try {
      const event = await apiService.get<Event>(`/events/${eventId}`);
      return event;
    } catch (error) {
      console.error('Failed to fetch event:', error);
      return null;
    }
  }

  /**
   * Get events for a specific month
   */
  async getEventsByMonth(year: number, month: number): Promise<Event[]> {
    try {
      // Backend uses /events/month/${yearMonth} format (e.g., "202311")
      const yearStr = year.toString();
      const monthStr = month < 10 ? '0' + month.toString() : month.toString();
      const events = await apiService.get<Event[]>(
        `/events/month/${yearStr + monthStr}`
      );
      return events || [];
    } catch (error) {
      console.error('Failed to fetch events by month:', error);
      return [];
    }
  }

  /**
   * Create a new event
   */
  async createEvent(data: CreateEventData): Promise<Event> {
    try {
      const event = await apiService.post<Event>('/events/new', data);
      return event;
    } catch (error) {
      console.error('Failed to create event:', error);
      throw error;
    }
  }

  /**
   * Update an event
   */
  async updateEvent(eventId: number, data: Partial<CreateEventData>, tags?: number[], groups?: any[], managers?: any[]): Promise<Event> {
    try {
      // Backend expects body to include eventId and uses PATCH /events/edit
      const body: any = {
        ...data,
        id: eventId,
      };
      if (tags) body.tags = tags;
      if (groups) body.groups = groups;
      if (managers) body.managers = managers;
      
      const event = await apiService.patch<Event>('/events/edit', body);
      return event;
    } catch (error) {
      console.error('Failed to update event:', error);
      throw error;
    }
  }

  /**
   * Toggle attendance (RSVP) to an event
   * This endpoint toggles attendance - if user is attending, it removes them; if not, it adds them
   */
  async toggleAttendance(eventId: number, body: any = {}): Promise<any> {
    try {
      // Backend uses PUT /events/${eventId}/attend (no userId in body, uses authenticated user)
      const result = await apiService.put(`/events/${eventId}/attend`, body);
      return result;
    } catch (error) {
      console.error('Failed to toggle attendance:', error);
      throw error;
    }
  }

  /**
   * RSVP to an event (convenience method that calls toggleAttendance)
   */
  async rsvpToEvent(eventId: number, userId: number): Promise<Event> {
    try {
      // Note: Backend uses authenticated user from token, userId param is ignored but kept for API compatibility
      const result = await this.toggleAttendance(eventId, {});
      return result;
    } catch (error) {
      console.error('Failed to RSVP to event:', error);
      throw error;
    }
  }

  /**
   * Cancel RSVP to an event (convenience method that calls toggleAttendance)
   */
  async cancelRsvp(eventId: number, userId: number): Promise<Event> {
    try {
      // Note: Backend uses authenticated user from token, userId param is ignored but kept for API compatibility
      // Toggle attendance to cancel
      const result = await this.toggleAttendance(eventId, {});
      return result;
    } catch (error) {
      console.error('Failed to cancel RSVP:', error);
      throw error;
    }
  }

  /**
   * Delete an event (if admin)
   */
  async deleteEvent(eventId: number): Promise<void> {
    try {
      await apiService.delete(`/events/${eventId}`);
    } catch (error) {
      console.error('Failed to delete event:', error);
      throw error;
    }
  }

  /**
   * Get upcoming events that the user has RSVP'd to
   * @param userId - User ID
   * @param communityId - Optional community ID to filter by. If null, returns events from all communities
   */
  async getUpcomingRSVPEvents(userId: number, communityId?: number | null): Promise<Event[]> {
    try {
      let url = `/events/user/${userId}/rsvp/upcoming`;
      if (communityId !== null && communityId !== undefined) {
        url += `?communityId=${communityId}`;
      }
      const events = await apiService.get<Event[]>(url);
      // Filter to only upcoming events and sort by date
      const now = new Date();
      const upcoming = (events || [])
        .filter(e => new Date(e.startTime) > now)
        .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
      return upcoming;
    } catch (error: any) {
      // Silently handle 404s (endpoint not implemented yet)
      if (error.status === 404 || error.response?.status === 404) {
        return [];
      }
      console.error('Failed to fetch upcoming RSVP events:', error);
      return [];
    }
  }

  /**
   * Share an event - generates a shareable URL
   */
  async shareEvent(eventId: number): Promise<string> {
    try {
      const result = await apiService.post<{ shareUrl: string }>(`/events/${eventId}/share`, {});
      return result.shareUrl || `${window.location.origin}/tabs/events/${eventId}`;
    } catch (error) {
      console.error('Failed to share event:', error);
      // Fallback to a basic URL if the endpoint fails
      return `${window.location.origin}/tabs/events/${eventId}`;
    }
  }

  /**
   * Toggle save/bookmark an event
   */
  async toggleSaveEvent(eventId: number, userId: number): Promise<Event> {
    try {
      // Backend uses authenticated user from token, userId param is kept for API compatibility
      const result = await apiService.put<Event>(`/events/${eventId}/save`, {});
      return result as Event;
    } catch (error) {
      console.error('Failed to toggle save event:', error);
      throw error;
    }
  }
}

export const eventService = new EventService();

