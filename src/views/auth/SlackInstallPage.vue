<template>
  <ion-page class="slack-install-page">
    <ion-content :fullscreen="true" class="slack-install-content">
      <header class="site-header">
        <router-link to="/login" class="brand-link" aria-label="Trova home">
          <TrovaSlackBrandMark variant="header" />
        </router-link>
        <div class="header-actions">
          <router-link to="/login" class="text-link">Sign In</router-link>
          <button
            type="button"
            class="icon-menu-btn"
            id="slack-install-menu-trigger"
            aria-label="Open menu"
          >
            <ion-icon :icon="menuOutline" aria-hidden="true" />
          </button>
          <ion-popover
            trigger="slack-install-menu-trigger"
            trigger-action="click"
            side="bottom"
            alignment="end"
            :dismiss-on-select="true"
          >
            <ion-content class="menu-popover-content">
              <ion-list lines="none">
                <ion-item button :detail="false" @click="goLogin">
                  <ion-label>Sign In</ion-label>
                </ion-item>
                <ion-item button :detail="false" @click="openTrovaSite">
                  <ion-label>About Trova</ion-label>
                </ion-item>
                <ion-item button :detail="false" @click="router.push('/support')">
                  <ion-label>Support</ion-label>
                </ion-item>
              </ion-list>
            </ion-content>
          </ion-popover>
        </div>
      </header>

      <main class="main">
        <section class="hero">
          <p class="hero-eyebrow">Trova for Slack</p>
          <h1 class="hero-title">Bring your whole self to work—right in Slack</h1>
          <p class="hero-lead">
            Help your team discover shared interests, spark real conversations, and build
            stronger connections where you already work.
          </p>
          <div class="hero-cta">
            <button
              type="button"
              class="add-to-slack-btn"
              :disabled="!hasClientId"
              @click="startInstall"
            >
              <!-- Official-style Slack hash mark (correct path data; no external images) -->
              <span class="slack-glyph" aria-hidden="true">
                <svg viewBox="0 0 54 54" width="22" height="22" xmlns="http://www.w3.org/2000/svg">
                  <path
                    fill="#E01E5A"
                    d="M11.3 22.5a5.65 5.65 0 1 1 0-11.3h11.3v11.3H11.3z"
                  />
                  <path
                    fill="#36C5F0"
                    d="M22.5 11.3a5.65 5.65 0 1 1 11.3 0v11.3H22.5V11.3z"
                  />
                  <path
                    fill="#2EB67D"
                    d="M42.7 22.5a5.65 5.65 0 1 1 0 11.3H31.4V22.5h11.3z"
                  />
                  <path
                    fill="#ECB22E"
                    d="M31.4 42.7a5.65 5.65 0 1 1-11.3 0V31.4h11.3v11.3z"
                  />
                  <path
                    fill="#E01E5A"
                    d="M11.3 31.4a5.65 5.65 0 1 1 0 11.3h11.3V31.4H11.3z"
                  />
                  <path
                    fill="#36C5F0"
                    d="M11.3 22.5H0a5.65 5.65 0 1 1 0 11.3h11.3V22.5z"
                  />
                  <path
                    fill="#2EB67D"
                    d="M31.4 42.7v11.3a5.65 5.65 0 1 1-11.3 0V42.7h11.3z"
                  />
                  <path
                    fill="#ECB22E"
                    d="M42.7 31.4H54a5.65 5.65 0 1 1 0 11.3H42.7V31.4z"
                  />
                </svg>
              </span>
              <span>Add to Slack</span>
            </button>
            <p v-if="!hasClientId" class="config-warn">
              Slack client ID is not configured for this environment.
            </p>
          </div>
        </section>

        <section class="benefits" aria-labelledby="benefits-heading">
          <h2 id="benefits-heading" class="section-title">What you get</h2>
          <ul class="benefit-list">
            <li class="benefit-item">
              <span class="benefit-icon-wrap" aria-hidden="true">
                <ion-icon :icon="peopleOutline" />
              </span>
              <div>
                <h3 class="benefit-title">Rich profiles</h3>
                <p class="benefit-text">
                  Show interests, skills, and location so colleagues can find common ground.
                </p>
              </div>
            </li>
            <li class="benefit-item">
              <span class="benefit-icon-wrap" aria-hidden="true">
                <ion-icon :icon="chatbubblesOutline" />
              </span>
              <div>
                <h3 class="benefit-title">Conversation in Slack</h3>
                <p class="benefit-text">
                  Home tab and messages keep engagement where your team already collaborates.
                </p>
              </div>
            </li>
            <li class="benefit-item">
              <span class="benefit-icon-wrap" aria-hidden="true">
                <ion-icon :icon="compassOutline" />
              </span>
              <div>
                <h3 class="benefit-title">Discovery on the web</h3>
                <p class="benefit-text">
                  Open Trova in the browser for maps, search, and deeper discovery when you need it.
                </p>
              </div>
            </li>
          </ul>
        </section>

        <section class="steps" aria-labelledby="steps-heading">
          <h2 id="steps-heading" class="section-title">How it works</h2>
          <ol class="step-list">
            <li>
              <span class="step-num">1</span>
              <span>Click <strong>Add to Slack</strong> and choose your workspace.</span>
            </li>
            <li>
              <span class="step-num">2</span>
              <span>Approve the permissions Trova needs to show profiles and features.</span>
            </li>
            <li>
              <span class="step-num">3</span>
              <span>Team members complete profiles from the Trova Home tab—done.</span>
            </li>
          </ol>
        </section>

        <section class="support-block">
          <p class="support-block__text">
            Questions? Visit
            <router-link to="/support" class="inline-link">Support</router-link>
            or
            <a
              class="inline-link"
              href="https://www.trova.io"
              target="_blank"
              rel="noopener noreferrer"
              >trova.io</a
            >.
          </p>
        </section>
      </main>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import {
  IonPage,
  IonContent,
  IonIcon,
  IonPopover,
  IonList,
  IonItem,
  IonLabel,
} from '@ionic/vue';
import {
  chatbubblesOutline,
  compassOutline,
  menuOutline,
  peopleOutline,
} from 'ionicons/icons';
import { computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { environment } from '@/environments/environment';
import { buildSlackAppInstallAuthorizeUrl } from '@/config/slack-install';
import TrovaSlackBrandMark from '@/components/TrovaSlackBrandMark.vue';

const route = useRoute();
const router = useRouter();

const hasClientId = computed(() => Boolean(environment.slackClientId));

function startInstall() {
  const redirectUri = `${window.location.origin}/slack-install-redirect`;
  const teamId = (route.query.slackTeamId as string) || undefined;
  const url = buildSlackAppInstallAuthorizeUrl({ redirectUri, teamId: teamId || null });
  window.location.href = url;
}

function goLogin() {
  router.push('/login');
}

function openTrovaSite() {
  window.open('https://www.trova.io', '_blank', 'noopener,noreferrer');
}

onMounted(() => {
  if (route.query.auto === '1' || route.query.auto === 'true') {
    startInstall();
  }
});
</script>

<style scoped>
/* Single font stack — no extra Google font requests */
.slack-install-content {
  --background: #f0f2f5;
}

.slack-install-page {
  font-family: var(--ion-font-family);
  color: #1a1d21;
}

.site-header {
  position: sticky;
  top: 0;
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px max(20px, env(safe-area-inset-right, 0px)) 14px
    max(20px, env(safe-area-inset-left, 0px));
  background: rgba(255, 255, 255, 0.96);
  backdrop-filter: blur(12px);
  border-bottom: 1px solid #e8e8e8;
  max-width: 960px;
  margin: 0 auto;
}

.brand-link {
  display: flex;
  align-items: center;
  text-decoration: none;
  color: inherit;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

.text-link {
  font-weight: 600;
  font-size: 0.9375rem;
  color: #1a1d21;
  text-decoration: none;
}

.text-link:hover {
  color: var(--ion-color-primary);
}

.icon-menu-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  padding: 0;
  border: none;
  border-radius: 10px;
  background: transparent;
  color: #1a1d21;
  cursor: pointer;
}

.icon-menu-btn:hover {
  background: rgba(0, 0, 0, 0.05);
}

.icon-menu-btn ion-icon {
  font-size: 26px;
}

.menu-popover-content {
  --padding-start: 0;
  --padding-end: 0;
  --padding-top: 0;
  --padding-bottom: 0;
}

.main {
  max-width: 640px;
  margin: 0 auto;
  padding: 32px max(20px, env(safe-area-inset-right, 0px)) 56px
    max(20px, env(safe-area-inset-left, 0px));
}

.hero {
  text-align: center;
  margin-bottom: 48px;
}

.hero-eyebrow {
  margin: 0 0 10px;
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--ion-color-primary);
}

.hero-title {
  margin: 0 0 16px;
  font-size: clamp(1.5rem, 5vw, 1.875rem);
  font-weight: 700;
  line-height: 1.25;
  letter-spacing: -0.02em;
  color: #1a1d21;
}

.hero-lead {
  margin: 0 0 28px;
  font-size: 1.0625rem;
  line-height: 1.55;
  color: #5c5c5c;
}

.hero-cta {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}

.add-to-slack-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 14px 24px;
  font-family: inherit;
  font-size: 1rem;
  font-weight: 700;
  color: #1a1d21;
  background: #fff;
  border: 1px solid #c5c5c5;
  border-radius: 8px;
  cursor: pointer;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
  transition:
    transform 0.15s ease,
    box-shadow 0.15s ease,
    border-color 0.15s ease;
}

.add-to-slack-btn:hover:not(:disabled) {
  border-color: #888;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  transform: translateY(-1px);
}

.add-to-slack-btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.slack-glyph {
  display: flex;
  line-height: 0;
  flex-shrink: 0;
}

.config-warn {
  margin: 0;
  font-size: 0.875rem;
  color: var(--ion-color-danger);
  text-align: center;
  max-width: 320px;
}

.section-title {
  margin: 0 0 20px;
  font-size: 1.125rem;
  font-weight: 700;
  color: #1a1d21;
}

.benefits {
  margin-bottom: 40px;
}

.benefit-list {
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.benefit-item {
  display: flex;
  gap: 16px;
  align-items: flex-start;
  padding: 20px;
  background: #fff;
  border-radius: 12px;
  border: 1px solid #e4e4e4;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
}

.benefit-icon-wrap {
  flex-shrink: 0;
  width: 44px;
  height: 44px;
  border-radius: 10px;
  background: rgba(var(--ion-color-primary-rgb), 0.12);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--ion-color-primary);
}

.benefit-icon-wrap ion-icon {
  font-size: 24px;
}

.benefit-title {
  margin: 0 0 6px;
  font-size: 1rem;
  font-weight: 700;
  color: #1a1d21;
}

.benefit-text {
  margin: 0;
  font-size: 0.9375rem;
  line-height: 1.5;
  color: #5c5c5c;
}

.steps {
  margin-bottom: 36px;
}

.step-list {
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.step-list li {
  display: flex;
  gap: 14px;
  align-items: flex-start;
  font-size: 0.9375rem;
  line-height: 1.5;
  color: #3d3d3d;
}

.step-num {
  flex-shrink: 0;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: var(--ion-color-primary);
  color: #fff;
  font-size: 0.8125rem;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
}

.support-block {
  padding: 20px;
  background: #fff;
  border-radius: 12px;
  border: 1px solid #e4e4e4;
  text-align: center;
}

.support-block__text {
  margin: 0;
  font-size: 0.9375rem;
  line-height: 1.5;
  color: #5c5c5c;
}

.inline-link {
  color: var(--ion-color-primary);
  font-weight: 600;
  text-decoration: none;
}

.inline-link:hover {
  text-decoration: underline;
}
</style>
