<template>
  <ion-page>
    <ion-content :fullscreen="true" class="home-content">
      <div class="home-container">
        <!-- Hero Welcome Section -->
        <div class="hero-section">
          <div class="welcome-content">
            <h1 class="welcome-title">
              Welcome back<span class="highlight">!</span>
            </h1>
            <p class="welcome-subtitle">
              {{ welcomeMessage }}
            </p>
          </div>
        </div>

        <!-- Main Content Grid: Activity Feed, Groups, Events + LLM Chat -->
        <div class="main-content-grid">
          <!-- Left Column: Activity Feed -->
          <div class="content-column activity-column">
            <HomeActivityFeed :community-id="currentCommunityId" />
          </div>

          <!-- Center Column: Groups -->
          <div class="content-column groups-column">
            <HomeGroupsSection :community-id="currentCommunityId" />
          </div>

          <!-- Right Column: Events + LLM Chatbox -->
          <div class="content-column events-column">
            <HomeEventsSection :community-id="currentCommunityId" />
            <LLMChatbox />
          </div>
        </div>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { computed, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useCommunityStore } from '@/stores/community.store';
import HomeActivityFeed from './components/HomeActivityFeed.vue';
import HomeGroupsSection from './components/HomeGroupsSection.vue';
import HomeEventsSection from './components/HomeEventsSection.vue';
import LLMChatbox from '@/components/LLMChatbox.vue';
import {
  IonPage,
  IonContent,
} from '@ionic/vue';

const router = useRouter();
const communityStore = useCommunityStore();

// Use community store's currentCommunityId directly (null = Global view)
const currentCommunityId = computed(() => communityStore.currentCommunityId);

// Welcome message based on selected community
const welcomeMessage = computed(() => {
  if (communityStore.isGlobalView) {
    return 'Here\'s what\'s happening across all your communities';
  }
  const communityName = communityStore.currentCommunityName;
  return `Here's what's happening in ${communityName}`;
});

// Watch for community changes - components will automatically reload when communityId prop changes
watch(() => communityStore.currentCommunityId, () => {
  // Components will automatically reload when communityId prop changes
});
</script>

<style scoped>
.home-content {
  --background: linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%);
}

.home-container {
  padding: 20px 16px 32px;
  max-width: 1400px;
  margin: 0 auto;
}

/* Hero Section */
.hero-section {
  margin-bottom: 32px;
  padding-top: 8px;
}

.view-toggle-container {
  margin-top: 20px;
  display: flex;
  justify-content: center;
}

.view-toggle {
  --background: #ffffff;
  --indicator-color: var(--color-primary);
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  border: 1px solid rgba(0, 0, 0, 0.05);
  max-width: 400px;
  width: 100%;
}

.view-toggle ion-segment-button {
  --color: #64748b;
  --color-checked: #ffffff;
  --indicator-color: var(--color-primary);
  font-weight: 600;
  font-size: 14px;
}

.welcome-content {
  animation: fadeInUp 0.6s ease-out;
}

.welcome-title {
  font-size: 36px;
  font-weight: 800;
  color: #1a1a1a;
  margin: 0 0 8px 0;
  letter-spacing: -1px;
  line-height: 1.1;
}

.welcome-title .highlight {
  color: var(--color-primary);
}

.welcome-subtitle {
  font-size: 16px;
  color: #64748b;
  margin: 0;
  font-weight: 400;
  line-height: 1.5;
}

/* Quick Actions Grid */
.quick-actions-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
  margin-bottom: 24px;
}

.action-card {
  position: relative;
  background: #ffffff;
  border-radius: 20px;
  overflow: hidden;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.8);
  min-height: 180px;
  display: flex;
  flex-direction: column;
}

.action-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(135deg, rgba(52, 168, 83, 0.05) 0%, rgba(29, 185, 138, 0.05) 100%);
  opacity: 0;
  transition: opacity 0.3s ease;
}

.action-card:hover::before,
.action-card:active::before {
  opacity: 1;
}

.action-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 12px 24px rgba(0, 0, 0, 0.12);
}

.action-card:active {
  transform: translateY(-2px);
}

.card-gradient {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 60px;
  background: linear-gradient(135deg, var(--color-primary) 0%, var(--color-secondary) 100%);
  opacity: 0.1;
}

.discover-gradient {
  background: linear-gradient(135deg, var(--color-secondary) 0%, var(--color-primary) 100%);
}

.card-content {
  padding: 20px;
  position: relative;
  z-index: 1;
  flex: 1;
  display: flex;
  flex-direction: column;
}

.icon-wrapper {
  width: 56px;
  height: 56px;
  background: linear-gradient(135deg, var(--color-primary) 0%, var(--color-secondary) 100%);
  border-radius: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 16px;
  box-shadow: 0 4px 12px rgba(52, 168, 83, 0.25);
}

.action-icon {
  font-size: 28px;
  color: #ffffff;
}

.card-title {
  font-size: 18px;
  font-weight: 700;
  color: #1a1a1a;
  margin: 0 0 6px 0;
  letter-spacing: -0.3px;
}

.card-description {
  font-size: 13px;
  color: #64748b;
  margin: 0 0 12px 0;
  line-height: 1.4;
  flex: 1;
}

.card-stats {
  display: flex;
  align-items: baseline;
  gap: 4px;
}

.stat-number {
  font-size: 20px;
  font-weight: 700;
  color: var(--color-primary);
}

.stat-label {
  font-size: 12px;
  color: #94a3b8;
  font-weight: 500;
}

.card-arrow {
  position: absolute;
  bottom: 16px;
  right: 16px;
  width: 32px;
  height: 32px;
  background: rgba(52, 168, 83, 0.1);
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.3s ease;
}

.action-card:hover .card-arrow {
  background: var(--color-primary);
  transform: translateX(4px);
}

.card-arrow ion-icon {
  font-size: 18px;
  color: var(--color-primary);
  transition: color 0.3s ease;
}

.action-card:hover .card-arrow ion-icon {
  color: #ffffff;
}

/* Features Section */
.features-section {
  margin-bottom: 32px;
}

.feature-item {
  background: #ffffff;
  border-radius: 16px;
  padding: 16px;
  margin-bottom: 12px;
  display: flex;
  align-items: center;
  gap: 16px;
  cursor: pointer;
  transition: all 0.2s ease;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
  border: 1px solid rgba(0, 0, 0, 0.05);
}

.feature-item:active {
  transform: scale(0.98);
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.08);
}

.feature-icon {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.messages-icon {
  background: linear-gradient(135deg, rgba(59, 130, 246, 0.1) 0%, rgba(96, 165, 250, 0.1) 100%);
}

.messages-icon ion-icon {
  font-size: 24px;
  color: #3b82f6;
}

.connections-icon {
  background: linear-gradient(135deg, rgba(239, 68, 68, 0.1) 0%, rgba(248, 113, 113, 0.1) 100%);
}

.connections-icon ion-icon {
  font-size: 24px;
  color: #ef4444;
}

.feature-content {
  flex: 1;
  min-width: 0;
}

.feature-title {
  font-size: 16px;
  font-weight: 600;
  color: #1a1a1a;
  margin: 0 0 4px 0;
}

.feature-subtitle {
  font-size: 13px;
  color: #64748b;
  margin: 0;
}

.feature-badge {
  font-size: 12px;
  min-width: 24px;
  height: 24px;
  border-radius: 12px;
}

/* Main Content Grid */
.main-content-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 24px;
  margin-bottom: 32px;
}

.content-column {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

/* Desktop: 3-column layout */
@media (min-width: 1024px) {
  .main-content-grid {
    grid-template-columns: 1fr 1fr 1fr;
    gap: 24px;
  }

  .activity-column {
    min-width: 0;
  }

  .groups-column {
    min-width: 0;
  }

  .events-column {
    min-width: 0;
  }
}

/* Tablet: 2-column layout */
@media (min-width: 768px) and (max-width: 1023px) {
  .main-content-grid {
    grid-template-columns: 1fr 1fr;
    gap: 20px;
  }

  .activity-column {
    grid-column: 1 / -1;
  }
}

/* Animations */
@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* Responsive adjustments */
@media (max-width: 480px) {
  .welcome-title {
    font-size: 32px;
  }
}
</style>
