<template>
  <div class="step-panel">
    <h2 class="step-title">What are you passionate about?</h2>
    <p class="step-description">We'll dive deeper on the next page.</p>
    
    <ion-item class="setup-item" lines="full">
      <ion-label position="stacked">First Name</ion-label>
      <ion-input
        :model-value="profileData.firstName"
        @update:model-value="update('firstName', $event)"
        placeholder="Enter your first name"
        autocomplete="given-name"
      ></ion-input>
    </ion-item>

    <ion-item class="setup-item" lines="full">
      <ion-label position="stacked">Last Name</ion-label>
      <ion-input
        :model-value="profileData.lastName"
        @update:model-value="update('lastName', $event)"
        placeholder="Enter your last name"
        autocomplete="family-name"
      ></ion-input>
    </ion-item>

    <div class="passions-container">
      <ion-label class="passions-label">I like to...</ion-label>
      <ThingSelector
        :selected-things="profileData.passions"
        type="activityOrInterest"
        input-placeholder="Search passions..."
        :min-required="1"
        :show-warning="false"
        @update:selected-things="update('passions', $event)"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { IonItem, IonLabel, IonInput } from '@ionic/vue';
import ThingSelector from '../shared/ThingSelector.vue';

interface Props {
  profileData: {
    firstName: string;
    lastName: string;
    passions: Array<string | any>;
  };
}

const props = defineProps<Props>();
const emit = defineEmits<{
  'update': [field: string, value: any];
}>();

function update(field: string, value: any) {
  emit('update', field, value);
}
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
  margin: 0 0 24px 0;
}

.setup-item {
  --padding-start: 0;
  --padding-end: 0;
  --inner-padding-end: 0;
  margin-bottom: 12px;
}

.passions-container {
  margin-top: 20px;
}

.passions-label {
  font-weight: 500;
  font-size: 14px;
  color: #1a1a1a;
  margin-bottom: 8px;
  display: block;
}

/* Fix Chrome autofill styling for ion-input in this component */
.setup-item ion-input input:-webkit-autofill,
.setup-item ion-input input:-webkit-autofill:hover,
.setup-item ion-input input:-webkit-autofill:focus,
.setup-item ion-input input:-webkit-autofill:active {
  -webkit-box-shadow: 0 0 0px 1000px white inset !important;
  -webkit-text-fill-color: #1a1a1a !important;
  transition: background-color 5000s ease-in-out 0s !important;
  background-color: white !important;
  font-size: 16px !important;
  font-family: inherit !important;
  line-height: normal !important;
  padding: 0 !important;
}

.setup-item ion-input input:-webkit-autofill::first-line {
  font-size: 16px !important;
  font-family: inherit !important;
  color: #1a1a1a !important;
}
</style>

