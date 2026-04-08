<template>
  <div
    class="trova-slack-brand"
    :class="`trova-slack-brand--${variant}`"
    spellcheck="false"
  >
    <span class="trova-slack-brand__circle-wrap" aria-hidden="true">
      <img
        src="/images/brand/trova-circle-mark.png"
        alt=""
        class="trova-slack-brand__circle"
        width="40"
        height="40"
        loading="eager"
      />
    </span>
    <span class="trova-slack-brand__word">Trova</span>
  </div>
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{
    /** toolbar = ion header; header = marketing page site-header */
    variant?: 'toolbar' | 'header';
  }>(),
  { variant: 'header' }
);
</script>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Lobster&display=swap');

.trova-slack-brand {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  -webkit-tap-highlight-color: transparent;
}

.trova-slack-brand--toolbar {
  user-select: none;
  -webkit-user-select: none;
}

.trova-slack-brand__circle-wrap {
  display: flex;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  overflow: hidden;
  flex-shrink: 0;
  box-shadow: 0 1px 3px rgba(15, 23, 42, 0.12);
}

.trova-slack-brand--header .trova-slack-brand__circle-wrap {
  width: 40px;
  height: 40px;
}

.trova-slack-brand__circle {
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center;
  display: block;
}

.trova-slack-brand__word {
  font-family: 'Lobster', cursive;
  font-size: 1.85rem;
  line-height: 1;
  color: #000000;
  letter-spacing: 0.02em;
  position: relative;
  top: 1px;
  background-color: transparent;
}

.trova-slack-brand--toolbar .trova-slack-brand__word {
  font-size: 1.65rem;
}

.trova-slack-brand--toolbar .trova-slack-brand__circle-wrap {
  width: 34px;
  height: 34px;
}

.trova-slack-brand__word::selection {
  background-color: rgba(45, 122, 78, 0.28);
  color: inherit;
}
</style>
