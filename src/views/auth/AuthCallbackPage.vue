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
import { useRouter } from 'vue-router';
import { IonPage, IonContent, IonText } from '@ionic/vue';

const router = useRouter();

onMounted(() => {
  // TODO: Handle OAuth callback
  // After successful auth, redirect to tabs
  setTimeout(() => {
    router.push('/tabs/tab1');
  }, 1000);
});
</script>

