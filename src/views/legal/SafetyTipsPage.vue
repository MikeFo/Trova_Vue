<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-title>Safety Tips</ion-title>
      </ion-toolbar>
    </ion-header>
    <ion-content class="safety-content">
      <div class="safety-shell">
        <header class="hero">
          <h1 class="hero-title">Let’s grow safely together</h1>
          <p class="hero-sub">
            Trova helps you connect with new people, because that’s how community is built.
          </p>
        </header>

        <section class="card">
          <h2>Overview</h2>
          <p>
            Trova brings people together. With so many people on Trova, user safety is a priority. These guidelines are
            here to support your personal safety and well-being, but they are not a substitute for your judgment.
          </p>
        </section>

        <section class="card">
          <h2>Online behavior</h2>

          <h3>Protect your finances</h3>
          <p>
            Never send money or financial information. Be cautious of emergency stories and requests to wire funds.
          </p>

          <h3>Protect your personal information</h3>
          <p>
            Don’t share sensitive information (social security number, credit card/bank info, work/home address) with
            people you don’t know or haven’t met in person.
          </p>
          <p class="note">
            Note: Trova will never email you asking for your username or password. Report suspicious emails.
          </p>

          <h3>Be web wise</h3>
          <ul>
            <li>Keep conversations on the platform.</li>
            <li>Block and report suspicious users.</li>
            <li>Be cautious of anyone pushing you to move off-platform quickly.</li>
          </ul>

          <h3>Report suspicious behavior</h3>
          <p>
            If someone violates the Terms or makes you uncomfortable, report it to
            <a class="link" href="mailto:help@trova.io">help@trova.io</a>.
          </p>
          <ul>
            <li>Requests for money or donations</li>
            <li>Requests for photographs</li>
            <li>Minors using the platform</li>
            <li>Harassing or offensive messages</li>
            <li>Fraudulent registration or profiles</li>
            <li>Spam or solicitation</li>
          </ul>
        </section>

        <section class="card">
          <h2>Offline behavior</h2>
          <ul>
            <li>
              <strong>Get to know the other person:</strong> stay on-platform until you’re comfortable meeting.
            </li>
            <li>
              <strong>Meet in public:</strong> choose a populated place; don’t meet at home or somewhere isolated.
            </li>
            <li>
              <strong>Tell a friend:</strong> share your plans and keep your phone charged.
            </li>
            <li>
              <strong>Control transportation:</strong> get yourself to/from the meeting.
            </li>
            <li>
              <strong>Stay sober:</strong> keep a clear mind; be cautious with drinks and substances.
            </li>
          </ul>
        </section>

        <section class="card">
          <h2>Health</h2>
          <p>
            Trova is designed for platonic relationships. If a relationship becomes sexual, we encourage safe practices
            and open communication.
          </p>
          <ul>
            <li><strong>Protect yourself:</strong> use proper protection to reduce STI risk.</li>
            <li><strong>Be open and honest:</strong> discuss testing and boundaries before sexual contact.</li>
            <li><strong>Vaccinate:</strong> consult a medical professional about vaccines that reduce STI risk.</li>
            <li><strong>Know your status:</strong> regular testing helps you stay informed and safe.</li>
          </ul>
        </section>

        <section class="card card--help">
          <h2>For further help</h2>
          <p>
            If you’re in immediate danger, call <strong>911</strong>.
          </p>
          <p class="help-lead">
            If you need support related to physical or sexual assault, these 24-hour hotlines can help:
          </p>
          <ul class="help-list">
            <li>
              <strong>RAINN (Rape, Abuse &amp; Incest National Network)</strong><br />
              1-800-656-HOPE · <a class="link" href="https://www.rainn.org" target="_blank" rel="noopener noreferrer">rainn.org</a>
            </li>
            <li>
              <strong>Planned Parenthood</strong><br />
              1-800-230-7526 ·
              <a class="link" href="https://www.plannedparenthood.org" target="_blank" rel="noopener noreferrer"
                >plannedparenthood.org</a
              >
            </li>
            <li>
              <strong>National Domestic Violence Hotline</strong><br />
              1-800-799-SAFE (7233) ·
              <a class="link" href="https://www.thehotline.org" target="_blank" rel="noopener noreferrer"
                >thehotline.org</a
              >
            </li>
          </ul>

          <div class="report-box" role="note" aria-label="Report concerns">
            If you’re aware of anyone who violates our Terms of Use, please report them at
            <a class="link" href="mailto:help@trova.io">help@trova.io</a>.
          </div>
        </section>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { IonPage, IonHeader, IonToolbar, IonTitle, IonContent } from '@ionic/vue';
</script>

<style scoped>
.safety-content {
  --background: #ffffff;
}

.safety-shell {
  max-width: 860px;
  margin: 0 auto;
  padding: 22px 18px 44px;
  color: #0f172a;
}

.hero {
  margin-bottom: 18px;
}

.hero-title {
  margin: 0 0 8px;
  font-size: clamp(1.45rem, 3.4vw, 2rem);
  letter-spacing: -0.02em;
}

.hero-sub {
  margin: 0;
  color: #475569;
  line-height: 1.55;
  max-width: 52rem;
}

.card {
  border: 1px solid #e2e8f0;
  border-radius: 14px;
  padding: 16px 16px 14px;
  background: #fff;
  margin: 14px 0;
}

h2 {
  margin: 0 0 10px;
  font-size: 1.1rem;
  letter-spacing: -0.01em;
}

h3 {
  margin: 14px 0 8px;
  font-size: 0.98rem;
}

p {
  margin: 0 0 10px;
  color: #334155;
  line-height: 1.65;
}

ul {
  margin: 0 0 10px;
  padding-left: 1.15rem;
  color: #334155;
  line-height: 1.6;
}

.note {
  color: #64748b;
  font-size: 0.92rem;
}

.link {
  color: var(--ion-color-primary);
  font-weight: 600;
  text-decoration: none;
}
.link:hover {
  text-decoration: underline;
}

.card--help {
  border-color: rgba(45, 122, 78, 0.25);
  background: linear-gradient(180deg, rgba(45, 122, 78, 0.05) 0%, #ffffff 55%);
}

.help-lead {
  margin-top: 0;
}

.help-list li {
  margin-bottom: 12px;
}

.report-box {
  margin-top: 12px;
  padding: 12px 12px 12px;
  border-radius: 12px;
  border: 1px solid #e2e8f0;
  background: #fff;
  color: #475569;
}
</style>

