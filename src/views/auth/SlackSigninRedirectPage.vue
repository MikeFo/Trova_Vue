<template>
  <ion-page>
    <ion-content>
      <div class="ion-padding slack-signin-redirect">
        <template v-if="error">
          <ion-text color="danger">
            <h2>Sign-in failed</h2>
            <p>{{ error }}</p>
          </ion-text>
          <ion-button expand="block" @click="router.replace('/login')">Go to login</ion-button>
        </template>
        <template v-else>
          <ion-text>
            <h2>Signing you in...</h2>
          </ion-text>
        </template>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { IonPage, IonContent, IonText, IonButton } from '@ionic/vue';
import { apiService } from '@/services/api.service';
import { authService } from '@/services/auth.service';

const route = useRoute();
const router = useRouter();
const error = ref<string | null>(null);

function getRedirectPath(state: string | undefined): string {
  if (!state || typeof state !== 'string') return '/tabs/map';
  const s = state.trim().toLowerCase();
  if (s === 'map') return '/tabs/map';
  if (s === 'org-chart') return '/tabs/org-chart';
  if (s === 'console') return '/tabs/home'; // console needs communityId; user can navigate from home
  if (s.startsWith('/')) return s;
  return '/tabs/map';
}

onMounted(async () => {
  const code = route.query.code as string | undefined;
  const state = route.query.state as string | undefined;

  if (!code) {
    router.replace('/login');
    return;
  }

  const redirectUri = `${window.location.origin}/slack-signin-redirect`;

  try {
    const result = await apiService.post<{ idToken: string; existing?: boolean; email?: string; slackUserId?: string }>(
      '/public/slack/user-signin',
      { code, redirectUri }
    );

    if (!result?.idToken) {
      error.value = 'Invalid response from server';
      return;
    }

    await authService.signInWithCustomToken(result.idToken);

    const redirectPath = getRedirectPath(state);
    router.replace(redirectPath);
  } catch (err: unknown) {
    const msg = err && typeof err === 'object' && 'message' in err ? String((err as Error).message) : 'Sign-in failed';
    error.value = msg;
    console.error('Slack sign-in redirect error:', err);
  }
});
</script>

<style scoped>
.slack-signin-redirect {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 100%;
}
.slack-signin-redirect h2 {
  margin-bottom: 0.5rem;
}
.slack-signin-redirect p {
  margin-bottom: 1rem;
}
</style>
