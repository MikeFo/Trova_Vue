<template>
  <ion-page>
    <ion-content class="ion-padding">
      <div class="slack-redirect">
        <p v-if="error" class="error">{{ error }}</p>
        <template v-else>
          <p>Completing sign in…</p>
          <ion-spinner></ion-spinner>
        </template>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { IonPage, IonContent, IonSpinner } from '@ionic/vue';
import { signInWithCustomToken } from 'firebase/auth';
import { useFirebase } from '@/composables/useFirebase';
import { getSlackSignInRedirectUri, consumeStoredRedirectTo } from '@/services/slack-auth.service';
import { apiService } from '@/services/api.service';
import { authService } from '@/services/auth.service';
import { environment } from '@/environments/environment';
import { slackSessionService } from '@/services/slack-session.service';

const router = useRouter();
const error = ref('');

onMounted(async () => {
  const params = new URLSearchParams(window.location.search);
  const code = params.get('code');
  const state = params.get('state');

  if (!code) {
    error.value = 'Missing authorization code. Please try the link from Slack again.';
    return;
  }

  const redirectTo = state ? consumeStoredRedirectTo(state) : null;
  const defaultPath = '/tabs/home';

  try {
    const redirectUri = getSlackSignInRedirectUri();
    const apiBase = environment.apiUrl;
    const res = await fetch(`${apiBase}/public/slack/user-signin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, redirectUri }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.message || `Sign-in failed (${res.status})`);
    }

    const data = await res.json();
    const { idToken, existing, email } = data;

    if (!idToken) {
      throw new Error('No token returned from sign-in');
    }

    const { auth } = useFirebase();
    if (!auth) throw new Error('Firebase auth not initialized');

    await signInWithCustomToken(auth, idToken);

    if (existing === false && email) {
      await apiService.post('/auth/complete-slack-signup', { userEmail: email });
    }

    slackSessionService.clearValidation();
    await authService.getUserProfile();

    const target = redirectTo || defaultPath;
    const [path, search] = target.split('?');
    let query: Record<string, string> | undefined;
    if (search) {
      query = {};
      new URLSearchParams(search).forEach((v, k) => {
        query![k] = v;
      });
    }
    router.replace(query ? { path: path || defaultPath, query } : { path: path || defaultPath });
  } catch (e: any) {
    console.error('[SlackSigninRedirect]', e);
    error.value = e.message || 'Sign-in failed. Please try again from Slack.';
  }
});
</script>

<style scoped>
.slack-redirect {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 200px;
  gap: 16px;
}
.error {
  color: var(--ion-color-danger);
  text-align: center;
}
</style>
