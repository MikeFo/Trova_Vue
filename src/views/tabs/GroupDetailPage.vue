<template>
  <ion-page>
    <ion-content :fullscreen="true" class="group-detail-content">
      <div v-if="isLoading" class="loading-container">
        <ion-spinner></ion-spinner>
        <p>Loading group...</p>
      </div>

      <div v-else-if="group" class="group-detail-container">
        <!-- Mobile Layout -->
        <div class="mobile-layout">
          <!-- Group Header -->
          <div class="group-header-mobile">
            <ion-button fill="clear" @click="goBack" class="back-button">
              <ion-icon :icon="arrowBack"></ion-icon>
            </ion-button>
            <h1 class="group-name-mobile">{{ group.name }}</h1>
            <ion-button fill="clear" class="more-button">
              <ion-icon :icon="ellipsisVertical"></ion-icon>
            </ion-button>
          </div>

          <!-- Group Image -->
          <div class="group-image-section">
            <img
              v-if="group.logo || group.logoSmall"
              :src="group.logo || group.logoSmall"
              :alt="group.name"
              class="group-header-image"
            />
            <div v-else class="group-header-placeholder">
              <ion-icon :icon="people"></ion-icon>
            </div>
          </div>

          <!-- Tabs -->
          <ion-segment v-model="activeTab" class="detail-tabs">
            <ion-segment-button value="feed">
              <ion-label>Feed</ion-label>
            </ion-segment-button>
            <ion-segment-button value="events">
              <ion-label>Events</ion-label>
            </ion-segment-button>
            <ion-segment-button value="details">
              <ion-label>Details</ion-label>
            </ion-segment-button>
          </ion-segment>

          <!-- Tab Content -->
          <div class="tab-content">
            <!-- Feed Tab -->
            <div v-if="activeTab === 'feed'" class="feed-tab">
              <ChatThread
                v-if="conversation"
                :conversation="conversation"
                @back="goBack"
              />
              <div v-else-if="group.convoId" class="no-conversation">
                <ion-spinner></ion-spinner>
                <p>Loading conversation...</p>
              </div>
              <div v-else class="no-conversation">
                <p>No conversation available</p>
              </div>
            </div>

            <!-- Events Tab -->
            <div v-if="activeTab === 'events'" class="events-tab">
              <div class="group-events">
                <p v-if="groupEvents.length === 0" class="no-events">
                  No events scheduled for this group
                </p>
                <div v-else class="events-list">
                  <!-- Event cards will go here -->
                </div>
              </div>
            </div>

            <!-- Details Tab -->
            <div v-if="activeTab === 'details'" class="details-tab">
              <GroupDetailsSidebar
                :group="group"
                :members="members"
                @share="handleShare"
                @leave="handleLeave"
              />
            </div>
          </div>
        </div>

        <!-- Desktop Layout -->
        <div class="desktop-layout">
          <div class="desktop-content">
            <!-- Left Sidebar -->
            <div class="sidebar">
              <GroupDetailsSidebar
                :group="group"
                :members="members"
                @share="handleShare"
                @leave="handleLeave"
              />
            </div>

            <!-- Main Content -->
            <div class="main-content">
              <!-- Tabs -->
              <ion-segment v-model="activeTab" class="detail-tabs-desktop">
                <ion-segment-button value="feed">
                  <ion-label>Feed</ion-label>
                </ion-segment-button>
                <ion-segment-button value="events">
                  <ion-label>Events</ion-label>
                </ion-segment-button>
                <ion-segment-button value="details">
                  <ion-label>Details</ion-label>
                </ion-segment-button>
              </ion-segment>

              <!-- Tab Content -->
              <div class="tab-content-desktop">
                <!-- Feed Tab -->
                <div v-if="activeTab === 'feed'" class="feed-tab">
                  <ChatThread
                    v-if="conversation"
                    :conversation="conversation"
                    @back="goBack"
                  />
                  <div v-else-if="group.convoId" class="no-conversation">
                    <ion-spinner></ion-spinner>
                    <p>Loading conversation...</p>
                  </div>
                  <div v-else class="no-conversation">
                    <p>No conversation available</p>
                  </div>
                </div>

                <!-- Events Tab -->
                <div v-if="activeTab === 'events'" class="events-tab">
                  <div class="group-events">
                    <p v-if="groupEvents.length === 0" class="no-events">
                      No events scheduled for this group
                    </p>
                    <div v-else class="events-list">
                      <!-- Event cards will go here -->
                    </div>
                  </div>
                </div>

                <!-- Details Tab -->
                <div v-if="activeTab === 'details'" class="details-tab">
                  <div class="details-content">
                    <h2>Group Information</h2>
                    <p>{{ group.bio }}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div v-else class="error-state">
        <p>Group not found</p>
        <ion-button @click="goBack">Go Back</ion-button>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useAuthStore } from '@/stores/auth.store';
import { useCommunityStore } from '@/stores/community.store';
import { useConversationsStore } from '@/stores/conversations.store';
import { conversationService } from '@/services/conversation.service';
import { groupService, type Group } from '@/services/group.service';
import { eventService, type Event } from '@/services/event.service';
import ChatThread from './components/ChatThread.vue';
import GroupDetailsSidebar from './components/GroupDetailsSidebar.vue';
import {
  IonPage,
  IonContent,
  IonButton,
  IonIcon,
  IonSpinner,
  IonSegment,
  IonSegmentButton,
  IonLabel,
} from '@ionic/vue';
import {
  arrowBack,
  ellipsisVertical,
  people,
} from 'ionicons/icons';

const router = useRouter();
const route = useRoute();
const authStore = useAuthStore();
const communityStore = useCommunityStore();
const conversationsStore = useConversationsStore();

const isLoading = ref(true);
const group = ref<Group | null>(null);
const members = ref<any[]>([]);
const groupEvents = ref<Event[]>([]);
const activeTab = ref('feed');
const conversation = ref<any>(null);

async function loadGroup() {
  const groupId = route.params.id as string;
  if (!groupId) {
    isLoading.value = false;
    return;
  }

  isLoading.value = true;
  try {
    const fetchedGroup = await groupService.getGroup(groupId);
    if (fetchedGroup) {
      group.value = fetchedGroup;
      
      // Load members if available
      if (fetchedGroup.users) {
        members.value = fetchedGroup.users;
      }

      // Load conversation for group
      try {
        console.log('[GroupDetailPage] Loading conversation for group:', fetchedGroup.id);
        
        // If group already has a convoId, use it directly (most common case)
        if (fetchedGroup.convoId) {
          console.log('[GroupDetailPage] Group has convoId, loading directly:', fetchedGroup.convoId);
          const directConvo = await conversationService.getConversationById(fetchedGroup.convoId);
          
          if (directConvo) {
            // Load messages for this conversation
            const messages = await conversationService.getMessagesForConversation(directConvo.conversationId);
            directConvo.messages = messages;
            
            // Add conversation to store and set as active
            conversationsStore.conversations.set(directConvo.conversationId, directConvo);
            conversation.value = directConvo;
            // Use setActiveConversation which handles subscription internally
            try {
              conversationsStore.setActiveConversation(directConvo.conversationId);
            } catch (err) {
              console.warn('[GroupDetailPage] Error setting active conversation:', err);
              // Fallback: set directly if method fails
              conversationsStore.activeConversation = directConvo;
            }
            console.log('[GroupDetailPage] Conversation loaded with', messages.length, 'messages');
          } else {
            console.log('[GroupDetailPage] Conversation not found by ID, trying parentId query...');
            // Fallback: try querying by parentId
            const groupConversations = await conversationService.getFirebaseConversationsByGroupId(
              fetchedGroup.id,
              'groups'
            );
            
            if (groupConversations.length > 0) {
              const foundConvo = groupConversations[0];
              console.log('[GroupDetailPage] Found group conversation by parentId:', foundConvo.conversationId);
              
              // Load messages for this conversation
              const messages = await conversationService.getMessagesForConversation(foundConvo.conversationId);
              foundConvo.messages = messages;
              
              // Add conversation to store and set as active
              conversationsStore.conversations.set(foundConvo.conversationId, foundConvo);
              conversation.value = foundConvo;
              try {
                conversationsStore.setActiveConversation(foundConvo.conversationId);
              } catch (err) {
                console.warn('[GroupDetailPage] Error setting active conversation:', err);
                conversationsStore.activeConversation = foundConvo;
              }
              console.log('[GroupDetailPage] Conversation loaded with', messages.length, 'messages');
            } else {
              // No conversation found, try to create one
              console.log('[GroupDetailPage] No conversation found, trying to get or create...');
              await createOrLoadConversation(fetchedGroup);
            }
          }
        } else {
          // Group doesn't have convoId, try querying by parentId first
          console.log('[GroupDetailPage] No convoId, trying parentId query...');
          const groupConversations = await conversationService.getFirebaseConversationsByGroupId(
            fetchedGroup.id,
            'groups'
          );
          
          if (groupConversations.length > 0) {
            const foundConvo = groupConversations[0];
            console.log('[GroupDetailPage] Found group conversation by parentId:', foundConvo.conversationId);
            
            // Load messages for this conversation
            const messages = await conversationService.getMessagesForConversation(foundConvo.conversationId);
            foundConvo.messages = messages;
            
            // Add conversation to store and set as active
            conversationsStore.conversations.set(foundConvo.conversationId, foundConvo);
            conversation.value = foundConvo;
            try {
              conversationsStore.setActiveConversation(foundConvo.conversationId);
            } catch (err) {
              console.warn('[GroupDetailPage] Error setting active conversation:', err);
              conversationsStore.activeConversation = foundConvo;
            }
            console.log('[GroupDetailPage] Conversation loaded with', messages.length, 'messages');
          } else {
            // No conversation found, try to create one
            console.log('[GroupDetailPage] No conversation found, trying to get or create...');
            await createOrLoadConversation(fetchedGroup);
          }
        }
      } catch (error) {
        console.error('[GroupDetailPage] Error loading conversation:', error);
      }

      // Load group events
      if (authStore.user?.id) {
        try {
          const communityId = communityStore.currentCommunityId || 1;
          const events = await eventService.getEvents(communityId, authStore.user.id);
          groupEvents.value = events.filter(e => e.groupId === fetchedGroup.id);
        } catch (error) {
          console.error('Error loading group events:', error);
        }
      }
    }
  } catch (error) {
    console.error('[GroupDetailPage] Error loading group:', error);
  } finally {
    isLoading.value = false;
  }
}

async function createOrLoadConversation(fetchedGroup: Group) {
  try {
    console.log('[GroupDetailPage] No conversation found, trying to get or create...');
    // Try to get or create conversation
    const convoResult = await groupService.getOrCreateConvo(fetchedGroup.id);
    console.log('[GroupDetailPage] getOrCreateConvo result:', convoResult);
    
    if (convoResult.conversationId) {
      // Wait a moment for backend to sync to Firebase
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Try loading again with retries
      let loadedConvo = null;
      for (let attempt = 0; attempt < 3; attempt++) {
        const retryConversations = await conversationService.getFirebaseConversationsByGroupId(
          fetchedGroup.id,
          'groups'
        );
        
        if (retryConversations.length > 0) {
          loadedConvo = retryConversations[0];
          break;
        }
        
        console.log(`[GroupDetailPage] Retry ${attempt + 1}/3 loading conversation...`);
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
      if (loadedConvo) {
        // Load messages
        const messages = await conversationService.getMessagesForConversation(loadedConvo.conversationId);
        loadedConvo.messages = messages;
        
        // Add conversation to store and set as active
        conversationsStore.conversations.set(loadedConvo.conversationId, loadedConvo);
        conversation.value = loadedConvo;
        // Use setActiveConversation which handles subscription internally
        try {
          conversationsStore.setActiveConversation(loadedConvo.conversationId);
        } catch (err) {
          console.warn('[GroupDetailPage] Error setting active conversation:', err);
          // Fallback: set directly if method fails
          conversationsStore.activeConversation = loadedConvo;
        }
        console.log('[GroupDetailPage] Created and loaded new conversation with', messages.length, 'messages');
      } else {
        // Fallback: try loading by conversationId directly
        console.log('[GroupDetailPage] Trying to load by conversationId directly...');
        const directConvo = await conversationService.getConversationById(convoResult.conversationId);
        if (directConvo) {
          // Add conversation to store and set as active
          conversationsStore.conversations.set(directConvo.conversationId, directConvo);
          conversation.value = directConvo;
          // Use setActiveConversation which handles subscription internally
          try {
            conversationsStore.setActiveConversation(directConvo.conversationId);
          } catch (err) {
            console.warn('[GroupDetailPage] Error setting active conversation:', err);
            // Fallback: set directly if method fails
            conversationsStore.activeConversation = directConvo;
          }
          console.log('[GroupDetailPage] Loaded conversation directly by ID');
        } else {
          console.warn('[GroupDetailPage] Conversation not found after all attempts');
        }
      }
    } else {
      console.warn('[GroupDetailPage] No conversationId in getOrCreateConvo result');
    }
  } catch (error) {
    console.error('[GroupDetailPage] Error creating/loading conversation:', error);
  }
}

function goBack() {
  router.push('/tabs/groups');
}

async function handleShare() {
  if (!group.value) return;
  try {
    const result = await groupService.shareGroup(group.value.id);
    // TODO: Show share dialog or copy to clipboard
    console.log('Share URL:', result.shareUrl);
  } catch (error) {
    console.error('Error sharing group:', error);
  }
}

async function handleLeave() {
  if (!group.value || !authStore.user?.id) return;
  
  if (confirm('Are you sure you want to leave this group?')) {
    try {
      await groupService.leaveGroup(authStore.user.id, group.value.id);
      router.push('/tabs/groups');
    } catch (error) {
      console.error('Error leaving group:', error);
    }
  }
}

onMounted(() => {
  loadGroup();
});
</script>

<style scoped>
.group-detail-content {
  --background: #f8fafc;
}

.loading-container,
.error-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 64px 16px;
  color: #64748b;
}

.group-detail-container {
  min-height: 100%;
}

/* Mobile Layout */
.mobile-layout {
  display: block;
}

@media (min-width: 768px) {
  .mobile-layout {
    display: none;
  }
}

.group-header-mobile {
  background: #ffffff;
  padding: 12px 16px;
  display: flex;
  align-items: center;
  gap: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
  border-bottom: 1px solid #e5e7eb;
}

.back-button {
  --padding-start: 8px;
  --padding-end: 8px;
  margin: 0;
}

.back-button ion-icon {
  font-size: 24px;
  color: #1a1a1a;
}

.group-name-mobile {
  flex: 1;
  font-size: 18px;
  font-weight: 600;
  color: #1a1a1a;
  margin: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.more-button {
  --padding-start: 8px;
  --padding-end: 8px;
  margin: 0;
}

.more-button ion-icon {
  font-size: 20px;
  color: #1a1a1a;
}

.group-image-section {
  width: 100%;
  height: 200px;
  overflow: hidden;
  background: #e5e7eb;
}

.group-header-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.group-header-placeholder {
  width: 100%;
  height: 100%;
  background: linear-gradient(135deg, var(--color-primary) 0%, var(--color-secondary) 100%);
  display: flex;
  align-items: center;
  justify-content: center;
}

.group-header-placeholder ion-icon {
  font-size: 64px;
  color: #ffffff;
}

.detail-tabs {
  background: #ffffff;
  padding: 8px;
  border-bottom: 1px solid #e5e7eb;
}

.tab-content {
  padding: 16px;
}

.feed-tab,
.events-tab,
.details-tab {
  min-height: 400px;
}

.no-conversation,
.no-events {
  text-align: center;
  padding: 64px 16px;
  color: #64748b;
}

/* Desktop Layout */
.desktop-layout {
  display: none;
}

@media (min-width: 768px) {
  .desktop-layout {
    display: block;
  }
}

.desktop-content {
  display: flex;
  max-width: 1400px;
  margin: 0 auto;
  padding: 24px;
  gap: 24px;
}

.sidebar {
  width: 320px;
  flex-shrink: 0;
}

.main-content {
  flex: 1;
  background: #ffffff;
  border-radius: 16px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
  overflow: hidden;
}

.detail-tabs-desktop {
  background: #ffffff;
  padding: 0 16px;
  border-bottom: 1px solid #e5e7eb;
}

.tab-content-desktop {
  padding: 24px;
  min-height: 600px;
}

.details-content {
  padding: 24px;
}

.details-content h2 {
  font-size: 24px;
  font-weight: 700;
  color: #1a1a1a;
  margin: 0 0 16px 0;
}

.details-content p {
  font-size: 16px;
  color: #64748b;
  line-height: 1.6;
}
</style>

