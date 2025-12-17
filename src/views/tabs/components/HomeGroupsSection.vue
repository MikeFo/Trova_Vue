<template>
  <div class="groups-section">
    <div class="section-header">
      <h2 class="section-title">Groups</h2>
      <ion-button 
        fill="clear" 
        size="small" 
        class="see-all-button"
        @click="navigateTo('/tabs/groups')"
      >
        View all
        <ion-icon :icon="chevronForward" slot="end"></ion-icon>
      </ion-button>
    </div>

    <div v-if="isLoading" class="loading-state">
      <ion-spinner name="crescent"></ion-spinner>
      <p>Loading groups...</p>
    </div>

    <div v-else-if="groups.length > 0" class="groups-list">
      <div
        v-for="group in groups"
        :key="group.id"
        class="group-card"
        @click="navigateToGroup(group.id)"
      >
        <div class="group-image">
          <img
            v-if="group.logo || group.logoSmall"
            :src="group.logo || group.logoSmall"
            :alt="group.name"
          />
          <div v-else class="group-placeholder">
            <ion-icon :icon="gridOutline"></ion-icon>
          </div>
        </div>
        <div class="group-content">
          <div class="group-header">
            <h3 class="group-name">{{ group.name }}</h3>
            <ion-icon 
              v-if="group.isFavorite" 
              :icon="star" 
              class="star-icon"
            ></ion-icon>
          </div>
          <p v-if="group.bio" class="group-description">
            {{ truncateText(group.bio, 80) }}
          </p>
          <div class="group-footer">
            <span v-if="group.memberCount !== undefined" class="member-count">
              {{ group.memberCount }} {{ group.memberCount === 1 ? 'member' : 'members' }}
            </span>
            <ion-badge 
              v-if="showCommunityBadge && group.communityId"
              color="primary" 
              class="community-badge"
            >
              {{ getCommunityName(group.communityId) }}
            </ion-badge>
          </div>
        </div>
      </div>
    </div>

    <div v-else class="empty-state">
      <div class="empty-icon">
        <ion-icon :icon="gridOutline"></ion-icon>
      </div>
      <h3 class="empty-title">
        {{ showCommunityBadge ? 'No starred groups' : `No starred groups in ${currentCommunityName}` }}
      </h3>
      <p class="empty-description">
        {{ showCommunityBadge 
          ? 'Star groups to see them on your homepage' 
          : 'Star groups in this community to see them here' }}
      </p>
      <ion-button 
        fill="outline" 
        class="empty-action-button"
        @click="navigateTo('/tabs/groups')"
      >
        Browse Groups
      </ion-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { useRouter } from 'vue-router';
import { groupService, type Group } from '@/services/group.service';
import { useAuthStore } from '@/stores/auth.store';
import { useCommunityStore } from '@/stores/community.store';
import {
  IonButton,
  IonIcon,
  IonBadge,
  IonSpinner,
} from '@ionic/vue';
import { chevronForward, gridOutline, star } from 'ionicons/icons';

interface Props {
  communityId?: number | null;
}

const props = withDefaults(defineProps<Props>(), {
  communityId: null,
});

const router = useRouter();
const authStore = useAuthStore();
const communityStore = useCommunityStore();
const groups = ref<Group[]>([]);
const isLoading = ref(false);

const showCommunityBadge = computed(() => props.communityId === null);
const currentCommunityName = computed(() => communityStore.currentCommunityName);

function getCommunityName(communityId: number): string {
  const community = communityStore.getCommunityById(communityId);
  return community?.name || 'Community';
}

function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
}

function navigateToGroup(groupId: number) {
  router.push(`/tabs/groups/${groupId}`);
}

function navigateTo(path: string) {
  router.push(path);
}

async function loadGroups() {
  const userId = authStore.user?.id;
  if (!userId) {
    groups.value = [];
    return;
  }

  isLoading.value = true;
  try {
    const starredGroups = await groupService.getStarredGroups(userId, props.communityId || undefined);
    groups.value = starredGroups;
  } catch (error) {
    console.error('[HomeGroupsSection] Failed to load groups:', error);
    groups.value = [];
  } finally {
    isLoading.value = false;
  }
}

watch(() => props.communityId, () => {
  loadGroups();
});

onMounted(() => {
  loadGroups();
});
</script>

<style scoped>
.groups-section {
  margin-bottom: 32px;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.section-title {
  font-size: 20px;
  font-weight: 700;
  color: #1a1a1a;
  margin: 0;
  letter-spacing: -0.3px;
}

.see-all-button {
  --color: var(--color-primary);
  font-size: 14px;
  font-weight: 600;
  --padding-start: 8px;
  --padding-end: 8px;
  margin: 0;
}

.see-all-button ion-icon {
  font-size: 16px;
}

.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 16px;
  min-height: 200px;
}

.loading-state p {
  margin-top: 16px;
  color: #64748b;
  font-size: 14px;
}

.groups-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.group-card {
  background: #ffffff;
  border-radius: 16px;
  padding: 16px;
  display: flex;
  gap: 16px;
  cursor: pointer;
  transition: all 0.2s ease;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
  border: 1px solid rgba(0, 0, 0, 0.05);
}

.group-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
}

.group-card:active {
  transform: translateY(0);
}

.group-image {
  width: 80px;
  height: 80px;
  border-radius: 12px;
  overflow: hidden;
  flex-shrink: 0;
  background: linear-gradient(135deg, rgba(45, 122, 78, 0.1) 0%, rgba(29, 185, 138, 0.1) 100%);
  display: flex;
  align-items: center;
  justify-content: center;
}

.group-image img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.group-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.group-placeholder ion-icon {
  font-size: 32px;
  color: var(--color-primary);
}

.group-content {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.group-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.group-name {
  font-size: 18px;
  font-weight: 600;
  color: #1a1a1a;
  margin: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
}

.star-icon {
  font-size: 20px;
  color: #fbbf24;
  flex-shrink: 0;
}

.group-description {
  font-size: 14px;
  color: #64748b;
  margin: 0;
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.group-footer {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: auto;
}

.member-count {
  font-size: 12px;
  color: #94a3b8;
  font-weight: 500;
}

.community-badge {
  font-size: 11px;
  padding: 4px 8px;
  border-radius: 6px;
}

.empty-state {
  background: #ffffff;
  border-radius: 16px;
  padding: 40px 24px;
  text-align: center;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
  border: 1px solid rgba(0, 0, 0, 0.05);
}

.empty-icon {
  width: 64px;
  height: 64px;
  margin: 0 auto 20px;
  background: linear-gradient(135deg, rgba(45, 122, 78, 0.1) 0%, rgba(29, 185, 138, 0.1) 100%);
  border-radius: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.empty-icon ion-icon {
  font-size: 32px;
  color: var(--color-primary);
}

.empty-title {
  font-size: 18px;
  font-weight: 700;
  color: #1a1a1a;
  margin: 0 0 8px 0;
}

.empty-description {
  font-size: 14px;
  color: #64748b;
  margin: 0 0 20px 0;
  line-height: 1.5;
}

.empty-action-button {
  --border-color: var(--color-primary);
  --color: var(--color-primary);
  --border-radius: 12px;
  --padding-start: 20px;
  --padding-end: 20px;
  height: 40px;
  font-weight: 600;
  text-transform: none;
  font-size: 14px;
}

/* Responsive */
@media (max-width: 768px) {
  .group-card {
    padding: 12px;
    gap: 12px;
  }

  .group-image {
    width: 64px;
    height: 64px;
  }

  .group-name {
    font-size: 16px;
  }
}
</style>






