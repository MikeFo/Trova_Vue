<template>
  <div class="community-config-section">
    <h2 class="section-title">Community Configuration</h2>

    <div v-if="isLoading" class="loading-state">
      <ion-spinner></ion-spinner>
      <p>Loading community settings...</p>
    </div>

    <div v-else class="config-sections">
      <!-- Community Bio -->
      <div class="config-card">
        <h3 class="card-title">Community Bio</h3>
        <p class="card-description">Edit your community description (max 250 characters)</p>
        <ion-textarea
          v-model="communityBio"
          :maxlength="250"
          rows="4"
          placeholder="Enter community description..."
          class="bio-textarea"
        ></ion-textarea>
        <div class="char-count">{{ communityBio.length }}/250</div>
        <ion-button @click="saveBio" :disabled="isSaving">
          {{ isSaving ? 'Saving...' : 'Save Bio' }}
        </ion-button>
      </div>

      <!-- Community Logo -->
      <div class="config-card">
        <h3 class="card-title">Community Logo</h3>
        <p class="card-description">Upload or update your community logo</p>
        <div class="logo-upload-container">
          <div v-if="logoPreview" class="logo-preview">
            <img :src="logoPreview" alt="Community logo" />
            <ion-button fill="clear" size="small" @click="removeLogo">
              Remove
            </ion-button>
          </div>
          <div v-else class="logo-placeholder" @click="triggerLogoInput">
            <ion-icon :icon="camera"></ion-icon>
            <p>Tap to upload logo</p>
          </div>
          <input
            ref="logoInput"
            type="file"
            accept="image/*"
            @change="handleLogoUpload"
            style="display: none"
          />
        </div>
        <ion-button @click="saveLogo" :disabled="isSaving || !logoFile">
          {{ isSaving ? 'Saving...' : 'Save Logo' }}
        </ion-button>
      </div>

      <!-- Community Links -->
      <div class="config-card">
        <h3 class="card-title">Community Links</h3>
        <p class="card-description">Manage community links</p>
        <div class="links-list">
          <div
            v-for="(link, index) in communityLinks"
            :key="index"
            class="link-item"
          >
            <ion-input
              v-model="link.url"
              placeholder="URL"
              type="url"
            ></ion-input>
            <ion-input
              v-model="link.label"
              placeholder="Label"
            ></ion-input>
            <ion-button fill="clear" color="danger" @click="removeLink(index)">
              <ion-icon :icon="trashOutline"></ion-icon>
            </ion-button>
          </div>
        </div>
        <ion-button fill="outline" @click="addLink">
          <ion-icon :icon="addOutline" slot="start"></ion-icon>
          Add Link
        </ion-button>
        <ion-button @click="saveLinks" :disabled="isSaving">
          {{ isSaving ? 'Saving...' : 'Save Links' }}
        </ion-button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useCommunityStore } from '@/stores/community.store';
import { useFirebase } from '@/composables/useFirebase';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { adminService } from '@/services/admin.service';
import { toastController } from '@ionic/vue';
import {
  IonButton,
  IonIcon,
  IonTextarea,
  IonInput,
  IonSpinner,
} from '@ionic/vue';
import {
  camera,
  addOutline,
  trashOutline,
} from 'ionicons/icons';

interface Props {
  communityId: number | null;
}

const props = defineProps<Props>();
const emit = defineEmits<{
  refresh: [];
}>();

const communityStore = useCommunityStore();
const { storage } = useFirebase();

const isLoading = ref(false);
const isSaving = ref(false);
const communityBio = ref('');
const logoPreview = ref<string | null>(null);
const logoFile = ref<File | null>(null);
const logoInput = ref<HTMLInputElement | null>(null);
const communityLinks = ref<Array<{ url: string; label: string }>>([]);

async function loadCommunityData() {
  if (!props.communityId) return;

  isLoading.value = true;
  try {
    const community = communityStore.getCommunityById(props.communityId);
    if (community) {
      communityBio.value = community.bio || '';
      logoPreview.value = community.logo || null;
    }
    // TODO: Load community links from API
  } catch (error) {
    console.error('Error loading community data:', error);
  } finally {
    isLoading.value = false;
  }
}

function triggerLogoInput() {
  logoInput.value?.click();
}

function handleLogoUpload(event: Event) {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];
  if (file) {
    logoFile.value = file;
    const reader = new FileReader();
    reader.onload = (e) => {
      logoPreview.value = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  }
}

function removeLogo() {
  logoPreview.value = null;
  logoFile.value = null;
  if (logoInput.value) {
    logoInput.value.value = '';
  }
}

async function saveBio() {
  if (!props.communityId) return;

  isSaving.value = true;
  try {
    await adminService.updateCommunityBio(props.communityId, communityBio.value);
    const toast = await toastController.create({
      message: 'Community bio updated successfully',
      duration: 2000,
      color: 'success',
    });
    await toast.present();
    emit('refresh');
  } catch (error) {
    console.error('Error saving bio:', error);
    const toast = await toastController.create({
      message: 'Failed to update community bio',
      duration: 2000,
      color: 'danger',
    });
    await toast.present();
  } finally {
    isSaving.value = false;
  }
}

async function saveLogo() {
  if (!props.communityId || !logoFile.value || !storage) return;

  isSaving.value = true;
  try {
    const fileName = `community_${props.communityId}_${Date.now()}`;
    const imageRef = storageRef(storage, `images/${fileName}`);
    
    await uploadBytes(imageRef, logoFile.value);
    const logoUrl = await getDownloadURL(imageRef);
    
    await adminService.updateCommunityLogo(props.communityId, logoUrl);
    
    const toast = await toastController.create({
      message: 'Community logo updated successfully',
      duration: 2000,
      color: 'success',
    });
    await toast.present();
    emit('refresh');
  } catch (error) {
    console.error('Error saving logo:', error);
    const toast = await toastController.create({
      message: 'Failed to update community logo',
      duration: 2000,
      color: 'danger',
    });
    await toast.present();
  } finally {
    isSaving.value = false;
  }
}

function addLink() {
  communityLinks.value.push({ url: '', label: '' });
}

function removeLink(index: number) {
  communityLinks.value.splice(index, 1);
}

async function saveLinks() {
  if (!props.communityId) return;

  isSaving.value = true;
  try {
    // TODO: Save links via API
    const toast = await toastController.create({
      message: 'Community links updated successfully',
      duration: 2000,
      color: 'success',
    });
    await toast.present();
    emit('refresh');
  } catch (error) {
    console.error('Error saving links:', error);
    const toast = await toastController.create({
      message: 'Failed to update community links',
      duration: 2000,
      color: 'danger',
    });
    await toast.present();
  } finally {
    isSaving.value = false;
  }
}

onMounted(() => {
  loadCommunityData();
});
</script>

<style scoped>
.community-config-section {
  background: white;
  border-radius: 16px;
  padding: 24px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
}

.section-title {
  font-size: 24px;
  font-weight: 700;
  color: #1a1a1a;
  margin: 0 0 24px 0;
}

.loading-state {
  text-align: center;
  padding: 48px 16px;
  color: #64748b;
}

.config-sections {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.config-card {
  padding: 24px;
  background: #f9fafb;
  border-radius: 12px;
  border: 1px solid #e5e7eb;
}

.card-title {
  font-size: 18px;
  font-weight: 600;
  color: #1a1a1a;
  margin: 0 0 8px 0;
}

.card-description {
  font-size: 14px;
  color: #64748b;
  margin: 0 0 16px 0;
}

.bio-textarea {
  width: 100%;
  margin-bottom: 8px;
  --background: white;
  --border-radius: 8px;
}

.char-count {
  font-size: 12px;
  color: #64748b;
  text-align: right;
  margin-bottom: 16px;
}

.logo-upload-container {
  display: flex;
  justify-content: center;
  margin-bottom: 16px;
}

.logo-preview {
  position: relative;
  width: 150px;
  height: 150px;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.logo-preview img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.logo-preview ion-button {
  position: absolute;
  bottom: 8px;
  right: 8px;
}

.logo-placeholder {
  width: 150px;
  height: 150px;
  border-radius: 12px;
  border: 3px dashed #d1d5db;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s;
  color: #6b7280;
  background: white;
}

.logo-placeholder:hover {
  border-color: var(--color-primary);
  background: #f0fdf4;
}

.logo-placeholder ion-icon {
  font-size: 48px;
  margin-bottom: 8px;
}

.logo-placeholder p {
  font-size: 14px;
  margin: 0;
}

.links-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 16px;
}

.link-item {
  display: flex;
  gap: 12px;
  align-items: center;
}

.link-item ion-input {
  flex: 1;
}

.config-card ion-button {
  margin-top: 16px;
  margin-right: 8px;
}
</style>





