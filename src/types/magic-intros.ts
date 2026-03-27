export interface DateRange {
  /**
   * ISO date (no time), e.g. '2026-03-01'
   */
  startDate: string;
  /**
   * ISO date (no time), e.g. '2026-03-31'
   */
  endDate: string;
}

// Card response: /communities/:id/stats/trova-magic-engaged
export interface MagicIntroSummary {
  totalPairs: number;
  engagedPairs: number;
}

// By-date response: /communities/:id/stats/trova-magic-engaged/by-date
export interface MagicIntroByDateRow {
  /**
   * 'YYYY-MM-DD'
   */
  date: string;
  totalPairings: number;
  engaged: number;
  /**
   * Percentage, e.g. 40 for 40.0%
   */
  engagementRate: number;
}

export interface MagicIntroByDateResponse {
  results: MagicIntroByDateRow[];
}

// Engaged users response: /communities/:id/stats/trova-magic-engaged/users
export interface MagicIntroEngagedUser {
  userId: number;
  name: string | null;
  email: string | null;
  profilePicture: string | null;
}

export interface MagicIntroEngagedUsersResponse {
  users: MagicIntroEngagedUser[];
}

// Pairings response: /communities/:id/stats/trova-magic-engaged/pairings
export interface MagicIntroPairingParticipant {
  userId: number;
  name: string | null;
  email: string | null;
  profilePicture: string | null;
  messageCount: number;
}

export interface MagicIntroPairingRow {
  channelId: string;
  createdAt: string;
  participants: MagicIntroPairingParticipant[];
  totalHumanMessages: number;
  distinctHumanSpeakers: number;
  isFullyEngaged: boolean;
}

export interface MagicIntroPairingsResponse {
  pairings: MagicIntroPairingRow[];
}

