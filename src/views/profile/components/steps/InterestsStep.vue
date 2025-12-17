<template>
  <div class="step-panel">
    <h2 class="step-title">What are your favorite interests and activities?</h2>
    <p class="step-description">Add at least 5 activities you enjoy</p>
    
    <ThingSelector
      :selected-things="profileData.interests"
      type="activityOrInterest"
      input-placeholder="Search activities..."
      :min-required="5"
      :show-warning="true"
      @update:selected-things="update('interests', $event)"
    />
  </div>
</template>

<script setup lang="ts">
import ThingSelector from '../shared/ThingSelector.vue';

interface Props {
  profileData: {
    interests: Array<string | any>;
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
</style>

