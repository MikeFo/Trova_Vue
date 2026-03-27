import { apiService } from './api.service';
import type {
  DateRange,
  MagicIntroSummary,
  MagicIntroByDateResponse,
  MagicIntroEngagedUsersResponse,
  MagicIntroPairingsResponse,
} from '@/types/magic-intros';

/**
 * Fetch Magic Intro summary (engaged / total) for a community and date range.
 *
 * API: GET /communities/:id/stats/trova-magic-engaged
 */
export async function fetchMagicIntroSummary(
  communityId: number,
  range?: DateRange
): Promise<MagicIntroSummary> {
  const params =
    range != null
      ? {
          startDate: range.startDate,
          endDate: range.endDate,
        }
      : undefined;

  return apiService.get<MagicIntroSummary>(
    `/communities/${communityId}/stats/trova-magic-engaged`,
    params ? { params } : undefined
  );
}

/**
 * Fetch Magic Intros grouped by date within a range.
 *
 * API: GET /communities/:id/stats/trova-magic-engaged/by-date
 */
export async function fetchMagicIntroByDate(
  communityId: number,
  range?: DateRange
): Promise<MagicIntroByDateResponse> {
  const params =
    range != null
      ? {
          startDate: range.startDate,
          endDate: range.endDate,
        }
      : undefined;

  return apiService.get<MagicIntroByDateResponse>(
    `/communities/${communityId}/stats/trova-magic-engaged/by-date`,
    params ? { params } : undefined
  );
}

/**
 * Fetch users who engaged with Magic Intros within a range.
 *
 * API: GET /communities/:id/stats/trova-magic-engaged/users
 */
export async function fetchMagicIntroEngagedUsers(
  communityId: number,
  range?: DateRange
): Promise<MagicIntroEngagedUsersResponse> {
  const params =
    range != null
      ? {
          startDate: range.startDate,
          endDate: range.endDate,
        }
      : undefined;

  return apiService.get<MagicIntroEngagedUsersResponse>(
    `/communities/${communityId}/stats/trova-magic-engaged/users`,
    params ? { params } : undefined
  );
}

/**
 * Fetch Magic Intro pairings with per-participant human message counts.
 *
 * API: GET /communities/:id/stats/trova-magic-engaged/pairings
 *
 * Query params:
 * - startDate, endDate (required for finite timeframes; omit for all-time)
 * - date (optional YYYY-MM-DD to drill into a single run date bucket)
 */
export async function fetchMagicIntroPairings(
  communityId: number,
  args: { range?: DateRange; date?: string }
): Promise<MagicIntroPairingsResponse> {
  const params: Record<string, string> = {};
  if (args.range) {
    params.startDate = args.range.startDate;
    params.endDate = args.range.endDate;
  }
  if (args.date) {
    params.date = args.date;
  }

  return apiService.get<MagicIntroPairingsResponse>(
    `/communities/${communityId}/stats/trova-magic-engaged/pairings`,
    Object.keys(params).length ? { params } : undefined
  );
}

