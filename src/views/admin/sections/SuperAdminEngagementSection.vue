<template>
  <div class="super-admin-engagement">
    <div class="header-row">
      <div>
        <h2>Engagement (last {{ days }} days)</h2>
        <p class="subtext">
          Communities included if they have <b>either</b> self-intros or Slack opens.
        </p>
      </div>
      <ion-button size="small" fill="outline" @click="load">
        Refresh
      </ion-button>
    </div>

    <div v-if="isLoading" class="loading">
      <ion-spinner />
      <span>Loading…</span>
    </div>

    <div v-else-if="rows.length === 0" class="empty">
      No data found.
    </div>

    <ion-card v-else>
      <ion-card-content>
        <div class="table-wrap">
          <table class="engagement-table">
            <thead>
              <tr>
                <th>Community</th>
                <th>Leader</th>
                <th>Managers</th>
                <th class="num">Self intros</th>
                <th class="num">Slack opens</th>
                <th class="num">Open users</th>
                <th>Opens summary</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="r in rows" :key="r.community_id">
                <td>
                  <div class="community-name">{{ r.community_name }}</div>
                  <div class="community-id">ID: {{ r.community_id }}</div>
                </td>
                <td>
                  <div>{{ r.leader_email || '—' }}</div>
                  <div class="community-id">leader_id: {{ r.leader_id || '—' }}</div>
                </td>
                <td>{{ r.community_manager_emails || '—' }}</td>
                <td class="num">
                  <ion-button
                    size="small"
                    fill="clear"
                    :disabled="(r[selfIntrosKey] || 0) === 0"
                    @click="openEmails('self_intros', r.community_id, r.community_name)"
                  >
                    {{ r[selfIntrosKey] || 0 }}
                  </ion-button>
                </td>
                <td class="num">
                  <ion-button
                    size="small"
                    fill="clear"
                    :disabled="(r[slackOpensKey] || 0) === 0"
                    @click="openEmails('slack_opens', r.community_id, r.community_name)"
                  >
                    {{ r[slackOpensKey] || 0 }}
                  </ion-button>
                </td>
                <td class="num">{{ r[slackOpenUsersKey] || 0 }}</td>
                <td>{{ r[opensSummaryKey] || '—' }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </ion-card-content>
    </ion-card>

    <ion-modal :is-open="isModalOpen" @didDismiss="closeModal">
      <ion-header>
        <ion-toolbar>
          <ion-title>{{ modalTitle }}</ion-title>
          <ion-buttons slot="end">
            <ion-button @click="closeModal">Close</ion-button>
          </ion-buttons>
        </ion-toolbar>
      </ion-header>
      <ion-content class="ion-padding">
        <div v-if="modalLoading" class="loading">
          <ion-spinner />
          <span>Loading…</span>
        </div>
        <div v-else>
          <ion-item lines="none">
            <ion-label>
              <div><b>{{ modalCommunityName }}</b> ({{ modalCommunityId }})</div>
              <div class="subtext">{{ modalMetricLabel }} emails (last {{ days }} days)</div>
            </ion-label>
            <ion-button size="small" fill="outline" :disabled="modalEmails.length === 0" @click="copyEmails">
              Copy
            </ion-button>
          </ion-item>

          <ion-list v-if="modalEmails.length > 0">
            <ion-item v-for="e in modalEmails" :key="e.email">
              <ion-label>
                <div>{{ e.email }}</div>
                <div class="subtext" v-if="e.fname || e.lname">{{ (e.fname || '') + ' ' + (e.lname || '') }}</div>
              </ion-label>
            </ion-item>
          </ion-list>
          <div v-else class="empty">
            No emails found.
          </div>
        </div>
      </ion-content>
    </ion-modal>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import {
  IonButton,
  IonCard,
  IonCardContent,
  IonContent,
  IonHeader,
  IonItem,
  IonLabel,
  IonList,
  IonModal,
  IonSpinner,
  IonTitle,
  IonToolbar,
  IonButtons,
  toastController,
} from '@ionic/vue';
import { adminService } from '@/services/admin.service';

type EngagementRow = Record<string, any>;

const props = defineProps<{
  userId: number;
}>();

const days = 90;
const rows = ref<EngagementRow[]>([]);
const isLoading = ref(false);

const selfIntrosKey = computed(() => `self_introductions_${days}d`);
const slackOpensKey = computed(() => `slack_opens_${days}d`);
const slackOpenUsersKey = computed(() => `slack_open_users_${days}d`);
const opensSummaryKey = computed(() => `opens_summary_${days}d`);

const isModalOpen = ref(false);
const modalLoading = ref(false);
const modalEmails = ref<any[]>([]);
const modalMetric = ref<'self_intros' | 'slack_opens'>('self_intros');
const modalCommunityId = ref<number | null>(null);
const modalCommunityName = ref<string>('');

const modalMetricLabel = computed(() => (modalMetric.value === 'self_intros' ? 'Self intros' : 'Slack opens'));
const modalTitle = computed(() => `${modalMetricLabel.value} emails`);

async function load() {
  try {
    isLoading.value = true;
    rows.value = await adminService.getSuperAdminCommunityEngagementSummary(props.userId, days);
  } catch (e) {
    console.error('[SuperAdminEngagementSection] load failed', e);
    const t = await toastController.create({
      message: 'Failed to load engagement data',
      duration: 2500,
      color: 'danger',
    });
    await t.present();
  } finally {
    isLoading.value = false;
  }
}

async function openEmails(metric: 'self_intros' | 'slack_opens', communityId: number, communityName: string) {
  modalMetric.value = metric;
  modalCommunityId.value = communityId;
  modalCommunityName.value = communityName;
  modalEmails.value = [];
  isModalOpen.value = true;
  modalLoading.value = true;
  try {
    if (metric === 'self_intros') {
      modalEmails.value = await adminService.getSuperAdminSelfIntroEmails(props.userId, communityId, days);
    } else {
      modalEmails.value = await adminService.getSuperAdminSlackOpenEmails(props.userId, communityId, days);
    }
  } catch (e) {
    console.error('[SuperAdminEngagementSection] drilldown failed', e);
    const t = await toastController.create({
      message: 'Failed to load emails',
      duration: 2500,
      color: 'danger',
    });
    await t.present();
  } finally {
    modalLoading.value = false;
  }
}

function closeModal() {
  isModalOpen.value = false;
}

async function copyEmails() {
  const text = modalEmails.value.map((r) => r.email).filter(Boolean).join('\n');
  try {
    await navigator.clipboard.writeText(text);
    const t = await toastController.create({
      message: `Copied ${modalEmails.value.length} emails`,
      duration: 1500,
      color: 'success',
    });
    await t.present();
  } catch {
    const t = await toastController.create({
      message: 'Copy failed (clipboard not available)',
      duration: 2000,
      color: 'warning',
    });
    await t.present();
  }
}

onMounted(load);
</script>

<style scoped>
.super-admin-engagement {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.header-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}
.subtext {
  opacity: 0.75;
  font-size: 12px;
  margin-top: 4px;
}
.loading {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 0;
}
.empty {
  opacity: 0.75;
  padding: 8px 0;
}
.table-wrap {
  overflow: auto;
}
.engagement-table {
  width: 100%;
  border-collapse: collapse;
}
.engagement-table th,
.engagement-table td {
  padding: 10px 8px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.08);
  vertical-align: top;
}
.num {
  text-align: right;
  white-space: nowrap;
}
.community-name {
  font-weight: 600;
}
.community-id {
  opacity: 0.65;
  font-size: 12px;
  margin-top: 2px;
}
</style>

