<template>
  <div class="location-field">
    <ion-label class="location-label">{{ label }}</ion-label>
    <div class="autocomplete-container">
      <input
        ref="inputRef"
        type="text"
        class="autocomplete-input"
        :placeholder="placeholder"
        :disabled="disabled"
        :value="modelValue"
        @input="handleInput"
        autocomplete="off"
      />
      <ion-icon :icon="search" class="input-icon"></ion-icon>
    </div>
    <div v-if="selectedLocations.length > 0" class="location-chips">
      <ion-chip
        v-for="loc in selectedLocations"
        :key="loc.googlePlaceId"
        color="primary"
        @click="$emit('remove', loc)"
        class="location-chip removable"
      >
        {{ loc.primaryName }}, {{ loc.secondaryName }}
        <ion-icon :icon="closeCircle" slot="end"></ion-icon>
      </ion-chip>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';
import { useGooglePlaces, type PlaceData } from '@/composables/useGooglePlaces';
import { search, closeCircle } from 'ionicons/icons';
import { IonLabel, IonChip, IonIcon } from '@ionic/vue';

interface Props {
  label: string;
  placeholder: string;
  modelValue: string;
  disabled?: boolean;
  selectedLocations: Array<PlaceData & { type: string }>;
  locationType: string;
}

const props = defineProps<Props>();
const emit = defineEmits<{
  'update:modelValue': [value: string];
  'select': [place: PlaceData];
  'remove': [location: PlaceData & { type: string }];
}>();

const inputRef = ref<HTMLInputElement | null>(null);
const { loadGoogleMapsScript, createAutocomplete } = useGooglePlaces();

async function initializeAutocomplete() {
  if (!inputRef.value || props.disabled) return;
  
  try {
    await loadGoogleMapsScript();
    await new Promise(resolve => setTimeout(resolve, 100));
    
    createAutocomplete(
      inputRef.value,
      (place) => {
        emit('select', place);
        emit('update:modelValue', '');
      },
      ['locality', 'sublocality', 'sublocality_level_1', 'neighborhood']
    );
  } catch (error) {
    console.error('Failed to initialize autocomplete:', error);
  }
}

function handleInput(event: Event) {
  const target = event.target as HTMLInputElement;
  emit('update:modelValue', target.value);
}

onMounted(() => {
  if (!props.disabled) {
    initializeAutocomplete();
  }
});

watch(() => props.disabled, (newVal) => {
  if (!newVal && inputRef.value) {
    initializeAutocomplete();
  }
});
</script>

<style scoped>
.location-field {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 24px;
}

.location-label {
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

.location-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 8px;
}

.location-chip {
  cursor: pointer;
}
</style>

