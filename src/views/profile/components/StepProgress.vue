<template>
  <div class="progress-container">
    <div class="progress-bar">
      <div 
        class="progress-fill" 
        :style="{ width: `${(currentStep / totalSteps) * 100}%` }"
      ></div>
    </div>
    <div class="step-indicator">
      <span class="step-text">Step {{ currentStep }} of {{ totalSteps }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  currentStep: number;
  totalSteps: number;
}>();
</script>

<style scoped>
.progress-container {
  margin-bottom: 32px;
}

.progress-bar {
  width: 100%;
  height: 8px;
  background: #e5e7eb;
  border-radius: 4px;
  overflow: hidden;
  margin-bottom: 12px;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #2d7a4e 0%, #1DB98A 100%);
  transition: width 0.3s ease;
}

.step-indicator {
  text-align: center;
}

.step-text {
  font-size: 14px;
  color: #6b7280;
  font-weight: 500;
}
</style>

