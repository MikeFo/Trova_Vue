<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-title>Terms of Use</ion-title>
      </ion-toolbar>
    </ion-header>
    <ion-content class="legal-content">
      <div class="legal-shell">
        <header class="hero">
          <h1 class="hero-title">Terms of Use</h1>
          <p class="hero-sub">
            Trova is a free-to-use platform, but it does come with user terms. Read on to understand your role.
          </p>
          <p class="updated-at">Last revised on {{ lastRevised }}</p>
        </header>

        <p>
          Welcome to Trova, operated by Trova Inc (“Trova”, “we”, “us”). These Terms of Use (“Terms”) govern your access
          to and use of Trova (including our website, apps, and Slack-connected experiences, collectively the
          “Service”).
        </p>

        <p>
          By creating an account or using the Service, you agree to be bound by these Terms and our
          <router-link class="inline-link" to="/privacy">Privacy Policy</router-link>
          and
          <router-link class="inline-link" to="/safety">Safety Tips</router-link>.
          If you don’t agree, don’t use the Service.
        </p>

        <h2>1. Eligibility</h2>
        <ul>
          <li>You must be at least 18 years old to use the Service.</li>
          <li>You must comply with applicable laws and workplace policies when using Trova.</li>
        </ul>

        <h2>2. Your account</h2>
        <ul>
          <li>You’re responsible for your account and activity under it.</li>
          <li>Keep your credentials secure and notify us if you suspect unauthorized access.</li>
        </ul>

        <h2>3. Acceptable use</h2>
        <p>
          Trova is built for community and connection. You agree not to misuse the Service, including by:
        </p>
        <ul>
          <li>Harassing, threatening, or discriminating against others.</li>
          <li>Spamming, soliciting, or attempting to defraud users.</li>
          <li>Impersonating others or creating misleading profiles.</li>
          <li>Sharing others’ personal information without permission.</li>
          <li>Attempting to disrupt, scrape, or reverse engineer the Service.</li>
        </ul>

        <h2>4. Safety and reporting</h2>
        <p>
          You are solely responsible for your interactions with others—especially if you choose to communicate off the
          platform or meet in person. Please review our
          <router-link class="inline-link" to="/safety">Safety Tips</router-link>
          before meeting someone new.
        </p>
        <p>
          If you see suspicious activity or believe someone is violating these Terms, contact
          <a class="inline-link" href="mailto:help@trova.io">help@trova.io</a>.
        </p>

        <h2>5. Third-party services</h2>
        <p>
          The Service may integrate with third-party platforms (e.g., Slack) and may display or use third-party
          services (e.g., Google Maps). Your use of those services is governed by their terms and policies.
        </p>

        <h2>6. Changes, suspension, and termination</h2>
        <ul>
          <li>We may change or discontinue parts of the Service.</li>
          <li>We may suspend or terminate access if we believe these Terms are violated.</li>
          <li>You may terminate your account by contacting <a class="inline-link" href="mailto:help@trova.io">help@trova.io</a>.</li>
        </ul>

        <h2>7. Disclaimers</h2>
        <p>
          The Service is provided “as is” and “as available.” We don’t guarantee specific outcomes from using Trova
          (including connections, introductions, or engagement).
        </p>

        <h2>8. Limitation of liability</h2>
        <p>
          To the maximum extent permitted by law, Trova will not be liable for indirect, incidental, special,
          consequential, or punitive damages arising from your use of the Service.
        </p>

        <h2>9. Contact</h2>
        <p>
          Questions? Contact us at <a class="inline-link" href="mailto:help@trova.io">help@trova.io</a>.
        </p>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { IonPage, IonHeader, IonToolbar, IonTitle, IonContent } from '@ionic/vue';

const lastRevised = 'April 14, 2026';
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

