<template>
  <div class="group-details-sidebar">
    <!-- Group Header -->
    <div class="group-header-section">
      <div class="group-logo-large">
        <img
          v-if="group.logo || group.logoSmall"
          :src="group.logo || group.logoSmall"
          :alt="group.name"
          class="group-logo-image"
        />
        <div v-else class="group-logo-placeholder">
          <ion-icon :icon="people"></ion-icon>
        </div>
      </div>

      <div class="group-title-section">
        <div class="group-title-row">
          <h1 class="group-name">{{ group.name }}</h1>
          <div class="group-actions-row">
            <ion-button
              fill="clear"
              class="favorite-button"
              @click="toggleFavorite"
            >
              <ion-icon
                :icon="group.isFavorite ? star : starOutline"
                :class="{ 'favorite-active': group.isFavorite }"
              ></ion-icon>
            </ion-button>
            <ion-button
              v-if="isAdmin"
              fill="clear"
              class="edit-button"
              @click="editGroup"
            >
              <ion-icon :icon="createOutline"></ion-icon>
            </ion-button>
          </div>
        </div>
        <div v-if="group.isPrivate" class="private-indicator">
          <ion-icon :icon="lockClosedOutline"></ion-icon>
          <span>Private Group</span>
        </div>
      </div>
    </div>

    <!-- Group Leader -->
    <div v-if="group.leader" class="leader-section">
      <div class="leader-info">
        <img
          v-if="group.leader.profilePicture"
          :src="group.leader.profilePicture"
          :alt="group.leader.fullName"
          class="leader-avatar"
        />
        <div v-else class="leader-avatar-placeholder">
          <ion-icon :icon="person"></ion-icon>
        </div>
        <div class="leader-details">
          <h3 class="leader-name">{{ group.leader.fullName }}</h3>
          <p class="leader-label">Group Leader</p>
        </div>
      </div>
    </div>

    <!-- Member Count -->
    <div class="member-count-section">
      <div class="member-count-header">
        <h3>{{ (group.memberCount || 0) + 1 }} Members</h3>
      </div>
      <div v-if="group.users && group.users.length > 0" class="member-avatars-preview">
        <img
          v-for="(member, index) in getDisplayedMembers()"
          :key="member.id"
          :src="member.profilePicture || '/assets/images/default-pro-pic.svg'"
          :alt="member.fullName"
          class="member-avatar-preview"
          :style="{ zIndex: getDisplayedMembers().length - index }"
        />
        <span v-if="getExtraMembersCount() > 0" class="extra-members-preview">
          +{{ getExtraMembersCount() }}
        </span>
      </div>
    </div>

    <!-- About Section -->
    <div v-if="group.bio" class="about-section">
      <h3 class="section-title">About</h3>
      <p class="about-text">{{ group.bio }}</p>
    </div>

    <!-- Tags Section -->
    <div v-if="group.tags && group.tags.length > 0" class="tags-section">
      <h3 class="section-title">Tags</h3>
      <div class="tags-list">
        <span
          v-for="tag in group.tags"
          :key="tag"
          class="tag-pill"
        >
          {{ tag }}
        </span>
      </div>
    </div>

    <!-- Actions -->
    <div class="actions-section">
      <ion-button
        v-if="isMember"
        fill="clear"
        class="leave-button"
        @click="$emit('leave')"
      >
        <ion-icon :icon="logOutOutline" slot="start"></ion-icon>
        Leave Group
      </ion-button>
      <ion-button
        fill="solid"
        class="share-button"
        @click="$emit('share')"
      >
        <ion-icon :icon="shareSocialOutline" slot="start"></ion-icon>
        Share
      </ion-button>
    </div>

    <!-- Member Search -->
    <div class="member-search-section">
      <ion-searchbar
        v-model="memberSearchQuery"
        placeholder="Location, interest, etc"
        class="member-search"
        :debounce="300"
      ></ion-searchbar>
      <div class="search-actions">
        <ion-button fill="clear" class="filter-button">
          <ion-icon :icon="funnelOutline"></ion-icon>
        </ion-button>
        <ion-button fill="clear" class="location-button">
          <ion-icon :icon="locationOutline"></ion-icon>
        </ion-button>
      </div>
    </div>

    <!-- Member List -->
    <div class="members-list-section">
      <MemberList
        :members="filteredMembers"
        :current-user-id="currentUserId"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { useAuthStore } from '@/stores/auth.store';
import type { Group } from '@/services/group.service';
import MemberList from './MemberList.vue';
import {
  IonButton,
  IonIcon,
  IonSearchbar,
} from '@ionic/vue';
import {
  people,
  person,
  star,
  starOutline,
  createOutline,
  lockClosedOutline,
  logOutOutline,
  shareSocialOutline,
  funnelOutline,
  locationOutline,
} from 'ionicons/icons';

interface Props {
  group: Group;
  members?: any[];
}

const props = withDefaults(defineProps<Props>(), {
  members: () => [],
});

const emit = defineEmits<{
  share: [];
  leave: [];
}>();

const authStore = useAuthStore();
const memberSearchQuery = ref('');

const currentUserId = computed(() => authStore.user?.id);
const isMember = computed(() => props.group.userFollows === true);
const isAdmin = computed(() => props.group.isAdmin === true || props.group.leaderId === currentUserId.value);

const filteredMembers = computed(() => {
  if (!memberSearchQuery.value.trim()) {
    return props.members || props.group.users || [];
  }

  const query = memberSearchQuery.value.toLowerCase();
  const membersList = props.members || props.group.users || [];
  
  return membersList.filter((member) => {
    const name = member.fullName?.toLowerCase() || '';
    const location = member.currentLocation?.toLowerCase() || '';
    const interests = member.interests?.map((i: any) => i.name?.toLowerCase() || '').join(' ') || '';
    
    return name.includes(query) || location.includes(query) || interests.includes(query);
  });
});

function getDisplayedMembers() {
  const membersList = props.group.users || [];
  return membersList.slice(0, 5);
}

function getExtraMembersCount() {
  const membersList = props.group.users || [];
  return Math.max(0, membersList.length - 5);
}

function toggleFavorite() {
  props.group.isFavorite = !props.group.isFavorite;
  // TODO: Save to backend
}

function editGroup() {
  // TODO: Navigate to edit group page
  console.log('Edit group:', props.group.id);
}
</script>

<style scoped>
.group-details-sidebar {
  background: #ffffff;
  border-radius: 16px;
  padding: 24px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.group-header-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
}

.group-logo-large {
  width: 120px;
  height: 120px;
  border-radius: 16px;
  overflow: hidden;
  background: #e5e7eb;
  flex-shrink: 0;
}

.group-logo-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.group-logo-placeholder {
  width: 100%;
  height: 100%;
  background: linear-gradient(135deg, var(--color-primary) 0%, var(--color-secondary) 100%);
  display: flex;
  align-items: center;
  justify-content: center;
}

.group-logo-placeholder ion-icon {
  font-size: 48px;
  color: #ffffff;
}

.group-title-section {
  width: 100%;
  text-align: center;
}

.group-title-row {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  margin-bottom: 8px;
}

.group-name {
  font-size: 24px;
  font-weight: 700;
  color: #1a1a1a;
  margin: 0;
  flex: 1;
}

.group-actions-row {
  display: flex;
  align-items: center;
  gap: 4px;
}

.favorite-button,
.edit-button {
  --padding-start: 8px;
  --padding-end: 8px;
  margin: 0;
}

.favorite-button ion-icon,
.edit-button ion-icon {
  font-size: 20px;
  color: #cbd5e1;
}

.favorite-button .favorite-active {
  color: var(--color-primary);
}

.private-indicator {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  font-size: 12px;
  color: #64748b;
}

.private-indicator ion-icon {
  font-size: 16px;
}

.leader-section {
  padding: 16px;
  background: #f8fafc;
  border-radius: 12px;
}

.leader-info {
  display: flex;
  align-items: center;
  gap: 12px;
}

.leader-avatar {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  object-fit: cover;
  flex-shrink: 0;
}

.leader-avatar-placeholder {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--color-primary) 0%, var(--color-secondary) 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.leader-avatar-placeholder ion-icon {
  font-size: 24px;
  color: #ffffff;
}

.leader-details {
  flex: 1;
  min-width: 0;
}

.leader-name {
  font-size: 16px;
  font-weight: 600;
  color: #1a1a1a;
  margin: 0 0 4px 0;
}

.leader-label {
  font-size: 13px;
  color: #64748b;
  margin: 0;
}

.member-count-section {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.member-count-header h3 {
  font-size: 18px;
  font-weight: 700;
  color: #1a1a1a;
  margin: 0;
}

.member-avatars-preview {
  display: flex;
  align-items: center;
  gap: -8px;
}

.member-avatar-preview {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  object-fit: cover;
  border: 2px solid #ffffff;
  margin-left: -8px;
  position: relative;
}

.member-avatar-preview:first-child {
  margin-left: 0;
}

.extra-members-preview {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: #f1f5f9;
  border: 2px solid #ffffff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  font-weight: 600;
  color: #64748b;
  margin-left: -8px;
  position: relative;
}

.about-section,
.tags-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.section-title {
  font-size: 16px;
  font-weight: 700;
  color: #1a1a1a;
  margin: 0;
}

.about-text {
  font-size: 14px;
  color: #64748b;
  line-height: 1.6;
  margin: 0;
}

.tags-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.tag-pill {
  padding: 6px 12px;
  background: rgba(45, 122, 78, 0.1);
  color: var(--color-primary);
  border-radius: 16px;
  font-size: 13px;
  font-weight: 500;
}

.actions-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.leave-button {
  --color: #ef4444;
  font-weight: 600;
  text-transform: none;
}

.share-button {
  --background: var(--color-primary);
  --color: #ffffff;
  font-weight: 600;
  text-transform: none;
}

.member-search-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.member-search {
  --background: #f8fafc;
  --border-radius: 12px;
  --box-shadow: none;
  --placeholder-color: #94a3b8;
  --icon-color: #64748b;
  padding: 0;
}

.search-actions {
  display: flex;
  gap: 8px;
}

.filter-button,
.location-button {
  --color: var(--color-primary);
  --padding-start: 8px;
  --padding-end: 8px;
  margin: 0;
}

.members-list-section {
  max-height: 600px;
  overflow-y: auto;
}

/* Responsive adjustments */
@media (max-width: 767px) {
  .group-details-sidebar {
    padding: 16px;
  }

  .group-logo-large {
    width: 100px;
    height: 100px;
  }
}
</style>

