<template>
  <ion-app>
    <ion-router-outlet />
  </ion-app>
</template>

<script setup lang="ts">
import { onMounted, watch } from 'vue';
import { useRoute } from 'vue-router';
import { IonApp, IonRouterOutlet } from '@ionic/vue';
import { authService } from './services/auth.service';
import { useFirebase } from './composables/useFirebase';
import { slackSessionService } from './services/slack-session.service';
import { useAuthStore } from './stores/auth.store';

const route = useRoute();
const authStore = useAuthStore();

// Validate secretId from URL if present (Slack link)
// Only validate if user is not fully authenticated
async function validateSlackSession() {
  const secretId = (route.query.s as string) || '';
  const communityId = route.query.communityId ? Number(route.query.communityId) : null;
  const slackUserId = (route.query.slackUserId as string) || '';
  
  // Only validate secretId if user came from Slack link (not fully authenticated)
  const isFullyAuthenticated = authStore.isAuthenticated && authStore.user?.id;
  
  if (secretId && communityId && slackUserId && !isFullyAuthenticated) {
    console.log('[App] Validating secretId from URL for session gate');
    try {
      const isValid = await slackSessionService.validateSecretId(
        secretId,
        communityId,
        slackUserId
      );
      if (!isValid) {
        console.warn('[App] SecretId validation failed - link may have expired');
      }
    } catch (error) {
      console.error('[App] Failed to validate secretId:', error);
    }
  } else if (isFullyAuthenticated) {
    console.log('[App] User is fully authenticated, skipping secretId validation');
  }
}

// Initialize Firebase early to ensure it's ready
onMounted(async () => {
  try {
    // Initialize Firebase first
    const firebase = useFirebase();
    if (!firebase.app || !firebase.auth) {
      console.warn('Firebase initialization issue - app:', !!firebase.app, 'auth:', !!firebase.auth);
    }
    
    // Then check auth state to restore persisted session
    await authService.checkAuth();
    
    // Validate secretId from URL if present (Slack link)
    await validateSlackSession();
  } catch (error) {
    // Don't log sensitive info
    console.warn('Auth initialization on app mount failed');
    // Don't redirect here - let route guards handle it
  }
});

// Watch for route changes to validate secretId if it appears in URL
watch(() => route.query.s, () => {
  validateSlackSession();
});
</script>
