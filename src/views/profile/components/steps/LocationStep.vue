<template>
  <div class="step-panel">
    <h2 class="step-title">Where are you from?</h2>
    <p class="step-description">There's no place like home! Meet people who may have followed the same journey as you.</p>
    
    <LocationAutocomplete
      label="Hometown"
      placeholder="Search for your hometown"
      v-model="hometownQuery"
      :disabled="locationsByType('hometown').length > 0"
      :selected-locations="locationsByType('hometown')"
      location-type="hometown"
      @select="addLocation($event, 'hometown')"
      @remove="removeLocation"
    />

    <LocationAutocomplete
      label="Current City"
      placeholder="Search for your current city"
      v-model="currentQuery"
      :disabled="locationsByType('current').length > 0"
      :selected-locations="locationsByType('current')"
      location-type="current"
      @select="addLocation($event, 'current')"
      @remove="removeLocation"
    />

    <LocationAutocomplete
      label="Places You've Lived"
      placeholder="Search for places you have lived"
      v-model="pastQuery"
      :selected-locations="locationsByType('past')"
      location-type="past"
      @select="addLocation($event, 'past')"
      @remove="removeLocation"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { useGooglePlaces, type PlaceData } from '@/composables/useGooglePlaces';
import LocationAutocomplete from '../shared/LocationAutocomplete.vue';

interface Props {
  locations: Array<PlaceData & { type: string }>;
}

const props = defineProps<Props>();
const emit = defineEmits<{
  'update:locations': [locations: Array<PlaceData & { type: string }>];
}>();

const hometownQuery = ref('');
const currentQuery = ref('');
const pastQuery = ref('');

function locationsByType(type: string) {
  return props.locations.filter(loc => loc.type === type);
}

function addLocation(place: PlaceData, type: string) {
  const location = { ...place, type };
  const updated = [...props.locations, location];
  emit('update:locations', updated);
}

function removeLocation(location: PlaceData & { type: string }) {
  const updated = props.locations.filter(
    loc => !(loc.googlePlaceId === location.googlePlaceId && loc.type === location.type)
  );
  emit('update:locations', updated);
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
  margin: 0 0 32px 0;
}
</style>

