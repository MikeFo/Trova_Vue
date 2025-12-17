<template>
  <ion-page>
    <ion-content>
      <div class="ion-padding">
        <ion-text>
          <h2>Logging out...</h2>
        </ion-text>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { authService } from '@/services/auth.service';
import { IonPage, IonContent, IonText } from '@ionic/vue';

const router = useRouter();

onMounted(async () => {
  try {
    await authService.logout();
  } catch (error) {
    console.error('Logout error:', error);
  } finally {
    router.push('/login');
  }
});
</script>

