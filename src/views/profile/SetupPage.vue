<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-title>Complete Your Profile</ion-title>
      </ion-toolbar>
    </ion-header>
    <ion-content :fullscreen="true" class="setup-content">
      <div class="setup-container">
        <!-- Progress Indicator -->
        <StepProgress :current-step="currentStep" :total-steps="totalSteps" />

        <!-- Step Content -->
        <div class="step-content">
          <!-- Step 2: Deets Setup -->
          <DeetsStep
            v-if="currentStep === 2"
            :profile-data="profileData"
            @update="handleUpdate"
          />

          <!-- Step 3: Interests Setup -->
          <InterestsStep
            v-if="currentStep === 3"
            :profile-data="profileData"
            @update="handleUpdate"
          />

          <!-- Step 4: Photo Setup -->
          <PhotoStep
            v-if="currentStep === 4"
            :photo="profileData.photo"
            @update="handlePhotoUpdate"
          />

          <!-- Step 5: Skip Setup -->
          <SkipStep
            v-if="currentStep === 5"
            @continue="continueToNextStep"
            @skip="skipToComplete"
          />

          <!-- Step 6: Location Setup (Sub-step 0) -->
          <LocationStep
            v-if="currentStep === 6 && subStep === 0"
            :locations="profileData.locations"
            @update:locations="handleUpdate('locations', $event)"
          />

          <!-- Step 6: Background Setup (Sub-step 1) -->
          <BackgroundStep
            v-if="currentStep === 6 && subStep === 1"
            :profile-data="profileData"
            @update="handleUpdate"
          />

          <!-- Step 7: Intention Setup -->
          <IntentionStep
            v-if="currentStep === 7"
            :profile-data="profileData"
            @update="handleUpdate"
          />
        </div>

        <!-- Navigation Buttons -->
        <div class="step-navigation" v-if="currentStep < 7 && !(currentStep === 5)">
          <ion-button
            v-if="currentStep > 2 || (currentStep === 6 && subStep > 0)"
            fill="outline"
            @click="previousStep"
            class="nav-button"
          >
            Back
          </ion-button>
          <ion-button
            expand="block"
            @click="nextStep"
            :disabled="!canProceed"
            class="nav-button primary"
          >
            {{ getNextButtonText() }}
          </ion-button>
        </div>

        <!-- Step 7 Navigation (Complete Button) -->
        <div class="step-navigation" v-if="currentStep === 7">
          <ion-button
            fill="outline"
            @click="previousStep"
            class="nav-button"
          >
            Back
          </ion-button>
          <ion-button
            expand="block"
            @click="completeSetup"
            :disabled="!canProceed"
            class="nav-button primary"
          >
            Complete Setup
          </ion-button>
        </div>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { ref, computed, nextTick } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth.store';
import { profileService } from '@/services/profile.service';
import { useGooglePlaces, type PlaceData } from '@/composables/useGooglePlaces';
import { toastController } from '@ionic/vue';
import { IonPage, IonHeader, IonToolbar, IonTitle, IonContent, IonButton } from '@ionic/vue';

// Components
import StepProgress from './components/StepProgress.vue';
import DeetsStep from './components/steps/DeetsStep.vue';
import InterestsStep from './components/steps/InterestsStep.vue';
import PhotoStep from './components/steps/PhotoStep.vue';
import SkipStep from './components/steps/SkipStep.vue';
import LocationStep from './components/steps/LocationStep.vue';
import BackgroundStep from './components/steps/BackgroundStep.vue';
import IntentionStep from './components/steps/IntentionStep.vue';

const router = useRouter();
const authStore = useAuthStore();
const { loadGoogleMapsScript } = useGooglePlaces();

const currentStep = ref(2); // Start at step 2 (skip community step for now)
const totalSteps = 7;
const subStep = ref(0); // For step 6: 0 = location, 1 = background

const profileData = ref({
  firstName: '',
  lastName: '',
  passions: [] as Array<string | any>,
  interests: [] as Array<string | any>,
  photo: null as string | null,
  locations: [] as Array<PlaceData & { type: string }>,
  currentEmployer: null as string | null,
  pastEmployers: [] as string[],
  jobTitle: '',
  school: '',
  degree: '',
  intentions: [] as Array<string | any>,
});

function getThingCount(things: Array<string | any>): number {
  return things.length;
}

const canProceed = computed(() => {
  switch (currentStep.value) {
    case 2:
      return profileData.value.firstName && 
             profileData.value.lastName && 
             getThingCount(profileData.value.passions) > 0;
    case 3:
      return getThingCount(profileData.value.interests) >= 5;
    case 4:
      return true; // Photo is optional
    case 5:
      return true; // Skip step
    case 6:
      if (subStep.value === 0) {
        return true; // Location is optional but recommended
      } else {
        return true; // Background is optional
      }
    case 7:
      return getThingCount(profileData.value.intentions) > 0;
    default:
      return true;
  }
});

function getNextButtonText(): string {
  if (currentStep.value === 6 && subStep.value === 0) {
    return 'Next';
  }
  if (currentStep.value === 7) {
    return 'Complete Setup';
  }
  return 'Next';
}

function handleUpdate(field: string, value: any) {
  (profileData.value as any)[field] = value;
}

function handlePhotoUpdate(value: string | null) {
  profileData.value.photo = value;
}

async function nextStep() {
  if (!canProceed.value) {
    const toast = await toastController.create({
      message: getValidationMessage(),
      duration: 2000,
      color: 'warning',
    });
    await toast.present();
    return;
  }

  if (currentStep.value === 6 && subStep.value === 0) {
    // Move to background sub-step
    subStep.value = 1;
    // Load Google Maps for organization search when entering background sub-step
    await loadGoogleMapsScript();
    await nextTick();
  } else if (currentStep.value === 7) {
    // Complete setup
    await completeSetup();
  } else {
    currentStep.value++;
    if (currentStep.value === 6) {
      subStep.value = 0;
      // Initialize Google Places when entering location step
      await nextTick();
      await loadGoogleMapsScript();
    }
  }
}

function previousStep() {
  if (currentStep.value === 6 && subStep.value === 1) {
    // Go back to location sub-step
    subStep.value = 0;
  } else if (currentStep.value > 2) {
    currentStep.value--;
    if (currentStep.value === 6) {
      subStep.value = 0;
    }
  }
}

async function continueToNextStep() {
  currentStep.value = 6;
  subStep.value = 0;
  await nextTick();
  await loadGoogleMapsScript();
}

async function skipToComplete() {
  try {
    // When skipping, we still want to save what we have and mark setup as complete
    // But don't require all fields to be filled
    try {
      // Try to save profile data if we have any
      if (profileData.value.firstName || profileData.value.lastName) {
        await profileService.saveProfile(profileData.value);
      }
    } catch (error) {
      // If saving fails, that's okay - we can still mark setup as complete
      console.warn('Failed to save profile data when skipping:', error);
    }
    
    // Update setup step to complete
    await profileService.completeSetup();
    
    const toast = await toastController.create({
      message: 'Welcome to Trova!',
      duration: 2000,
      color: 'success',
    });
    await toast.present();
    
    // Redirect to home
    setTimeout(() => {
      router.push('/tabs/home');
    }, 500);
  } catch (error: any) {
    console.error('Skip to complete error:', error);
    const toast = await toastController.create({
      message: error.message || 'Failed to complete setup. Please try again.',
      duration: 3000,
      color: 'danger',
    });
    await toast.present();
  }
}

function getValidationMessage(): string {
  switch (currentStep.value) {
    case 2:
      return 'Please enter your name and select at least one passion';
    case 3:
      const remaining = 5 - getThingCount(profileData.value.interests);
      return `Please add at least ${remaining} more ${remaining === 1 ? 'activity' : 'activities'}`;
    case 7:
      return 'Please add at least one intention';
    default:
      return 'Please complete all required fields';
  }
}

async function completeSetup() {
  try {
    // Save profile data to backend
    await profileService.saveProfile(profileData.value);
    
    // Update setup step to complete and refresh user
    await profileService.completeSetup();
    
    const toast = await toastController.create({
      message: 'Profile setup complete!',
      duration: 2000,
      color: 'success',
    });
    await toast.present();
    
    // Redirect to home after a short delay to ensure state is updated
    setTimeout(() => {
      router.push('/tabs/home');
    }, 500);
  } catch (error: any) {
    console.error('Setup completion error:', error);
    const toast = await toastController.create({
      message: error.message || 'Failed to save profile. Please try again.',
      duration: 3000,
      color: 'danger',
    });
    await toast.present();
  }
}
</script>

<style scoped>
.setup-content {
  --background: #f8fafc;
}

.setup-container {
  max-width: 600px;
  margin: 0 auto;
  padding: 20px;
}

.step-content {
  background: white;
  border-radius: 16px;
  padding: 24px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  margin-bottom: 20px;
  min-height: 400px;
}

.step-navigation {
  display: flex;
  gap: 12px;
  align-items: center;
}

.nav-button {
  flex: 1;
  height: 48px;
  font-weight: 600;
}

.nav-button.primary {
  flex: 2;
}

/* Fix Chrome autofill styling for native inputs and ion-input */
input:-webkit-autofill,
input:-webkit-autofill:hover,
input:-webkit-autofill:focus,
input:-webkit-autofill:active {
  -webkit-box-shadow: 0 0 0px 1000px white inset !important;
  -webkit-text-fill-color: #1a1a1a !important;
  transition: background-color 5000s ease-in-out 0s !important;
  border-color: #e5e7eb !important;
  background-color: white !important;
  font-size: 16px !important;
  font-family: inherit !important;
  line-height: normal !important;
}

input:-webkit-autofill::first-line {
  font-size: 16px !important;
  font-family: inherit !important;
  color: #1a1a1a !important;
}

/* Target inputs inside ion-input shadow DOM */
ion-input input:-webkit-autofill,
ion-input input:-webkit-autofill:hover,
ion-input input:-webkit-autofill:focus,
ion-input input:-webkit-autofill:active {
  -webkit-box-shadow: 0 0 0px 1000px white inset !important;
  -webkit-text-fill-color: #1a1a1a !important;
  transition: background-color 5000s ease-in-out 0s !important;
  background-color: white !important;
  font-size: 16px !important;
  font-family: inherit !important;
  line-height: normal !important;
}

ion-input input:-webkit-autofill::first-line {
  font-size: 16px !important;
  font-family: inherit !important;
  color: #1a1a1a !important;
}

/* For dark mode support */
@media (prefers-color-scheme: dark) {
  input:-webkit-autofill,
  input:-webkit-autofill:hover,
  input:-webkit-autofill:focus,
  input:-webkit-autofill:active,
  ion-input input:-webkit-autofill,
  ion-input input:-webkit-autofill:hover,
  ion-input input:-webkit-autofill:focus,
  ion-input input:-webkit-autofill:active {
    -webkit-box-shadow: 0 0 0px 1000px #1e293b inset !important;
    -webkit-text-fill-color: #f1f5f9 !important;
    background-color: #1e293b !important;
  }
}
</style>
