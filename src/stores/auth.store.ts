import { defineStore } from 'pinia';
import { ref, computed } from 'vue';

export interface User {
  id: number;
  email: string;
  fname: string;
  lname: string;
  fullName: string;
  profilePicture: string;
  emailConfirmed: boolean;
  setupStep: string;
  [key: string]: any;
}

export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(null);
  const isAuthenticated = ref(false);
  const isLoading = ref(false);

  const isSetupComplete = computed(() => {
    if (!user.value) return false;
    const setupStep = user.value.setupStep;
    return [
      'complete',
      'view',
      'slack-complete',
      'slack-new',
      'teams-complete',
      'webex-complete',
    ].includes(setupStep) || +setupStep >= 4;
  });

  function setUser(newUser: User | null) {
    user.value = newUser;
    isAuthenticated.value = !!newUser;
  }

  function logout() {
    user.value = null;
    isAuthenticated.value = false;
  }

  function updateSetupStep(step: string) {
    if (user.value) {
      user.value.setupStep = step;
    }
  }

  return {
    user,
    isAuthenticated,
    isLoading,
    isSetupComplete,
    setUser,
    logout,
    updateSetupStep,
  };
}, {
  persist: {
    key: 'auth-store',
    storage: localStorage,
    paths: ['isAuthenticated'],
    // Only persist auth state flag, not user data
    // User data will be fetched fresh from backend on each session
  }
});

