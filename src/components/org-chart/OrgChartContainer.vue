<template>
  <div
    class="orgchart-container"
    :class="{ 'is-dragging': isDragging }"
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
import { ref, computed, watch, onBeforeUnmount } from 'vue';

const props = defineProps<{
  scale?: number;
  translateX?: number;
  translateY?: number;
}>();

const emit = defineEmits<{
  (e: 'update:scale', value: number): void;
  (e: 'update:translateX', value: number): void;
  (e: 'update:translateY', value: number): void;
}>();

defineExpose({
  centerOnNode,
  centerOnRoot,
});

const zoomoutLimit = 0.2;
const zoominLimit = 1.5;
const zoomModifier = 0.08;

const scale = ref(props.scale || 1.0);
const translateX = ref(props.translateX || 0);
const translateY = ref(props.translateY || 0);

const isDragging = ref(false);
const startX = ref(0);
const startY = ref(0);
const startTranslateX = ref(0);
const startTranslateY = ref(0);

const touchStartDistance = ref(0);
const touchStartScale = ref(1.0);
const isPinching = ref(false);

// RAF throttling state (non-reactive on purpose -- no need to trigger Vue updates)
let rafId: number | null = null;
let pendingScale: number | null = null;
let pendingTx: number | null = null;
let pendingTy: number | null = null;

// Inertia state
let inertiaRafId: number | null = null;
let lastClientX = 0;
let lastClientY = 0;
let lastMoveTime = 0;
let velocityX = 0;
let velocityY = 0;

const chartStyle = computed(() => ({
  transform: `matrix(${scale.value}, 0, 0, ${scale.value}, ${translateX.value}, ${translateY.value})`,
}));

function scheduleUpdate() {
  if (rafId !== null) return;
  rafId = requestAnimationFrame(() => {
    if (pendingScale !== null) scale.value = pendingScale;
    if (pendingTx !== null) translateX.value = pendingTx;
    if (pendingTy !== null) translateY.value = pendingTy;
    pendingScale = null;
    pendingTx = null;
    pendingTy = null;
    rafId = null;
  });
}

function stopInertia() {
  if (inertiaRafId !== null) {
    cancelAnimationFrame(inertiaRafId);
    inertiaRafId = null;
  }
}

function emitCurrentState() {
  emit('update:scale', scale.value);
  emit('update:translateX', translateX.value);
  emit('update:translateY', translateY.value);
}

// ── Mouse ──

function onMouseDown(e: MouseEvent) {
  if (e.button !== 0) return;
  stopInertia();
  isDragging.value = true;
  startX.value = e.clientX;
  startY.value = e.clientY;
  startTranslateX.value = translateX.value;
  startTranslateY.value = translateY.value;
  lastClientX = e.clientX;
  lastClientY = e.clientY;
  lastMoveTime = performance.now();
  velocityX = 0;
  velocityY = 0;
}

function onMouseMove(e: MouseEvent) {
  if (!isDragging.value) return;

  const now = performance.now();
  const dt = now - lastMoveTime;
  if (dt > 0) {
    velocityX = (e.clientX - lastClientX) / dt;
    velocityY = (e.clientY - lastClientY) / dt;
  }
  lastClientX = e.clientX;
  lastClientY = e.clientY;
  lastMoveTime = now;

  pendingTx = startTranslateX.value + (e.clientX - startX.value);
  pendingTy = startTranslateY.value + (e.clientY - startY.value);
  scheduleUpdate();
}

function onMouseUp() {
  if (!isDragging.value) return;
  isDragging.value = false;
  emitCurrentState();
  maybeStartInertia();
}

function onMouseLeave() {
  if (!isDragging.value) return;
  isDragging.value = false;
  emitCurrentState();
}

// ── Touch ──

function getTouchDistance(touches: TouchList): number {
  if (touches.length < 2) return 0;
  const dx = touches[0].clientX - touches[1].clientX;
  const dy = touches[0].clientY - touches[1].clientY;
  return Math.sqrt(dx * dx + dy * dy);
}

function onTouchStart(e: TouchEvent) {
  stopInertia();
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
    lastClientX = e.touches[0].clientX;
    lastClientY = e.touches[0].clientY;
    lastMoveTime = performance.now();
    velocityX = 0;
    velocityY = 0;
  }
}

function onTouchMove(e: TouchEvent) {
  if (isPinching.value && e.touches.length === 2) {
    const currentDistance = getTouchDistance(e.touches);
    const scaleChange = currentDistance / touchStartDistance.value;
    pendingScale = Math.max(zoomoutLimit, Math.min(zoominLimit, touchStartScale.value * scaleChange));
    scheduleUpdate();
  } else if (isDragging.value && e.touches.length === 1) {
    const now = performance.now();
    const dt = now - lastMoveTime;
    if (dt > 0) {
      velocityX = (e.touches[0].clientX - lastClientX) / dt;
      velocityY = (e.touches[0].clientY - lastClientY) / dt;
    }
    lastClientX = e.touches[0].clientX;
    lastClientY = e.touches[0].clientY;
    lastMoveTime = now;

    pendingTx = startTranslateX.value + (e.touches[0].clientX - startX.value);
    pendingTy = startTranslateY.value + (e.touches[0].clientY - startY.value);
    scheduleUpdate();
  }
}

function onTouchEnd() {
  const wasDragging = isDragging.value;
  isDragging.value = false;
  isPinching.value = false;
  emitCurrentState();
  if (wasDragging) maybeStartInertia();
}

// ── Zoom (cursor-anchored) ──

function onWheel(e: WheelEvent) {
  const container = e.currentTarget as HTMLElement;
  const rect = container.getBoundingClientRect();
  const mouseX = e.clientX - rect.left;
  const mouseY = e.clientY - rect.top;

  const oldScale = scale.value;
  const direction = e.deltaY > 0 ? -1 : 1;
  const newScale = Math.max(zoomoutLimit, Math.min(zoominLimit, oldScale + direction * zoomModifier));
  if (newScale === oldScale) return;

  const ratio = newScale / oldScale;
  pendingScale = newScale;
  pendingTx = mouseX - (mouseX - translateX.value) * ratio;
  pendingTy = mouseY - (mouseY - translateY.value) * ratio;
  scheduleUpdate();
}

// ── Inertia ──

function maybeStartInertia() {
  const speed = Math.sqrt(velocityX * velocityX + velocityY * velocityY);
  if (speed < 0.05) return;

  const friction = 0.94;
  let vx = velocityX * 16;
  let vy = velocityY * 16;

  function step() {
    vx *= friction;
    vy *= friction;

    if (Math.abs(vx) < 0.3 && Math.abs(vy) < 0.3) {
      inertiaRafId = null;
      emitCurrentState();
      return;
    }

    translateX.value += vx;
    translateY.value += vy;
    inertiaRafId = requestAnimationFrame(step);
  }

  inertiaRafId = requestAnimationFrame(step);
}

// ── Prop watchers ──

watch(() => props.scale, (v) => {
  if (v !== undefined && v !== scale.value) scale.value = v;
});
watch(() => props.translateX, (v) => {
  if (v !== undefined && v !== translateX.value) translateX.value = v;
});
watch(() => props.translateY, (v) => {
  if (v !== undefined && v !== translateY.value) translateY.value = v;
});

// ── Centering helpers ──

function centerOnNode(nodeElement: HTMLElement) {
  if (!nodeElement) return;
  const container = document.querySelector('.orgchart-container') as HTMLElement;
  if (!container) return;

  const containerRect = container.getBoundingClientRect();
  const nodeRect = nodeElement.getBoundingClientRect();

  const containerCenterX = containerRect.width / 2;
  const containerCenterY = containerRect.height / 2;
  const nodeCenterX = nodeRect.left - containerRect.left + nodeRect.width / 2;
  const nodeCenterY = nodeRect.top - containerRect.top + nodeRect.height / 2;

  translateX.value += containerCenterX - nodeCenterX;
  translateY.value += containerCenterY - nodeCenterY;
  emitCurrentState();
}

function centerOnRoot() {
  setTimeout(() => {
    const firstNode = document.querySelector('.org-node-wrapper') as HTMLElement;
    if (firstNode) {
      centerOnNode(firstNode);
    } else {
      translateX.value = 0;
      translateY.value = 0;
      emitCurrentState();
    }
  }, 150);
}

onBeforeUnmount(() => {
  if (rafId !== null) cancelAnimationFrame(rafId);
  stopInertia();
});
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
  contain: layout style paint;
}

.orgchart-container.is-dragging {
  cursor: grabbing;
}

.orgchart-container.is-dragging .orgchart {
  pointer-events: none;
}

.orgchart {
  position: relative;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  transform-origin: 0 0;
  min-width: 100%;
  min-height: 100%;
  will-change: transform;
}
</style>
