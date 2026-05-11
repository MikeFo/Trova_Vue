<template>
  <ion-page class="slack-profile-write-page">
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

    <ion-content class="slack-profile-write-content">
      <div v-if="phase === 'loading'" class="shell shell--narrow center">
        <ion-spinner name="crescent" />
        <p>Connecting your Slack profile…</p>
      </div>

      <div v-else-if="phase === 'success'" class="shell shell--narrow">
        <div class="success-icon-wrap" aria-hidden="true">
          <ion-icon :icon="checkmarkCircle" class="success-icon" />
        </div>
        <h1 class="headline center-text">You’re all set</h1>
        <p class="subhead center-text">
          Trova can update your custom status in Slack. Head back to Slack to finish editing your status.
        </p>

        <ion-button expand="block" size="large" class="cta-primary" @click="returnToSlack">
          Return to Slack
        </ion-button>
      </div>

      <div v-else-if="phase === 'error'" class="shell shell--narrow">
        <ion-text color="danger">
          <h2>Couldn’t connect profile permissions</h2>
          <p>{{ errorMessage }}</p>
        </ion-text>
        <ion-button expand="block" class="ion-margin-top" @click="retry">Try again</ion-button>
        <ion-button expand="block" fill="clear" @click="returnToSlack">Return to Slack</ion-button>
      </div>

      <div v-else class="shell shell--narrow">
        <ion-text color="danger">
          <h2>Missing authorization</h2>
          <p>
            This page opens after you approve Trova in Slack. Open Custom Status from Trova in Slack and use
            <strong>Approve on Slack</strong> again.
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

/** Match trova-api `getUrlSlackAuthCustomStatus`: encodeURI(baseUrl + '/slack-profile-write-redirect') */
function buildRedirectUri(): string {
  return encodeURI(`${environment.siteUrl}/slack-profile-write-redirect`);
}

async function runExchange() {
  const code = route.query.code as string | undefined;
  const slackError = route.query.error as string | undefined;

  if (slackError) {
    phase.value = 'error';
    errorMessage.value =
      (typeof slackError === 'string' && decodeURIComponent(slackError)) || 'Authorization was denied or failed.';
    return;
  }

  if (!code) {
    phase.value = 'missing_params';
    return;
  }

  try {
    const redirectUri = buildRedirectUri();
    const res = await communityService.slackProfileWriteAuthUser(code, redirectUri);
    const team =
      typeof res?.slackTeamId === 'string' && res.slackTeamId.trim() ? res.slackTeamId.trim() : null;
    slackTeamId.value = team;
    phase.value = 'success';
  } catch (e: unknown) {
    phase.value = 'error';
    errorMessage.value =
      e instanceof Error ? e.message : 'Could not complete Slack authorization. Please try again.';
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
  phase.value = 'loading';
  void runExchange();
}

onMounted(() => {
  void runExchange();
});
</script>

<style scoped>
.slack-profile-write-page {
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

.slack-profile-write-content {
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
