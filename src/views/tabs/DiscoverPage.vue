<template>
  <ion-page>
    <ion-content :fullscreen="true" class="discover-content">
      <div class="discover-container">
        <!-- Mobile Toggle (only if matches enabled) -->
        <div v-if="matchesEnabled" class="mobile-toggle-container">
          <div class="toggle-background" :class="{ right: !mobileToggleState }"></div>
          <div
            class="toggle-button"
            :class="{ active: mobileToggleState }"
            @click="mobileToggleState = true"
          >
            Intros
          </div>
          <div
            class="toggle-button"
            :class="{ active: !mobileToggleState }"
            @click="mobileToggleState = false"
          >
            All Members
          </div>
        </div>

        <!-- Desktop Layout: Side by side -->
        <div class="desktop-layout">
          <!-- Intros/Matches Section -->
          <div
            v-if="matchesEnabled"
            class="intros-section"
            :class="{ 'mobile-visible': mobileToggleState, 'mobile-hidden': !mobileToggleState }"
          >
            <h2 class="section-title">Intros</h2>
            <div v-if="isLoadingMatches" class="loading-container">
              <ion-spinner></ion-spinner>
              <p>Loading matches...</p>
            </div>
            <div v-else-if="matches.length === 0" class="empty-state">
              <div class="empty-icon">
                <ion-icon :icon="peopleOutline"></ion-icon>
              </div>
              <h3 class="empty-title">No matches yet</h3>
              <p class="empty-description">
                Complete your profile to get personalized recommendations!
              </p>
            </div>
            <div v-else class="matches-list">
              <!-- Match cards will go here -->
              <div
                v-for="match in matches"
                :key="match.id"
                class="match-card"
                @click="viewProfile((match.matchedUser?.id || match.matchedUserId) as number)"
              >
                <img
                  v-if="match.matchedUser?.profilePicture"
                  :src="match.matchedUser.profilePicture"
                  :alt="match.matchedUser.fullName || `${match.matchedUser.fname} ${match.matchedUser.lname}`"
                  class="match-avatar"
                />
                <div v-else class="match-avatar-placeholder">
                  <ion-icon :icon="person"></ion-icon>
                </div>
                <div class="match-info">
                  <h4 class="match-name">
                    {{ match.matchedUser?.fullName || `${match.matchedUser?.fname} ${match.matchedUser?.lname}` }}
                  </h4>
                  <p v-if="match.matchedUser?.bio" class="match-bio">{{ match.matchedUser.bio }}</p>
                  <div v-if="match.reasons && match.reasons.length > 0" class="match-reasons">
                    <span
                      v-for="(reason, idx) in match.reasons.slice(0, 3)"
                      :key="idx"
                      class="match-reason-tag"
                    >
                      {{ reason }}
                    </span>
                  </div>
                </div>
                <ion-button
                  fill="outline"
                  size="small"
                  class="say-hi-button"
                  @click.stop="sayHi(match)"
                >
                  Say Hi
                </ion-button>
              </div>
            </div>
          </div>

          <!-- All Members Section -->
          <div
            class="all-members-section"
            :class="{
              'full-width': !matchesEnabled,
              'mobile-visible': !mobileToggleState || !matchesEnabled,
              'mobile-hidden': mobileToggleState && matchesEnabled
            }"
          >
            <div class="section-header">
              <h2 class="section-title">
                {{ matchesEnabled ? 'All Members' : 'Discover Your Community' }}
              </h2>
            </div>

            <!-- Search Bar -->
            <div class="search-container">
              <ion-searchbar
                v-model="searchQuery"
                placeholder="Search by name, interest, location..."
                class="members-search"
                :debounce="100"
                @ionInput="handleSearch"
              ></ion-searchbar>
            </div>

            <!-- Loading State -->
            <div v-if="isLoadingProfiles" class="loading-container">
              <ion-spinner></ion-spinner>
              <p>Loading members...</p>
            </div>

            <!-- Members List -->
            <div v-else-if="filteredProfiles.length === 0" class="empty-state">
              <div class="empty-icon">
                <ion-icon :icon="peopleOutline"></ion-icon>
              </div>
              <h3 class="empty-title">No members found</h3>
              <p class="empty-description">
                {{ searchQuery ? 'Try a different search term' : 'No members in this community yet' }}
              </p>
            </div>

            <div v-else class="members-list">
              <div
                v-for="profile in filteredProfiles"
                :key="profile.id"
                class="member-card"
                @click="viewProfile(profile.userId)"
              >
                <img
                  v-if="profile.profilePicture"
                  :src="profile.profilePicture"
                  :alt="profile.fullName || `${profile.fname} ${profile.lname}`"
                  class="member-avatar"
                />
                <div v-else class="member-avatar-placeholder">
                  <ion-icon :icon="person"></ion-icon>
                </div>
                <div class="member-info">
                  <h4 class="member-name">
                    {{ profile.fullName || `${profile.fname} ${profile.lname}` }}
                  </h4>
                  <p v-if="profile.bio" class="member-bio">{{ profile.bio }}</p>
                  <div v-if="profile.interests && profile.interests.length > 0" class="member-interests">
                    <span
                      v-for="(interest, idx) in profile.interests.slice(0, 3)"
                      :key="idx"
                      class="interest-tag"
                    >
                      {{ interest }}
                    </span>
                    <span v-if="profile.interests.length > 3" class="more-interests">
                      +{{ profile.interests.length - 3 }}
                    </span>
                  </div>
                  <div v-if="profile.locations && profile.locations.length > 0" class="member-location">
                    <ion-icon :icon="locationOutline"></ion-icon>
                    <span>{{ profile.locations[0].primaryName }}</span>
                  </div>
                </div>
                <ion-button
                  fill="clear"
                  size="small"
                  class="view-profile-button"
                  @click.stop="viewProfile(profile.userId)"
                >
                  <ion-icon :icon="chevronForwardOutline"></ion-icon>
                </ion-button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth.store';
import { useCommunityStore } from '@/stores/community.store';
import { matchService, type UserMatch } from '@/services/match.service';
import { profileService, type ProfilesInit } from '@/services/profile.service';
import {
  IonPage,
  IonContent,
  IonSearchbar,
  IonButton,
  IonIcon,
  IonSpinner,
} from '@ionic/vue';
import {
  peopleOutline,
  person,
  locationOutline,
  chevronForwardOutline,
} from 'ionicons/icons';

const router = useRouter();
const authStore = useAuthStore();
const communityStore = useCommunityStore();

// State
const matchesEnabled = ref(true); // TODO: Get from community settings
const mobileToggleState = ref(true); // true = Intros, false = All Members
const isLoadingMatches = ref(false);
const isLoadingProfiles = ref(false);
const searchQuery = ref('');
const matches = ref<UserMatch[]>([]);
const profiles = ref<ProfilesInit[]>([]);

// Filtered profiles based on search
const filteredProfiles = computed(() => {
  if (!searchQuery.value.trim()) {
    return profiles.value;
  }

  const query = searchQuery.value.toLowerCase();
  const filtered: ProfilesInit[] = [];
  const scored: Array<{ profile: ProfilesInit; score: number }> = [];

  for (const profile of profiles.value) {
    let score = 0;
    let hasMatch = false;

    // Name match (highest priority)
    const fullName = `${profile.fname} ${profile.lname}`.toLowerCase();
    if (fullName.includes(query)) {
      score += 100;
      hasMatch = true;
    } else if (profile.fname.toLowerCase().includes(query) || profile.lname.toLowerCase().includes(query)) {
      score += 80;
      hasMatch = true;
    }

    // Interests match
    if (profile.interests) {
      const interestMatches = profile.interests.filter(i => i.toLowerCase().includes(query));
      if (interestMatches.length > 0) {
        score += interestMatches.length * 10;
        hasMatch = true;
      }
    }

    // Location match
    if (profile.locations) {
      const locationMatches = profile.locations.filter(l =>
        l.primaryName.toLowerCase().includes(query) ||
        l.secondaryName?.toLowerCase().includes(query)
      );
      if (locationMatches.length > 0) {
        score += locationMatches.length * 5;
        hasMatch = true;
      }
    }

    // Education match
    if (profile.education) {
      const educationMatches = profile.education.filter(e => e.toLowerCase().includes(query));
      if (educationMatches.length > 0) {
        score += educationMatches.length * 5;
        hasMatch = true;
      }
    }

    // Organizations match
    if (profile.organizations) {
      const orgMatches = profile.organizations.filter(o => o.toLowerCase().includes(query));
      if (orgMatches.length > 0) {
        score += orgMatches.length * 5;
        hasMatch = true;
      }
    }

    // Bio match
    if (profile.bio && profile.bio.toLowerCase().includes(query)) {
      score += 3;
      hasMatch = true;
    }

    if (hasMatch) {
      scored.push({ profile, score });
    }
  }

  // Sort by score (highest first), then by name
  scored.sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score;
    }
    const aName = `${a.profile.fname} ${a.profile.lname}`.toLowerCase();
    const bName = `${b.profile.fname} ${b.profile.lname}`.toLowerCase();
    return aName.localeCompare(bName);
  });

  return scored.map(item => item.profile);
});

// Load matches
async function loadMatches() {
  if (!matchesEnabled.value) return;

  isLoadingMatches.value = true;
  try {
    const loadedMatches = await matchService.getMatches();
    matches.value = loadedMatches;
    console.log('[DiscoverPage] Loaded matches:', loadedMatches.length);
  } catch (error) {
    console.error('[DiscoverPage] Error loading matches:', error);
  } finally {
    isLoadingMatches.value = false;
  }
}

// Load profiles
async function loadProfiles() {
  const communityId = communityStore.currentCommunityId;
  if (!communityId) {
    console.warn('[DiscoverPage] No community selected');
    return;
  }

  isLoadingProfiles.value = true;
  try {
    const loadedProfiles = await profileService.getProfilesForUserAndCommunity(communityId);
    profiles.value = loadedProfiles;
    console.log('[DiscoverPage] Loaded profiles:', loadedProfiles.length);
  } catch (error) {
    console.error('[DiscoverPage] Error loading profiles:', error);
  } finally {
    isLoadingProfiles.value = false;
  }
}

function handleSearch(event: any) {
  searchQuery.value = event.target.value || '';
}

function viewProfile(userId: number) {
  // Navigate to user profile page
  router.push(`/tabs/profile/${userId}`);
}

async function sayHi(match: UserMatch) {
  // TODO: Implement friend request/say hi functionality
  console.log('[DiscoverPage] Say Hi to:', match.matchedUser?.fullName || match.matchedUserId);
  // This would typically send a friend request or start a conversation
}

// Watch for community changes
watch(() => communityStore.currentCommunityId, (newCommunityId) => {
  if (newCommunityId) {
    loadProfiles();
    loadMatches();
  }
});

onMounted(() => {
  loadProfiles();
  loadMatches();
});
</script>

<style scoped>
.discover-content {
  --background: #f8fafc;
}

.discover-container {
  padding: 16px;
  max-width: 1400px;
  margin: 0 auto;
}

/* Mobile Toggle */
.mobile-toggle-container {
  display: flex;
  position: relative;
  background: #e2e8f0;
  border-radius: 12px;
  padding: 4px;
  margin-bottom: 24px;
}

.toggle-background {
  position: absolute;
  top: 4px;
  left: 4px;
  width: calc(50% - 4px);
  height: calc(100% - 8px);
  background: white;
  border-radius: 8px;
  transition: transform 0.3s ease;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.toggle-background.right {
  transform: translateX(100%);
}

.toggle-button {
  flex: 1;
  text-align: center;
  padding: 12px;
  font-weight: 600;
  font-size: 15px;
  color: #64748b;
  cursor: pointer;
  position: relative;
  z-index: 1;
  transition: color 0.3s ease;
}

.toggle-button.active {
  color: #1a1a1a;
}

/* Desktop Layout */
.desktop-layout {
  display: flex;
  gap: 24px;
}

.intros-section {
  flex: 0 0 400px;
}

.all-members-section {
  flex: 1;
}

.all-members-section.full-width {
  flex: 1 1 100%;
}

.section-header {
  margin-bottom: 16px;
}

.section-title {
  font-size: 22px;
  font-weight: 700;
  color: #1a1a1a;
  margin: 0;
  letter-spacing: -0.5px;
}

.search-container {
  margin-bottom: 24px;
}

.members-search {
  --background: #ffffff;
  --border-radius: 12px;
  --box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
}

/* Match Cards */
.matches-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.match-card {
  background: white;
  border-radius: 12px;
  padding: 16px;
  display: flex;
  align-items: center;
  gap: 12px;
  cursor: pointer;
  transition: all 0.2s ease;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.match-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.match-avatar,
.member-avatar {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  object-fit: cover;
  flex-shrink: 0;
}

.match-avatar-placeholder,
.member-avatar-placeholder {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background: #e2e8f0;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.match-avatar-placeholder ion-icon,
.member-avatar-placeholder ion-icon {
  font-size: 28px;
  color: #94a3b8;
}

.match-info,
.member-info {
  flex: 1;
  min-width: 0;
}

.match-name,
.member-name {
  font-size: 16px;
  font-weight: 600;
  color: #1a1a1a;
  margin: 0 0 4px 0;
}

.match-bio,
.member-bio {
  font-size: 14px;
  color: #64748b;
  margin: 0 0 8px 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.match-reasons {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 8px;
}

.match-reason-tag {
  font-size: 12px;
  padding: 4px 8px;
  background: #f1f5f9;
  border-radius: 6px;
  color: #475569;
}

.say-hi-button {
  --border-color: var(--color-primary);
  --color: var(--color-primary);
  --border-radius: 8px;
  flex-shrink: 0;
}

/* Member Cards */
.members-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.member-card {
  background: white;
  border-radius: 12px;
  padding: 16px;
  display: flex;
  align-items: center;
  gap: 12px;
  cursor: pointer;
  transition: all 0.2s ease;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.member-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.member-interests {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 8px;
}

.interest-tag {
  font-size: 12px;
  padding: 4px 8px;
  background: #f1f5f9;
  border-radius: 6px;
  color: #475569;
}

.more-interests {
  font-size: 12px;
  color: #94a3b8;
  padding: 4px 0;
}

.member-location {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 13px;
  color: #64748b;
  margin-top: 6px;
}

.view-profile-button {
  --color: #94a3b8;
  flex-shrink: 0;
}

.loading-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 64px 16px;
  gap: 16px;
}

.empty-state {
  text-align: center;
  padding: 64px 16px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.empty-icon {
  width: 100px;
  height: 100px;
  margin: 0 auto 32px;
  background: linear-gradient(135deg, rgba(45, 122, 78, 0.1) 0%, rgba(29, 185, 138, 0.1) 100%);
  border-radius: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.empty-icon ion-icon {
  font-size: 48px;
  color: var(--color-primary);
}

.empty-title {
  font-size: 24px;
  font-weight: 700;
  color: #1a1a1a;
  margin: 0 0 12px 0;
}

.empty-description {
  font-size: 16px;
  color: #64748b;
  margin: 0;
  line-height: 1.6;
  max-width: 400px;
}

/* Mobile: Hide desktop layout, show toggle */
@media (max-width: 767px) {
  .desktop-layout {
    flex-direction: column;
  }

  .intros-section {
    display: none;
  }

  .intros-section.mobile-visible {
    display: block;
  }

  .all-members-section.mobile-hidden {
    display: none;
  }

  .all-members-section.mobile-visible {
    display: block;
  }
}

/* Desktop: Hide mobile toggle */
@media (min-width: 768px) {
  .mobile-toggle-container {
    display: none;
  }

  .discover-container {
    padding: 24px;
  }
}
</style>
