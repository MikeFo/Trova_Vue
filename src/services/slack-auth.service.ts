import { environment } from '@/environments/environment';

const SLACK_REDIRECT_PREFIX = 'slack_redirect_';

/**
 * redirect_uri must match exactly: Slack app config, authorize link, and POST /public/slack/user-signin.
 * - In browser: uses VITE_SLACK_REDIRECT_ORIGIN (for ngrok) or current origin.
 * - SSR/fallback: uses environment.siteUrl.
 * For local dev with ngrok: set VITE_SLACK_REDIRECT_ORIGIN=https://your-subdomain.ngrok.io in .env.local.
 */
export function getSlackSignInRedirectUri(): string {
  if (typeof window !== 'undefined') {
    const base =
      (import.meta.env.VITE_SLACK_REDIRECT_ORIGIN as string) || window.location.origin;
    return `${base}/slack-signin-redirect`;
  }
  return `${environment.siteUrl || ''}/slack-signin-redirect`;
}

/**
 * Build Slack OpenID Connect authorize URL and store redirectTo for after sign-in.
 * Call this before redirecting the user to Slack.
 */
export function buildSlackAuthorizeUrl(redirectTo: string, slackTeamId?: string): string {
  const state = `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
  try {
    sessionStorage.setItem(`${SLACK_REDIRECT_PREFIX}${state}`, redirectTo);
  } catch (e) {
    console.warn('[SlackAuth] Could not store redirectTo', e);
  }

  const params = new URLSearchParams({
    scope: 'openid email profile',
    response_type: 'code',
    redirect_uri: getSlackSignInRedirectUri(),
    state,
    client_id: environment.slackClientId,
  });
  if (slackTeamId) {
    params.set('team', slackTeamId);
  }

  return `https://slack.com/openid/connect/authorize?${params.toString()}`;
}

/**
 * Retrieve and remove the stored redirect path for this state (after Slack redirects back).
 */
export function consumeStoredRedirectTo(state: string): string | null {
  const key = `${SLACK_REDIRECT_PREFIX}${state}`;
  try {
    const value = sessionStorage.getItem(key);
    if (value) sessionStorage.removeItem(key);
    return value;
  } catch {
    return null;
  }
}

/**
 * Check if the route query looks like a Slack deep link (user came from Slack).
 */
export function hasSlackParams(query: Record<string, unknown>): boolean {
  const hasSlackUserId = typeof query.slackUserId === 'string' && query.slackUserId.length > 0;
  const hasSlackContext =
    typeof query.slackTeamId === 'string' ||
    typeof query.communityId === 'string' ||
    typeof query.communityId === 'number' ||
    typeof query.s === 'string';
  return !!(hasSlackUserId && hasSlackContext);
}

/**
 * Check if the route has full Slack-link params required to load without auth:
 * slackUserId + s (secret) + communityId (from path or query).
 * When true, console/map/org can load via temp-code + backend validation instead of redirecting to slack-landing.
 */
export function hasSlackLinkParams(route: { params: Record<string, unknown>; query: Record<string, unknown> }): boolean {
  const slackUserId = typeof route.query.slackUserId === 'string' && route.query.slackUserId.length > 0;
  const s = typeof route.query.s === 'string' && route.query.s.length > 0;
  const communityIdFromQuery =
    (typeof route.query.communityId === 'string' && route.query.communityId.length > 0) ||
    (typeof route.query.communityId === 'number' && !isNaN(Number(route.query.communityId)));
  const communityIdFromParams =
    typeof route.params.communityId === 'string' && route.params.communityId.length > 0;
  return !!(slackUserId && s && (communityIdFromQuery || communityIdFromParams));
}
