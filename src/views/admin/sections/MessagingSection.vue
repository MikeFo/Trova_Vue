<template>
  <div class="messaging-section">
    <h2 class="section-title">Messaging</h2>
    <p class="section-description">Send messages to individual users or all community members</p>

    <div class="messaging-container">
      <!-- Recipient Selection -->
      <div class="recipients-section">
        <h3 class="subsection-title">Recipients</h3>
        <ion-radio-group v-model="recipientType">
          <ion-item>
            <ion-radio slot="start" value="all"></ion-radio>
            <ion-label>
              <h3>All Members</h3>
              <p>Send to all community members</p>
            </ion-label>
          </ion-item>
          <ion-item>
            <ion-radio slot="start" value="selected"></ion-radio>
            <ion-label>
              <h3>Selected Users</h3>
              <p>Choose specific recipients</p>
            </ion-label>
          </ion-item>
        </ion-radio-group>

        <!-- User Selection -->
        <div v-if="recipientType === 'selected'" class="user-selection">
          <ion-searchbar
            v-model="userSearchQuery"
            placeholder="Search users..."
            :debounce="300"
            @ionInput="searchUsers"
          ></ion-searchbar>
          <div class="selected-users">
            <ion-chip
              v-for="user in selectedUsers"
              :key="user.id"
              @click="removeUser(user.id)"
            >
              {{ user.fullName }}
              <ion-icon :icon="closeCircle"></ion-icon>
            </ion-chip>
          </div>
          <div v-if="searchResults.length > 0" class="search-results">
            <div
              v-for="user in searchResults"
              :key="user.id"
              class="user-result-item"
              @click="addUser(user)"
            >
              <img
                v-if="user.profilePicture"
                :src="user.profilePicture"
                :alt="user.fullName"
                class="user-avatar"
              />
              <div v-else class="user-avatar-placeholder">
                {{ getInitials(user.fullName) }}
              </div>
              <div class="user-info">
                <div class="user-name">{{ user.fullName }}</div>
                <div class="user-email">{{ user.email }}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Message Composition -->
      <div class="message-section">
        <h3 class="subsection-title">Message</h3>
        <ion-textarea
          v-model="messageText"
          :rows="8"
          placeholder="Type your message here..."
          :maxlength="5000"
          class="message-textarea"
        ></ion-textarea>
        <div class="char-count">{{ messageText.length }}/5000</div>
      </div>

      <!-- Send Button -->
      <ion-button
        expand="block"
        @click="sendMessage"
        :disabled="!canSend || isSending"
        class="send-button"
      >
        <ion-icon :icon="sendOutline" slot="start"></ion-icon>
        {{ isSending ? 'Sending...' : 'Send Message' }}
      </ion-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { adminService } from '@/services/admin.service';
import { userService } from '@/services/user.service';
import type { User } from '@/stores/auth.store';
import { toastController } from '@ionic/vue';
import {
  IonButton,
  IonIcon,
  IonSearchbar,
  IonTextarea,
  IonRadioGroup,
  IonItem,
  IonRadio,
  IonLabel,
  IonChip,
} from '@ionic/vue';
import {
  sendOutline,
  closeCircle,
} from 'ionicons/icons';

interface Props {
  communityId: number | null;
}

const props = defineProps<Props>();

const recipientType = ref<'all' | 'selected'>('all');
const userSearchQuery = ref('');
const searchResults = ref<User[]>([]);
const selectedUsers = ref<User[]>([]);
const messageText = ref('');
const isSending = ref(false);

const canSend = computed(() => {
  if (!messageText.value.trim()) return false;
  if (recipientType.value === 'selected' && selectedUsers.value.length === 0) return false;
  return true;
});

async function searchUsers() {
  if (!userSearchQuery.value.trim()) {
    searchResults.value = [];
    return;
  }

  try {
    const users = await userService.searchUsers(userSearchQuery.value);
    // Filter out already selected users
    searchResults.value = users.filter(
      (user) => !selectedUsers.value.find((u) => u.id === user.id)
    );
  } catch (error) {
    console.error('Error searching users:', error);
  }
}

function addUser(user: User) {
  if (!selectedUsers.value.find((u) => u.id === user.id)) {
    selectedUsers.value.push(user);
    userSearchQuery.value = '';
    searchResults.value = [];
  }
}

function removeUser(userId: number) {
  selectedUsers.value = selectedUsers.value.filter((u) => u.id !== userId);
}

function getInitials(name: string): string {
  const parts = name.split(' ');
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return name.substring(0, 2).toUpperCase();
}

async function sendMessage() {
  if (!props.communityId || !canSend.value) return;

  isSending.value = true;
  try {
    const userIds = recipientType.value === 'all' 
      ? [] // Empty array means all members
      : selectedUsers.value.map((u) => u.id);

    await adminService.sendMessage(props.communityId, userIds, messageText.value);
    
    const toast = await toastController.create({
      message: 'Message sent successfully',
      duration: 2000,
      color: 'success',
    });
    await toast.present();

    // Reset form
    messageText.value = '';
    selectedUsers.value = [];
    recipientType.value = 'all';
  } catch (error) {
    console.error('Error sending message:', error);
    const toast = await toastController.create({
      message: 'Failed to send message',
      duration: 2000,
      color: 'danger',
    });
    await toast.present();
  } finally {
    isSending.value = false;
  }
}
</script>

<style scoped>
.messaging-section {
  background: white;
  border-radius: 16px;
  padding: 24px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
}

.section-title {
  font-size: 24px;
  font-weight: 700;
  color: #1a1a1a;
  margin: 0 0 8px 0;
}

.section-description {
  font-size: 14px;
  color: #64748b;
  margin: 0 0 24px 0;
}

.messaging-container {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.recipients-section,
.message-section {
  padding: 20px;
  background: #f9fafb;
  border-radius: 12px;
  border: 1px solid #e5e7eb;
}

.subsection-title {
  font-size: 18px;
  font-weight: 600;
  color: #1a1a1a;
  margin: 0 0 16px 0;
}

.user-selection {
  margin-top: 16px;
}

.selected-users {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 16px;
}

.search-results {
  margin-top: 16px;
  max-height: 300px;
  overflow-y: auto;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: white;
}

.user-result-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  cursor: pointer;
  transition: background 0.2s ease;
  border-bottom: 1px solid #e5e7eb;
}

.user-result-item:last-child {
  border-bottom: none;
}

.user-result-item:hover {
  background: #f9fafb;
}

.user-avatar,
.user-avatar-placeholder {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  flex-shrink: 0;
}

.user-avatar {
  object-fit: cover;
}

.user-avatar-placeholder {
  background: linear-gradient(135deg, rgba(45, 122, 78, 0.1) 0%, rgba(29, 185, 138, 0.1) 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  color: var(--color-primary);
  font-size: 14px;
}

.user-info {
  flex: 1;
  min-width: 0;
}

.user-name {
  font-weight: 500;
  color: #1a1a1a;
  margin-bottom: 4px;
}

.user-email {
  font-size: 14px;
  color: #64748b;
}

.message-textarea {
  width: 100%;
  --background: white;
  --border-radius: 8px;
}

.char-count {
  font-size: 12px;
  color: #64748b;
  text-align: right;
  margin-top: 8px;
}

.send-button {
  --border-radius: 12px;
  height: 48px;
  font-weight: 600;
  font-size: 16px;
  text-transform: none;
  --background: linear-gradient(135deg, var(--color-primary) 0%, var(--color-secondary) 100%);
  --color: white;
  box-shadow: 0 4px 12px rgba(45, 122, 78, 0.3);
}
</style>





