<template>
  <div class="step-panel skip-step">
    <h2 class="step-title">Want to continue on to section 2?</h2>
    <p class="step-description">You can add more details later:</p>
    
    <ul class="addition-steps-list">
      <li>Work experience</li>
      <li>Education</li>
      <li>Places Lived</li>
    </ul>

    <div class="skip-actions">
      <ion-button expand="block" @click="$emit('continue')" class="continue-button">
        Yes, Keep Building!
      </ion-button>
      <p class="or-text">or</p>
      <ion-button fill="clear" @click="$emit('skip')" class="skip-button">
        Continue to the app
      </ion-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { IonButton } from '@ionic/vue';

defineEmits<{
  'continue': [];
  'skip': [];
}>();
</script>

<style scoped>
.step-panel {
  animation: fadeIn 0.3s ease;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.step-title {
  font-size: 28px;
  font-weight: 700;
  color: #1a1a1a;
  margin: 0 0 8px 0;
}

.step-description {
  font-size: 16px;
  color: #6b7280;
  margin: 0 0 32px 0;
}

.skip-step {
  text-align: center;
}

.addition-steps-list {
  list-style: none;
  padding: 0;
  margin: 24px 0;
  text-align: left;
  max-width: 300px;
  margin-left: auto;
  margin-right: auto;
}

.addition-steps-list li {
  padding: 8px 0;
  font-size: 16px;
  color: #6b7280;
}

.skip-actions {
  margin-top: 32px;
}

.continue-button {
  margin-bottom: 16px;
}

.or-text {
  margin: 16px 0;
  color: #6b7280;
}

.skip-button {
  text-decoration: underline;
  --color: #2d7a4e;
}
</style>

