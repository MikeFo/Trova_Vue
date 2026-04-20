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
              </ion-list>
            </ion-content>
          </ion-popover>
        </div>
      </header>

      <main class="main">
        <section class="hero-serif">
          <h1 class="hero-title">
            Trova helps employees bring their authentic selves to work
          </h1>
        </section>

        <section class="cta-split">
          <div class="cta-copy">
            <div class="mark-row">
              <div class="trova-mark" aria-hidden="true">T</div>
              <p class="cta-headline">
                Stronger relationships build stronger companies.
              </p>
            </div>
          </div>
          <div class="cta-action">
            <button
              type="button"
              class="add-to-slack-btn"
              :disabled="!hasClientId"
              @click="startInstall"
            >
              <span class="slack-glyph" aria-hidden="true">
                <svg viewBox="0 0 54 54" width="22" height="22">
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
                    d="M11.3 31.4a5.65 5.65 0 1 1 0 11.3 11.3 0 0 1 0-11.3v11.3H11.3z"
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

        <section class="feature-grid">
          <article class="feature-card feature-card--trova">
            <p class="eyebrow">Available on Trova</p>
            <div class="feature-row">
              <ion-icon :icon="searchOutline" class="feature-icon" />
              <span>Filter, search &amp; sort by interests and location</span>
            </div>
            <div class="avatar-demo">
              <div class="avatar avatar--a" aria-hidden="true" />
              <span class="avatar-plus" aria-hidden="true">
                <ion-icon :icon="addOutline" />
              </span>
              <div class="avatar avatar--b" aria-hidden="true" />
            </div>
            <p class="feature-caption">
              Employee introductions based on shared interests
            </p>
          </article>

          <article class="feature-card feature-card--slack" aria-label="Slack app preview">
            <div class="slack-chrome">
              <div class="slack-top">
                <span class="slack-app-name">Trova</span>
                <span class="slack-verified" aria-hidden="true">✓</span>
                <span class="slack-chevron" aria-hidden="true">▾</span>
              </div>
              <div class="slack-tabs">
                <span class="slack-tab slack-tab--active">Home</span>
                <span class="slack-tab">About</span>
              </div>
              <p class="slack-lead">Here's what you can do with Trova</p>
              <button type="button" class="slack-primary-pill" tabindex="-1">
                Create your profile!
              </button>
              <button type="button" class="slack-secondary-pill" tabindex="-1">
                Learn more
              </button>
              <div class="slack-profile-preview">
                <div class="preview-photo" aria-hidden="true" />
                <div class="preview-copy">
                  <p class="preview-title">This week's Intro! Ashley Jones</p>
                  <p class="preview-meta">Ithaca College · Boston, MA</p>
                  <ul class="preview-tags">
                    <li>Interests</li>
                    <li>Activities</li>
                    <li>Intentions</li>
                  </ul>
                </div>
              </div>
            </div>
          </article>
        </section>

        <section class="closing">
          <h2 class="closing-title">
            Bring your whole self to work with Trova Profiles
          </h2>
          <div class="closing-copy">
            <p>
              People are every organization's greatest asset. We understand people are
              not defined by their jobs but by the passions and interests they share
              outside their nine-to-five.
            </p>
            <p>
              That's why we built Trova for Slack, making it quick and easy to create and
              view team profiles so employees can bring their whole selves to work.
              With Trova, people can see the fun and interesting things coworkers are up
              to, in addition to getting thoughtful introductions.
            </p>
            <p>
              Install Trova in Slack to showcase employee interests where your team
              already spends time. You'll see the impact on engagement and conversation
              across your organization.
            </p>
          </div>
        </section>

        <section class="how-to">
          <h3 class="how-to-title">How to use Trova for Slack</h3>
          <p>
            Add the app from this page (or the Slack App Directory) and follow the steps
            to connect your workspace. On the Trova Home tab, people can edit their
            profile, view introductions, and open Trova on the web for richer discovery
            by interests and location.
          </p>
          <p class="support-line">
            <strong>Support:</strong> ask your Trova program admin, or visit
            <a href="https://www.trova.io" target="_blank" rel="noopener noreferrer"
              >trova.io</a
            >
            to learn more.
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
import { addOutline, menuOutline, searchOutline } from 'ionicons/icons';
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
@import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,500;0,9..144,600;0,9..144,700;1,9..144,400&family=Source+Sans+3:wght@400;500;600;700&display=swap');

.slack-install-content {
  --background: #fafbfc;
}

.slack-install-page {
  font-family: 'Source Sans 3', var(--ion-font-family);
  color: var(--ion-text-color);
}

.site-header {
  position: sticky;
  top: 0;
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px max(24px, env(safe-area-inset-right, 0px)) 14px
    max(28px, env(safe-area-inset-left, 0px));
  background: rgba(255, 255, 255, 0.92);
  backdrop-filter: blur(10px);
  border-bottom: 1px solid var(--ion-border-color);
  max-width: 1200px;
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
  gap: 16px;
}

.text-link {
  font-weight: 600;
  font-size: 0.95rem;
  color: var(--ion-color-dark);
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
  color: var(--ion-color-dark);
  cursor: pointer;
}

.icon-menu-btn:hover {
  background: var(--ion-color-light);
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
  max-width: 1120px;
  margin: 0 auto;
  padding: 28px max(24px, env(safe-area-inset-right, 0px)) 64px
    max(28px, env(safe-area-inset-left, 0px));
}

.hero-serif {
  text-align: center;
  padding: 12px 8px 36px;
}

.hero-title {
  font-family: 'Fraunces', Georgia, serif;
  font-weight: 600;
  font-size: clamp(1.5rem, 4vw, 2.25rem);
  line-height: 1.25;
  color: #111827;
  max-width: 38rem;
  margin: 0 auto;
  letter-spacing: -0.02em;
}

.cta-split {
  display: grid;
  grid-template-columns: 1fr;
  gap: 28px;
  align-items: center;
  margin-bottom: 48px;
}

@media (min-width: 768px) {
  .cta-split {
    grid-template-columns: 1.1fr 1fr;
    gap: 40px;
  }
}

.mark-row {
  display: flex;
  gap: 16px;
  align-items: flex-start;
}

.trova-mark {
  flex-shrink: 0;
  width: 48px;
  height: 48px;
  border-radius: 14px;
  background: linear-gradient(145deg, var(--ion-color-primary) 0%, var(--ion-color-primary-shade) 100%);
  color: #fff;
  font-family: 'Fraunces', Georgia, serif;
  font-weight: 700;
  font-size: 1.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 14px rgba(45, 122, 78, 0.35);
}

.cta-headline {
  margin: 0;
  font-size: clamp(1.2rem, 2.5vw, 1.5rem);
  font-weight: 700;
  line-height: 1.35;
  color: #111827;
}

.cta-action {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

@media (min-width: 768px) {
  .cta-action {
    align-items: flex-end;
  }
}

.add-to-slack-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 14px 22px;
  font-family: inherit;
  font-size: 1rem;
  font-weight: 700;
  color: #1a1a1a;
  background: #fff;
  border: 1px solid #d1d5db;
  border-radius: 12px;
  cursor: pointer;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.06);
  transition:
    transform 0.15s ease,
    box-shadow 0.15s ease,
    border-color 0.15s ease;
}

.add-to-slack-btn:hover:not(:disabled) {
  border-color: #9ca3af;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
  transform: translateY(-1px);
}

.add-to-slack-btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.slack-glyph {
  display: flex;
  line-height: 0;
}

.config-warn {
  margin-top: 12px;
  font-size: 0.875rem;
  color: var(--ion-color-danger);
  text-align: center;
  max-width: 280px;
}

.feature-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 20px;
  margin-bottom: 56px;
}

@media (min-width: 900px) {
  .feature-grid {
    grid-template-columns: 1fr 1fr;
    gap: 24px;
  }
}

.feature-card {
  border-radius: 20px;
  padding: 24px;
  overflow: hidden;
}

.feature-card--trova {
  background: linear-gradient(180deg, #eef2f6 0%, #e2e8f0 100%);
  border: 1px solid #e2e8f0;
  box-shadow: 0 8px 30px rgba(15, 23, 42, 0.06);
}

.eyebrow {
  margin: 0 0 16px;
  font-size: 0.8rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: #db2777;
}

.feature-row {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  font-weight: 600;
  font-size: 1rem;
  color: #1e293b;
  line-height: 1.4;
}

.feature-icon {
  font-size: 24px;
  color: var(--ion-color-primary);
  flex-shrink: 0;
  margin-top: 2px;
}

.avatar-demo {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  margin: 28px 0 20px;
}

.avatar {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  border: 3px solid #fff;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.12);
}

.avatar--a {
  background: linear-gradient(135deg, #93c5fd 0%, #6366f1 100%);
}

.avatar--b {
  background: linear-gradient(135deg, #fca5a5 0%, #ec4899 100%);
}

.avatar-plus {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: var(--ion-color-primary);
  color: #fff;
  box-shadow: 0 2px 8px rgba(45, 122, 78, 0.45);
}

.avatar-plus ion-icon {
  font-size: 22px;
}

.feature-caption {
  margin: 0;
  font-size: 0.95rem;
  color: #475569;
  text-align: center;
  font-weight: 500;
}

.feature-card--slack {
  background: #1a1d21;
  border: 1px solid #2d3339;
  box-shadow:
    0 20px 50px rgba(0, 0, 0, 0.35),
    inset 0 1px 0 rgba(255, 255, 255, 0.04);
}

.slack-chrome {
  color: #e8e8e8;
  font-size: 0.875rem;
}

.slack-top {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 14px;
  font-weight: 700;
  font-size: 0.95rem;
}

.slack-app-name {
  color: #fff;
}

.slack-verified {
  color: #2eb67d;
  font-size: 0.85rem;
}

.slack-chevron {
  color: #9ca3af;
  font-size: 0.75rem;
}

.slack-tabs {
  display: flex;
  gap: 20px;
  margin-bottom: 18px;
  border-bottom: 1px solid #333;
  padding-bottom: 10px;
}

.slack-tab {
  color: #9ca3af;
  font-weight: 600;
}

.slack-tab--active {
  color: #fff;
  box-shadow: inset 0 -2px 0 var(--ion-color-primary);
  padding-bottom: 10px;
  margin-bottom: -11px;
}

.slack-lead {
  margin: 0 0 16px;
  color: #d1d5db;
  line-height: 1.45;
}

.slack-primary-pill,
.slack-secondary-pill {
  display: block;
  width: 100%;
  font-family: inherit;
  font-weight: 700;
  font-size: 0.9rem;
  padding: 12px 16px;
  border-radius: 10px;
  border: none;
  cursor: default;
  margin-bottom: 10px;
  text-align: center;
}

.slack-primary-pill {
  background: var(--ion-color-primary);
  color: #fff;
}

.slack-secondary-pill {
  background: #2d3339;
  color: #e5e7eb;
  border: 1px solid #404854;
}

.slack-profile-preview {
  margin-top: 22px;
  padding: 14px;
  background: #252a30;
  border-radius: 12px;
  border: 1px solid #363d47;
  display: flex;
  gap: 12px;
  align-items: flex-start;
}

.preview-photo {
  width: 56px;
  height: 56px;
  border-radius: 8px;
  flex-shrink: 0;
  background: linear-gradient(145deg, #fbbf24 0%, #f59e0b 50%, #d97706 100%);
}

.preview-copy {
  min-width: 0;
}

.preview-title {
  margin: 0 0 4px;
  font-weight: 700;
  color: #fff;
  font-size: 0.85rem;
  line-height: 1.3;
}

.preview-meta {
  margin: 0 0 8px;
  font-size: 0.75rem;
  color: #9ca3af;
}

.preview-tags {
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.preview-tags li {
  font-size: 0.65rem;
  font-weight: 600;
  padding: 4px 8px;
  border-radius: 6px;
  background: #1f2429;
  color: #a1a1aa;
}

.closing {
  padding: 8px 0 40px;
  border-top: 1px solid var(--ion-border-color);
  padding-top: 40px;
}

.closing-title {
  font-family: 'Fraunces', Georgia, serif;
  font-weight: 600;
  font-size: clamp(1.35rem, 3vw, 1.85rem);
  color: #111827;
  margin: 0 0 20px;
  line-height: 1.3;
  text-align: center;
  max-width: 36rem;
  margin-left: auto;
  margin-right: auto;
}

.closing-copy {
  max-width: 40rem;
  margin: 0 auto;
}

.closing-copy p {
  margin: 0 0 16px;
  font-size: 1.02rem;
  line-height: 1.65;
  color: #374151;
}

.closing-copy p:last-child {
  margin-bottom: 0;
}

.how-to {
  max-width: 40rem;
  margin: 0 auto;
  padding: 28px 24px;
  background: #fff;
  border-radius: 16px;
  border: 1px solid var(--ion-border-color);
  box-shadow: 0 4px 20px rgba(15, 23, 42, 0.04);
}

.how-to-title {
  margin: 0 0 12px;
  font-size: 1.1rem;
  font-weight: 700;
  color: #111827;
}

.how-to p {
  margin: 0 0 14px;
  font-size: 0.95rem;
  line-height: 1.6;
  color: #4b5563;
}

.how-to p:last-child {
  margin-bottom: 0;
}

.support-line a {
  color: var(--ion-color-primary);
  font-weight: 600;
  text-decoration: none;
}

.support-line a:hover {
  text-decoration: underline;
}
</style>
