<template>
  <div
    class="org-node-wrapper"
    :class="{ 'org-chain-member': isSelfOnChain }"
    :data-slack-id="datasource.slackId"
    :data-node-id="datasource.id"
    ref="nodeWrapper"
  >
    <div
      class="org-node"
      :class="{
        'org-node-selected': isSelected,
        'org-node-highlighted': isHighlighted,
      }"
      @click="handleNodeClick"
    >
      <div class="org-node-header">
        <div class="org-node-avatar">
          <img
            v-if="datasource.profilePicture"
            :src="datasource.profilePicture"
            :alt="datasource.name"
            loading="lazy"
          />
          <div v-else class="org-node-avatar-placeholder">
            {{ datasource.name.charAt(0).toUpperCase() }}
          </div>
        </div>
        <button
          v-if="hasAnyChildren"
          class="org-node-toggle"
          @click.stop="toggleExpand"
          :aria-label="isCollapsed ? 'Expand' : 'Collapse'"
        >
          <ion-icon :icon="isCollapsed ? add : remove"></ion-icon>
        </button>
      </div>

      <div class="org-node-content">
        <div class="org-node-name">{{ datasource.name }}</div>
        <div v-if="datasource.title && displayFlags.showTitle" class="org-node-title">
          {{ datasource.title }}
        </div>
        <div v-if="datasource.department && displayFlags.showDepartment" class="org-node-field">
          {{ datasource.department }}
        </div>
        <div v-if="datasource.location && displayFlags.showLocation" class="org-node-field">
          {{ datasource.location }}
        </div>
        <div v-if="datasource.role && displayFlags.showRole" class="org-node-field">
          {{ datasource.role }}
        </div>
        <div v-if="datasource.team && displayFlags.showTeam" class="org-node-field">
          {{ datasource.team }}
        </div>
      </div>

      <div v-if="hiddenLabel" class="org-node-hidden-count">
        {{ hiddenLabel }}
      </div>
    </div>

    <!-- Children: only mount when expanded AND within depth limit -->
    <div
      v-if="hasVisibleChildren && !isCollapsed"
      class="org-node-children"
      :class="{ 'org-connector-down--chain': isSelfOnChain }"
    >
      <div
        v-for="(group, groupIndex) in visibleChildGroups"
        :key="`group-${groupIndex}`"
        class="org-group"
        :class="{ 'org-group--chain': groupTouchesChain(group) }"
      >
        <div
          v-for="child in group"
          :key="child.id || child.slackId"
          class="org-node-child"
          :class="{ 'org-node-child--chain': isInReportingChain(child.slackId) }"
        >
          <OrgChartNode
            :datasource="child"
            :display-flags="displayFlags"
            :group-scale="groupScale"
            :max-render-depth="maxRenderDepth"
            :reporting-chain-slack-ids="reportingChainSlackIds"
            :is-selected="selectedNodeId === child.id"
            :is-highlighted="highlightedSlackId === child.slackId"
            :highlighted-slack-id="activeHighlightedSlackId"
            @node-click="handleChildNodeClick"
            @select-node="handleSelectNode"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch, inject } from 'vue';
import { add, remove } from 'ionicons/icons';
import { IonIcon } from '@ionic/vue';
import type { OrgNode, OrgChartDisplayFlags } from '@/models/org-chart';

const nodeWrapper = ref<HTMLElement | null>(null);

defineExpose({
  nodeElement: nodeWrapper,
});

const props = defineProps<{
  datasource: OrgNode;
  displayFlags: OrgChartDisplayFlags;
  groupScale?: number;
  maxRenderDepth?: number;
  /** Slack IDs on the path from org root to the focused user (from API slackIdsInChain). */
  reportingChainSlackIds?: string[];
  isSelected?: boolean;
  isHighlighted?: boolean;
  highlightedSlackId?: string | null;
}>();

/** Set when user clicks expand — shows all direct reports regardless of maxRenderDepth. */
const manualDepthBypass = inject<Record<string, boolean>>('orgChartManualDepthBypass', {});

const chainSet = computed(() => new Set(props.reportingChainSlackIds ?? []));
const isSelfOnChain = computed(() => chainSet.value.has(props.datasource.slackId));

function isInReportingChain(slackId: string): boolean {
  return chainSet.value.has(slackId);
}

function groupTouchesChain(group: OrgNode[]): boolean {
  return group.some((c) => chainSet.value.has(c.slackId));
}

const emit = defineEmits<{
  (e: 'node-click', node: OrgNode): void;
  (e: 'select-node', nodeId: string): void;
}>();

const groupScale = computed(() => props.groupScale || 3);
const isCollapsed = ref(true);
const showAllChildren = ref(false);
const selectedNodeId = ref<string | null>(null);

const activeHighlightedSlackId = computed(() =>
  props.highlightedSlackId ?? null
);

const hasHighlightedChild = computed(() =>
  !!props.highlightedSlackId &&
  !!props.datasource.children?.some(c => c.slackId === props.highlightedSlackId)
);

// Derive effective children without mutating props.
// Replaces the old onMounted prop mutation pattern.
const effectiveChildren = computed(() => {
  const children = props.datasource.children;
  if (!children || children.length === 0) return [];

  if (showAllChildren.value || props.isHighlighted || hasHighlightedChild.value) {
    return children;
  }

  const expanded = props.datasource.expandedChildrenSlackIds;
  if (expanded && expanded.length > 0) {
    const filtered = children.filter(c => expanded.includes(c.slackId));
    return filtered.length > 0 ? filtered : children;
  }

  return children;
});

// Depth-limit filtering (Focused View). Manual expand bypasses so users can drill to the full org.
const visibleChildren = computed(() => {
  const max = props.maxRenderDepth;
  const eff = effectiveChildren.value;
  if (max === undefined || !isFinite(max)) return eff;
  if (manualDepthBypass[props.datasource.slackId]) {
    return eff;
  }
  return eff.filter(c => (c._depthFromFocus ?? 0) <= max);
});

const totalChildCount = computed(() => props.datasource.children?.length ?? 0);
const hasAnyChildren = computed(() => totalChildCount.value > 0);
const hasVisibleChildren = computed(() => visibleChildren.value.length > 0);

const depthLimitedCount = computed(() => {
  if (!hasAnyChildren.value) return 0;
  return effectiveChildren.value.length - visibleChildren.value.length;
});

const hiddenLabel = computed(() => {
  if (isCollapsed.value && totalChildCount.value > 0) {
    return `+${totalChildCount.value} report${totalChildCount.value !== 1 ? 's' : ''}`;
  }
  if (depthLimitedCount.value > 0) {
    return `+${depthLimitedCount.value} more`;
  }
  return '';
});

const visibleChildGroups = computed(() => {
  const groups: OrgNode[][] = [];
  const children = visibleChildren.value;
  for (let i = 0; i < children.length; i += groupScale.value) {
    groups.push(children.slice(i, i + groupScale.value));
  }
  return groups;
});

function toggleExpand() {
  if (!hasAnyChildren.value) return;
  const sid = props.datasource.slackId;
  if (isCollapsed.value) {
    showAllChildren.value = true;
    manualDepthBypass[sid] = true;
  } else {
    delete manualDepthBypass[sid];
  }
  isCollapsed.value = !isCollapsed.value;
}

function handleNodeClick() {
  emit('node-click', props.datasource);
  emit('select-node', props.datasource.id);
}

function handleChildNodeClick(node: OrgNode) {
  emit('node-click', node);
}

function handleSelectNode(nodeId: string) {
  selectedNodeId.value = nodeId;
  emit('select-node', nodeId);
}

onMounted(() => {
  const isOnChain = (props.datasource.expandedChildrenSlackIds?.length ?? 0) > 0;
  const isOrHasHighlighted = props.isHighlighted || hasHighlightedChild.value;

  if (isOrHasHighlighted || isOnChain) {
    isCollapsed.value = false;
  } else {
    isCollapsed.value = true;
  }
});

watch(() => props.isHighlighted, (newVal) => {
  if (newVal) isCollapsed.value = false;
});
</script>

<style scoped>
.org-node-wrapper {
  display: flex;
  flex-direction: column;
  align-items: center;
  position: relative;
  margin: 20px;
  /* Do not use contain: paint/content — it clips the expand toggle (positioned outside the card box). */
  z-index: 1;
}

.org-node {
  background: #ffffff;
  border-radius: 12px;
  padding: 16px;
  min-width: 200px;
  max-width: 250px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  border: 2px solid #e5e7eb;
  cursor: pointer;
  transition: box-shadow 0.2s ease, border-color 0.2s ease, transform 0.15s ease;
  position: relative;
  z-index: 2;
}

.org-node:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  transform: translateY(-2px);
}

.org-node-selected {
  border-color: #2d7a4e;
  box-shadow: 0 4px 16px rgba(45, 122, 78, 0.3);
}

.org-node-highlighted {
  border-color: #fbbf24;
  box-shadow: 0 4px 16px rgba(251, 191, 36, 0.4);
}

.org-node-header {
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 12px;
  position: relative;
}

.org-node-avatar {
  width: 60px;
  height: 60px;
  border-radius: 50%;
  overflow: hidden;
  border: 2px solid #e5e7eb;
}

.org-node-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.org-node-avatar-placeholder {
  width: 100%;
  height: 100%;
  background: linear-gradient(135deg, #2d7a4e 0%, #1db98a 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #ffffff;
  font-size: 24px;
  font-weight: 600;
}

.org-node-toggle {
  position: absolute;
  bottom: -12px;
  left: 50%;
  transform: translateX(-50%);
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: #ffffff;
  border: 2px solid #2d7a4e;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  z-index: 20;
  pointer-events: auto;
  transition: background 0.2s ease, color 0.2s ease;
}

.org-node-toggle:hover {
  background: #2d7a4e;
  color: #ffffff;
}

.org-node-toggle ion-icon {
  font-size: 16px;
  color: #2d7a4e;
}

.org-node-toggle:hover ion-icon {
  color: #ffffff;
}

.org-node-content {
  text-align: center;
}

.org-node-name {
  font-size: 16px;
  font-weight: 600;
  color: #1a1a1a;
  margin-bottom: 4px;
}

.org-node-title {
  font-size: 14px;
  color: #6b7280;
  margin-bottom: 8px;
}

.org-node-field {
  font-size: 12px;
  color: #9ca3af;
  margin-bottom: 4px;
}

.org-node-hidden-count {
  text-align: center;
  font-size: 11px;
  color: #6b7280;
  background: #f3f4f6;
  border-radius: 10px;
  padding: 2px 8px;
  margin-top: 8px;
}

.org-node-children {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-top: 40px;
  position: relative;
}

/* Connectors: thicker, higher-contrast than legacy grey hairlines */
.org-node-children::before {
  content: '';
  position: absolute;
  top: -20px;
  left: 50%;
  transform: translateX(-50%);
  width: 3px;
  height: 20px;
  border-radius: 2px;
  background: #64748b;
  z-index: 1;
}

.org-group {
  display: flex;
  flex-direction: row;
  align-items: flex-start;
  justify-content: center;
  gap: 20px;
  margin-bottom: 20px;
  position: relative;
}

.org-group::before {
  content: '';
  position: absolute;
  top: -20px;
  left: 0;
  right: 0;
  height: 3px;
  border-radius: 2px;
  background: #64748b;
  z-index: 1;
}

.org-node-child {
  position: relative;
  z-index: 1;
}

.org-node-child::before {
  content: '';
  position: absolute;
  top: -20px;
  left: 50%;
  transform: translateX(-50%);
  width: 3px;
  height: 20px;
  border-radius: 2px;
  background: #64748b;
  z-index: 1;
}

/* Reporting chain from API: same path as yellow focus highlight — draw in brand green */
.org-node-children.org-connector-down--chain::before {
  background: #2d7a4e;
  box-shadow: 0 0 0 1px rgba(45, 122, 78, 0.35);
  z-index: 2;
}

.org-group.org-group--chain::before {
  background: #2d7a4e;
  box-shadow: 0 0 0 1px rgba(45, 122, 78, 0.35);
  z-index: 2;
}

.org-node-child.org-node-child--chain::before {
  background: #2d7a4e;
  box-shadow: 0 0 0 1px rgba(45, 122, 78, 0.35);
  z-index: 2;
}

/* Subtle cue on cards that sit on the reporting chain */
.org-chain-member .org-node:not(.org-node-highlighted) {
  border-color: #cbd5e1;
  box-shadow:
    0 2px 8px rgba(0, 0, 0, 0.08),
    inset 0 0 0 1px rgba(45, 122, 78, 0.12);
}

/* Connectors must not capture clicks — full-width bus + z-index sat above flex children in some browsers. */
.org-node-children::before,
.org-group::before,
.org-node-child::before {
  pointer-events: none;
}

@media (max-width: 768px) {
  .org-node {
    min-width: 160px;
    max-width: 180px;
    padding: 12px;
  }

  .org-node-avatar {
    width: 50px;
    height: 50px;
  }

  .org-node-name {
    font-size: 14px;
  }

  .org-node-title,
  .org-node-field {
    font-size: 11px;
  }
}
</style>
