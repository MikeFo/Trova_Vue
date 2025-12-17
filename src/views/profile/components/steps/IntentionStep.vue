<template>
  <div class="step-panel">
    <h2 class="step-title">Last one, promise.</h2>
    <p class="step-description">How do you want to engage with people in your community? List'em all!</p>
    
    <ThingSelector
      :selected-things="profileData.intentions"
      type="intention"
      input-placeholder="I'm looking for someone to..."
      :min-required="1"
      :show-warning="true"
      @update:selected-things="update('intentions', $event)"
    />
  </div>
</template>

<script setup lang="ts">
import ThingSelector from '../shared/ThingSelector.vue';

interface Props {
  profileData: {
    intentions: Array<string | any>;
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

