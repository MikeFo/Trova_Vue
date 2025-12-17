<template>
  <div
    class="orgchart-container"
    @mousedown="onMouseDown"
    @mousemove="onMouseMove"
    @mouseup="onMouseUp"
    @mouseleave="onMouseLeave"
    @wheel.prevent="onWheel"
    @touchstart="onTouchStart"
    @touchmove="onTouchMove"
    @touchend="onTouchEnd"
  >
    <div
      class="orgchart"
      :style="chartStyle"
    >
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';

const props = defineProps<{
  scale?: number;
  translateX?: number;
  translateY?: number;
}>();

const emit = defineEmits<{
  (e: 'update:scale', value: number): void;
  (e: 'update:translateX', value: number): void;
  (e: 'update:translateY', value: number): void;
  (e: 'center-on-node', nodeElement: HTMLElement): void;
}>();

// Expose methods for centering
defineExpose({
  centerOnNode,
  centerOnRoot,
});

const zoomoutLimit = 0.2;
const zoominLimit = 1.0;
const zoomModifier = 0.1;

const scale = ref(props.scale || 1.0);
const translateX = ref(props.translateX || 0);
const translateY = ref(props.translateY || 0);

const isDragging = ref(false);
const startX = ref(0);
const startY = ref(0);
const startTranslateX = ref(0);
const startTranslateY = ref(0);

// Touch support
const touchStartDistance = ref(0);
const touchStartScale = ref(1.0);
const isPinching = ref(false);

const chartStyle = computed(() => {
  return {
    transform: `matrix(${scale.value}, 0, 0, ${scale.value}, ${translateX.value}, ${translateY.value})`,
  };
});

function setChartScale(newScale: number) {
  const clampedScale = Math.max(zoomoutLimit, Math.min(zoominLimit, newScale));
  scale.value = clampedScale;
  emit('update:scale', clampedScale);
}

function setChartTranslate(x: number, y: number) {
  translateX.value = x;
  translateY.value = y;
  emit('update:translateX', x);
  emit('update:translateY', y);
}

function onMouseDown(e: MouseEvent) {
  if (e.button !== 0) return; // Only left mouse button
  isDragging.value = true;
  startX.value = e.clientX;
  startY.value = e.clientY;
  startTranslateX.value = translateX.value;
  startTranslateY.value = translateY.value;
}

function onMouseMove(e: MouseEvent) {
  if (!isDragging.value) return;
  
  const deltaX = e.clientX - startX.value;
  const deltaY = e.clientY - startY.value;
  
  setChartTranslate(
    startTranslateX.value + deltaX,
    startTranslateY.value + deltaY
  );
}

function onMouseUp() {
  isDragging.value = false;
}

function onMouseLeave() {
  isDragging.value = false;
}

function onWheel(e: WheelEvent) {
  const modifier = zoomModifier;
  const newScale = scale.value + (e.deltaY > 0 ? -modifier : modifier);
  setChartScale(newScale);
}

function getTouchDistance(touches: TouchList): number {
  if (touches.length < 2) return 0;
  const dx = touches[0].clientX - touches[1].clientX;
  const dy = touches[0].clientY - touches[1].clientY;
  return Math.sqrt(dx * dx + dy * dy);
}

function onTouchStart(e: TouchEvent) {
  if (e.touches.length === 2) {
    isPinching.value = true;
    touchStartDistance.value = getTouchDistance(e.touches);
    touchStartScale.value = scale.value;
  } else if (e.touches.length === 1) {
    isDragging.value = true;
    startX.value = e.touches[0].clientX;
    startY.value = e.touches[0].clientY;
    startTranslateX.value = translateX.value;
    startTranslateY.value = translateY.value;
  }
}

function onTouchMove(e: TouchEvent) {
  if (isPinching.value && e.touches.length === 2) {
    const currentDistance = getTouchDistance(e.touches);
    const scaleChange = currentDistance / touchStartDistance.value;
    const newScale = touchStartScale.value * scaleChange;
    setChartScale(newScale);
  } else if (isDragging.value && e.touches.length === 1) {
    const deltaX = e.touches[0].clientX - startX.value;
    const deltaY = e.touches[0].clientY - startY.value;
    setChartTranslate(
      startTranslateX.value + deltaX,
      startTranslateY.value + deltaY
    );
  }
}

function onTouchEnd() {
  isDragging.value = false;
  isPinching.value = false;
}

// Watch for prop changes
watch(() => props.scale, (newScale) => {
  if (newScale !== undefined && newScale !== scale.value) {
    scale.value = newScale;
  }
});

watch(() => props.translateX, (newX) => {
  if (newX !== undefined && newX !== translateX.value) {
    translateX.value = newX;
  }
});

watch(() => props.translateY, (newY) => {
  if (newY !== undefined && newY !== translateY.value) {
    translateY.value = newY;
  }
});

// Center chart on a specific node element
function centerOnNode(nodeElement: HTMLElement) {
  if (!nodeElement) return;
  
  const container = document.querySelector('.orgchart-container') as HTMLElement;
  if (!container) return;
  
  const containerRect = container.getBoundingClientRect();
  const nodeRect = nodeElement.getBoundingClientRect();
  
  // Get the chart element to find its position
  const chart = container.querySelector('.orgchart') as HTMLElement;
  if (!chart) return;
  const chartRect = chart.getBoundingClientRect();
  
  // Calculate the center of the container viewport
  const containerCenterX = containerRect.width / 2;
  const containerCenterY = containerRect.height / 2;
  
  // Calculate where the node center currently is in the container
  const nodeCenterX = nodeRect.left - containerRect.left + nodeRect.width / 2;
  const nodeCenterY = nodeRect.top - containerRect.top + nodeRect.height / 2;
  
  // Calculate how much we need to move the chart to center the node
  // The delta is how far the node is from the center
  const deltaX = containerCenterX - nodeCenterX;
  const deltaY = containerCenterY - nodeCenterY;
  
  // Apply the translation, accounting for the current scale
  // Since the transform is applied with scale, we need to adjust accordingly
  const newTranslateX = translateX.value + deltaX / scale.value;
  const newTranslateY = translateY.value + deltaY / scale.value;
  
  setChartTranslate(newTranslateX, newTranslateY);
}

// Center chart on the root node (first node in the chart)
function centerOnRoot() {
  // Wait for DOM to be ready
  setTimeout(() => {
    const firstNode = document.querySelector('.org-node-wrapper') as HTMLElement;
    if (firstNode) {
      centerOnNode(firstNode);
    } else {
      // If no node found, just center the chart at origin
      setChartTranslate(0, 0);
    }
  }, 150);
}
</script>

<style scoped>
.orgchart-container {
  width: 100%;
  height: 100%;
  overflow: hidden;
  position: relative;
  cursor: grab;
  user-select: none;
  -webkit-user-select: none;
  touch-action: none;
}

.orgchart-container:active {
  cursor: grabbing;
}

.orgchart {
  position: relative;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  transform-origin: center center;
  min-width: 100%;
  min-height: 100%;
}
</style>

