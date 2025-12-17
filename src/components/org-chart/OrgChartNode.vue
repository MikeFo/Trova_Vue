<template>
  <div 
    class="org-node-wrapper"
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
          />
          <div v-else class="org-node-avatar-placeholder">
            {{ datasource.name.charAt(0).toUpperCase() }}
          </div>
        </div>
        <button
          v-if="hasChildren"
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
    </div>

    <div
      v-if="hasChildren"
      class="org-node-children"
      :class="{ 'org-node-collapsed': isCollapsed }"
    >
      <div
        v-for="(group, groupIndex) in childGroups"
        :key="`group-${groupIndex}`"
        class="org-group"
      >
        <div
          v-for="child in group"
          :key="child.id || child.slackId"
          class="org-node-child"
        >
              <OrgChartNode
                :datasource="child"
                :display-flags="displayFlags"
                :group-scale="groupScale"
                :is-selected="selectedNodeId === child.id"
                :is-highlighted="highlightedSlackId === child.slackId"
                :highlighted-slack-id="highlightedSlackId || props.highlightedSlackId"
                @node-click="handleChildNodeClick"
                @select-node="handleSelectNode"
              />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { add, remove } from 'ionicons/icons';
import { IonIcon } from '@ionic/vue';
import type { OrgNode, OrgChartDisplayFlags } from '@/models/org-chart';

const nodeWrapper = ref<HTMLElement | null>(null);

// Expose node element for centering
defineExpose({
  nodeElement: nodeWrapper,
});

const props = defineProps<{
  datasource: OrgNode;
  displayFlags: OrgChartDisplayFlags;
  groupScale?: number;
  isSelected?: boolean;
  isHighlighted?: boolean;
  highlightedSlackId?: string | null;
}>();

const emit = defineEmits<{
  (e: 'node-click', node: OrgNode): void;
  (e: 'select-node', nodeId: string): void;
}>();

const groupScale = computed(() => props.groupScale || 3);
// Root node should be expanded by default, children start collapsed
const isCollapsed = ref(false); // Changed to false - root should show children
const originalChildren = ref<OrgNode[]>([]);
const selectedNodeId = ref<string | null>(null);
const highlightedSlackId = ref<string | null>(props.isHighlighted ? props.datasource.slackId : null);

const hasChildren = computed(() => {
  return props.datasource.children && props.datasource.children.length > 0;
});

const displayFlags = computed(() => props.displayFlags);

// Group children for horizontal layout
const childGroups = computed(() => {
  if (!props.datasource.children || props.datasource.children.length === 0) {
    return [];
  }

  const groups: OrgNode[][] = [];
  const children = props.datasource.children;
  
  for (let i = 0; i < children.length; i += groupScale.value) {
    groups.push(children.slice(i, i + groupScale.value));
  }
  
  return groups;
});

function toggleExpand() {
  if (!hasChildren.value) return;

  if (isCollapsed.value) {
    // Expanding: restore original children if they were filtered
    if (originalChildren.value.length > 0 && props.datasource.children) {
      props.datasource.children = [...originalChildren.value];
      originalChildren.value = [];
    }
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
  console.log('[OrgChartNode] Mounted with datasource:', {
    name: props.datasource.name,
    id: props.datasource.id,
    childrenCount: props.datasource.children?.length || 0,
    expandedChildrenSlackIds: props.datasource.expandedChildrenSlackIds
  });
  
  // Always backup all children first (before any filtering)
  if (props.datasource.children && props.datasource.children.length > 0) {
    originalChildren.value = [...props.datasource.children];
  }
  
  // Check if any child is the highlighted user (to show siblings)
  const hasHighlightedChild = props.highlightedSlackId && props.datasource.children?.some(
    child => child.slackId === props.highlightedSlackId
  );
  
  // Handle initial expansion state based on expandedChildrenSlackIds
  // BUT: If this node has a highlighted child, show ALL children (to show siblings/teammates)
  // If this node is highlighted, show ALL its children (direct reports)
  if (props.isHighlighted || hasHighlightedChild) {
    // Show all children when viewing a specific user's context
    // This ensures we see teammates (siblings) and direct reports
    console.log('[OrgChartNode] Node is highlighted or has highlighted child, showing all children');
    
    // If we have originalChildren, restore them to show all siblings
    if (hasHighlightedChild && originalChildren.value.length > 0) {
      props.datasource.children = [...originalChildren.value];
      console.log('[OrgChartNode] Restored all children to show siblings');
    }
    
    isCollapsed.value = false;
  } else if (props.datasource.expandedChildrenSlackIds && props.datasource.expandedChildrenSlackIds.length > 0) {
    if (props.datasource.children && props.datasource.children.length > 0) {
      // Filter to only show children in the reporting chain (for non-highlighted paths)
      const filteredChildren = props.datasource.children.filter(
        (child: OrgNode) => props.datasource.expandedChildrenSlackIds!.includes(child.slackId)
      );
      
      console.log('[OrgChartNode] Filtered children:', {
        total: props.datasource.children.length,
        filtered: filteredChildren.length
      });
      
      // Only filter if we have filtered children, otherwise show all
      if (filteredChildren.length > 0 && filteredChildren.length < props.datasource.children.length) {
        props.datasource.children = filteredChildren;
      }
      
      // Expand if there are children to show
      isCollapsed.value = false;
    }
  } else if (props.datasource.children && props.datasource.children.length > 0) {
    // If no expandedChildrenSlackIds but has children, expand by default
    // This handles the root node case and nodes without chain filtering
    console.log('[OrgChartNode] No expandedChildrenSlackIds, expanding by default');
    isCollapsed.value = false;
  }
  
  console.log('[OrgChartNode] Final state:', {
    isCollapsed: isCollapsed.value,
    hasChildren: hasChildren.value,
    childrenCount: props.datasource.children?.length || 0
  });
});


watch(() => props.isHighlighted, (newVal) => {
  if (newVal) {
    highlightedSlackId.value = props.datasource.slackId;
  }
});
</script>

<style scoped>
.org-node-wrapper {
  display: flex;
  flex-direction: column;
  align-items: center;
  position: relative;
  margin: 20px;
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
  transition: all 0.2s ease;
  position: relative;
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
  z-index: 10;
  transition: all 0.2s ease;
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

.org-node-children {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-top: 40px;
  position: relative;
  opacity: 1;
  transition: opacity 0.2s ease;
}

.org-node-children::before {
  content: '';
  position: absolute;
  top: -20px;
  left: 50%;
  transform: translateX(-50%);
  width: 2px;
  height: 20px;
  background: #d1d5db;
}

.org-node-collapsed {
  display: none;
  opacity: 0;
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
  height: 2px;
  background: #d1d5db;
}

.org-node-child {
  position: relative;
}

.org-node-child::before {
  content: '';
  position: absolute;
  top: -20px;
  left: 50%;
  transform: translateX(-50%);
  width: 2px;
  height: 20px;
  background: #d1d5db;
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

