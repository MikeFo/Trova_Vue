<template>
  <ion-page>
    <ion-content>
      <div class="ion-padding">
        <ion-text>
          <h2>Authorizing...</h2>
        </ion-text>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { IonPage, IonContent, IonText } from '@ionic/vue';
import { authService } from '@/services/auth.service';
import { useAuthStore } from '@/stores/auth.store';

const router = useRouter();
const route = useRoute();
const authStore = useAuthStore();

onMounted(async () => {
  // Google redirect returns here; wait for Firebase + backend session hydration
  // before navigating to guarded routes to avoid bouncing back to /login.
  try {
    const isAuthenticated = await authService.checkAuth();
    if (!isAuthenticated) {
      await router.replace('/login');
      return;
    }

    const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : null;
    if (redirect) {
      await router.replace(redirect);
      return;
    }

    // Default to home; if setup is incomplete, guards will send to /setup.
    // If we already know setup is incomplete, go directly.
    if (authStore.user && !authStore.isSetupComplete) {
      await router.replace('/setup');
      return;
    }

    await router.replace('/tabs/home');
  } catch (e) {
    console.warn('[AuthCallbackPage] auth callback failed:', e);
    await router.replace('/login');
  }
});
</script>

