<template>
  <div class="step-panel">
    <h2 class="step-title">Share your background</h2>
    <p class="step-description">Want to meet a colleague or a fellow alum? The world is smaller than you think.</p>
    
    <!-- Current Employer -->
    <div class="organization-field">
      <ion-label class="organization-label">Current Employer</ion-label>
      <div class="autocomplete-container">
        <input
          ref="currentEmployerInput"
          type="text"
          class="autocomplete-input"
          placeholder="Search for your current employer"
          :disabled="!!profileData.currentEmployer"
          v-model="currentEmployerQuery"
          @input="handleOrganizationSearch($event, 'current')"
          autocomplete="off"
        />
        <ion-icon :icon="search" class="input-icon"></ion-icon>
      </div>
      <div v-if="currentEmployerSuggestions.length > 0 && !profileData.currentEmployer" class="suggestions-dropdown">
        <div
          v-for="org in currentEmployerSuggestions"
          :key="org.name"
          class="suggestion-item"
          @click="selectOrganization(org.name, 'current')"
        >
          {{ org.name }}
        </div>
      </div>
      <div v-if="profileData.currentEmployer" class="organization-chips">
        <ion-chip
          color="primary"
          @click="removeOrganization('current')"
          class="organization-chip removable"
        >
          {{ profileData.currentEmployer }}
          <ion-icon :icon="closeCircle" slot="end"></ion-icon>
        </ion-chip>
      </div>
    </div>

    <!-- Past Employers -->
    <div class="organization-field">
      <ion-label class="organization-label">Past Employers</ion-label>
      <div class="autocomplete-container">
        <input
          ref="pastEmployerInput"
          type="text"
          class="autocomplete-input"
          placeholder="Search for past employers"
          v-model="pastEmployerQuery"
          @input="handleOrganizationSearch($event, 'past')"
          @keyup.enter="addPastEmployer"
          autocomplete="off"
        />
        <ion-icon :icon="search" class="input-icon"></ion-icon>
      </div>
      <div v-if="pastEmployerSuggestions.length > 0" class="suggestions-dropdown">
        <div
          v-for="org in pastEmployerSuggestions"
          :key="org.name"
          class="suggestion-item"
          @click="selectOrganization(org.name, 'past')"
        >
          {{ org.name }}
        </div>
      </div>
      <div v-if="profileData.pastEmployers.length > 0" class="organization-chips">
        <ion-chip
          v-for="(employer, index) in profileData.pastEmployers"
          :key="index"
          color="primary"
          @click="removePastEmployer(index)"
          class="organization-chip removable"
        >
          {{ employer }}
          <ion-icon :icon="closeCircle" slot="end"></ion-icon>
        </ion-chip>
      </div>
    </div>

    <ion-item class="setup-item" lines="full">
      <ion-label position="stacked">Job Title</ion-label>
      <ion-input
        :model-value="profileData.jobTitle"
        @update:model-value="update('jobTitle', $event)"
        placeholder="What's your role?"
        autocomplete="organization-title"
      ></ion-input>
    </ion-item>

    <ion-item class="setup-item" lines="full">
      <ion-label position="stacked">School / University</ion-label>
      <ion-input
        :model-value="profileData.school"
        @update:model-value="update('school', $event)"
        placeholder="Where did you study?"
        autocomplete="organization"
      ></ion-input>
    </ion-item>

    <ion-item class="setup-item" lines="full">
      <ion-label position="stacked">Degree / Major</ion-label>
      <ion-input
        :model-value="profileData.degree"
        @update:model-value="update('degree', $event)"
        placeholder="What did you study?"
      ></ion-input>
    </ion-item>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, nextTick } from 'vue';
import { useGooglePlaces } from '@/composables/useGooglePlaces';
import { search, closeCircle } from 'ionicons/icons';
import { IonItem, IonLabel, IonInput, IonChip, IonIcon } from '@ionic/vue';

interface Props {
  profileData: {
    currentEmployer: string | null;
    pastEmployers: string[];
    jobTitle: string;
    school: string;
    degree: string;
  };
}

const props = defineProps<Props>();
const emit = defineEmits<{
  'update': [field: string, value: any];
}>();

const currentEmployerInput = ref<HTMLInputElement | null>(null);
const pastEmployerInput = ref<HTMLInputElement | null>(null);
const currentEmployerQuery = ref('');
const pastEmployerQuery = ref('');
const currentEmployerSuggestions = ref<Array<{ name: string }>>([]);
const pastEmployerSuggestions = ref<Array<{ name: string }>>([]);
const { loadGoogleMapsScript, searchOrganizations } = useGooglePlaces();
let organizationSearchTimeout: ReturnType<typeof setTimeout> | null = null;

function update(field: string, value: any) {
  emit('update', field, value);
}

function handleOrganizationSearch(event: Event, type: 'current' | 'past') {
  const target = event.target as HTMLInputElement;
  const query = target.value;

  if (organizationSearchTimeout) {
    clearTimeout(organizationSearchTimeout);
  }

  organizationSearchTimeout = setTimeout(async () => {
    if (query.length >= 3) {
      try {
        await searchOrganizations(query, (organizations) => {
          if (type === 'current') {
            currentEmployerSuggestions.value = organizations;
          } else {
            pastEmployerSuggestions.value = organizations;
          }
        });
      } catch (error) {
        console.error('Failed to search organizations:', error);
      }
    } else {
      if (type === 'current') {
        currentEmployerSuggestions.value = [];
      } else {
        pastEmployerSuggestions.value = [];
      }
    }
  }, 200);
}

function selectOrganization(name: string, type: 'current' | 'past') {
  if (type === 'current') {
    update('currentEmployer', name);
    currentEmployerQuery.value = '';
    currentEmployerSuggestions.value = [];
  } else {
    if (!props.profileData.pastEmployers.includes(name)) {
      const updated = [...props.profileData.pastEmployers, name];
      update('pastEmployers', updated);
    }
    pastEmployerQuery.value = '';
    pastEmployerSuggestions.value = [];
  }
}

function removeOrganization(type: 'current') {
  if (type === 'current') {
    update('currentEmployer', null);
  }
}

function removePastEmployer(index: number) {
  const updated = [...props.profileData.pastEmployers];
  updated.splice(index, 1);
  update('pastEmployers', updated);
}

function addPastEmployer() {
  if (pastEmployerQuery.value.trim() && !props.profileData.pastEmployers.includes(pastEmployerQuery.value.trim())) {
    const updated = [...props.profileData.pastEmployers, pastEmployerQuery.value.trim()];
    update('pastEmployers', updated);
    pastEmployerQuery.value = '';
    pastEmployerSuggestions.value = [];
  }
}

onMounted(async () => {
  await loadGoogleMapsScript();
});
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

.setup-item {
  --padding-start: 0;
  --padding-end: 0;
  --inner-padding-end: 0;
  margin-bottom: 16px;
}

.organization-field {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 24px;
}

.organization-label {
  font-weight: 500;
  font-size: 14px;
  color: #1a1a1a;
  margin-bottom: 4px;
}

.autocomplete-container {
  position: relative;
  display: flex;
  align-items: center;
}

.autocomplete-input {
  width: 100%;
  padding: 12px 40px 12px 12px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  font-size: 16px;
  font-family: inherit;
  background: white;
  transition: border-color 0.2s;
}

.autocomplete-input:focus {
  outline: none;
  border-color: #2d7a4e;
}

.autocomplete-input:disabled {
  background: #f9fafb;
  color: #6b7280;
  cursor: not-allowed;
}

.input-icon {
  position: absolute;
  right: 12px;
  color: #6b7280;
  pointer-events: none;
}

.organization-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 8px;
}

.organization-chip {
  cursor: pointer;
}

.suggestions-dropdown {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  max-height: 200px;
  overflow-y: auto;
  z-index: 1000;
  margin-top: 4px;
}

.suggestion-item {
  padding: 12px;
  cursor: pointer;
  transition: background-color 0.2s;
  border-bottom: 1px solid #f3f4f6;
}

.suggestion-item:last-child {
  border-bottom: none;
}

.suggestion-item:hover {
  background-color: #f9fafb;
}

/* Fix Chrome autofill styling for native inputs and ion-input */
.autocomplete-input:-webkit-autofill,
.autocomplete-input:-webkit-autofill:hover,
.autocomplete-input:-webkit-autofill:focus,
.autocomplete-input:-webkit-autofill:active {
  -webkit-box-shadow: 0 0 0px 1000px white inset !important;
  -webkit-text-fill-color: #1a1a1a !important;
  transition: background-color 5000s ease-in-out 0s !important;
  background-color: white !important;
  font-size: 16px !important;
  font-family: inherit !important;
  line-height: normal !important;
}

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

