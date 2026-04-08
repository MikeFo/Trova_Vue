<template>
  <ion-page class="slack-redirect-page">
    <ion-header class="slack-flow-header">
      <ion-toolbar
        class="slack-flow-toolbar"
        style="
          --padding-start: max(24px, env(safe-area-inset-left, 0px));
          --padding-end: max(24px, env(safe-area-inset-right, 0px));
        "
      >
        <!-- Default slot: same max-width + centering as .shell--wide so logo lines up with body column -->
        <div class="slack-header-inner">
          <div class="slack-flow-brand-slot">
            <TrovaSlackBrandMark variant="toolbar" />
          </div>
        </div>
      </ion-toolbar>
    </ion-header>
    <ion-content class="slack-redirect-content">
      <!-- OAuth error -->
      <div v-if="phase === 'oauth_error'" class="shell shell--narrow">
        <ion-text color="danger">
          <h2>Something went wrong</h2>
          <p>{{ oauthError }}</p>
        </ion-text>
        <ion-button expand="block" class="ion-margin-top" @click="retryInstall">Try again</ion-button>
        <ion-button expand="block" fill="clear" @click="router.push('/login')">Go to login</ion-button>
      </div>

      <!-- Loading OAuth -->
      <div v-else-if="phase === 'loading'" class="shell shell--narrow center">
        <ion-spinner name="crescent" />
        <p>Connecting your workspace…</p>
      </div>

      <!-- Wizard -->
      <div
        v-else-if="phase === 'wizard'"
        :class="['shell', phase === 'wizard' ? 'shell--wide' : 'shell--narrow']"
      >
        <ion-note v-if="designPreview" class="preview-banner" color="warning">
          Design preview: OAuth and save requests are skipped. Remove ?preview=1 for a real install.
        </ion-note>

        <!-- Step 1 -->
        <template v-if="wizardStep === 1">
          <section class="step1">
            <div class="step1-copy">
              <p v-if="slackTeamName" class="context-line">
                Setting up Trova for <strong>{{ slackTeamName }}</strong>
              </p>
              <h1 class="headline">Turn your Slack workspace into a connected community</h1>
              <p class="subhead">Profiles, introductions, and connections, all without leaving Slack.</p>
              <ul class="outcomes">
                <li>See who’s who across your team instantly</li>
                <li>Help people find others by skill, interest, or location</li>
                <li>Make it easier to connect, online and in person</li>
              </ul>
            </div>

            <div class="slack-examples-panel" role="region" aria-label="Examples of Trova in Slack">
              <p class="slack-examples-kicker">Real messages in Slack</p>
              <div class="slack-examples">
                <figure class="slack-example-fig">
                  <div class="slack-example-frame">
                    <img
                      src="/images/slack-onboarding/group-pairing.png"
                      alt="Slack message from Trova app: group pairing for teams to connect after training"
                      class="slack-example-img"
                      loading="lazy"
                    />
                  </div>
                  <figcaption class="slack-example-cap">
                    Programs and pairing, posted where your team already works
                  </figcaption>
                </figure>
                <figure class="slack-example-fig">
                  <div class="slack-example-frame">
                    <img
                      src="/images/slack-onboarding/welcome-intro.png"
                      alt="Slack message from Trova app: welcome a teammate with profile highlights and photo"
                      class="slack-example-img"
                      loading="lazy"
                    />
                  </div>
                  <figcaption class="slack-example-cap">
                    Welcomes and intros with rich context, no extra tools
                  </figcaption>
                </figure>
              </div>
            </div>

            <ion-button expand="block" size="large" class="cta-primary step1-cta" @click="wizardStep = 2">
              Continue
            </ion-button>
          </section>
        </template>

        <!-- Step 2 -->
        <template v-else-if="wizardStep === 2">
          <section class="step2">
            <header class="step2-header">
              <h2 class="step-title">Set up your Trova workspace</h2>
              <p class="step-sub">
                Choose how this workspace appears in Trova. You can change name and type anytime.
              </p>
            </header>

            <div class="setup-grid">
              <div class="setup-column">
                <div class="setup-form-card">
                  <div class="setup-field-block">
                    <label class="setup-field-label" for="slack-setup-name">Community name</label>
                    <ion-item lines="none" class="setup-field-shell">
                      <ion-input
                        id="slack-setup-name"
                        v-model="formName"
                        class="setup-ion-input"
                        type="text"
                        autocomplete="organization"
                        placeholder="Acme Engineering"
                      />
                    </ion-item>
                  </div>

                  <div class="setup-field-block setup-field-block--last">
                    <span class="setup-field-label" id="slack-setup-type-label">Workspace type</span>
                    <ion-item lines="none" class="setup-field-shell" aria-labelledby="slack-setup-type-label">
                      <ion-select
                        v-model="formType"
                        class="setup-ion-select"
                        interface="popover"
                        placeholder="Select type"
                        :interface-options="{ header: 'Workspace type' }"
                      >
                        <ion-select-option v-for="opt in communityTypes" :key="opt.value" :value="opt.value">
                          {{ opt.label }}
                        </ion-select-option>
                      </ion-select>
                    </ion-item>
                  </div>
                </div>

                <div class="setup-actions">
                  <ion-button
                    expand="block"
                    size="large"
                    class="cta-primary setup-submit"
                    :disabled="!canSubmitStep2 || savingStep2"
                    @click="submitStep2"
                  >
                    <ion-spinner v-if="savingStep2" name="crescent" class="btn-spinner" />
                    <span v-else>Continue</span>
                  </ion-button>
                  <button type="button" class="setup-back-link" @click="wizardStep = 1">Back</button>
                </div>

                <div class="legal-inline setup-legal">
                  <ion-checkbox v-model="acceptedTerms" class="legal-check" />
                  <span class="legal-text">
                    By continuing, you agree to our
                    <a href="https://www.trova.io" target="_blank" rel="noopener noreferrer" class="legal-a"
                      >Terms</a
                    >
                    and
                    <a href="https://www.trova.io" target="_blank" rel="noopener noreferrer" class="legal-a"
                      >Privacy Policy</a
                    >.
                  </span>
                </div>
              </div>

              <aside class="directory-preview-aside" aria-label="Directory preview">
                <p class="directory-preview-kicker">Included for your workspace</p>
                <p class="directory-preview-title">Trova Directory</p>
                <p class="directory-preview-helper">
                  We create a searchable directory automatically. Your team can explore by interests, skills, location,
                  and more as profiles are added.
                </p>
                <div class="directory-preview-frame">
                  <img
                    src="/images/slack-onboarding/directory-preview.png"
                    alt="Trova Directory with search and sample member listings"
                    class="directory-preview-img"
                    loading="lazy"
                  />
                </div>
              </aside>
            </div>
          </section>
        </template>

        <!-- Step 3 -->
        <template v-else-if="wizardStep === 3">
          <div class="step3">
            <div class="success-icon-wrap" aria-hidden="true">
              <ion-icon :icon="checkmarkCircle" class="success-icon" />
            </div>
            <h2 class="step3-title">You’re ready to go. Here’s what happens next</h2>

            <div class="next-card">
              <p class="next-card-title">You’re set up</p>
              <ul class="next-checks">
                <li>
                  <ion-icon :icon="checkmarkOutline" class="check-ico" />
                  Trova is now in your Slack workspace
                </li>
                <li>
                  <ion-icon :icon="checkmarkOutline" class="check-ico" />
                  Your community is configured
                </li>
                <li>
                  <ion-icon :icon="checkmarkOutline" class="check-ico" />
                  Next: invite people to create their profiles
                </li>
              </ul>
            </div>

            <p class="immediate-action">{{ immediateActionText }}</p>

            <div class="loop-strip" aria-label="How Trova works">
              <div class="loop-step">
                <div class="loop-ico">
                  <ion-icon :icon="personOutline" />
                </div>
                <p class="loop-label">People create profiles</p>
              </div>
              <ion-icon :icon="chevronForwardOutline" class="loop-arrow" />
              <div class="loop-step">
                <div class="loop-ico">
                  <ion-icon :icon="searchOutline" />
                </div>
                <p class="loop-label">People discover each other</p>
              </div>
              <ion-icon :icon="chevronForwardOutline" class="loop-arrow" />
              <div class="loop-step">
                <div class="loop-ico">
                  <ion-icon :icon="chatbubblesOutline" />
                </div>
                <p class="loop-label">People connect</p>
              </div>
            </div>

            <p class="activation-note">
              <strong>Tip:</strong> Open the Trova Home tab in Slack so your team can build profiles and discover each other.
              Automated welcome posts can be enabled on the backend when you are ready.
            </p>

            <ion-button expand="block" size="large" class="cta-primary" @click="openTrovaInSlack">
              Open Trova in Slack
            </ion-button>
            <ion-button expand="block" fill="outline" class="cta-secondary" @click="goFinishProfile">
              Finish your profile
            </ion-button>
          </div>
        </template>
      </div>

      <!-- Missing code -->
      <div v-else-if="phase === 'no_code'" class="shell shell--narrow ion-padding">
        <p>Missing authorization code. Start from the Trova app or add Trova to Slack first.</p>
        <ion-button expand="block" @click="router.push('/slack-install')">Add Trova to Slack</ion-button>
        <p v-if="showPreviewHint" class="preview-hint">
          <strong>Local design preview:</strong>
          <router-link class="preview-link" :to="previewRoute">Open the full wizard (no OAuth)</router-link>
        </p>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonContent,
  IonButton,
  IonText,
  IonSpinner,
  IonItem,
  IonLabel,
  IonInput,
  IonSelect,
  IonSelectOption,
  IonCheckbox,
  IonNote,
  IonIcon,
} from '@ionic/vue';
import {
  checkmarkCircle,
  checkmarkOutline,
  chevronForwardOutline,
  personOutline,
  searchOutline,
  chatbubblesOutline,
} from 'ionicons/icons';
import { communityService } from '@/services/community.service';
import { authService } from '@/services/auth.service';
import { environment } from '@/environments/environment';
import { buildSlackAppInstallAuthorizeUrl } from '@/config/slack-install';
import type { Community } from '@/services/community.service';
import TrovaSlackBrandMark from '@/components/TrovaSlackBrandMark.vue';

const route = useRoute();
const router = useRouter();

type Phase = 'loading' | 'oauth_error' | 'wizard' | 'no_code';

const initialCode = route.query.code as string | undefined;
const initialError = route.query.error as string | undefined;

function shouldUseDesignPreview(): boolean {
  if (!import.meta.env.DEV) return false;
  const code = route.query.code as string | undefined;
  const err = route.query.error as string | undefined;
  if (code || err) return false;
  const p = route.query.preview;
  return p === '1' || p === 'true';
}

const designPreview = ref(false);

const phase = ref<Phase>(
  shouldUseDesignPreview() ? 'wizard' : initialCode || initialError ? 'loading' : 'no_code'
);

const showPreviewHint = import.meta.env.DEV;
const previewRoute = { path: '/slack-install-redirect', query: { preview: '1' } };
const oauthError = ref('');
const wizardStep = ref<1 | 2 | 3>(1);

const community = ref<Community | null>(null);
const slackTeamName = ref<string | null>(null);
const slackTeamId = ref<string | null>(null);
const userSlackId = ref<string | null>(null);
const installerUserId = ref<number | undefined>(undefined);

const formName = ref('');
const formType = ref('corporate');
const acceptedTerms = ref(false);
const savingStep2 = ref(false);

const communityTypes = [
  { value: 'corporate', label: 'Corporate' },
  { value: 'college', label: 'College / university' },
  { value: 'nonprofit', label: 'Nonprofit' },
  { value: 'community', label: 'Community' },
  { value: 'other', label: 'Other' },
];

/** API may return type `slack` for Slack-provisioned communities; that is not a user-facing workplace category. */
function normalizeWorkspaceType(apiType?: string | null): string {
  const allowed = new Set(communityTypes.map((o) => o.value));
  if (apiType && allowed.has(apiType)) return apiType;
  return 'corporate';
}

const canSubmitStep2 = computed(() => {
  const hasCommunity = community.value != null && Number.isFinite(community.value.id);
  return formName.value.trim().length > 0 && acceptedTerms.value && hasCommunity;
});

const immediateActionText = computed(
  () =>
    'Open the Trova Home tab in Slack to get started, and invite your team so the directory fills in with profiles.'
);

function setRedirectAfterInstall(userId?: number) {
  const sid = userSlackId.value;
  if (sid) {
    authService.storeDataSlackLanding(sid, {
      redirectTo: 'setup',
      ...(userId != null ? { createdUserId: userId } : {}),
    });
  }
}

function persistOnboardingComplete() {
  const sid = userSlackId.value;
  if (!sid || designPreview.value) return;
  authService.storeDataSlackLanding(sid, {
    redirectTo: 'setup',
    ...(installerUserId.value != null ? { createdUserId: installerUserId.value } : {}),
    onboardingCompleted: true,
    workspaceType: formType.value,
    hasLaunchedFirstAction: false,
  });
}

async function runOAuth(code: string) {
  const redirectUri = `${window.location.origin}/slack-install-redirect`;
  const res = await communityService.oauthAuthenticateSlackApp(code, redirectUri, 'slack-install-redirect');
  community.value = res.community as Community;
  slackTeamName.value = res.extraInfo?.slackTeamName ?? null;
  slackTeamId.value = res.extraInfo?.slackTeamId ?? null;

  const u = res.user as Record<string, unknown>;
  userSlackId.value =
    (typeof u.slackId === 'string' && u.slackId) ||
    (typeof u.slack_id === 'string' && u.slack_id) ||
    null;

  installerUserId.value = typeof u.id === 'number' ? u.id : undefined;

  formName.value = (community.value?.name as string) || slackTeamName.value || '';
  formType.value = normalizeWorkspaceType(community.value?.type as string | undefined);

  setRedirectAfterInstall(installerUserId.value);
  phase.value = 'wizard';
  wizardStep.value = 1;
}

async function submitStep2() {
  if (!canSubmitStep2.value || !community.value) return;
  savingStep2.value = true;
  try {
    if (designPreview.value) {
      wizardStep.value = 3;
      return;
    }
    await communityService.updateCommunityPublic({
      id: community.value.id,
      name: formName.value.trim(),
      type: formType.value,
      bio: community.value.bio,
    });
    persistOnboardingComplete();
    wizardStep.value = 3;
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Save failed';
    oauthError.value = msg;
    phase.value = 'oauth_error';
  } finally {
    savingStep2.value = false;
  }
}

function openTrovaInSlack() {
  const team = slackTeamId.value;
  const appId = environment.slackAppId;
  if (team && appId) {
    window.location.href = `slack://app?team=${encodeURIComponent(team)}&id=${encodeURIComponent(appId)}&tab=home`;
  } else {
    window.location.href = 'slack://open';
  }
}

function goFinishProfile() {
  router.push('/setup');
}

function retryInstall() {
  const redirectUri = `${window.location.origin}/slack-install-redirect`;
  window.location.href = buildSlackAppInstallAuthorizeUrl({ redirectUri });
}

function applyDesignPreviewMocks() {
  designPreview.value = true;
  community.value = {
    id: 999_001,
    name: 'Acme Engineering',
    leaderId: 1,
    type: 'corporate',
    bio: undefined,
  };
  slackTeamName.value = 'Acme Engineering (preview)';
  slackTeamId.value = 'T00000000';
  userSlackId.value = null;
  installerUserId.value = undefined;
  formName.value = community.value.name;
  formType.value = 'corporate';
  acceptedTerms.value = false;
  wizardStep.value = 1;
}

watch(
  () => [route.query.preview, route.query.code, route.query.error],
  () => {
    if (!shouldUseDesignPreview()) return;
    applyDesignPreviewMocks();
    phase.value = 'wizard';
  },
  { immediate: true }
);

onMounted(async () => {
  const error = route.query.error as string | undefined;
  const code = route.query.code as string | undefined;

  if (error) {
    oauthError.value =
      (typeof error === 'string' && decodeURIComponent(error)) || 'Authorization was denied or failed.';
    phase.value = 'oauth_error';
    return;
  }

  if (!code) {
    return;
  }

  try {
    await runOAuth(code);
    router.replace({ path: '/slack-install-redirect', query: {} });
  } catch (e: unknown) {
    console.error('Slack install OAuth error:', e);
    oauthError.value =
      e instanceof Error ? e.message : 'Could not complete Slack installation. Please try again.';
    phase.value = 'oauth_error';
  }
});
</script>

<style scoped>
/* OAuth/install UI is light-themed; OS dark mode was pulling in Ionic md dark toolbar + illegible wordmark. */
.slack-redirect-page {
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

/* Mirrors .shell--wide: centered column edge matches wizard body on large screens */
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

.slack-redirect-content {
  --padding-start: max(24px, env(safe-area-inset-left, 0px));
  --padding-end: max(24px, env(safe-area-inset-right, 0px));
  --padding-top: 16px;
  --padding-bottom: 24px;
}

.shell {
  margin: 0 auto;
  width: 100%;
}
.shell--narrow {
  max-width: 28rem;
}
.shell--wide {
  max-width: 960px;
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

.preview-banner {
  display: block;
  margin-bottom: 1.25rem;
  padding: 0.65rem 0.9rem;
  border-radius: 10px;
  font-size: 0.8125rem;
  line-height: 1.45;
  border: 1px solid rgba(245, 158, 11, 0.35);
  background: rgba(254, 252, 232, 0.9);
}

/* Step 1 */
.step1 {
  padding-bottom: 0.5rem;
}
.step1-copy {
  max-width: 38rem;
}
.step1 .context-line {
  font-size: 0.9rem;
  color: var(--ion-color-medium-shade);
  margin: 0 0 0.75rem;
}
.headline {
  font-size: clamp(1.35rem, 3.5vw, 1.85rem);
  font-weight: 700;
  line-height: 1.22;
  color: var(--ion-text-color);
  margin: 0 0 0.65rem;
  letter-spacing: -0.02em;
}
.subhead {
  font-size: 1.0625rem;
  color: #475569;
  line-height: 1.55;
  margin: 0 0 1.35rem;
}
.outcomes {
  margin: 0;
  padding: 0.25rem 0 0 1.15rem;
  color: #1e293b;
  line-height: 1.65;
  font-size: 0.975rem;
}
.outcomes li {
  margin-bottom: 0.55rem;
  padding-left: 0.15rem;
}
.outcomes li:last-child {
  margin-bottom: 0;
}

.slack-examples-panel {
  margin: 2rem 0 1.75rem;
  padding: 1.35rem 1rem 1.5rem;
  background: linear-gradient(165deg, #f8fafc 0%, #eef2f6 45%, #e8edf2 100%);
  border-radius: 16px;
  border: 1px solid #e2e8f0;
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.85),
    0 1px 2px rgba(15, 23, 42, 0.04);
}
@media (min-width: 720px) {
  .slack-examples-panel {
    padding: 1.5rem 1.35rem 1.65rem;
  }
}
.slack-examples-kicker {
  margin: 0 0 1.1rem;
  font-size: 0.6875rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: #64748b;
  text-align: center;
}
@media (min-width: 720px) {
  .slack-examples-kicker {
    text-align: left;
    padding-left: 0.15rem;
  }
}

.slack-examples {
  display: grid;
  grid-template-columns: 1fr;
  gap: 1.35rem;
  align-items: stretch;
}
@media (min-width: 720px) {
  .slack-examples {
    grid-template-columns: 1fr 1fr;
    gap: 1.25rem;
    align-items: stretch;
  }
}

.slack-example-fig {
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}

.slack-example-frame {
  flex: 1 1 auto;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 200px;
  padding: 1rem 0.85rem;
  background: #fff;
  border-radius: 12px;
  border: 1px solid #e2e8f0;
  box-shadow:
    0 1px 2px rgba(15, 23, 42, 0.05),
    0 10px 28px -6px rgba(15, 23, 42, 0.14);
}

.slack-example-img {
  display: block;
  max-width: 100%;
  width: auto;
  height: auto;
  max-height: min(300px, 42vh);
  object-fit: contain;
}

.slack-example-cap {
  flex-shrink: 0;
  margin-top: auto;
  padding: 0.75rem 0.2rem 0;
  font-size: 0.8125rem;
  line-height: 1.45;
  color: #475569;
  font-weight: 500;
  text-align: center;
}

.step1-cta {
  margin-top: 0.25rem;
  text-transform: none;
  letter-spacing: 0.01em;
  font-weight: 600;
}

.cta-primary {
  --border-radius: 12px;
  font-weight: 600;
}

/* Step 2 */
.step2 {
  padding-bottom: 0.5rem;
}

.step2-header {
  margin-bottom: 1.5rem;
  max-width: 36rem;
}

.step-title {
  font-size: clamp(1.28rem, 2.8vw, 1.5rem);
  font-weight: 700;
  margin: 0 0 0.5rem;
  letter-spacing: -0.025em;
  color: #0f172a;
  line-height: 1.2;
}

.step-sub {
  font-size: 0.9375rem;
  color: #64748b;
  margin: 0;
  line-height: 1.55;
}

.setup-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 1.75rem;
  align-items: start;
}
@media (min-width: 768px) {
  .setup-grid {
    grid-template-columns: 1fr minmax(260px, 380px);
    gap: 2rem 2.25rem;
    align-items: start;
  }
}

.setup-column {
  min-width: 0;
  max-width: 32rem;
  display: flex;
  flex-direction: column;
  gap: 0;
}

.setup-form-card {
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 14px;
  padding: 1.35rem 1.25rem 1.3rem;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04), 0 4px 16px -4px rgba(15, 23, 42, 0.07);
}

.setup-field-block {
  margin-bottom: 1.2rem;
}
.setup-field-block--last {
  margin-bottom: 0;
}

.setup-field-label {
  display: block;
  font-size: 0.8125rem;
  font-weight: 600;
  color: #1e293b;
  margin: 0 0 0.45rem 0.05rem;
  letter-spacing: 0.01em;
}

.setup-field-shell {
  --background: #f8fafc;
  --padding-start: 14px;
  --padding-end: 14px;
  --inner-padding-end: 0;
  --inner-padding-top: 0;
  --inner-padding-bottom: 0;
  --min-height: 50px;
  margin: 0;
  border: 1.5px solid #94a3b8;
  border-radius: 10px;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.75);
  transition:
    border-color 0.15s ease,
    box-shadow 0.15s ease,
    background 0.15s ease;
}
.setup-field-shell:focus-within {
  --background: #ffffff;
  border-color: var(--ion-color-primary);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.9),
    0 0 0 3px rgba(45, 122, 78, 0.18);
}

.setup-ion-input {
  --padding-top: 14px;
  --padding-bottom: 14px;
  font-size: 1rem;
  font-weight: 500;
  color: #0f172a;
}

.setup-ion-select {
  width: 100%;
  max-width: 100%;
  --padding-top: 14px;
  --padding-bottom: 14px;
  font-size: 1rem;
  font-weight: 500;
  color: #0f172a;
}

.setup-actions {
  margin-top: 1.35rem;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 0.2rem;
}

.setup-submit {
  margin: 0;
  text-transform: none;
  letter-spacing: 0.02em;
  font-weight: 600;
  min-height: 50px;
}

.setup-back-link {
  display: block;
  width: 100%;
  margin: 0;
  padding: 0.7rem 0.5rem;
  font-family: inherit;
  font-size: 0.9375rem;
  font-weight: 600;
  color: var(--ion-color-primary);
  background: transparent;
  border: none;
  cursor: pointer;
  text-align: center;
  border-radius: 8px;
  transition: background 0.15s ease;
}
.setup-back-link:hover {
  background: rgba(45, 122, 78, 0.06);
}
.setup-back-link:focus-visible {
  outline: 2px solid var(--ion-color-primary);
  outline-offset: 2px;
}

.setup-legal {
  margin-top: 1.35rem;
  padding-top: 1.2rem;
  border-top: 1px solid #e2e8f0;
}

.directory-preview-aside {
  position: sticky;
  top: 12px;
  padding: 1.35rem 1.25rem 1.4rem;
  border-radius: 14px;
  background: #ffffff;
  border: 1px solid #e2e8f0;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04), 0 4px 16px -4px rgba(15, 23, 42, 0.07);
}

.directory-preview-kicker {
  margin: 0 0 0.35rem;
  font-size: 0.6875rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.09em;
  color: #64748b;
}

.directory-preview-title {
  margin: 0 0 0.6rem;
  font-size: 1.125rem;
  font-weight: 700;
  color: #0f172a;
  letter-spacing: -0.02em;
  line-height: 1.25;
}

.directory-preview-helper {
  margin: 0 0 1.05rem;
  font-size: 0.875rem;
  line-height: 1.55;
  color: #475569;
}

.directory-preview-frame {
  border-radius: 10px;
  overflow: hidden;
  border: 1px solid #e2e8f0;
  background: #f8fafc;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.8);
}

.directory-preview-img {
  display: block;
  width: 100%;
  height: auto;
  vertical-align: middle;
}

.legal-inline {
  display: flex;
  gap: 10px;
  align-items: flex-start;
}
.legal-check {
  margin-top: 2px;
  flex-shrink: 0;
  transform: scale(0.9);
}
.legal-text {
  font-size: 0.8rem;
  line-height: 1.45;
  color: var(--ion-color-medium-shade);
}
.legal-a {
  color: var(--ion-color-primary);
  font-weight: 600;
  text-decoration: none;
}
.legal-a:hover {
  text-decoration: underline;
}

.btn-spinner {
  width: 1.25rem;
  height: 1.25rem;
}

/* Step 3 */
.step3 {
  text-align: center;
  max-width: 32rem;
  margin: 0 auto;
}
.success-icon-wrap {
  margin-bottom: 0.75rem;
}
.success-icon {
  font-size: 3.5rem;
  color: var(--ion-color-primary);
}
.step3-title {
  font-size: clamp(1.2rem, 3vw, 1.45rem);
  font-weight: 700;
  line-height: 1.3;
  margin: 0 0 1.25rem;
}
.next-card {
  text-align: left;
  background: var(--ion-color-light);
  border: 1px solid var(--ion-border-color);
  border-radius: 14px;
  padding: 16px 18px;
  margin-bottom: 1.25rem;
}
.next-card-title {
  margin: 0 0 10px;
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--ion-color-medium-shade);
}
.next-checks {
  list-style: none;
  margin: 0;
  padding: 0;
}
.next-checks li {
  display: flex;
  gap: 10px;
  align-items: flex-start;
  font-size: 0.9rem;
  line-height: 1.4;
  margin-bottom: 8px;
  color: var(--ion-text-color);
}
.next-checks li:last-child {
  margin-bottom: 0;
}
.check-ico {
  color: var(--ion-color-primary);
  font-size: 1.15rem;
  flex-shrink: 0;
  margin-top: 1px;
}
.immediate-action {
  font-size: 0.95rem;
  line-height: 1.55;
  color: var(--ion-color-medium-shade);
  margin: 0 0 1.25rem;
  text-align: left;
}

.loop-strip {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 6px 8px;
  margin-bottom: 1.25rem;
  padding: 14px 10px;
  background: #fff;
  border: 1px solid var(--ion-border-color);
  border-radius: 12px;
}
.loop-step {
  text-align: center;
  min-width: 88px;
}
.loop-ico {
  width: 40px;
  height: 40px;
  margin: 0 auto 6px;
  border-radius: 10px;
  background: var(--ion-color-light);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--ion-color-primary);
  font-size: 1.25rem;
}
.loop-label {
  margin: 0;
  font-size: 0.72rem;
  font-weight: 600;
  color: var(--ion-color-dark);
  line-height: 1.25;
}
.loop-arrow {
  color: var(--ion-color-medium);
  font-size: 1rem;
  flex-shrink: 0;
}

.activation-note {
  font-size: 0.8rem;
  line-height: 1.5;
  color: var(--ion-color-medium);
  text-align: left;
  margin: 0 0 1.25rem;
}

.cta-secondary {
  margin-top: 8px;
  --border-radius: 12px;
}

.preview-hint {
  margin-top: 1.5rem;
  padding: 1rem;
  font-size: 0.875rem;
  line-height: 1.5;
  color: var(--ion-color-medium-shade);
  background: var(--ion-color-light);
  border-radius: 8px;
}
.preview-link {
  display: inline-block;
  margin-left: 0.25rem;
  font-weight: 600;
  color: var(--ion-color-primary);
}
</style>
