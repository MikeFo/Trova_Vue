<template>
  <ion-page>
    <ion-content class="ion-padding">
      <div class="slack-signin">
        <p>Redirecting you to Slack to sign in…</p>
        <ion-spinner></ion-spinner>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { IonPage, IonContent, IonSpinner } from '@ionic/vue';
import { buildSlackAuthorizeUrl } from '@/services/slack-auth.service';

const route = useRoute();

onMounted(() => {
  // redirectTo: where to send the user after Slack sign-in (full path + query)
  const redirectTo = (route.query.redirectTo as string) || '/tabs/home';
  const slackTeamId = route.query.slackTeamId as string | undefined;

  const url = buildSlackAuthorizeUrl(redirectTo, slackTeamId);
  window.location.href = url;
});
</script>

<style scoped>
.slack-signin {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 200px;
  gap: 16px;
}
</style>
