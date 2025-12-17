<template>
  <div class="member-list-container">
    <div
      v-for="member in members"
      :key="member.id"
      class="member-item"
      @click="$emit('member-click', member)"
    >
      <div class="member-avatar-wrapper">
        <img
          v-if="member.profilePicture"
          :src="member.profilePicture"
          :alt="member.fullName"
          class="member-avatar"
        />
        <div v-else class="member-avatar-placeholder">
          <ion-icon :icon="person"></ion-icon>
        </div>
      </div>

      <div class="member-info">
        <h3 class="member-name">{{ member.fullName || 'Unknown' }}</h3>
        <p v-if="member.currentLocation" class="member-location">
          <ion-icon :icon="locationOutline"></ion-icon>
          {{ member.currentLocation }}
        </p>

        <!-- Shared Interests -->
        <div
          v-if="member.commonInterests && member.commonInterests.length > 0"
          class="shared-interests"
        >
          <p class="shared-label">You share:</p>
          <div class="interests-tags">
            <span
              v-for="interest in member.commonInterests"
              :key="interest"
              class="interest-tag"
            >
              {{ interest }}
            </span>
          </div>
        </div>
      </div>
    </div>

    <div v-if="members.length === 0" class="empty-members">
      <p>No members found</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { IonIcon } from '@ionic/vue';
import { person, locationOutline } from 'ionicons/icons';

interface Member {
  id: number;
  fullName?: string;
  profilePicture?: string;
  currentLocation?: string;
  commonInterests?: string[];
}

interface Props {
  members: Member[];
  currentUserId?: number;
}

defineProps<Props>();

defineEmits<{
  'member-click': [member: Member];
}>();
</script>

<style scoped>
.member-list-container {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.member-item {
  display: flex;
  gap: 12px;
  padding: 12px;
  background: #f8fafc;
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.member-item:hover {
  background: #f1f5f9;
  transform: translateX(4px);
}

.member-avatar-wrapper {
  flex-shrink: 0;
}

.member-avatar {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  object-fit: cover;
  border: 2px solid #e5e7eb;
}

.member-avatar-placeholder {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--color-primary) 0%, var(--color-secondary) 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  border: 2px solid #e5e7eb;
}

.member-avatar-placeholder ion-icon {
  font-size: 24px;
  color: #ffffff;
}

.member-info {
  flex: 1;
  min-width: 0;
}

.member-name {
  font-size: 16px;
  font-weight: 600;
  color: #1a1a1a;
  margin: 0 0 4px 0;
}

.member-location {
  font-size: 13px;
  color: #64748b;
  margin: 0 0 8px 0;
  display: flex;
  align-items: center;
  gap: 4px;
}

.member-location ion-icon {
  font-size: 14px;
}

.shared-interests {
  margin-top: 8px;
}

.shared-label {
  font-size: 12px;
  color: #94a3b8;
  margin: 0 0 4px 0;
}

.interests-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.interest-tag {
  padding: 4px 10px;
  background: rgba(45, 122, 78, 0.1);
  color: var(--color-primary);
  border-radius: 12px;
  font-size: 12px;
  font-weight: 500;
}

.empty-members {
  text-align: center;
  padding: 32px 16px;
  color: #64748b;
}
</style>

