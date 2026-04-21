<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-title>Support</ion-title>
      </ion-toolbar>
    </ion-header>
    <ion-content class="legal-content">
      <div class="legal-shell">
        <header class="hero">
          <h1 class="hero-title">Help &amp; support</h1>
          <p class="hero-sub">
            Get help with Trova, Slack, and your account. We respond to email during business hours.
          </p>
        </header>

        <section class="card">
          <h2>Contact us</h2>
          <p>
            For product questions, billing, security concerns, or data requests, email us at
            <a class="inline-link" href="mailto:help@trova.io">help@trova.io</a>.
          </p>
          <p>
            If your organization runs a Trova program, your <strong>workspace or program admin</strong> can often
            resolve access and rollout questions fastest.
          </p>
        </section>

        <section class="card">
          <h2>Slack</h2>
          <ul>
            <li>
              <strong>Installing Trova for Slack</strong> — use our
              <router-link class="inline-link" to="/slack-install">Slack install page</router-link>
              or install from the Slack App Directory, then approve the permissions your team needs.
            </li>
            <li>
              <strong>Permissions</strong> — Trova asks only for scopes required to show profiles and features in your
              workspace. If something fails after you click Allow, try reinstalling from the install page or contact
              <a class="inline-link" href="mailto:help@trova.io">help@trova.io</a> with your workspace name and what you
              saw on screen.
            </li>
          </ul>
        </section>

        <section class="card">
          <h2>Account &amp; sign-in</h2>
          <p>
            Trouble signing in or completing setup? Confirm you are using the correct workspace or email, clear your
            browser cache for this site, and try again. If the problem continues, email
            <a class="inline-link" href="mailto:help@trova.io">help@trova.io</a> with a short description and (if
            possible) a screenshot of any error message.
          </p>
        </section>

        <section class="card">
          <h2>Policies &amp; safety</h2>
          <p>
            <router-link class="inline-link" to="/privacy">Privacy Policy</router-link>
            &nbsp;·&nbsp;
            <router-link class="inline-link" to="/terms">Terms of Service</router-link>
            &nbsp;·&nbsp;
            <router-link class="inline-link" to="/safety">Safety tips</router-link>
          </p>
        </section>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { IonPage, IonHeader, IonToolbar, IonTitle, IonContent } from '@ionic/vue';
</script>

<style scoped>
.legal-content {
  --background: #ffffff;
}

.legal-shell {
  max-width: 760px;
  margin: 0 auto;
  padding: 22px 18px 40px;
  color: #0f172a;
}

.hero {
  margin-bottom: 18px;
}
.hero-title {
  margin: 0 0 8px;
  font-size: clamp(1.4rem, 3.2vw, 2rem);
  letter-spacing: -0.02em;
}
.hero-sub {
  margin: 0;
  color: #475569;
  line-height: 1.6;
}

.card {
  margin-bottom: 20px;
  padding: 16px 18px;
  border-radius: 12px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
}

h2 {
  margin: 0 0 10px;
  font-size: 1.05rem;
  letter-spacing: -0.01em;
}

ul {
  margin: 0;
  padding-left: 1.15rem;
  color: #334155;
}

p {
  margin: 0 0 12px;
  line-height: 1.65;
  color: #334155;
}
p:last-child {
  margin-bottom: 0;
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
