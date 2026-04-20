<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-title>Privacy Policy</ion-title>
      </ion-toolbar>
    </ion-header>
    <ion-content class="legal-content">
      <div class="legal-shell">
        <header class="hero">
          <h1 class="hero-title">Privacy Policy</h1>
          <p class="hero-sub">
            We value your privacy. This policy explains what we collect, why we collect it, and the choices you have.
          </p>
          <p class="updated-at">Effective date: {{ effectiveDate }}</p>
        </header>

        <p>
          This Privacy Policy applies to Trova websites, apps, and Slack-connected experiences (collectively, the
          “Service”). It describes how Trova collects, uses, and shares information when you use the Service.
        </p>

        <h2>1. Information we collect</h2>
        <p>We collect information in three main ways: you provide it, we collect it automatically, or we receive it from integrations you use.</p>
        <ul>
          <li>
            <strong>Account &amp; profile information</strong> (e.g., email, name, photos, interests, skills, location, and other profile details you choose to provide).
          </li>
          <li>
            <strong>Workspace / integration information</strong> (e.g., Slack workspace identifiers and user identifiers needed to connect Trova to your workspace and provide features).
          </li>
          <li>
            <strong>Usage &amp; device information</strong> (e.g., feature usage, log data, IP address, browser type, and crash/diagnostics data).
          </li>
          <li>
            <strong>Content you create</strong> (e.g., messages, posts, and community content—where applicable).
          </li>
        </ul>

        <h2>2. How we use information</h2>
        <ul>
          <li>Provide, maintain, and improve the Service.</li>
          <li>Enable community features like profiles, directory search, introductions, and map-based discovery.</li>
          <li>Authenticate users and keep accounts secure.</li>
          <li>Provide support and communicate with you about the Service.</li>
          <li>Detect, prevent, and address fraud, abuse, and security incidents.</li>
        </ul>

        <h2>3. Sharing</h2>
        <p>
          We share information only as needed to operate the Service:
        </p>
        <ul>
          <li>
            <strong>With other users in your community</strong>: information you choose to include in your profile or share through the Service may be visible to others based on your settings and community configuration.
          </li>
          <li>
            <strong>With service providers</strong>: vendors who help us host, operate, monitor, and secure the Service (e.g., infrastructure, analytics, error reporting).
          </li>
          <li>
            <strong>With integrations you enable</strong>: if you connect Trova to third-party services (like Slack), we share and receive data as needed to provide the integration.
          </li>
          <li>
            <strong>For legal and safety reasons</strong>: if required by law, or to protect rights, safety, and security.
          </li>
        </ul>

        <h2>4. Cookies &amp; similar technologies</h2>
        <p>
          We may use cookies or similar technologies to keep you signed in, remember preferences, and understand how the Service is used.
        </p>

        <h2>5. Your choices</h2>
        <ul>
          <li>You can update certain profile details within the Service.</li>
          <li>You can request help or changes by contacting us at <a class="inline-link" href="mailto:help@trova.io">help@trova.io</a>.</li>
        </ul>

        <h2>6. Data retention</h2>
        <p>
          We retain information for as long as needed to provide the Service and for legitimate business or legal purposes, such as security, fraud prevention, and compliance.
        </p>

        <h2>7. Contact</h2>
        <p>
          Questions or requests? Email <a class="inline-link" href="mailto:help@trova.io">help@trova.io</a>.
        </p>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { IonPage, IonHeader, IonToolbar, IonTitle, IonContent } from '@ionic/vue';

const effectiveDate = 'April 14, 2026';
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
  margin-bottom: 14px;
}
.hero-title {
  margin: 0 0 8px;
  font-size: clamp(1.4rem, 3.2vw, 2rem);
  letter-spacing: -0.02em;
}
.hero-sub {
  margin: 0 0 10px;
  color: #475569;
  line-height: 1.6;
}

.updated-at {
  margin: 0 0 14px;
  color: #64748b;
  font-size: 0.9rem;
}

h2 {
  margin: 22px 0 10px;
  font-size: 1.05rem;
  letter-spacing: -0.01em;
}

ul {
  margin: 0 0 10px;
  padding-left: 1.15rem;
  color: #334155;
}

p {
  margin: 0 0 12px;
  line-height: 1.65;
  color: #334155;
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

