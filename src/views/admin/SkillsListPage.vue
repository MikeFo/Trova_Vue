<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-button @click="goBack">
            <ion-icon :icon="arrowBack"></ion-icon>
          </ion-button>
        </ion-buttons>
        <ion-title>Skills</ion-title>
        <ion-buttons slot="end">
          <ion-button @click="loadSkills">
            <ion-icon :icon="refresh"></ion-icon>
          </ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>
    <ion-content :fullscreen="true" class="skills-content">
      <!-- Loading State -->
      <div v-if="isLoading" class="loading-state">
        <ion-spinner></ion-spinner>
        <p>Loading skills...</p>
      </div>

      <!-- Skills List -->
      <div v-else-if="skills.length > 0" class="skills-list">
        <div class="list-header">
          <h2>All Skills</h2>
          <p class="subtitle">Click on a skill to view users who have it</p>
        </div>

        <ion-list>
          <ion-item
            v-for="skill in skills"
            :key="skill.name"
            button
            @click="navigateToSkillUsers(skill.name)"
            class="skill-item"
          >
            <ion-icon :icon="libraryOutline" slot="start" class="skill-icon"></ion-icon>
            <ion-label>
              <h2>{{ skill.name }}</h2>
              <p>
                <span class="stat-label">Users:</span>
                <span class="stat-value">{{ formatNumber(skill.value || 0) }}</span>
              </p>
            </ion-label>
            <ion-icon :icon="chevronForward" slot="end"></ion-icon>
          </ion-item>
        </ion-list>
      </div>

      <!-- Empty State -->
      <div v-else class="empty-state">
        <ion-icon :icon="libraryOutline" class="empty-icon"></ion-icon>
        <h2>No Skills Found</h2>
        <p>No skills were found for this community.</p>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { adminService } from '@/services/admin.service';
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonButtons,
  IonButton,
  IonIcon,
  IonContent,
  IonList,
  IonItem,
  IonLabel,
  IonSpinner,
} from '@ionic/vue';
import { arrowBack, refresh, libraryOutline, chevronForward } from 'ionicons/icons';

const router = useRouter();
const route = useRoute();

const isLoading = ref(true);
const skills = ref<Array<{ name: string; value: number }>>([]);

const communityId = computed(() => {
  const id = route.params.communityId;
  return typeof id === 'string' ? parseInt(id, 10) : Number(id);
});

function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-US').format(value);
}

function goBack() {
  router.back();
}

function navigateToSkillUsers(skillName: string) {
  router.push({
    path: `/communities/${communityId.value}/console/skills/${encodeURIComponent(skillName)}`
  });
}

async function loadSkills() {
  if (!communityId.value) return;
  
  isLoading.value = true;
  try {
    const allSkills = await adminService.getSkillsChartData(communityId.value, 'all', true, true);
    skills.value = allSkills.map(skill => ({
      name: skill.name,
      value: skill.value || 0
    })).sort((a, b) => b.value - a.value); // Sort by count descending
  } catch (error) {
    console.error('Error loading skills:', error);
    skills.value = [];
  } finally {
    isLoading.value = false;
  }
}

onMounted(() => {
  loadSkills();
});
</script>

<style scoped>
.skills-content {
  --background: #f5f5f5;
}

.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 48px 16px;
  color: #64748b;
}

.loading-state ion-spinner {
  margin-bottom: 16px;
}

.list-header {
  padding: 24px 16px 16px;
  background: white;
  border-bottom: 1px solid #e5e7eb;
}

.list-header h2 {
  margin: 0 0 4px 0;
  font-size: 20px;
  font-weight: 600;
  color: #1a1a1a;
}

.subtitle {
  margin: 0;
  font-size: 14px;
  color: #64748b;
}

.skills-list {
  background: white;
}

.skill-item {
  --padding-start: 16px;
  --padding-end: 16px;
  --min-height: 72px;
  border-bottom: 1px solid #e5e7eb;
}

.skill-item:last-child {
  border-bottom: none;
}

.skill-icon {
  font-size: 24px;
  color: var(--color-primary);
  margin-right: 16px;
}

.skill-item ion-label h2 {
  font-size: 16px;
  font-weight: 500;
  color: #1a1a1a;
  margin-bottom: 4px;
}

.skill-item ion-label p {
  font-size: 14px;
  color: #64748b;
  margin: 0;
}

.stat-label {
  font-weight: 500;
}

.stat-value {
  font-weight: 600;
  color: var(--color-primary);
  margin-left: 4px;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 64px 32px;
  text-align: center;
}

.empty-icon {
  font-size: 64px;
  color: #cbd5e1;
  margin-bottom: 16px;
}

.empty-state h2 {
  margin: 0 0 8px 0;
  font-size: 20px;
  font-weight: 600;
  color: #1a1a1a;
}

.empty-state p {
  margin: 0;
  font-size: 14px;
  color: #64748b;
}
</style>
