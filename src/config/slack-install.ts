import { environment } from '@/environments/environment';

/**
 * Bot scopes for “Add Trova to Slack” (install) — keep in sync with trova-api `utilities.getSlackScopes()` production list.
 */
export const SLACK_APP_INSTALL_SCOPES =
  'channels:history,channels:manage,channels:read,chat:write,chat:write.customize,chat:write.public,commands,groups:history,groups:read,im:history,mpim:history,mpim:write,reactions:read,team:read,users:read,users:read.email,users.profile:read';

/**
 * Build Slack OAuth v2 authorize URL for workspace app installation.
 * Redirect URI must exactly match a URL configured on the Slack app.
 */
export function buildSlackAppInstallAuthorizeUrl(options: {
  redirectUri: string;
  teamId?: string | null;
}): string {
  const clientId = environment.slackClientId;
  if (!clientId) {
    throw new Error('Slack client id is not configured (environment.slackClientId)');
  }
  const params = new URLSearchParams({
    client_id: clientId,
    scope: SLACK_APP_INSTALL_SCOPES,
    user_scope: '',
    redirect_uri: options.redirectUri,
  });
  if (options.teamId) {
    params.set('team', options.teamId);
  }
  return `https://slack.com/oauth/v2/authorize?${params.toString()}`;
}
