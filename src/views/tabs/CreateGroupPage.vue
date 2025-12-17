<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-button @click="goBack">
            <ion-icon :icon="closeOutline"></ion-icon>
          </ion-button>
        </ion-buttons>
        <ion-title>Create Group</ion-title>
        <ion-buttons slot="end">
          <ion-button 
            @click="handleCreate" 
            :disabled="!canCreate || isSubmitting"
          >
            {{ isSubmitting ? 'Creating...' : 'Create' }}
          </ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>
    <ion-content :fullscreen="true" class="create-group-content">
      <div class="create-group-container">
        <form @submit.prevent="handleCreate">
          <!-- Group Photo -->
          <div class="form-section">
            <ion-label class="section-label">Group Photo</ion-label>
            <div class="photo-upload-container">
              <div class="photo-preview" v-if="formData.logo">
                <img :src="formData.logo" alt="Group logo" />
                <ion-button
                  fill="clear"
                  size="small"
                  @click="removePhoto"
                  class="remove-photo"
                >
                  Remove
                </ion-button>
              </div>
              <div v-else class="photo-placeholder" @click="triggerFileInput">
                <ion-icon :icon="camera"></ion-icon>
                <p>Tap to add photo</p>
              </div>
              <input
                ref="fileInput"
                type="file"
                accept="image/*"
                @change="handlePhotoUpload"
                style="display: none"
              />
            </div>
          </div>

          <!-- Group Information -->
          <div class="form-section">
            <ion-label class="section-label">Group Information</ion-label>
            
            <ion-item class="form-item" lines="full">
              <ion-label position="stacked">Group Name</ion-label>
              <ion-input
                v-model="formData.name"
                placeholder="New Group Name"
                :maxlength="50"
                required
              ></ion-input>
            </ion-item>
            <div v-if="errors.name" class="error-message">{{ errors.name }}</div>

            <ion-item class="form-item" lines="full">
              <ion-label position="stacked">Description</ion-label>
              <ion-textarea
                v-model="formData.bio"
                placeholder="Group Description"
                :maxlength="500"
                rows="4"
                required
              ></ion-textarea>
            </ion-item>
            <div v-if="errors.bio" class="error-message">{{ errors.bio }}</div>
          </div>

          <!-- Privacy -->
          <div class="form-section">
            <ion-label class="section-label">Privacy</ion-label>
            <ion-radio-group v-model="formData.isPrivate">
              <ion-item lines="none">
                <ion-radio slot="start" :value="false"></ion-radio>
                <ion-label>
                  <h3>Public</h3>
                  <p>Anyone can find and join this group</p>
                </ion-label>
              </ion-item>
              <ion-item lines="none">
                <ion-radio slot="start" :value="true"></ion-radio>
                <ion-label>
                  <h3>Private</h3>
                  <p>Only invited members can join</p>
                </ion-label>
              </ion-item>
            </ion-radio-group>
          </div>

          <!-- Tags -->
          <div class="form-section">
            <ion-label class="section-label">Tags</ion-label>
            <p class="section-description">Add tags to help people find your group</p>
            <!-- TODO: Add tag picker component -->
            <div class="tags-placeholder">
              <ion-button fill="outline" size="small">
                <ion-icon :icon="addOutline" slot="start"></ion-icon>
                Add Tags
              </ion-button>
            </div>
          </div>

          <!-- Submit Button -->
          <div class="form-actions">
            <ion-button
              expand="block"
              @click="handleCreate"
              :disabled="!canCreate || isSubmitting"
              class="submit-button"
            >
              {{ isSubmitting ? 'Creating...' : 'Create Group' }}
            </ion-button>
          </div>
        </form>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth.store';
import { groupService } from '@/services/group.service';
import { useFirebase } from '@/composables/useFirebase';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { toastController } from '@ionic/vue';
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonButtons,
  IonButton,
  IonIcon,
  IonContent,
  IonItem,
  IonLabel,
  IonInput,
  IonTextarea,
  IonRadioGroup,
  IonRadio,
} from '@ionic/vue';
import { closeOutline, camera, addOutline } from 'ionicons/icons';

const router = useRouter();
const authStore = useAuthStore();
const { storage } = useFirebase();

const formData = ref({
  name: '',
  bio: '',
  isPrivate: false,
  tags: [] as number[],
  logo: null as string | null,
  logoFile: null as File | null,
});

const errors = ref({
  name: '',
  bio: '',
});

const isSubmitting = ref(false);
const fileInput = ref<HTMLInputElement | null>(null);

const canCreate = computed(() => {
  return formData.value.name.trim().length > 0 && 
         formData.value.bio.trim().length > 0;
});

function goBack() {
  router.back();
}

function triggerFileInput() {
  fileInput.value?.click();
}

function handlePhotoUpload(event: Event) {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];
  if (file) {
    formData.value.logoFile = file;
    const reader = new FileReader();
    reader.onload = (e) => {
      formData.value.logo = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  }
}

function removePhoto() {
  formData.value.logo = null;
  formData.value.logoFile = null;
  if (fileInput.value) {
    fileInput.value.value = '';
  }
}

function validateForm(): boolean {
  errors.value = { name: '', bio: '' };
  let isValid = true;

  if (!formData.value.name.trim()) {
    errors.value.name = 'Name is required';
    isValid = false;
  } else if (formData.value.name.length > 50) {
    errors.value.name = 'Name must be 50 characters or less';
    isValid = false;
  }

  if (!formData.value.bio.trim()) {
    errors.value.bio = 'Description is required';
    isValid = false;
  } else if (formData.value.bio.length > 500) {
    errors.value.bio = 'Description must be 500 characters or less';
    isValid = false;
  }

  return isValid;
}

async function handleCreate() {
  if (!validateForm()) {
    return;
  }

  if (!authStore.user?.id) {
    const toast = await toastController.create({
      message: 'You must be logged in to create a group',
      duration: 2000,
      color: 'danger',
    });
    await toast.present();
    return;
  }

  isSubmitting.value = true;

  try {
    // Get community ID from user object (as stored in production DB)
    // The /users/me endpoint should return the user with their community ID
    if (!authStore.user) {
      throw new Error('User not found');
    }

    const user = authStore.user;
    
    // Get community ID from user object (as stored in production DB)
    // Based on the user object structure, it uses 'inDemoCommunityId' for the current community
    const communityId = (user as any).inDemoCommunityId || 
                       (user as any).communityId || 
                       (user as any).community_id || 
                       null;

    // If no community ID, show error
    if (!communityId) {
      const toast = await toastController.create({
        message: 'You must be part of a community to create a group. Please join a community first.',
        duration: 4000,
        color: 'warning',
      });
      await toast.present();
      isSubmitting.value = false;
      return;
    }

    // Upload logo to Firebase Storage if provided
    let logoUrl: string | undefined = undefined;
    if (formData.value.logoFile && storage) {
      try {
        const userId = authStore.user.id;
        // Use same path pattern as profile photos to match Firebase Storage rules
        const fileName = `group_${userId}_${Date.now()}`;
        const imageRef = storageRef(storage, `images/${fileName}`);
        
        await uploadBytes(imageRef, formData.value.logoFile);
        logoUrl = await getDownloadURL(imageRef);
      } catch (uploadError: any) {
        console.error('Error uploading logo:', uploadError);
        const toast = await toastController.create({
          message: uploadError.message || 'Failed to upload logo. Creating group without logo.',
          duration: 3000,
          color: 'warning',
        });
        await toast.present();
        // Continue with group creation even if logo upload fails
      }
    }

    // Prepare group data - ensure all fields are properly formatted
    const groupData: any = {
      name: formData.value.name.trim(),
      bio: formData.value.bio.trim(),
      leaderId: authStore.user.id,
      communityId: communityId,
      isPrivate: formData.value.isPrivate,
      tags: formData.value.tags && formData.value.tags.length > 0 ? formData.value.tags : [],
    };

    // Only include logo if it exists and is a valid URL
    // Some backends have issues with very long URLs or special characters
    if (logoUrl && logoUrl.trim().length > 0) {
      // Ensure the logo URL is properly encoded
      try {
        new URL(logoUrl); // Validate it's a proper URL
        groupData.logo = logoUrl;
      } catch (urlError) {
        console.warn('Invalid logo URL, creating group without logo:', urlError);
        // Continue without logo if URL is invalid
      }
    }

    // Log the data being sent for debugging
    console.log('Creating group with data:', JSON.stringify(groupData, null, 2));
    console.log('Data types:', {
      name: typeof groupData.name,
      bio: typeof groupData.bio,
      leaderId: typeof groupData.leaderId,
      communityId: typeof groupData.communityId,
      isPrivate: typeof groupData.isPrivate,
      tags: Array.isArray(groupData.tags),
      logo: groupData.logo ? typeof groupData.logo : 'undefined',
    });

    // Retry logic for intermittent backend errors
    let newGroup = null;
    let retries = 0;
    const maxRetries = 2;
    
    while (!newGroup && retries <= maxRetries) {
      try {
        newGroup = await groupService.createGroup(groupData);
        break; // Success, exit retry loop
      } catch (error: any) {
        retries++;
        if (retries > maxRetries) {
          // Final attempt failed, throw the error
          throw error;
        }
        // If it's a 500 error, try again without logo (might be logo processing issue)
        if (error.status === 500 && logoUrl && retries === 1) {
          console.warn('First attempt failed with logo, retrying without logo...');
          const groupDataWithoutLogo = { ...groupData };
          delete groupDataWithoutLogo.logo;
          try {
            newGroup = await groupService.createGroup(groupDataWithoutLogo);
            const toast = await toastController.create({
              message: 'Group created successfully (logo upload will be processed separately)',
              duration: 3000,
              color: 'warning',
            });
            await toast.present();
            break;
          } catch (retryError) {
            // If retry without logo also fails, continue to next retry with original data
            console.warn('Retry without logo also failed, trying again with original data...');
          }
        } else {
          // Wait a bit before retrying
          await new Promise(resolve => setTimeout(resolve, 500 * retries));
        }
      }
    }

    if (!newGroup) {
      throw new Error('Group creation failed after retries');
    }

    const toast = await toastController.create({
      message: 'Group created successfully!',
      duration: 2000,
      color: 'success',
    });
    await toast.present();

    // Small delay to ensure backend has processed the creation
    await new Promise(resolve => setTimeout(resolve, 300));

    // Navigate back to groups list - it will refresh automatically via ionViewDidEnter
    // This ensures the new group appears in the list
    router.push('/tabs/groups');
  } catch (error: any) {
    console.error('Error creating group:', error);
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      response: error.response || error.originalError?.response,
      status: error.status || error.originalError?.response?.status,
      responseData: error.response?.data || error.originalError?.response?.data,
    });
    
    // Show more detailed error message
    let errorMessage = 'Failed to create group. Please try again.';
    
    if (error.message && error.message !== '{}' && error.message !== 'Request failed') {
      errorMessage = error.message;
    } else if (error.response?.data) {
      const responseData = error.response.data;
      if (responseData.message && responseData.message !== '{}') {
        errorMessage = responseData.message;
      } else if (responseData.error) {
        errorMessage = responseData.error;
      }
    } else if (error.originalError?.response?.data) {
      const responseData = error.originalError.response.data;
      if (responseData.message && responseData.message !== '{}') {
        errorMessage = responseData.message;
      } else if (responseData.error) {
        errorMessage = responseData.error;
      }
    }
    
    // If we have a 500 error, show a more helpful message
    const status = error.status || error.originalError?.response?.status || error.response?.status;
    if (status === 500) {
      errorMessage = 'Server error occurred. Please check that all required fields are filled and try again.';
    }
    
    const toast = await toastController.create({
      message: errorMessage,
      duration: 4000,
      color: 'danger',
    });
    await toast.present();
  } finally {
    isSubmitting.value = false;
  }
}
</script>

<style scoped>
.create-group-content {
  --background: #f8fafc;
}

.create-group-container {
  padding: 16px;
  max-width: 600px;
  margin: 0 auto;
}

.form-section {
  background: white;
  border-radius: 16px;
  padding: 24px;
  margin-bottom: 16px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
}

.section-label {
  font-size: 18px;
  font-weight: 600;
  color: #1a1a1a;
  margin-bottom: 16px;
  display: block;
}

.section-description {
  font-size: 14px;
  color: #64748b;
  margin: 0 0 12px 0;
}

.form-item {
  --padding-start: 0;
  --padding-end: 0;
  --inner-padding-end: 0;
  margin-bottom: 16px;
}

.error-message {
  color: #ef4444;
  font-size: 14px;
  margin-top: -12px;
  margin-bottom: 12px;
  padding-left: 16px;
}

.photo-upload-container {
  display: flex;
  justify-content: center;
  align-items: center;
  margin: 16px 0;
}

.photo-preview {
  position: relative;
  width: 150px;
  height: 150px;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
}

.photo-preview img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.remove-photo {
  position: absolute;
  bottom: 8px;
  right: 8px;
}

.photo-placeholder {
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
}

.photo-placeholder:hover {
  border-color: #2d7a4e;
  background: #f0fdf4;
}

.photo-placeholder ion-icon {
  font-size: 48px;
  margin-bottom: 8px;
}

.tags-placeholder {
  margin-top: 12px;
}

.form-actions {
  margin-top: 24px;
  padding: 0 8px;
}

.submit-button {
  --border-radius: 12px;
  --padding-top: 16px;
  --padding-bottom: 16px;
  height: 52px;
  font-weight: 600;
  font-size: 16px;
  text-transform: none;
  --background: linear-gradient(135deg, var(--color-primary) 0%, var(--color-secondary) 100%);
  --color: #ffffff;
  box-shadow: 0 4px 12px rgba(52, 168, 83, 0.3);
  transition: all 0.2s ease;
}

.submit-button:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(52, 168, 83, 0.4);
}

.submit-button:active:not(:disabled) {
  transform: translateY(0);
}

.submit-button:disabled {
  --background: #e5e7eb;
  --color: #94a3b8;
  box-shadow: none;
  opacity: 0.6;
}

/* Responsive: Desktop */
@media (min-width: 768px) {
  .create-group-container {
    padding: 24px;
  }

  .form-section {
    padding: 32px;
  }
}
</style>

