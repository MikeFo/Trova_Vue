<template>
  <div class="thing-selector">
    <!-- Selected Things -->
    <div v-if="selectedThings.length > 0" class="selected-things">
      <ion-chip
        v-for="thing in selectedThings"
        :key="getThingKey(thing)"
        color="primary"
        @click="removeThing(thing)"
        class="thing-chip removable"
      >
        {{ getThingName(thing) }}
        <ion-icon :icon="closeCircle" slot="end"></ion-icon>
      </ion-chip>
    </div>

    <!-- Search Input -->
    <ion-item class="setup-item" lines="full" v-if="showInput">
      <ion-input
        v-model="searchQuery"
        :placeholder="inputPlaceholder"
        @keyup.enter="handleAddCustom"
        @input="handleSearch"
      ></ion-input>
      <ion-button 
        slot="end" 
        @click="handleAddCustom" 
        :disabled="!searchQuery.trim()"
      >
        Add
      </ion-button>
    </ion-item>

    <!-- Search Results Dropdown -->
    <div v-if="searchResults.length > 0 && showInput && searchQuery.length >= 2" class="suggestions-dropdown">
      <div
        v-for="thing in searchResults"
        :key="thing.id"
        class="suggestion-item"
        @click="selectThing(thing)"
      >
        {{ thing.name }}
      </div>
    </div>

    <!-- Available Things List -->
    <div v-if="availableThings.length > 0" class="available-things">
      <div class="things-list">
        <ion-chip
          v-for="thing in availableThings"
          :key="thing.id"
          :outline="true"
          color="medium"
          @click="selectThing(thing)"
          class="thing-chip available"
        >
          {{ thing.name }}
        </ion-chip>
      </div>
    </div>

    <!-- Warning Message -->
    <ion-text v-if="showWarning && selectedThings.length < minRequired" color="warning">
      <p class="warning-text">
        {{ warningMessage }}
      </p>
    </ion-text>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { dataService, type DataThing } from '@/services/data.service';
import { closeCircle } from 'ionicons/icons';
import { IonItem, IonInput, IonButton, IonChip, IonIcon, IonText } from '@ionic/vue';

interface Props {
  selectedThings: Array<string | DataThing>;
  type: string;
  inputPlaceholder?: string;
  minRequired?: number;
  showWarning?: boolean;
  showInput?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  inputPlaceholder: 'Search...',
  minRequired: 0,
  showWarning: false,
  showInput: true,
});

const emit = defineEmits<{
  'update:selectedThings': [value: Array<string | DataThing>];
  'add': [thing: string | DataThing];
  'remove': [thing: string | DataThing];
}>();

const searchQuery = ref('');
const searchResults = ref<DataThing[]>([]);
const allThings = ref<DataThing[]>([]);
let searchTimeout: ReturnType<typeof setTimeout> | null = null;

// Load all things of this type on mount
async function loadThings() {
  try {
    console.log(`[ThingSelector] Loading things of type: ${props.type}`);
    const things = await dataService.getThings(props.type);
    console.log(`[ThingSelector] Successfully loaded ${things?.length || 0} things:`, things);
    
    if (things && Array.isArray(things)) {
      allThings.value = things;
      console.log(`[ThingSelector] Set allThings.value to ${allThings.value.length} items`);
    } else {
      console.warn(`[ThingSelector] Received invalid response:`, things);
      allThings.value = [];
    }
  } catch (error: any) {
    console.error(`[ThingSelector] Failed to load ${props.type}:`, error);
    console.error(`[ThingSelector] Error details:`, {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status,
      url: error.config?.url
    });
    allThings.value = [];
  }
}

// Computed list of available things (not selected)
const availableThings = computed(() => {
  const selectedKeys = new Set(props.selectedThings.map(t => getThingKey(t)));
  const selectedNames = new Set(props.selectedThings.map(t => getThingName(t).toLowerCase()));
  
  // Filter by search query if present
  let filtered = allThings.value;
  if (searchQuery.value.trim().length >= 2) {
    const query = searchQuery.value.trim().toLowerCase();
    filtered = allThings.value.filter(thing => 
      thing.name.toLowerCase().includes(query) ||
      thing.altNames?.toLowerCase().includes(query)
    );
  }
  
  return filtered.filter(thing => 
    !selectedKeys.has(thing.id.toString()) &&
    !selectedNames.has(thing.name.toLowerCase())
  );
});

function handleSearch() {
  const query = searchQuery.value.trim().toLowerCase();
  
  if (searchTimeout) {
    clearTimeout(searchTimeout);
  }

  if (query.length < 2) {
    searchResults.value = [];
    return;
  }

  searchTimeout = setTimeout(() => {
    // Filter things that match query and aren't already selected
    const selectedKeys = new Set(props.selectedThings.map(t => getThingKey(t)));
    const selectedNames = new Set(props.selectedThings.map(t => getThingName(t).toLowerCase()));
    
    searchResults.value = allThings.value.filter(
      thing => 
        thing.name.toLowerCase().includes(query) &&
        !selectedKeys.has(thing.id.toString()) &&
        !selectedNames.has(thing.name.toLowerCase())
    ).slice(0, 10); // Limit to 10 results
  }, 200);
}

function selectThing(thing: DataThing) {
  const thingKey = thing.id.toString();
  if (!props.selectedThings.find(t => getThingKey(t) === thingKey)) {
    emit('add', thing);
    const updated = [...props.selectedThings, thing];
    emit('update:selectedThings', updated);
  }
  searchQuery.value = '';
  searchResults.value = [];
}

async function handleAddCustom() {
  const query = searchQuery.value.trim();
  if (!query) return;

  // Check if it already exists in DB
  const existing = allThings.value.find(t => t.name.toLowerCase() === query.toLowerCase());
  
  if (existing) {
    selectThing(existing);
    return;
  }

  // Check if already selected
  const selectedNames = props.selectedThings.map(t => getThingName(t).toLowerCase());
  if (selectedNames.includes(query.toLowerCase())) {
    searchQuery.value = '';
    return;
  }

  // Add as custom string (or create in DB if needed)
  emit('add', query);
  const updated = [...props.selectedThings, query];
  emit('update:selectedThings', updated);
  
  searchQuery.value = '';
  searchResults.value = [];
}

function removeThing(thing: string | DataThing) {
  const updated = props.selectedThings.filter(t => getThingKey(t) !== getThingKey(thing));
  emit('update:selectedThings', updated);
  emit('remove', thing);
}

function getThingKey(thing: string | DataThing): string {
  return typeof thing === 'string' ? thing : thing.id.toString();
}

function getThingName(thing: string | DataThing): string {
  return typeof thing === 'string' ? thing : thing.name;
}

const warningMessage = computed(() => {
  const remaining = props.minRequired - props.selectedThings.length;
  if (remaining === 1) {
    return `Add at least 1 more`;
  }
  return `Add at least ${remaining} more`;
});

watch(() => props.type, loadThings, { immediate: true });
</script>

<style scoped>
.thing-selector {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.setup-item {
  --padding-start: 0;
  --padding-end: 0;
  --inner-padding-end: 0;
}

.selected-things {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 8px;
}

.available-things {
  margin-top: 8px;
}

.things-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  /* Limit to 5 rows: ~36px per chip + 8px gap = ~220px max */
  max-height: 220px;
  overflow-y: auto;
  padding: 6px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: #f9fafb;
}

.thing-chip {
  cursor: pointer;
  transition: all 0.2s;
}

.thing-chip.available:hover {
  --background: var(--ion-color-primary);
  --color: white;
}

.warning-text {
  font-size: 14px;
  margin-top: 12px;
  margin-bottom: 0;
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

/* Fix Chrome autofill styling for ion-input */
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

