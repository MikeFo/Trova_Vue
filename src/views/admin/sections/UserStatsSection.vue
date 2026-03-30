<template>
  <div class="user-stats-section">
    <div class="section-header">
      <h2 class="section-title">
        <span v-if="props.communityName && props.communityName.trim().length">
          {{ props.communityName }} – Engagement Dashboard
        </span>
        <span v-else>
          Engagement Dashboard
        </span>
      </h2>
      <div class="header-actions">
        <div class="time-period-wrapper">
          <ion-label class="time-period-label-inline">Time Period</ion-label>
          <ion-select v-model="selectedPeriod" @ionChange="onPeriodChange" class="time-period-select-inline">
            <ion-select-option value="all-time">All Time</ion-select-option>
            <ion-select-option value="2-years">Past 2 Years</ion-select-option>
            <ion-select-option value="18-months">Past 18 Months</ion-select-option>
            <ion-select-option value="12-months">Past 12 Months</ion-select-option>
            <ion-select-option value="6-months">Past 6 Months</ion-select-option>
            <ion-select-option value="3-months">Past 3 Months</ion-select-option>
            <ion-select-option value="1-month">Past Month</ion-select-option>
          </ion-select>
        </div>
        <ion-button fill="outline" size="small" @click="exportStats">
          <ion-icon :icon="downloadOutline" slot="start"></ion-icon>
          Export CSV
        </ion-button>
      </div>
    </div>

    <!-- Dashboard Content (renders immediately, sections load progressively) -->
    <div v-if="stats || hasAnyData || isLoading" class="dashboard-content">
      <!-- Primary Metrics (Core ROI) -->
      <div class="primary-metrics-section">
        <h3 class="section-subtitle">Primary Metrics</h3>
        <div class="primary-metrics-grid">
          <div
            class="primary-metric-card clickable"
            @click="openProfilesList"
          >
            <div class="metric-icon">
              <ion-icon :icon="checkmarkCircleOutline"></ion-icon>
            </div>
            <div class="metric-content">
              <div class="metric-value">
                <ion-spinner v-if="isLoadingProfileCompletion && stats?.profileCompletionCompleted === undefined" name="crescent" class="metric-spinner"></ion-spinner>
                <span v-else-if="stats?.profileCompletionCompleted !== undefined && stats?.profileCompletionTotal !== undefined">
                  {{ formatNumber(stats.profileCompletionCompleted) }}/{{ formatNumber(stats.profileCompletionTotal) }}
                </span>
                <span v-else>{{ formatPercentage(stats?.profileCompletionRate) }}</span>
              </div>
              <div class="metric-label-with-info">
                <span class="metric-label">Profile Completion (Completed / Eligible)</span>
                <ion-icon
                  :icon="informationCircleOutline"
                  class="metric-info-icon"
                  :title="metricTooltips.profileCompletion"
                ></ion-icon>
              </div>
            </div>
          </div>
          <div
            class="primary-metric-card clickable"
            @click="navigateToConnections"
          >
            <div class="metric-icon">
              <ion-icon :icon="peopleOutline"></ion-icon>
            </div>
            <div class="metric-content">
              <div class="metric-value">
                <ion-spinner v-if="isLoadingPrimary && stats?.connectionsMade === undefined" name="crescent" class="metric-spinner"></ion-spinner>
                <span v-else>{{ formatNumber(stats?.connectionsMade || 0) }}</span>
              </div>
              <div class="metric-label-with-info">
                <span class="metric-label">Introductions Created</span>
                <ion-icon
                  :icon="informationCircleOutline"
                  class="metric-info-icon"
                  :title="metricTooltips.introductionsCreated"
                ></ion-icon>
              </div>
              <div v-if="stats?.connectionsMadeTrend" class="metric-trend" :class="getTrendClass(stats.connectionsMadeTrend)">
                <ion-icon :icon="stats.connectionsMadeTrend > 0 ? trendingUpOutline : trendingDownOutline"></ion-icon>
                <span>{{ Math.abs(stats.connectionsMadeTrend).toFixed(1) }}%</span>
              </div>
            </div>
          </div>
          <div
            class="primary-metric-card primary-metric-card-highlight clickable"
            @click="openConversationsStartedList"
          >
            <div class="metric-icon">
              <ion-icon :icon="chatbubblesOutline"></ion-icon>
            </div>
            <div class="metric-content">
              <div class="metric-value">
                <ion-spinner v-if="isLoadingPrimary && stats?.trovaChatsStarted === undefined" name="crescent" class="metric-spinner"></ion-spinner>
                <span v-else>{{ formatNumber(stats?.trovaChatsStarted || 0) }}</span>
              </div>
              <div class="metric-label-with-info">
                <span class="metric-label">Messages Exchanged</span>
                <ion-icon
                  :icon="informationCircleOutline"
                  class="metric-info-icon"
                  :title="metricTooltips.messagesExchanged"
                ></ion-icon>
              </div>
              <div v-if="stats?.trovaChatsStartedTrend" class="metric-trend" :class="getTrendClass(stats.trovaChatsStartedTrend)">
                <ion-icon :icon="stats.trovaChatsStartedTrend > 0 ? trendingUpOutline : trendingDownOutline"></ion-icon>
                <span>{{ Math.abs(stats.trovaChatsStartedTrend).toFixed(1) }}%</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- General Actions Metrics -->
      <div v-if="hasUserActionsData || isLoadingActions" class="engagement-metrics-section">
        <h3 class="section-subtitle">General Actions</h3>
        <div class="engagement-metrics-grid">
          <div
            class="engagement-metric-card clickable"
            v-if="stats?.openedTrova !== undefined || isLoadingActions"
            @click="openOpenedTrovaList"
          >
            <div class="metric-icon-small">
              <ion-icon :icon="openOutline"></ion-icon>
            </div>
            <div class="metric-content-small">
              <div class="metric-value-small">
                <ion-spinner v-if="isLoadingActions && stats?.openedTrova === undefined" name="crescent" class="metric-spinner-small"></ion-spinner>
                <span v-else>{{ formatNumber(stats?.openedTrova) }}</span>
              </div>
              <div class="metric-label-with-info">
                <span class="metric-label-small">Trova Opens</span>
                <ion-icon
                  :icon="informationCircleOutline"
                  class="metric-info-icon"
                  :title="metricTooltips.trovaOpens"
                ></ion-icon>
              </div>
            </div>
          </div>
          <div
            class="engagement-metric-card"
            v-if="stats?.profileScore !== undefined"
          >
            <div class="metric-icon-small">
              <ion-icon :icon="starOutline"></ion-icon>
            </div>
            <div class="metric-content-small">
              <div class="metric-value-small">{{ formatNumber(stats.profileScore, 1) }}</div>
              <div class="metric-label-with-info">
                <span class="metric-label-small">Avg Profile Score</span>
                <ion-icon
                  :icon="informationCircleOutline"
                  class="metric-info-icon"
                  :title="metricTooltips.avgProfileScore"
                ></ion-icon>
              </div>
            </div>
          </div>
          <div 
            class="engagement-metric-card clickable"
            v-if="stats?.userOnboardingIntros !== undefined && stats.userOnboardingIntros > 0"
            @click="openOnboardingIntrosList"
          >
            <div class="metric-icon-small">
              <ion-icon :icon="peopleOutline"></ion-icon>
            </div>
            <div class="metric-content-small">
              <div class="metric-value-small">{{ formatNumber(stats.userOnboardingIntros) }}</div>
              <div class="metric-label-with-info">
                <span class="metric-label-small">Automated Onboarding Introductions</span>
                <ion-icon
                  :icon="informationCircleOutline"
                  class="metric-info-icon"
                  :title="metricTooltips.onboardingIntros"
                ></ion-icon>
              </div>
            </div>
          </div>
          <div 
            class="engagement-metric-card clickable"
            v-if="stats?.selfIntroduced !== undefined || isLoadingActions"
            @click="openSelfIntroducedList"
          >
            <div class="metric-icon-small">
              <ion-icon :icon="starOutline"></ion-icon>
            </div>
            <div class="metric-content-small">
              <div class="metric-value-small">
                <ion-spinner v-if="isLoadingActions && stats?.selfIntroduced === undefined" name="crescent" class="metric-spinner-small"></ion-spinner>
                <span v-else>{{ formatNumber(stats?.selfIntroduced) }}</span>
              </div>
              <div class="metric-label-with-info">
                <span class="metric-label-small">Self-Introductions Posted</span>
                <ion-icon
                  :icon="informationCircleOutline"
                  class="metric-info-icon"
                  :title="metricTooltips.selfIntroductions"
                ></ion-icon>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Engagement Attribution -->
      <div v-if="hasEngagementAttributionData || isLoadingEngagement" class="engagement-metrics-section">
        <h3 class="section-subtitle">Engagement by Feature</h3>
        <div class="engagement-metrics-grid">
          <div 
            class="engagement-metric-card clickable" 
            v-if="stats?.trovaMagicEngagements !== undefined || stats?.trovaMagicMatches !== undefined || isLoadingEngagement"
            @click="navigateToMagicIntros"
          >
            <div class="metric-icon-small">
              <ion-icon :icon="sparklesOutline"></ion-icon>
            </div>
            <div class="metric-content-small">
              <div class="metric-value-small">
                <ion-spinner v-if="isLoadingEngagement && stats?.trovaMagicMatches === undefined && !magicIntroSummary" name="crescent" class="metric-spinner-small"></ion-spinner>
                <span v-else-if="magicIntroSummary">
                  {{ formatNumber(magicIntroSummary.engagedPairs) }}/{{ formatNumber(magicIntroSummary.totalPairs) }}
                </span>
                <span v-else-if="stats?.trovaMagicEngagements !== undefined && stats?.trovaMagicMatches !== undefined">
                  {{ formatNumber(stats.trovaMagicEngagements || 0) }}/{{ formatNumber(stats.trovaMagicMatches) }}
                </span>
                <span v-else-if="stats?.trovaMagicMatches !== undefined">
                  {{ formatNumber(stats.trovaMagicEngagements || 0) }}/{{ formatNumber(stats.trovaMagicMatches) }}
                </span>
                <span v-else>{{ formatNumber(stats?.trovaMagicEngagements || 0) }}</span>
              </div>
              <div class="metric-label-with-info">
                <span class="metric-label-small">Magic Intros (Engaged / Total)</span>
                <ion-icon
                  :icon="informationCircleOutline"
                  class="metric-info-icon"
                  :title="metricTooltips.magicIntros"
                ></ion-icon>
              </div>
            </div>
          </div>
          <div 
            class="engagement-metric-card clickable" 
            v-if="stats?.channelPairingEngagements !== undefined || stats?.channelPairingMatches !== undefined || isLoadingEngagement"
            @click="navigateToChannelPairings"
          >
            <div class="metric-icon-small">
              <ion-icon :icon="linkOutline"></ion-icon>
            </div>
            <div class="metric-content-small">
              <div class="metric-value-small">
                <ion-spinner v-if="isLoadingEngagement && stats?.channelPairingMatches === undefined" name="crescent" class="metric-spinner-small"></ion-spinner>
                <span v-else-if="stats?.channelPairingEngagements !== undefined && stats?.channelPairingMatches !== undefined">
                  {{ formatNumber(stats.channelPairingEngagements || 0) }}/{{ formatNumber(stats.channelPairingMatches) }}
                </span>
                <span v-else-if="stats?.channelPairingMatches !== undefined">
                  {{ formatNumber(stats.channelPairingEngagements || 0) }}/{{ formatNumber(stats.channelPairingMatches) }}
                </span>
                <span v-else>{{ formatNumber(stats?.channelPairingEngagements || 0) }}</span>
              </div>
              <div class="metric-label-with-info">
                <span class="metric-label-small">Channel Pairings (Engaged / Total)</span>
                <ion-icon
                  :icon="informationCircleOutline"
                  class="metric-info-icon"
                  :title="metricTooltips.channelPairings"
                ></ion-icon>
              </div>
            </div>
          </div>
          <div 
            class="engagement-metric-card clickable" 
            v-if="stats?.mentorMenteeEngagements !== undefined || stats?.mentorMenteeMatches !== undefined || isLoadingEngagement"
            @click="navigateToMentorMenteeMatches"
          >
            <div class="metric-icon-small">
              <ion-icon :icon="schoolOutline"></ion-icon>
            </div>
            <div class="metric-content-small">
              <div class="metric-value-small">
                <ion-spinner v-if="isLoadingEngagement && stats?.mentorMenteeMatches === undefined" name="crescent" class="metric-spinner-small"></ion-spinner>
                <span v-else-if="stats?.mentorMenteeMatches !== undefined && stats?.mentorMenteeUniquePairs !== undefined">
                  {{ formatNumber(stats.mentorMenteeUniquePairs) }}/{{ formatNumber(stats.mentorMenteeMatches) }}
                </span>
                <span v-else-if="stats?.mentorMenteeMatches !== undefined">
                  {{ formatNumber(stats.mentorMenteeMatches) }}
                </span>
                <span v-else>0</span>
              </div>
              <div class="metric-label-with-info">
                <span class="metric-label-small">Mentor Matches (Unique / Total)</span>
                <ion-icon
                  :icon="informationCircleOutline"
                  class="metric-info-icon"
                  :title="metricTooltips.mentorMatches"
                ></ion-icon>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Skills Metrics -->
      <div v-if="hasSkillsData || isLoadingSkills" class="engagement-metrics-section">
        <h3 class="section-subtitle">Skills</h3>
        <div v-if="isLoadingSkills && !hasSkillsData" class="section-loading-indicator">
          <ion-spinner name="dots"></ion-spinner>
        </div>
        <div class="engagement-metrics-grid">
          <div 
            class="engagement-metric-card clickable" 
            v-if="stats?.totalSkills !== undefined"
            @click="navigateToSkillsList"
          >
            <div class="metric-icon-small">
              <ion-icon :icon="libraryOutline"></ion-icon>
            </div>
            <div class="metric-content-small">
              <div class="metric-value-small">{{ formatNumber(stats.totalSkills) }}</div>
              <div class="metric-label-with-info">
                <span class="metric-label-small">Skills Added to Profiles</span>
                <ion-icon
                  :icon="informationCircleOutline"
                  class="metric-info-icon"
                  :title="metricTooltips.skillsAdded"
                ></ion-icon>
              </div>
            </div>
          </div>
          <div 
            class="engagement-metric-card clickable" 
            v-if="stats?.usersCanMentor !== undefined"
            @click="navigateToMentorList('can')"
          >
            <div class="metric-icon-small">
              <ion-icon :icon="schoolOutline"></ion-icon>
            </div>
            <div class="metric-content-small">
              <div class="metric-value-small">{{ formatNumber(stats.usersCanMentor) }}</div>
              <div class="metric-label-with-info">
                <span class="metric-label-small">Users Available to Mentor</span>
                <ion-icon
                  :icon="informationCircleOutline"
                  class="metric-info-icon"
                  :title="metricTooltips.usersCanMentor"
                ></ion-icon>
              </div>
            </div>
          </div>
          <div 
            class="engagement-metric-card clickable" 
            v-if="stats?.usersWantMentor !== undefined"
            @click="navigateToMentorList('want')"
          >
            <div class="metric-icon-small">
              <ion-icon :icon="bookOutline"></ion-icon>
            </div>
            <div class="metric-content-small">
              <div class="metric-value-small">{{ formatNumber(stats.usersWantMentor) }}</div>
              <div class="metric-label-with-info">
                <span class="metric-label-small">Users Seeking Mentorship</span>
                <ion-icon
                  :icon="informationCircleOutline"
                  class="metric-info-icon"
                  :title="metricTooltips.usersWantMentor"
                ></ion-icon>
              </div>
            </div>
          </div>
        </div>
      </div>


      <!-- Legacy Stats (if available) -->
      <div v-if="stats?.activeUsers || stats?.newUsersThisMonth" class="legacy-stats-section">
        <h3 class="section-subtitle">Additional Statistics</h3>
        <div class="legacy-stats-grid">
          <div class="stat-card" v-if="stats.activeUsers">
            <div class="stat-value">{{ formatNumber(stats.activeUsers) }}</div>
            <div class="stat-label">Active Users</div>
          </div>
          <div class="stat-card" v-if="stats.newUsersThisMonth">
            <div class="stat-value">{{ formatNumber(stats.newUsersThisMonth) }}</div>
            <div class="stat-label">New This Month</div>
          </div>
        </div>
      </div>
    </div>

    <!-- No Stats Available (only shown after loading completes with no data) -->
    <div v-if="!isLoading && !stats && !hasAnyData" class="no-stats">
      <ion-icon :icon="statsChartOutline" class="no-stats-icon"></ion-icon>
      <p>Statistics not available</p>
      <p class="no-stats-hint">This feature requires backend support. The stats endpoint is not currently available.</p>
    </div>

    <!-- Profiles Modal -->
    <ion-modal
      :is-open="isProfileModalOpen"
      @didDismiss="closeProfilesList"
      @willDismiss="closeProfilesList"
      :backdrop-dismiss="true"
    >
      <ion-header>
        <ion-toolbar>
          <ion-title>Profiles</ion-title>
          <ion-buttons slot="end">
            <ion-button fill="clear" @click="closeProfilesList">
              <ion-icon :icon="closeOutline"></ion-icon>
            </ion-button>
          </ion-buttons>
        </ion-toolbar>
      </ion-header>
      <ion-content class="profile-modal-content">
        <div class="profile-modal-controls">
          <ion-searchbar
            v-model="profileSearch"
            placeholder="Search by name"
            inputmode="search"
          ></ion-searchbar>
          <ion-select v-model="profileSort" interface="popover" placeholder="Sort by">
            <ion-select-option value="completion-desc">Completion (High → Low)</ion-select-option>
            <ion-select-option value="completion-asc">Completion (Low → High)</ion-select-option>
            <ion-select-option value="name-asc">Name (A → Z)</ion-select-option>
            <ion-select-option value="name-desc">Name (Z → A)</ion-select-option>
          </ion-select>
        </div>

        <div v-if="isLoadingProfiles" class="loading-state">
          <ion-spinner></ion-spinner>
          <p>Loading profiles...</p>
        </div>

        <div v-else-if="sortedProfiles.length" class="profiles-table">
          <div class="profiles-table-header">
            <div class="col-name sortable" @click="handleHeaderSort('name')">
              User
              <span v-if="getSortIcon('name')" class="sort-icon">{{ getSortIcon('name') }}</span>
            </div>
            <div class="col-completion sortable" @click="handleHeaderSort('completion')">
              Completion
              <span v-if="getSortIcon('completion')" class="sort-icon">{{ getSortIcon('completion') }}</span>
            </div>
          </div>
          <div
            v-for="profile in sortedProfiles"
            :key="profile.id"
            class="profiles-table-row"
          >
            <div class="col-name name-cell">
              <div class="avatar" v-if="profile.profilePicture">
                <img :src="profile.profilePicture" :alt="profile.name" />
              </div>
              <div class="avatar placeholder" v-else>
                {{ profile.name.charAt(0).toUpperCase() }}
              </div>
              <div class="name-meta">
                <div class="name-text">{{ profile.name }}</div>
                <div class="email-text" v-if="profile.email">{{ profile.email }}</div>
              </div>
            </div>
            <div class="col-completion">{{ profile.completion.toFixed(0) }}%</div>
          </div>
        </div>

        <div v-else class="no-stats">
          <ion-icon :icon="statsChartOutline" class="no-stats-icon"></ion-icon>
          <p>No profiles found</p>
        </div>
      </ion-content>
    </ion-modal>

    <!-- Opened Trova Modal -->
    <ion-modal
      :is-open="isOpenedTrovaModalOpen"
      @didDismiss="closeOpenedTrovaList"
      @willDismiss="closeOpenedTrovaList"
      :backdrop-dismiss="true"
    >
      <ion-header>
        <ion-toolbar>
          <ion-title>Trova Opens</ion-title>
          <ion-buttons slot="end">
            <ion-button fill="clear" @click="closeOpenedTrovaList">
              <ion-icon :icon="closeOutline"></ion-icon>
            </ion-button>
          </ion-buttons>
        </ion-toolbar>
      </ion-header>
      <ion-content class="profile-modal-content">
        <div class="profile-modal-controls">
          <ion-searchbar
            v-model="openedTrovaSearch"
            placeholder="Search by name or email"
            inputmode="search"
          ></ion-searchbar>
          <ion-select v-model="openedTrovaSort" interface="popover" placeholder="Sort by">
            <ion-select-option value="opened-desc">Opened (High → Low)</ion-select-option>
            <ion-select-option value="opened-asc">Opened (Low → High)</ion-select-option>
            <ion-select-option value="name-asc">Name (A → Z)</ion-select-option>
            <ion-select-option value="name-desc">Name (Z → A)</ion-select-option>
          </ion-select>
        </div>

        <div v-if="isLoadingOpenedTrova" class="loading-state">
          <ion-spinner></ion-spinner>
          <p>Loading users...</p>
        </div>

        <div v-else-if="sortedOpenedTrovaUsers.length" class="profiles-table">
          <div class="profiles-table-header">
            <div class="col-name sortable" @click="handleOpenedTrovaHeaderSort('name')">
              User
              <span v-if="getOpenedTrovaSortIcon('name')" class="sort-icon">{{ getOpenedTrovaSortIcon('name') }}</span>
            </div>
            <div class="col-completion sortable" @click="handleOpenedTrovaHeaderSort('opened')">
              Times Opened
              <span v-if="getOpenedTrovaSortIcon('opened')" class="sort-icon">{{ getOpenedTrovaSortIcon('opened') }}</span>
            </div>
          </div>
          <div
            v-for="user in sortedOpenedTrovaUsers"
            :key="user.id"
            class="profiles-table-row"
          >
            <div class="col-name name-cell">
              <div class="avatar" v-if="user.profilePicture">
                <img :src="user.profilePicture" :alt="user.name" />
              </div>
              <div class="avatar placeholder" v-else>
                {{ user.name.charAt(0).toUpperCase() }}
              </div>
              <div class="name-meta">
                <div class="name-text">{{ user.name }}</div>
                <div class="email-text" v-if="user.email">{{ user.email }}</div>
              </div>
            </div>
            <div class="col-completion">{{ formatNumber(user.openedCount) }}</div>
          </div>
        </div>

        <div v-else class="no-stats">
          <ion-icon :icon="statsChartOutline" class="no-stats-icon"></ion-icon>
          <p v-if="openedTrovaError">{{ openedTrovaError }}</p>
          <p v-else>No users found</p>
        </div>
      </ion-content>
    </ion-modal>

    <!-- User Onboarding Intros Modal -->
    <ion-modal
      :is-open="isOnboardingIntrosModalOpen"
      @didDismiss="closeOnboardingIntrosList"
      @willDismiss="closeOnboardingIntrosList"
      :backdrop-dismiss="true"
    >
      <ion-header>
        <ion-toolbar>
          <ion-title>Automated Onboarding Introductions</ion-title>
          <ion-buttons slot="end">
            <ion-button fill="clear" @click="closeOnboardingIntrosList">
              <ion-icon :icon="closeOutline"></ion-icon>
            </ion-button>
          </ion-buttons>
        </ion-toolbar>
      </ion-header>
      <ion-content class="profile-modal-content">
        <div class="profile-modal-controls">
          <ion-searchbar
            v-model="onboardingIntrosSearch"
            placeholder="Search by name or email"
            inputmode="search"
          ></ion-searchbar>
        </div>

        <div v-if="isLoadingOnboardingIntros" class="loading-state">
          <ion-spinner></ion-spinner>
          <p>Loading users...</p>
        </div>

        <div v-else-if="sortedOnboardingIntroUsers.length" class="profiles-table onboarding-intros-table">
          <div class="profiles-table-header">
            <div class="col-name">User</div>
            <div class="col-completion onboarding-intro-date">Most Recent Intro</div>
          </div>
          <div
            v-for="user in sortedOnboardingIntroUsers"
            :key="user.id"
            class="profiles-table-row"
          >
            <div class="col-name name-cell">
              <div class="avatar" v-if="user.profilePicture">
                <img :src="user.profilePicture" :alt="user.name" />
              </div>
              <div class="avatar placeholder" v-else>
                {{ user.name.charAt(0).toUpperCase() }}
              </div>
              <div class="name-meta">
                <div class="name-text">{{ user.name }}</div>
                <div class="email-text" v-if="user.email">{{ user.email }}</div>
              </div>
            </div>
            <div class="col-completion onboarding-intro-date">
              <div class="intro-date">{{ formatIntroDate(user.introMessageSentAt) }}</div>
              <div class="intro-time">{{ formatIntroTime(user.introMessageSentAt) }}</div>
            </div>
          </div>
        </div>

        <div v-else class="no-stats">
          <ion-icon :icon="statsChartOutline" class="no-stats-icon"></ion-icon>
          <p v-if="onboardingIntrosError">{{ onboardingIntrosError }}</p>
          <p v-else>No users found</p>
        </div>
      </ion-content>
    </ion-modal>

    <!-- Conversations Started Modal -->
    <ion-modal
      :is-open="isConversationsStartedModalOpen"
      @didDismiss="closeConversationsStartedList"
      @willDismiss="closeConversationsStartedList"
      :backdrop-dismiss="true"
    >
      <ion-header>
        <ion-toolbar>
          <ion-title>Messages Exchanged by Match Type</ion-title>
          <ion-buttons slot="end">
            <ion-button fill="clear" @click="closeConversationsStartedList">
              <ion-icon :icon="closeOutline"></ion-icon>
            </ion-button>
          </ion-buttons>
        </ion-toolbar>
      </ion-header>
      <ion-content class="profile-modal-content">
        <div class="profile-modal-controls">
          <ion-searchbar
            v-model="conversationsStartedSearch"
            placeholder="Search by participants or channel ID"
            inputmode="search"
          ></ion-searchbar>
        </div>

        <div v-if="isLoadingConversationsStarted" class="loading-state">
          <ion-spinner></ion-spinner>
          <p>Loading conversations...</p>
        </div>

        <div v-else-if="sortedConversationsStarted.length" class="profiles-table conversations-started-table">
          <div class="profiles-table-header">
            <div class="col-name sortable" @click="handleConversationsStartedSort('type')">
              Match Type
              <span v-if="getConversationsStartedSortIcon('type')" class="sort-icon">{{ getConversationsStartedSortIcon('type') }}</span>
            </div>
            <div class="col-participants">Participants</div>
            <div class="col-date sortable" @click="handleConversationsStartedSort('date')">
              Date
              <span v-if="getConversationsStartedSortIcon('date')" class="sort-icon">{{ getConversationsStartedSortIcon('date') }}</span>
            </div>
            <div class="col-messages sortable" @click="handleConversationsStartedSort('messages')">
              Messages
              <span v-if="getConversationsStartedSortIcon('messages')" class="sort-icon">{{ getConversationsStartedSortIcon('messages') }}</span>
            </div>
          </div>
          <div
            v-for="conv in sortedConversationsStarted"
            :key="conv.channelId"
            class="profiles-table-row"
          >
            <div class="col-name">
              <div class="name-text">{{ formatConversationType(conv.conversationType) }}</div>
            </div>
            <div class="col-participants">{{ conv.participants || '—' }}</div>
            <div class="col-date onboarding-intro-date">
              <div class="intro-date">{{ formatIntroDate(conv.createdAt) }}</div>
              <div class="intro-time">{{ formatIntroTime(conv.createdAt) }}</div>
            </div>
            <div class="col-messages">{{ formatNumber(conv.messageCount) }}</div>
          </div>
        </div>

        <div v-else class="no-stats">
          <ion-icon :icon="statsChartOutline" class="no-stats-icon"></ion-icon>
          <p v-if="conversationsStartedError">{{ conversationsStartedError }}</p>
          <p v-else>No conversations found</p>
        </div>
      </ion-content>
    </ion-modal>

    <!-- Self-Introduced Users Modal -->
    <ion-modal
      :is-open="isSelfIntroducedModalOpen"
      @didDismiss="closeSelfIntroducedList"
      @willDismiss="closeSelfIntroducedList"
      :backdrop-dismiss="true"
    >
      <ion-header>
        <ion-toolbar>
          <ion-title>Self-Introductions Posted</ion-title>
          <ion-buttons slot="end">
            <ion-button fill="clear" @click="closeSelfIntroducedList">
              <ion-icon :icon="closeOutline"></ion-icon>
            </ion-button>
          </ion-buttons>
        </ion-toolbar>
      </ion-header>
      <ion-content class="profile-modal-content">
        <div class="profile-modal-controls">
          <ion-searchbar
            v-model="selfIntroducedSearch"
            placeholder="Search by name or email"
            inputmode="search"
          ></ion-searchbar>
        </div>

        <div v-if="isLoadingSelfIntroduced" class="loading-state">
          <ion-spinner></ion-spinner>
          <p>Loading users...</p>
        </div>

        <div v-else-if="sortedSelfIntroducedUsers.length" class="profiles-table self-introduced-table">
          <div class="profiles-table-header">
            <div class="col-name sortable" @click="handleSelfIntroducedSort('name')">
              User
              <span v-if="getSelfIntroducedSortIcon('name')" class="sort-icon">{{ getSelfIntroducedSortIcon('name') }}</span>
            </div>
            <div class="col-date sortable" @click="handleSelfIntroducedSort('date')">
              Introduced At
              <span v-if="getSelfIntroducedSortIcon('date')" class="sort-icon">{{ getSelfIntroducedSortIcon('date') }}</span>
            </div>
            <div class="col-channel sortable" @click="handleSelfIntroducedSort('channel')">
              Channel
              <span v-if="getSelfIntroducedSortIcon('channel')" class="sort-icon">{{ getSelfIntroducedSortIcon('channel') }}</span>
            </div>
          </div>
          <div
            v-for="user in sortedSelfIntroducedUsers"
            :key="user.id"
            class="profiles-table-row"
          >
            <div class="col-name name-cell">
              <div class="avatar" v-if="user.profilePicture">
                <img :src="user.profilePicture" :alt="user.name" />
              </div>
              <div class="avatar placeholder" v-else>
                {{ user.name.charAt(0).toUpperCase() }}
              </div>
              <div class="name-meta">
                <div class="name-text">{{ user.name }}</div>
                <div class="email-text" v-if="user.email">{{ user.email }}</div>
              </div>
            </div>
            <div class="col-date onboarding-intro-date">
              <div class="intro-date">{{ formatIntroDate(user.introducedAt) }}</div>
              <div class="intro-time">{{ formatIntroTime(user.introducedAt) }}</div>
            </div>
            <div class="col-channel">
              {{ user.channelName || user.channelId || 'Unknown Channel' }}
            </div>
          </div>
        </div>

        <div v-else class="no-stats">
          <ion-icon :icon="statsChartOutline" class="no-stats-icon"></ion-icon>
          <p v-if="selfIntroducedError">{{ selfIntroducedError }}</p>
          <p v-else>No users found</p>
        </div>
      </ion-content>
    </ion-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { useRouter } from 'vue-router';
import { adminService, type UserStats, type ConversationStarted, type SelfIntroducedUserRow } from '@/services/admin.service';
import { profileService, type ProfilesInit } from '@/services/profile.service';
import { toastController } from '@ionic/vue';
import { fetchMagicIntroSummary } from '@/services/magic-intro.service';
import type { MagicIntroSummary, DateRange } from '@/types/magic-intros';
import {
  IonButton,
  IonIcon,
  IonItem,
  IonLabel,
  IonSelect,
  IonSelectOption,
  IonSpinner,
  IonModal,
  IonSearchbar,
  IonContent,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonButtons,
} from '@ionic/vue';
import {
  downloadOutline,
  statsChartOutline,
  personOutline,
  peopleOutline,
  chatbubblesOutline,
  checkmarkCircleOutline,
  thumbsUpOutline,
  trendingUpOutline,
  trendingDownOutline,
  openOutline,
  starOutline,
  flashOutline,
  sparklesOutline,
  linkOutline,
  libraryOutline,
  schoolOutline,
  bookOutline,
  checkmarkDoneOutline,
  closeOutline,
  informationCircleOutline,
} from 'ionicons/icons';

interface Props {
  communityId: number | null;
  communityName?: string | null;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  openMagicIntros: [startDate?: string, endDate?: string];
  openChannelPairings: [startDate?: string, endDate?: string];
  openMentorMenteeMatches: [startDate?: string, endDate?: string];
  openConnections: [startDate?: string, endDate?: string];
  openSkills: [];
  openMentorList: [type: 'can' | 'want'];
}>();

const router = useRouter();
const isLoading = ref(false);
const isLoadingPrimary = ref(true);
const isLoadingActions = ref(true);
const isLoadingEngagement = ref(true);
const isLoadingSkills = ref(true);
const isLoadingProfileCompletion = ref(true);
const stats = ref<Partial<UserStats> | null>(null);
const magicIntroSummary = ref<MagicIntroSummary | null>(null);
const isLoadingMagicIntroSummary = ref(false);
const magicIntroSummaryError = ref<string | null>(null);
const skillsStats = ref<Array<{ name: string; count: number }>>([]);
const isSlackCommunity = ref(false); // TODO: Determine from community data
const selectedPeriod = ref<'all-time' | '2-years' | '18-months' | '12-months' | '6-months' | '3-months' | '1-month'>('3-months'); // Default to past 3 months for faster load
const isProfileModalOpen = ref(false);
const isLoadingProfiles = ref(false);
const profileRows = ref<Array<{
  id: number;
  name: string;
  email?: string;
  profilePicture?: string;
  score: number;
  completion: number;
}>>([]);
const profileSearch = ref('');
const profileSort = ref<'completion-desc' | 'completion-asc' | 'name-asc' | 'name-desc'>('completion-desc');

const isOpenedTrovaModalOpen = ref(false);
const isLoadingOpenedTrova = ref(false);
const openedTrovaError = ref<string | null>(null);
const openedTrovaRows = ref<Array<{
  id: number;
  name: string;
  email?: string;
  profilePicture?: string;
  openedCount: number;
}>>([]);
const openedTrovaSearch = ref('');
const openedTrovaSort = ref<'opened-desc' | 'opened-asc' | 'name-asc' | 'name-desc'>('opened-desc');

const isOnboardingIntrosModalOpen = ref(false);
const isLoadingOnboardingIntros = ref(false);
const onboardingIntrosError = ref<string | null>(null);
const onboardingIntroRows = ref<Array<{
  id: number;
  name: string;
  email?: string;
  profilePicture?: string;
  introMessageSentAt?: string;
}>>([]);
const onboardingIntrosSearch = ref('');

const isSelfIntroducedModalOpen = ref(false);
const isLoadingSelfIntroduced = ref(false);
const selfIntroducedError = ref<string | null>(null);
const selfIntroducedRows = ref<SelfIntroducedUserRow[]>([]);
const selfIntroducedSearch = ref('');
const selfIntroducedSort = ref<'date-desc' | 'date-asc' | 'name-asc' | 'name-desc' | 'channel-asc' | 'channel-desc'>('date-desc');

const isConversationsStartedModalOpen = ref(false);
const isLoadingConversationsStarted = ref(false);
const conversationsStartedError = ref<string | null>(null);
const conversationsStartedRows = ref<Array<{
  conversationType: 'magic_intro' | 'channel_pairing' | 'mentor_match';
  channelId: string;
  createdAt: string;
  messageCount: number;
  participants: string;
}>>([]);
const conversationsStartedSearch = ref('');
const conversationsStartedSort = ref<'date-desc' | 'date-asc' | 'type-asc' | 'type-desc' | 'messages-desc' | 'messages-asc'>('date-desc');

const hasAnyData = computed(() => {
  if (!stats.value) return false;
  return !!(
    stats.value.profilesCreated ||
    stats.value.connectionsMade ||
    stats.value.trovaChatsStarted ||
    stats.value.totalMessagesSent ||
    stats.value.eventsCreated ||
    stats.value.eventsAttended ||
    stats.value.groupsCreated ||
    stats.value.groupsJoined ||
    stats.value.dailyActiveUsers ||
    stats.value.weeklyActiveUsers ||
    stats.value.profileCompletionRate ||
    stats.value.matchResponseRate ||
    stats.value.totalUsers ||
    stats.value.activeUsers ||
    stats.value.newUsersThisMonth
  );
});

const hasUserActionsData = computed(() => {
  if (!stats.value) return false;
  return !!(
    stats.value.openedTrova !== undefined ||
    stats.value.profileScore !== undefined ||
    stats.value.spotlightsCreated !== undefined ||
    stats.value.recWallsGiven !== undefined ||
    stats.value.recWallsReceived !== undefined ||
    (stats.value.userOnboardingIntros !== undefined && stats.value.userOnboardingIntros > 0) ||
    stats.value.selfIntroduced !== undefined
  );
});

const hasEngagementAttributionData = computed(() => {
  if (!stats.value) return false;
  return !!(
    stats.value.trovaMagicEngagements !== undefined ||
    stats.value.trovaMagicMatches !== undefined ||
    stats.value.channelPairingEngagements !== undefined ||
    stats.value.mentorMenteeEngagements !== undefined ||
    stats.value.mentorMenteeMatches !== undefined ||
    stats.value.channelPairingMatches !== undefined ||
    stats.value.channelPairingOnDemand !== undefined ||
    stats.value.channelPairingCadence !== undefined
  );
});

const magicIntroDateRange = computed<DateRange | undefined>(() => {
  const { start, end } = getDateRangeForPeriod(selectedPeriod.value);
  if (!start || !end) {
    return undefined;
  }
  // Backend accepts YYYY-MM-DD; truncate any time component if present.
  const startDate = start.split('T')[0];
  const endDate = end.split('T')[0];
  return { startDate, endDate };
});

const hasSkillsData = computed(() => {
  if (!stats.value) return false;
  return !!(
    stats.value.totalSkills !== undefined ||
    stats.value.usersCanMentor !== undefined ||
    stats.value.usersWantMentor !== undefined
  );
});


const hasChannelPairingData = computed(() => {
  if (!stats.value) return false;
  return !!(
    stats.value.channelPairingGroups !== undefined ||
    stats.value.channelPairingUsers !== undefined
  );
});

const metricTooltips: Record<string, string> = {
  profileCompletion:
    'Share of users with key profile fields filled in (bio, interests, location, photo, etc.). Calculated from profile data for the selected time period.',
  introductionsCreated:
    'Unique introduction groups created (Trova Magic, Channel Pairing, Mentor/Mentee) in the selected time period. Groups are de-duplicated so the same set of people only counts once.',
  messagesExchanged:
    'Total messages sent across all Trova conversations (Magic Intros, Channel Pairings, Mentor Matches) in the selected time period, based on the conversations-started endpoint.',
  trovaOpens:
    'Total times users opened the Trova home experience in the selected time period, aggregated from the slack-user-stats “homepage views / Trova opens” column.',
  avgProfileScore:
    'Average profile completeness score across users (0–100), based on how many core profile fields each user has filled out.',
  onboardingIntros:
    'Automated welcome introductions sent to new users via the Weekly Introductions workflow during the selected time period.',
  selfIntroductions:
    'Number of self-introduction posts (intro messages users wrote about themselves) created in the selected time period.',
  magicIntros:
    'Magic Intro groups that led to at least one conversation vs. total Magic Intro groups created in the selected time period.',
  channelPairings:
    'Channel pairing groups (2–5 people) that had an engaged conversation (2+ members sending messages) vs. total channel pairing groups created.',
  mentorMatches:
    'Unique mentor/mentee pairs vs. total mentor sessions created in the selected time period.',
  skillsAdded:
    'Distinct skills that have been added to at least one profile in this community.',
  usersCanMentor:
    'Users who have indicated they are available to mentor, based on profile and skills settings.',
  usersWantMentor:
    'Users who have indicated they are seeking mentorship, based on profile and skills settings.',
};

function formatNumber(value: number | undefined | null, decimals: number = 0): string {
  if (value === undefined || value === null) return '0';
  if (decimals > 0) {
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(value);
  }
  return new Intl.NumberFormat('en-US').format(value);
}

function formatPercentage(value: number | undefined | null): string {
  if (value === undefined || value === null) return 'N/A';
  return `${value.toFixed(1)}%`;
}

function getTrendClass(trend: number): string {
  return trend > 0 ? 'trend-up' : trend < 0 ? 'trend-down' : 'trend-neutral';
}

function normalizeName(profile: ProfilesInit): string {
  return (
    profile.fullName ||
    [profile.fname, profile.lname].filter(Boolean).join(' ') ||
    'Unknown User'
  );
}

function getProfileScore(profile: ProfilesInit, completion: number): number {
  const possible = [
    (profile as any).profileScore,
    (profile as any).profile_score,
    (profile as any).score,
  ].find((val) => typeof val === 'number' && !isNaN(val));
  return typeof possible === 'number' ? possible : completion;
}

function calculateProfileCompletion(profile: ProfilesInit): number {
  const checks = [
    !!profile.bio && profile.bio.trim().length > 0,
    Array.isArray(profile.interests) && profile.interests.length > 0,
    Array.isArray(profile.locations) && profile.locations.length > 0,
    !!profile.currentLocationName && profile.currentLocationName.trim().length > 0,
    !!profile.profilePicture,
    !!profile.jobTitle,
    !!profile.currentEmployer,
  ];
  const filled = checks.filter(Boolean).length;
  const total = checks.length || 1;
  return (filled / total) * 100;
}

async function loadProfiles() {
  if (!props.communityId) {
    profileRows.value = [];
    return;
  }
  
  isLoadingProfiles.value = true;
  // Clear existing data immediately when loading new community
  profileRows.value = [];
  
  try {
    // Use slack-user-stats endpoint to get profile_completion_percent from slack_user table
    const result = await adminService.getSlackUserStats(props.communityId);
    
    // Find the profile completion column from columns array if available
    let completionColumnProp: string | null = null;
    if (result.columns && Array.isArray(result.columns)) {
      const completionColumn = result.columns.find((col: any) => 
        col.name === 'Profile Score' || 
        col.name === 'Profile Completion' ||
        col.prop === 'profileCompletionScore' ||
        col.prop === 'profile_completion_percent' ||
        col.prop === 'profileCompletionPercent'
      );
      if (completionColumn) {
        completionColumnProp = completionColumn.prop || completionColumn.name;
      }
    }
    
    // If no rows returned, try fallback to get profiles from profile service
    if (!result.rows || result.rows.length === 0) {
      try {
        const { profileService } = await import('@/services/profile.service');
        const profiles = await profileService.getProfilesForUserAndCommunity(props.communityId);
        profileRows.value = profiles.map((profile: any) => {
          // Calculate completion from profile fields
          const hasFname = !!profile.fname;
          const hasLname = !!profile.lname;
          const hasBio = !!profile.bio;
          const hasLocation = !!(profile.currentLat && profile.currentLong);
          const hasInterests = !!(profile.interests && profile.interests.length > 0);
          const hasPhoto = !!profile.profilePicture;
          
          const completedFields = [hasFname, hasLname, hasBio, hasLocation, hasInterests, hasPhoto].filter(Boolean).length;
          const completion = Math.round((completedFields / 6) * 100);
          
          return {
            id: profile.userId || profile.id,
            name: `${profile.fname || ''} ${profile.lname || ''}`.trim() || 'Unknown User',
            email: profile.email,
            profilePicture: profile.profilePicture,
            score: completion,
            completion: completion,
          };
        });
        return;
      } catch (fallbackError) {
        console.error('[UserStatsSection] Fallback profile load failed:', fallbackError);
        profileRows.value = [];
        return;
      }
    }
    
    profileRows.value = (result.rows || []).map((row: any) => {
      // Get profile_completion_percent from slack_user table (may be in different field names)
      // The database stores it as a decimal (0.3455 = 34.55%), so we need to check both decimal and percentage formats
      let completion = 0;
      
      // Try using the column prop if we found it
      if (completionColumnProp && row[completionColumnProp] !== undefined) {
        completion = row[completionColumnProp];
      } else {
        // Fallback to checking common field names
        completion = 
          row.profile_completion_percent ?? 
          row.profileCompletionPercent ?? 
          row.profile_completion_percent_proposed ??
          row.profileCompletionPercentProposed ??
          row.profileCompletionScore ?? // fallback to profileCompletionScore if available
          row['Profile Completion'] ?? // Check column name format
          row['Profile Score'] ?? // Check if it's in Profile Score column
          0;
      }
      
      // If completion is a decimal (0-1 range), convert to percentage (0-100)
      // If it's already a percentage (0-100), use as-is
      if (typeof completion === 'number' && !isNaN(completion)) {
        if (completion > 0 && completion <= 1) {
          // It's a decimal, convert to percentage
          completion = completion * 100;
        }
        // If it's already > 1, assume it's already a percentage
      } else {
        completion = 0;
      }
      
      return {
        id: row.userId || row.user_id || row.id,
        name: row.name || 'Unknown User',
        email: row.email,
        profilePicture: row.profilePicture || row.profile_picture,
        score: completion, // Use completion as score since we removed profile score column
        completion: completion,
      };
    });
  } catch (error) {
    console.error('[UserStatsSection] Failed to load profiles:', error);
    profileRows.value = [];
  } finally {
    isLoadingProfiles.value = false;
  }
}

const sortedProfiles = computed(() => {
  const term = profileSearch.value.trim().toLowerCase();
  let rows = profileRows.value;
  if (term) {
    rows = rows.filter((p) => p.name.toLowerCase().includes(term));
  }

  const sorter = profileSort.value;
  const sorted = [...rows];
  sorted.sort((a, b) => {
    switch (sorter) {
      case 'completion-asc':
        return a.completion - b.completion;
      case 'completion-desc':
        return b.completion - a.completion;
      case 'name-desc':
        return b.name.localeCompare(a.name);
      case 'name-asc':
      default:
        return a.name.localeCompare(b.name);
    }
  });
  return sorted;
});

function handleHeaderSort(column: 'name' | 'completion') {
  const currentSort = profileSort.value;
  if (column === 'name') {
    // Toggle between name-asc and name-desc
    profileSort.value = currentSort === 'name-asc' ? 'name-desc' : 'name-asc';
  } else if (column === 'completion') {
    // Toggle between completion-asc and completion-desc
    profileSort.value = currentSort === 'completion-desc' ? 'completion-asc' : 'completion-desc';
  }
}

function getSortIcon(column: 'name' | 'completion'): string | null {
  const currentSort = profileSort.value;
  if (column === 'name') {
    if (currentSort === 'name-asc') return '↑';
    if (currentSort === 'name-desc') return '↓';
  } else if (column === 'completion') {
    if (currentSort === 'completion-asc') return '↑';
    if (currentSort === 'completion-desc') return '↓';
  }
  return null;
}

function openProfilesList() {
  if (!props.communityId) return;
  isProfileModalOpen.value = true;
  if (!profileRows.value.length) {
    loadProfiles();
  }
}

function closeProfilesList() {
  isProfileModalOpen.value = false;
}

async function loadOpenedTrovaUsers() {
  if (!props.communityId) return;
  isLoadingOpenedTrova.value = true;
  openedTrovaError.value = null;
  try {
    // Get date range for the selected period
    const { start, end } = getDateRangeForPeriod(selectedPeriod.value);
    
    // Use slack-user-stats endpoint to get homepageViews/openedTrova data
    const result = await adminService.getSlackUserStats(
      props.communityId,
      start,
      end
    );
    
    // Check if there was an error
    if (result.error) {
      openedTrovaError.value = result.error;
      openedTrovaRows.value = [];
      return;
    }
    
    // Check if we got an empty result
    if (!result || (!result.rows || result.rows.length === 0)) {
      openedTrovaRows.value = [];
      return;
    }
    
    // Find the homepageViews column from columns array if available
    let homepageViewsProp: string | null = null;
    if (result.columns && Array.isArray(result.columns)) {
      const homepageViewsColumn = result.columns.find((col: any) => 
        col.name === 'Homepage Views' || 
        col.name === 'Trova Opens' ||
        col.prop === 'homepageViews' ||
        col.prop === 'openedTrova' ||
        col.prop === 'opened_trova'
      );
      if (homepageViewsColumn) {
        homepageViewsProp = homepageViewsColumn.prop || homepageViewsColumn.name;
      }
    }
    
    openedTrovaRows.value = (result.rows || [])
      .map((row: any) => {
        // Try using the column prop if we found it
        let openedCount = 0;
        if (homepageViewsProp && row[homepageViewsProp] !== undefined) {
          openedCount = row[homepageViewsProp];
        } else {
          // Fallback to checking common field names
          openedCount = 
            row.homepageViews ?? 
            row.openedTrova ?? 
            row.opened_trova ?? 
            row['Trova Opens'] ??
            row['Homepage Views'] ??
            row['homepageViews'] ??
            (typeof row.homepageViews === 'string' ? parseInt(row.homepageViews) : null) ??
            0;
        }
        
        // Convert to number if needed
        if (typeof openedCount === 'string') {
          openedCount = parseInt(openedCount) || 0;
        }
        if (typeof openedCount !== 'number' || isNaN(openedCount)) {
          openedCount = 0;
        }
        
        return {
          id: row.userId || row.user_id || row.id || `user-${row.name || 'unknown'}`,
          name: row.name || 'Unknown User',
          email: row.email,
          profilePicture: row.profilePicture || row.profile_picture,
          openedCount: openedCount,
        };
      })
      .filter((user: any) => {
        // Only include users who have opened Trova at least once
        return user.openedCount > 0;
      });

    // Sync aggregate on the main card from the same data so "Trova Opens" matches the drill-down
    const totalOpened = openedTrovaRows.value.reduce((sum, r) => sum + r.openedCount, 0);
    if (totalOpened > 0 && stats.value) {
      stats.value.openedTrova = totalOpened;
    }
  } catch (error: any) {
    console.error('[UserStatsSection] Failed to load opened Trova users:', error);
    openedTrovaError.value = error?.message || 'Failed to load user data. Please try again later.';
    openedTrovaRows.value = [];
  } finally {
    isLoadingOpenedTrova.value = false;
  }
}

const sortedOpenedTrovaUsers = computed(() => {
  const term = openedTrovaSearch.value.trim().toLowerCase();
  let rows = openedTrovaRows.value;
  if (term) {
    rows = rows.filter((p) => p.name.toLowerCase().includes(term) || p.email?.toLowerCase().includes(term));
  }

  const sorter = openedTrovaSort.value;
  const sorted = [...rows];
  sorted.sort((a, b) => {
    switch (sorter) {
      case 'opened-asc':
        return a.openedCount - b.openedCount;
      case 'opened-desc':
        return b.openedCount - a.openedCount;
      case 'name-desc':
        return b.name.localeCompare(a.name);
      case 'name-asc':
      default:
        return a.name.localeCompare(b.name);
    }
  });
  return sorted;
});

function handleOpenedTrovaHeaderSort(column: 'name' | 'opened') {
  const currentSort = openedTrovaSort.value;
  if (column === 'name') {
    openedTrovaSort.value = currentSort === 'name-asc' ? 'name-desc' : 'name-asc';
  } else if (column === 'opened') {
    openedTrovaSort.value = currentSort === 'opened-desc' ? 'opened-asc' : 'opened-desc';
  }
}

function getOpenedTrovaSortIcon(column: 'name' | 'opened'): string | null {
  const currentSort = openedTrovaSort.value;
  if (column === 'name') {
    if (currentSort === 'name-asc') return '↑';
    if (currentSort === 'name-desc') return '↓';
  } else if (column === 'opened') {
    if (currentSort === 'opened-asc') return '↑';
    if (currentSort === 'opened-desc') return '↓';
  }
  return null;
}

function openOpenedTrovaList() {
  if (!props.communityId) return;
  isOpenedTrovaModalOpen.value = true;
  if (!openedTrovaRows.value.length) {
    loadOpenedTrovaUsers();
  }
}

function closeOpenedTrovaList() {
  isOpenedTrovaModalOpen.value = false;
}

function openOnboardingIntrosList() {
  if (!props.communityId) return;
  isOnboardingIntrosModalOpen.value = true;
  if (!onboardingIntroRows.value.length) {
    loadOnboardingIntroUsers();
  }
}

function closeOnboardingIntrosList() {
  isOnboardingIntrosModalOpen.value = false;
}

function openSelfIntroducedList() {
  if (!props.communityId) return;
  isSelfIntroducedModalOpen.value = true;
  // Always reload to respect current time period filter
  loadSelfIntroducedUsers();
}

function closeSelfIntroducedList() {
  isSelfIntroducedModalOpen.value = false;
}

async function loadSelfIntroducedUsers() {
  if (!props.communityId) return;
  isLoadingSelfIntroduced.value = true;
  selfIntroducedError.value = null;
  try {
    let { start, end } = getDateRangeForPeriod(selectedPeriod.value);
    
    // Backend requires startDate and endDate, so use a wide range for 'all-time'
    if (!start || !end) {
      // Use 10 years ago to now for 'all-time' period
      const now = new Date();
      const tenYearsAgo = new Date(now.getFullYear() - 10, 0, 1);
      start = tenYearsAgo.toISOString();
      end = now.toISOString();
    }
    
    const rows = await adminService.getSelfIntroducedUsers(props.communityId, start, end);

    if (rows === null) {
      selfIntroducedError.value = 'This feature requires backend support. The self-introduced/users endpoint may not be available or returned an error.';
      selfIntroducedRows.value = [];
      return;
    }

    if (rows.length === 0) {
      selfIntroducedError.value = null; // Clear error if we got empty array (valid response)
      selfIntroducedRows.value = [];
      return;
    }

    selfIntroducedRows.value = rows;
    
    // Update the stat count to match the actual number of users fetched
    // This ensures consistency between the stat card and the modal
    if (rows.length > 0 && stats.value) {
      const actualCount = rows.length;
      if (stats.value.selfIntroduced !== actualCount) {
        stats.value.selfIntroduced = actualCount;
      }
    }
  } catch (error: any) {
    console.error('[UserStatsSection] Failed to load self-introduced users:', error);
    const status = error?.status || error?.response?.status;
    if (status === 500) {
      selfIntroducedError.value = 'Server error: The backend endpoint returned a 500 error. Please check backend logs or contact support.';
    } else if (status === 400) {
      selfIntroducedError.value = 'Invalid request: Please check date parameters.';
    } else {
      selfIntroducedError.value = error?.message || 'Failed to load user data. Please try again later.';
    }
    selfIntroducedRows.value = [];
  } finally {
    isLoadingSelfIntroduced.value = false;
  }
}

function formatIntroDate(value?: string): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  // Format: M/D/YYYY
  return d.toLocaleDateString('en-US', {
    month: 'numeric',
    day: 'numeric',
    year: 'numeric'
  });
}

function formatIntroTime(value?: string): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  // Format: H:MM AM/PM (no seconds)
  return d.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
}

function formatConversationType(type: 'magic_intro' | 'channel_pairing' | 'mentor_match'): string {
  switch (type) {
    case 'magic_intro':
      return 'Trova Magic';
    case 'channel_pairing':
      return 'Channel Pairing';
    case 'mentor_match':
      return 'Mentor Match';
    default:
      return type;
  }
}

function openConversationsStartedList() {
  if (!props.communityId) return;
  isConversationsStartedModalOpen.value = true;
  // Always reload to respect current time period filter
  loadConversationsStarted();
}

function closeConversationsStartedList() {
  isConversationsStartedModalOpen.value = false;
}

async function loadConversationsStarted() {
  if (!props.communityId) return;
  isLoadingConversationsStarted.value = true;
  conversationsStartedError.value = null;
  try {
    const { start, end } = getDateRangeForPeriod(selectedPeriod.value);
    
    // For 'all-time', start and end will be undefined, which the API accepts
    const response = await adminService.getConversationsStarted(props.communityId, start, end);

    if (response === null) {
      conversationsStartedError.value = 'This feature requires backend support. The conversations-started endpoint may not be available or returned an error.';
      conversationsStartedRows.value = [];
      return;
    }

    if (!response.conversations || response.conversations.length === 0) {
      conversationsStartedError.value = null; // Clear error if we got empty array (valid response)
      conversationsStartedRows.value = [];
      return;
    }

    conversationsStartedRows.value = response.conversations.map((conv) => ({
      conversationType: conv.conversationType,
      channelId: conv.channelId,
      createdAt: conv.createdAt,
      messageCount: conv.messageCount,
      participants: conv.participants || '—',
    }));
  } catch (error: any) {
    console.error('[UserStatsSection] Failed to load conversations started:', error);
    const status = error?.status || error?.response?.status;
    if (status === 500) {
      conversationsStartedError.value = 'Server error: The backend endpoint returned a 500 error. Please check backend logs or contact support.';
    } else if (status === 400) {
      conversationsStartedError.value = 'Invalid request: Please check date parameters.';
    } else {
      conversationsStartedError.value = error?.message || 'Failed to load conversation data. Please try again later.';
    }
    conversationsStartedRows.value = [];
  } finally {
    isLoadingConversationsStarted.value = false;
  }
}

const sortedConversationsStarted = computed(() => {
  const term = conversationsStartedSearch.value.trim().toLowerCase();
  let rows = conversationsStartedRows.value;
  if (term) {
    rows = rows.filter((conv) => {
      const participants = (conv.participants || '').toLowerCase();
      const channelId = (conv.channelId || '').toLowerCase();
      const type = formatConversationType(conv.conversationType).toLowerCase();
      return participants.includes(term) || channelId.includes(term) || type.includes(term);
    });
  }

  // Apply sorting based on conversationsStartedSort
  const sorted = [...rows];
  const sort = conversationsStartedSort.value;
  
  sorted.sort((a, b) => {
    if (sort === 'date-desc') {
      const at = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bt = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return bt - at;
    } else if (sort === 'date-asc') {
      const at = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bt = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return at - bt;
    } else if (sort === 'type-asc') {
      const aType = formatConversationType(a.conversationType);
      const bType = formatConversationType(b.conversationType);
      return aType.localeCompare(bType);
    } else if (sort === 'type-desc') {
      const aType = formatConversationType(a.conversationType);
      const bType = formatConversationType(b.conversationType);
      return bType.localeCompare(aType);
    } else if (sort === 'messages-desc') {
      return b.messageCount - a.messageCount;
    } else if (sort === 'messages-asc') {
      return a.messageCount - b.messageCount;
    }
    return 0;
  });
  
  return sorted;
});

function handleConversationsStartedSort(column: 'type' | 'date' | 'messages') {
  const currentSort = conversationsStartedSort.value;
  if (column === 'type') {
    conversationsStartedSort.value = currentSort === 'type-asc' ? 'type-desc' : 'type-asc';
  } else if (column === 'date') {
    conversationsStartedSort.value = currentSort === 'date-desc' ? 'date-asc' : 'date-desc';
  } else if (column === 'messages') {
    conversationsStartedSort.value = currentSort === 'messages-desc' ? 'messages-asc' : 'messages-desc';
  }
}

function getConversationsStartedSortIcon(column: 'type' | 'date' | 'messages'): string | null {
  const currentSort = conversationsStartedSort.value;
  if (column === 'type') {
    if (currentSort === 'type-asc') return '↑';
    if (currentSort === 'type-desc') return '↓';
  } else if (column === 'date') {
    if (currentSort === 'date-asc') return '↑';
    if (currentSort === 'date-desc') return '↓';
  } else if (column === 'messages') {
    if (currentSort === 'messages-asc') return '↑';
    if (currentSort === 'messages-desc') return '↓';
  }
  return null;
}

async function loadOnboardingIntroUsers() {
  if (!props.communityId) return;
  isLoadingOnboardingIntros.value = true;
  onboardingIntrosError.value = null;
  try {
    let { start, end } = getDateRangeForPeriod(selectedPeriod.value);
    
    // Backend requires startDate and endDate, so use a wide range for 'all-time'
    if (!start || !end) {
      // Use 10 years ago to now for 'all-time' period
      const now = new Date();
      const tenYearsAgo = new Date(now.getFullYear() - 10, 0, 1);
      start = tenYearsAgo.toISOString();
      end = now.toISOString();
    }
    
    const rows = await adminService.getWeeklyIntroductionsUsers(props.communityId, start, end);

    if (rows === null) {
      onboardingIntrosError.value = 'This feature requires backend support. The weekly-introductions/users endpoint may not be available or returned an error.';
      onboardingIntroRows.value = [];
      return;
    }

    if (rows.length === 0) {
      onboardingIntrosError.value = null; // Clear error if we got empty array (valid response)
      onboardingIntroRows.value = [];
      return;
    }

    onboardingIntroRows.value = rows.map((r: any) => ({
      id: r.id,
      name: r.name || 'Unknown User',
      email: r.email,
      profilePicture: r.profilePicture,
      introMessageSentAt: r.introMessageSentAt,
    }));
  } catch (error: any) {
    console.error('[UserStatsSection] Failed to load onboarding intro users:', error);
    const status = error?.status || error?.response?.status;
    if (status === 500) {
      onboardingIntrosError.value = 'Server error: The backend endpoint returned a 500 error. Please check backend logs or contact support.';
    } else if (status === 400) {
      onboardingIntrosError.value = 'Invalid request: Please check date parameters.';
    } else {
      onboardingIntrosError.value = error?.message || 'Failed to load user data. Please try again later.';
    }
    onboardingIntroRows.value = [];
  } finally {
    isLoadingOnboardingIntros.value = false;
  }
}

const sortedOnboardingIntroUsers = computed(() => {
  const term = onboardingIntrosSearch.value.trim().toLowerCase();
  let rows = onboardingIntroRows.value;
  if (term) {
    rows = rows.filter((u) => {
      const name = (u.name || '').toLowerCase();
      const email = (u.email || '').toLowerCase();
      return name.includes(term) || email.includes(term);
    });
  }

  const sorted = [...rows];
  sorted.sort((a, b) => {
    const at = a.introMessageSentAt ? new Date(a.introMessageSentAt).getTime() : 0;
    const bt = b.introMessageSentAt ? new Date(b.introMessageSentAt).getTime() : 0;
    return bt - at; // most recent first
  });
  return sorted;
});

const sortedSelfIntroducedUsers = computed(() => {
  const term = selfIntroducedSearch.value.trim().toLowerCase();
  let rows = selfIntroducedRows.value;
  if (term) {
    rows = rows.filter((u) => {
      const name = (u.name || '').toLowerCase();
      const email = (u.email || '').toLowerCase();
      const channel = ((u.channelName || u.channelId || '') || '').toLowerCase();
      return name.includes(term) || email.includes(term) || channel.includes(term);
    });
  }

  const sorted = [...rows];
  const sort = selfIntroducedSort.value;
  
  sorted.sort((a, b) => {
    if (sort === 'date-desc') {
      const at = a.introducedAt ? new Date(a.introducedAt).getTime() : 0;
      const bt = b.introducedAt ? new Date(b.introducedAt).getTime() : 0;
      return bt - at;
    } else if (sort === 'date-asc') {
      const at = a.introducedAt ? new Date(a.introducedAt).getTime() : 0;
      const bt = b.introducedAt ? new Date(b.introducedAt).getTime() : 0;
      return at - bt;
    } else if (sort === 'name-asc') {
      return a.name.localeCompare(b.name);
    } else if (sort === 'name-desc') {
      return b.name.localeCompare(a.name);
    } else if (sort === 'channel-asc') {
      const aChannel = (a.channelName || a.channelId || 'Unknown Channel');
      const bChannel = (b.channelName || b.channelId || 'Unknown Channel');
      return aChannel.localeCompare(bChannel);
    } else if (sort === 'channel-desc') {
      const aChannel = (a.channelName || a.channelId || 'Unknown Channel');
      const bChannel = (b.channelName || b.channelId || 'Unknown Channel');
      return bChannel.localeCompare(aChannel);
    }
    return 0;
  });
  
  return sorted;
});

function handleSelfIntroducedSort(column: 'name' | 'date' | 'channel') {
  const currentSort = selfIntroducedSort.value;
  if (column === 'name') {
    selfIntroducedSort.value = currentSort === 'name-asc' ? 'name-desc' : 'name-asc';
  } else if (column === 'date') {
    selfIntroducedSort.value = currentSort === 'date-desc' ? 'date-asc' : 'date-desc';
  } else if (column === 'channel') {
    selfIntroducedSort.value = currentSort === 'channel-asc' ? 'channel-desc' : 'channel-asc';
  }
}

function getSelfIntroducedSortIcon(column: 'name' | 'date' | 'channel'): string | null {
  const currentSort = selfIntroducedSort.value;
  if (column === 'name') {
    if (currentSort === 'name-asc') return '↑';
    if (currentSort === 'name-desc') return '↓';
  } else if (column === 'date') {
    if (currentSort === 'date-asc') return '↑';
    if (currentSort === 'date-desc') return '↓';
  } else if (column === 'channel') {
    if (currentSort === 'channel-asc') return '↑';
    if (currentSort === 'channel-desc') return '↓';
  }
  return null;
}

function navigateToMagicIntros() {
  if (!props.communityId) return;
  const range = magicIntroDateRange.value;
  emit('openMagicIntros', range?.startDate, range?.endDate);
}

function navigateToChannelPairings() {
  if (!props.communityId) return;
  const { start, end } = getDateRangeForPeriod(selectedPeriod.value);
  emit('openChannelPairings', start, end);
}

function navigateToMentorMenteeMatches() {
  if (!props.communityId) return;
  const { start, end } = getDateRangeForPeriod(selectedPeriod.value);
  emit('openMentorMenteeMatches', start, end);
}

function navigateToConnections() {
  if (!props.communityId) return;
  const { start, end } = getDateRangeForPeriod(selectedPeriod.value);
  emit('openConnections', start, end);
}

function navigateToSkillsList() {
  if (!props.communityId) return;
  emit('openSkills');
}

function navigateToMentorList(type: 'can' | 'want') {
  if (!props.communityId) return;
  emit('openMentorList', type);
}

function getDateRangeForPeriod(period: string): { start: string | undefined; end: string | undefined } {
  if (period === 'all-time') {
    return { start: undefined, end: undefined };
  }

  const now = new Date();
  
  // End date: end of today (in UTC to avoid timezone issues)
  const end = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
    23, 59, 59, 999
  ));
  
  // Start date: N months ago from today
  // Calculate months to subtract
  let monthsToSubtract = 6;
  switch (period) {
    case '2-years':
      monthsToSubtract = 24;
      break;
    case '18-months':
      monthsToSubtract = 18;
      break;
    case '12-months':
      monthsToSubtract = 12;
      break;
    case '6-months':
      monthsToSubtract = 6;
      break;
    case '3-months':
      monthsToSubtract = 3;
      break;
    case '1-month':
      monthsToSubtract = 1;
      break;
    default:
      monthsToSubtract = 6;
  }
  
  // Get current UTC date components
  const currentYear = now.getUTCFullYear();
  const currentMonth = now.getUTCMonth(); // 0-11
  const currentDay = now.getUTCDate();
  
  // Calculate target month and year
  let targetYear = currentYear;
  let targetMonth = currentMonth - monthsToSubtract;
  
  // Handle year rollover (if targetMonth is negative)
  while (targetMonth < 0) {
    targetMonth += 12;
    targetYear -= 1;
  }
  
  // Use the last day of the month if the day doesn't exist (e.g., Jan 31 -> Feb 28)
  const daysInTargetMonth = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();
  const targetDay = Math.min(currentDay, daysInTargetMonth);
  
  // Create start date in UTC
  const start = new Date(Date.UTC(
    targetYear,
    targetMonth,
    targetDay,
    0, 0, 0, 0
  ));
  
  return {
    // Use date-only ISO format (YYYY-MM-DD) as the single source of truth
    // for all stats endpoints (including Magic Intros).
    start: start.toISOString().split('T')[0],
    end: end.toISOString().split('T')[0],
  };
}

function toUtcDayBounds(range: { start?: string; end?: string }): { start?: string; end?: string } {
  const start = range.start ? `${range.start}T00:00:00.000Z` : undefined;
  const end = range.end ? `${range.end}T23:59:59.999Z` : undefined;
  return { start, end };
}

function onPeriodChange() {
  loadStats();
}

onMounted(() => {
  loadStats();
});

watch(() => props.communityId, (newId, oldId) => {
  if (newId && newId !== oldId) {
    // Clear profile rows immediately when community changes
    profileRows.value = [];
    profileSearch.value = '';
    
    loadStats();
    // Reload profiles if modal is open
    if (isProfileModalOpen.value) {
      loadProfiles();
    }
  }
});

async function loadStats() {
  if (!props.communityId) return;

  isLoading.value = true;
  isLoadingPrimary.value = true;
  isLoadingActions.value = true;
  isLoadingEngagement.value = true;
  isLoadingSkills.value = true;
  isLoadingProfileCompletion.value = true;

  const { start, end } = getDateRangeForPeriod(selectedPeriod.value);
  const communityId = props.communityId;

  // Initialize stats object immediately so the UI skeleton can render
  stats.value = { totalUsers: 0, activeUsers: 0, newUsersThisMonth: 0 };

  // Fields that should not be overwritten once set by their authoritative source
  const engagementAttributionFields = [
    'trovaMagicEngagements', 'channelPairingEngagements', 'mentorMenteeEngagements',
    'trovaMagicMatches', 'channelPairingMatches', 'mentorMenteeMatches', 'mentorMenteeUniquePairs',
  ];
  const conversationsOwnedFields = ['trovaChatsStarted'];
  const profileOwnedFields = ['profileCompletionRate', 'profileCompletionCompleted', 'profileCompletionTotal'];

  const mergeIntoStats = (source: Partial<UserStats>, skipFields: string[] = []) => {
    if (!stats.value) stats.value = {};
    Object.keys(source).forEach(key => {
      if (skipFields.includes(key)) return;
      const value = source[key as keyof UserStats];
      if (value !== undefined && value !== null) {
        (stats.value as any)[key] = value;
      }
    });
    // Trigger reactivity
    stats.value = { ...stats.value };
  };

  // Magic Intros summary (fire-and-forget, has its own loading state)
  const magicRange = magicIntroDateRange.value;
  isLoadingMagicIntroSummary.value = true;
  magicIntroSummaryError.value = null;
  magicIntroSummary.value = null;
  if (magicRange && communityId) {
    fetchMagicIntroSummary(communityId, magicRange)
      .then((summary) => { magicIntroSummary.value = summary; })
      .catch((error: any) => {
        console.error('[UserStatsSection] Failed to load Magic Intro summary:', error);
        magicIntroSummaryError.value = error?.message || 'Failed to load Magic Intro summary';
      })
      .finally(() => { isLoadingMagicIntroSummary.value = false; });
  } else {
    isLoadingMagicIntroSummary.value = false;
  }

  // Fire ALL independent data fetches in parallel. Each updates stats progressively.
  const allPromises: Promise<void>[] = [];

  // Primary metrics + engagement attribution (profiles, events, groups, matches)
  allPromises.push(
    adminService.getEngagementStats(communityId, start, end)
      .then((result) => {
        if (result) mergeIntoStats(result, [...conversationsOwnedFields, ...profileOwnedFields]);
      })
      .catch((error) => { console.error('Error loading engagement stats:', error); })
      .finally(() => { isLoadingPrimary.value = false; isLoadingEngagement.value = false; })
  );

  // User actions (Trova Opens, profile score, etc.)
  allPromises.push(
    adminService.getUserActionsStats(communityId, start, end)
      .then((result) => {
        if (result) mergeIntoStats(result, engagementAttributionFields);
      })
      .catch(() => {})
      .finally(() => { isLoadingActions.value = false; })
  );

  // Skills + mentor/mentee
  allPromises.push(
    adminService.getSkillsStats(communityId)
      .then((result) => {
        if (result) mergeIntoStats(result);
      })
      .catch(() => {})
      .finally(() => { isLoadingSkills.value = false; })
  );

  // Channel pairing
  allPromises.push(
    adminService.getChannelPairingStats(communityId, start, end)
      .then((result) => {
        if (result) mergeIntoStats(result);
      })
      .catch(() => {})
  );

  // Messages Exchanged — only counts messages in Trova-created channels
  allPromises.push(
    adminService.getMessagesExchangedStats(communityId, start, end)
      .then((result) => {
        if (result) {
          mergeIntoStats({ trovaChatsStarted: result.total } as Partial<UserStats>);
        } else {
          // Fallback to conversations-started if new endpoint not deployed yet
          return adminService.getConversationsStarted(communityId, start, end)
            .then((fallback) => {
              mergeIntoStats({ trovaChatsStarted: fallback?.totalMessages || 0 } as Partial<UserStats>);
            });
        }
      })
      .catch((error) => {
        console.warn('[UserStatsSection] Messages exchanged fetch failed:', error);
        mergeIntoStats({ trovaChatsStarted: 0 } as Partial<UserStats>);
      })
  );

  // Weekly introductions
  allPromises.push(
    adminService.getWeeklyIntroductionsStats(communityId)
      .then((result) => {
        if (result) {
          mergeIntoStats(result);
        } else {
          mergeIntoStats({ userOnboardingIntros: 0 } as Partial<UserStats>);
        }
      })
      .catch(() => {})
  );

  // Self-introduced
  allPromises.push(
    adminService.getSelfIntroducedStats(communityId, start, end)
      .then((result) => {
        if (result) {
          mergeIntoStats(result);
          if (result.selfIntroduced !== undefined && result.selfIntroduced !== null && communityId !== null && start && end) {
            adminService.getSelfIntroducedUsers(communityId, start, end)
              .then((users) => {
                if (users && users.length > 0 && stats.value) {
                  const actualCount = users.length;
                  if (stats.value.selfIntroduced !== actualCount) {
                    stats.value.selfIntroduced = actualCount;
                    stats.value = { ...stats.value };
                  }
                }
              })
              .catch((error) => {
                console.warn('[UserStatsSection] Failed to verify self-introduced count:', error);
              });
          }
        } else {
          console.warn('[UserStatsSection] Self-introduced stats endpoint returned null');
          mergeIntoStats({ selfIntroduced: 0 } as Partial<UserStats>);
        }
      })
      .catch((error) => {
        console.error('[UserStatsSection] Self-introduced stats fetch rejected:', error);
      })
  );

  // Profile completion via lightweight aggregate endpoint (no full profile fetch)
  allPromises.push(
    adminService.getProfileCompletionStats(communityId)
      .then((result) => {
        if (result) {
          const rate = result.total > 0 ? (result.completed / result.total) * 100 : 0;
          mergeIntoStats({
            profileCompletionCompleted: result.completed,
            profileCompletionTotal: result.total,
            profileCompletionRate: rate,
          } as Partial<UserStats>);
        }
      })
      .catch(() => {})
      .finally(() => { isLoadingProfileCompletion.value = false; })
  );

  // Wait for all to settle, then mark global loading as done
  await Promise.allSettled(allPromises);
  isLoading.value = false;
}

async function exportStats() {
  if (!props.communityId || !stats.value) return;

  try {
    const { start, end } = getDateRangeForPeriod(selectedPeriod.value);
    
    // Try backend export first
    try {
      const blob = await adminService.exportData(props.communityId, 'stats', start, end);
      adminService.downloadCSV(blob, `roi_stats_${props.communityId}_${Date.now()}.csv`);
      
      const toast = await toastController.create({
        message: 'Statistics exported successfully',
        duration: 2000,
        color: 'success',
      });
      await toast.present();
      return;
    } catch (exportError: any) {
      // If backend export fails, create CSV client-side
      if (exportError?.status === 404 || exportError?.response?.status === 404) {
      } else {
        throw exportError;
      }
    }

    // Client-side CSV generation
    const csvRows: string[] = [];
    
    // Header
    csvRows.push('ROI Engagement Dashboard Statistics');
    const periodLabel = selectedPeriod.value === 'all-time' 
      ? 'All Time' 
      : selectedPeriod.value.replace('-', ' ').replace(/\b\w/g, (l) => l.toUpperCase());
    csvRows.push(`Time Period: ${periodLabel}`);
    if (start && end) {
      csvRows.push(`Date Range: ${new Date(start).toLocaleDateString()} - ${new Date(end).toLocaleDateString()}`);
    }
    csvRows.push('');
    
    // Primary Metrics
    csvRows.push('PRIMARY METRICS');
    csvRows.push('Metric,Value');
    csvRows.push(`Profiles Created,${formatNumber(stats.value.profilesCreated || stats.value.totalUsers || 0)}`);
    csvRows.push(`Introductions Created,${formatNumber(stats.value.connectionsMade || 0)}`);
    csvRows.push(`Messages Exchanged,${formatNumber(stats.value.trovaChatsStarted || 0)}`);
    csvRows.push('');
    
    // Engagement Metrics
    csvRows.push('ENGAGEMENT METRICS');
    csvRows.push('Metric,Value');
    csvRows.push(`Total Messages Sent,${formatNumber(stats.value.totalMessagesSent || 0)}`);
    csvRows.push(`Events Created,${formatNumber(stats.value.eventsCreated || 0)}`);
    csvRows.push(`Events Attended,${formatNumber(stats.value.eventsAttended || 0)}`);
    csvRows.push(`Groups Created,${formatNumber(stats.value.groupsCreated || 0)}`);
    csvRows.push(`Groups Joined,${formatNumber(stats.value.groupsJoined || 0)}`);
    csvRows.push(`Daily Active Users,${formatNumber(stats.value.dailyActiveUsers || 0)}`);
    csvRows.push(`Weekly Active Users,${formatNumber(stats.value.weeklyActiveUsers || 0)}`);
    csvRows.push(`Profile Completion Rate,${formatPercentage(stats.value.profileCompletionRate)}`);
    if (stats.value.userOnboardingIntros !== undefined && stats.value.userOnboardingIntros > 0) {
      csvRows.push(`Automated Onboarding Introductions,${formatNumber(stats.value.userOnboardingIntros)}`);
    }
    csvRows.push(`Match Response Rate,${formatPercentage(stats.value.matchResponseRate)}`);
    csvRows.push('');
    
    // Additional Stats
    if (stats.value.activeUsers || stats.value.newUsersThisMonth) {
      csvRows.push('ADDITIONAL STATISTICS');
      csvRows.push('Metric,Value');
      if (stats.value.activeUsers) {
        csvRows.push(`Active Users,${formatNumber(stats.value.activeUsers)}`);
      }
      if (stats.value.newUsersThisMonth) {
        csvRows.push(`New Users This Month,${formatNumber(stats.value.newUsersThisMonth)}`);
      }
    }
    
    // Create blob and download
    const csv = csvRows.join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    adminService.downloadCSV(blob, `roi_stats_${props.communityId}_${Date.now()}.csv`);
    
    const toast = await toastController.create({
      message: 'Statistics exported successfully',
      duration: 2000,
      color: 'success',
    });
    await toast.present();
  } catch (error) {
    console.error('Error exporting stats:', error);
    const toast = await toastController.create({
      message: 'Failed to export statistics',
      duration: 2000,
      color: 'danger',
    });
    await toast.present();
  }
}
</script>

<style scoped>
.user-stats-section {
  background: white;
  border-radius: 16px;
  padding: 24px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
}

.header-actions {
  display: flex;
  gap: 12px;
}

.section-title {
  font-size: 24px;
  font-weight: 700;
  color: #1a1a1a;
  margin: 0;
}

.section-subtitle {
  font-size: 18px;
  font-weight: 600;
  color: #1a1a1a;
  margin: 0 0 16px 0;
}


.dashboard-content {
  display: flex;
  flex-direction: column;
  gap: 32px;
}

/* Primary Metrics Section */
.primary-metrics-section {
  margin-bottom: 8px;
}

.primary-metrics-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 20px;
}

.primary-metric-card {
  display: flex;
  align-items: center;
  gap: 20px;
  padding: 24px;
  background: #ffffff;
  border-radius: 16px;
  border: 1px solid #e5e7eb;
  transition: transform 0.2s, box-shadow 0.2s;
}

.primary-metric-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
}

.primary-metric-card.clickable {
  cursor: pointer;
  background: linear-gradient(135deg, rgba(45, 122, 78, 0.12) 0%, rgba(29, 185, 138, 0.12) 100%);
  border-color: rgba(45, 122, 78, 0.35);
  box-shadow: 0 4px 10px rgba(45, 122, 78, 0.12);
}

.primary-metric-card.clickable:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(45, 122, 78, 0.16);
  background: linear-gradient(135deg, rgba(45, 122, 78, 0.16) 0%, rgba(29, 185, 138, 0.16) 100%);
}

.primary-metric-card.clickable .metric-label {
  color: #1a1a1a;
}

.primary-metric-card-highlight {
  background: #ffffff;
  border-color: rgba(45, 122, 78, 0.25);
}

.metric-icon {
  font-size: 32px;
  color: var(--color-primary);
  flex-shrink: 0;
}

.metric-content {
  flex: 1;
}

.metric-spinner {
  width: 24px;
  height: 24px;
  color: var(--color-primary);
}

.metric-spinner-small {
  width: 20px;
  height: 20px;
  color: var(--color-primary);
}

.metric-value {
  font-size: 28px;
  font-weight: 700;
  color: var(--color-primary);
  margin-bottom: 4px;
  line-height: 1.2;
  min-height: 34px;
}

.metric-label {
  font-size: 13px;
  color: #64748b;
  font-weight: 500;
}

.metric-label-with-info {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
}

.metric-info-icon {
  font-size: 16px;
  color: #94a3b8;
  flex-shrink: 0;
}

.metric-info-icon:hover {
  color: var(--color-primary);
}

.metric-trend {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-top: 8px;
  font-size: 12px;
  font-weight: 600;
}

.metric-trend ion-icon {
  font-size: 16px;
}

.metric-trend.trend-up {
  color: #10b981;
}

.metric-trend.trend-down {
  color: #ef4444;
}

.metric-trend.trend-neutral {
  color: #64748b;
}

/* Engagement Metrics Section */
.engagement-metrics-section {
  margin-bottom: 8px;
}

.engagement-metrics-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
}

.engagement-metric-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 20px;
  background: #ffffff;
  border-radius: 12px;
  border: 1px solid #e5e7eb;
  transition: transform 0.2s, box-shadow 0.2s;
}

.engagement-metric-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.08);
  border-color: var(--color-primary);
}

.metric-icon-small {
  font-size: 32px;
  color: var(--color-primary);
  flex-shrink: 0;
  opacity: 0.8;
}

.metric-content-small {
  flex: 1;
}

.metric-value-small {
  font-size: 28px;
  font-weight: 700;
  color: #1a1a1a;
  margin-bottom: 4px;
  line-height: 1.2;
  min-height: 34px;
}

.engagement-metric-header {
  font-size: 24px;
  font-weight: 600;
  color: #1a1a1a;
  line-height: 1.4;
}

.engagement-metric-header .metric-number {
  font-weight: 700;
  color: var(--color-primary);
  font-size: 26px;
}

.metric-label-small {
  font-size: 13px;
  color: #64748b;
  font-weight: 500;
}

/* Legacy Stats */
.legacy-stats-section {
  margin-bottom: 8px;
}

.legacy-stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
}

.stat-card {
  padding: 24px;
  background: linear-gradient(135deg, rgba(45, 122, 78, 0.1) 0%, rgba(29, 185, 138, 0.1) 100%);
  border-radius: 12px;
  text-align: center;
  border: 1px solid rgba(45, 122, 78, 0.2);
}

.stat-value {
  font-size: 36px;
  font-weight: 700;
  color: var(--color-primary);
  margin-bottom: 8px;
}

.stat-label {
  font-size: 14px;
  color: #64748b;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.subsection-title {
  font-size: 18px;
  font-weight: 600;
  color: #1a1a1a;
  margin: 0 0 16px 0;
}

.skills-stats-section {
  margin-top: 24px;
}

.skills-table {
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  overflow: hidden;
}

.table-header {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 16px;
  padding: 12px 16px;
  background: #f9fafb;
  font-weight: 600;
  font-size: 14px;
  color: #64748b;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.table-row {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 16px;
  padding: 12px 16px;
  border-bottom: 1px solid #e5e7eb;
}

.table-row:last-child {
  border-bottom: none;
}

.col-skill {
  font-weight: 500;
  color: #1a1a1a;
}

.col-count {
  font-weight: 600;
  color: var(--color-primary);
}

.loading-state {
  text-align: center;
  padding: 48px 16px;
  color: #64748b;
}

.section-loading-indicator {
  display: flex;
  justify-content: center;
  padding: 12px 0 4px;
  color: var(--color-primary, #16a34a);
}

.no-stats {
  text-align: center;
  padding: 48px 16px;
  color: #64748b;
}

.no-stats-icon {
  font-size: 64px;
  color: #cbd5e1;
  margin-bottom: 16px;
}

.no-stats-hint {
  font-size: 12px;
  color: #94a3b8;
  margin-top: 8px;
}

.engagement-metric-card.clickable {
  cursor: pointer;
  background: linear-gradient(135deg, rgba(45, 122, 78, 0.12) 0%, rgba(29, 185, 138, 0.12) 100%);
  border-color: rgba(45, 122, 78, 0.35);
  box-shadow: 0 4px 10px rgba(45, 122, 78, 0.12);
  transition: all 0.2s ease;
}

.engagement-metric-card.clickable:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(45, 122, 78, 0.16);
  background: linear-gradient(135deg, rgba(45, 122, 78, 0.16) 0%, rgba(29, 185, 138, 0.16) 100%);
}

.engagement-metric-card.clickable .metric-value-small {
  color: var(--color-primary);
}

.engagement-metric-card.clickable .metric-label-small {
  color: #1a1a1a;
}

/* Profiles modal */
.profile-modal-content {
  --padding-start: 16px;
  --padding-end: 16px;
  --padding-top: 12px;
  --padding-bottom: 24px;
}

.profile-modal-controls {
  display: flex;
  gap: 12px;
  align-items: center;
  margin-bottom: 12px;
}

.profiles-table {
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  overflow: hidden;
}

.profiles-table-header,
.profiles-table-row {
  display: grid;
  grid-template-columns: 1.5fr 0.5fr;
  align-items: center;
  gap: 12px;
}

.profiles-table-header {
  background: #f9fafb;
  font-weight: 700;
  color: #475569;
  padding: 12px 16px;
  text-transform: uppercase;
  font-size: 12px;
  letter-spacing: 0.4px;
}

.profiles-table-header .sortable {
  cursor: pointer;
  user-select: none;
  display: flex;
  align-items: center;
  gap: 6px;
  transition: color 0.2s;
}

.profiles-table-header .sortable:hover {
  color: var(--color-primary);
}

.sort-icon {
  font-size: 14px;
  color: var(--color-primary);
  font-weight: 700;
}

.profiles-table-row {
  padding: 12px 16px;
  border-top: 1px solid #e5e7eb;
}

.name-cell {
  display: flex;
  align-items: center;
  gap: 10px;
}

.avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  overflow: hidden;
  flex-shrink: 0;
  background: #e5e7eb;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  color: #475569;
}

.avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.avatar.placeholder {
  background: linear-gradient(135deg, var(--color-primary) 0%, var(--color-secondary) 100%);
  color: #ffffff;
}

.name-meta {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.name-text {
  font-weight: 600;
  color: #0f172a;
}

.email-text {
  font-size: 12px;
  color: #64748b;
}

.col-completion {
  font-weight: 600;
  color: var(--color-primary);
}

/* Override green color for onboarding intros dates and ensure font consistency */
.onboarding-intros-table .onboarding-intro-date {
  color: #0f172a;
  display: flex;
  flex-direction: column;
  gap: 2px;
  font-family: inherit;
}

.onboarding-intros-table .intro-date,
.onboarding-intros-table .intro-time {
  font-family: inherit;
  font-weight: 600;
  color: #0f172a;
}

.onboarding-intros-table .intro-time {
  font-size: 12px;
  color: #64748b;
}

/* Conversations Started table columns */
.conversations-started-table .profiles-table-header {
  display: grid;
  grid-template-columns: 1fr 2fr 1fr auto;
  gap: 16px;
}

.conversations-started-table .profiles-table-row {
  display: grid;
  grid-template-columns: 1fr 2fr 1fr auto;
  gap: 16px;
  align-items: center;
}

.conversations-started-table .col-name,
.conversations-started-table .col-messages,
.conversations-started-table .col-participants,
.conversations-started-table .col-date {
  font-weight: 600;
  color: #0f172a;
  font-family: inherit;
  font-size: 14px;
}

.conversations-started-table .col-participants {
  word-break: break-word;
}

.conversations-started-table .col-name .name-text {
  font-weight: 600;
  color: #0f172a;
  font-size: 14px;
}

/* Self-Introduced table columns */
.self-introduced-table .profiles-table-header {
  display: grid;
  grid-template-columns: 1.5fr 1fr 1fr;
  gap: 16px;
}

.self-introduced-table .profiles-table-row {
  display: grid;
  grid-template-columns: 1.5fr 1fr 1fr;
  gap: 16px;
  align-items: center;
}

.self-introduced-table .col-name,
.self-introduced-table .col-date,
.self-introduced-table .col-channel {
  font-weight: 600;
  color: #0f172a;
  font-family: inherit;
  font-size: 14px;
}

.self-introduced-table .col-channel {
  word-break: break-word;
}

@media (max-width: 768px) {
  .profile-modal-controls {
    flex-direction: column;
  }

  .profiles-table-header,
  .profiles-table-row {
    grid-template-columns: 1fr;
    gap: 8px;
  }
  
  .self-introduced-table .profiles-table-header,
  .self-introduced-table .profiles-table-row {
    grid-template-columns: 1fr;
    gap: 8px;
  }
}

/* Responsive */
@media (max-width: 768px) {
  .primary-metrics-grid {
    grid-template-columns: 1fr;
  }

  .engagement-metrics-grid {
    grid-template-columns: repeat(2, 1fr);
  }

  .legacy-stats-grid {
    grid-template-columns: 1fr;
  }


  .section-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 16px;
  }

  .header-actions {
    width: 100%;
  }
}
</style>





