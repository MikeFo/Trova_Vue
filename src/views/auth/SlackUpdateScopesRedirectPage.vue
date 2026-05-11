<template>
  <ion-page class="slack-update-scopes-page">
    <ion-header class="slack-flow-header">
      <ion-toolbar
        class="slack-flow-toolbar"
        style="
          --padding-start: max(24px, env(safe-area-inset-left, 0px));
          --padding-end: max(24px, env(safe-area-inset-right, 0px));
        "
      >
        <div class="slack-header-inner">
          <div class="slack-flow-brand-slot">
            <TrovaSlackBrandMark variant="toolbar" />
          </div>
        </div>
      </ion-toolbar>
    </ion-header>

    <ion-content class="slack-update-scopes-content">
      <div v-if="phase === 'loading'" class="shell shell--narrow center">
        <ion-spinner name="crescent" />
        <p>Updating your Slack permissions…</p>
      </div>

      <div v-else-if="phase === 'success'" class="shell shell--narrow">
        <div class="success-icon-wrap" aria-hidden="true">
          <ion-icon :icon="checkmarkCircle" class="success-icon" />
        </div>
        <h1 class="headline center-text">Awesome, you’re all set!</h1>
        <p class="subhead center-text">
          Trova has the latest approved permissions. You can head back to Slack to keep going.
        </p>

        <ion-button expand="block" size="large" class="cta-primary" @click="returnToSlack">
          Return to Slack
        </ion-button>
      </div>

      <div v-else-if="phase === 'error'" class="shell shell--narrow">
        <ion-text color="danger">
          <h2>Couldn’t update permissions</h2>
          <p>{{ errorMessage }}</p>
        </ion-text>
        <ion-button expand="block" class="ion-margin-top" @click="retry">Try again</ion-button>
        <ion-button expand="block" fill="clear" @click="returnToSlack">Return to Slack</ion-button>
      </div>

      <div v-else class="shell shell--narrow">
        <ion-text color="danger">
          <h2>Missing authorization details</h2>
          <p>
            This page is only used after Slack redirects back to Trova. Please restart the update-scopes flow from
            Slack.
          </p>
        </ion-text>
        <ion-button expand="block" fill="clear" @click="returnToSlack">Return to Slack</ion-button>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import { IonPage, IonHeader, IonToolbar, IonContent, IonSpinner, IonButton, IonText, IonIcon } from '@ionic/vue';
import { checkmarkCircle } from 'ionicons/icons';
import { communityService } from '@/services/community.service';
import { environment } from '@/environments/environment';
import TrovaSlackBrandMark from '@/components/TrovaSlackBrandMark.vue';

type Phase = 'loading' | 'success' | 'error' | 'missing_params';

const route = useRoute();

const phase = ref<Phase>('loading');
const errorMessage = ref('Something went wrong. Please try again.');
const slackTeamId = ref<string | null>(null);
const communityId = ref<number | null>(null);

function extractSlackTeamId(res: any): string | null {
  const candidates = [
    res?.slackTeamId,
    res?.teamId,
    res?.team_id,
    res?.extraInfo?.slackTeamId,
    res?.extraInfo?.slackTeamID,
    res?.extraInfo?.teamId,
    res?.extraInfo?.team_id,
    res?.slack?.teamId,
    res?.slack?.team_id,
  ];
  for (const c of candidates) {
    if (typeof c === 'string' && c.trim()) return c;
  }
  return null;
}

function buildRedirectUri(cid: number): string {
  // Mirror legacy Ionic behavior: encodeURI(siteUrl + '/slack-update-scopes-redirect?communityId=...')
  return encodeURI(`${environment.siteUrl}/slack-update-scopes-redirect?communityId=${cid}`);
}

async function runUpdateScopes() {
  const cidRaw = route.query.communityId as string | undefined;
  const code = route.query.code as string | undefined;
  const slackError = route.query.error as string | undefined;

  if (slackError) {
    phase.value = 'error';
    errorMessage.value =
      (typeof slackError === 'string' && decodeURIComponent(slackError)) || 'Authorization was denied or failed.';
    return;
  }

  const cid = cidRaw ? Number(cidRaw) : NaN;
  if (!Number.isFinite(cid) || !code) {
    phase.value = 'missing_params';
    return;
  }

  communityId.value = cid;

  try {
    const redirectUri = buildRedirectUri(cid);
    const res = await communityService.slackUpdateScopesSuccessful(cid, code, redirectUri);
    slackTeamId.value = extractSlackTeamId(res);
    phase.value = 'success';
  } catch (e: unknown) {
    phase.value = 'error';
    errorMessage.value = e instanceof Error ? e.message : 'Could not complete Slack re-authorization. Please try again.';
  }
}

function returnToSlack() {
  const team = slackTeamId.value;
  const appId = environment.slackAppId;
  if (team && appId) {
    window.location.href = `slack://app?team=${encodeURIComponent(team)}&id=${encodeURIComponent(appId)}&tab=home`;
  } else {
    window.location.href = 'slack://open';
  }
}

function retry() {
  // We can't restart the Slack consent flow from here without knowing the authorize URL used upstream.
  // Best effort: re-run the backend exchange in case this was a transient network issue.
  phase.value = 'loading';
  void runUpdateScopes();
}

onMounted(() => {
  void runUpdateScopes();
});
</script>

<style scoped>
/* Keep Slack OAuth UI light-themed for consistent brand mark readability. */
.slack-update-scopes-page {
  color-scheme: light;
  --ion-background-color: #ffffff;
  --ion-text-color: #1a1a1a;
  --ion-toolbar-background: #ffffff;
  --ion-toolbar-color: #1a1a1a;
}

.slack-flow-toolbar {
  --min-height: 52px;
  --border-width: 0 0 1px 0;
}

.slack-header-inner {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  width: 100%;
  max-width: 960px;
  margin-inline: auto;
  box-sizing: border-box;
}

.slack-flow-brand-slot {
  display: flex;
  justify-content: flex-start;
  align-items: center;
  padding: 6px 0;
}

.slack-update-scopes-content {
  --padding-start: max(24px, env(safe-area-inset-left, 0px));
  --padding-end: max(24px, env(safe-area-inset-right, 0px));
  --padding-top: 18px;
  --padding-bottom: 24px;
}

.shell {
  margin: 0 auto;
  width: 100%;
}
.shell--narrow {
  max-width: 28rem;
}
.shell.center,
.center {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 50vh;
  gap: 1rem;
}

.success-icon-wrap {
  display: flex;
  justify-content: center;
  margin: 0.5rem 0 0.75rem;
}
.success-icon {
  font-size: 3.25rem;
  color: var(--ion-color-primary);
}

.headline {
  margin: 0 0 0.6rem;
  font-size: 1.6rem;
  font-weight: 800;
  letter-spacing: -0.02em;
  line-height: 1.2;
  color: #0f172a;
}

.subhead {
  margin: 0 0 1.25rem;
  font-size: 1rem;
  line-height: 1.55;
  color: #475569;
}

.center-text {
  text-align: center;
}

.cta-primary {
  --border-radius: 12px;
  font-weight: 600;
}
</style>

