import { onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { authService } from '../services/auth.service';
import { useAuthStore } from '../stores/auth.store';

export function useAuth() {
  const router = useRouter();
  const authStore = useAuthStore();

  async function initializeAuth() {
    try {
      const isAuthenticated = await authService.checkAuth();
      if (!isAuthenticated) {
        router.push('/login');
      }
    } catch (error) {
      console.error('Auth initialization error:', error);
      router.push('/login');
    }
  }

  async function requireAuth() {
    if (!authStore.isAuthenticated) {
      router.push('/login');
      return false;
    }
    return true;
  }

  async function requireSetupComplete() {
    if (!authStore.isAuthenticated) {
      router.push('/login');
      return false;
    }
    if (!authStore.isSetupComplete) {
      router.push('/setup');
      return false;
    }
    return true;
  }

  return {
    initializeAuth,
    requireAuth,
    requireSetupComplete,
  };
}

