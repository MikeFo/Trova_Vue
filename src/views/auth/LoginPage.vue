<template>
  <ion-page>
    <ion-content :fullscreen="true" class="login-content">
      <div class="login-container">
        <!-- Trova Logo -->
        <div class="logo-section">
          <h1 class="trova-logo">Trova</h1>
        </div>

        <!-- Welcome Header -->
        <div class="welcome-section">
          <h2 class="welcome-title">Welcome Back!</h2>
        </div>

        <!-- Social Login (Primary) -->
        <div class="social-section">
          <div class="social-buttons">
            <button 
              class="social-button facebook-button"
              @click="handleFacebookLogin"
              :disabled="loading"
            >
              <span class="social-icon facebook-icon">f</span>
            </button>
            <button 
              class="social-button google-button"
              @click="handleGoogleLogin"
              :disabled="loading"
            >
              <span class="social-icon google-icon">G</span>
            </button>
          </div>
        </div>

        <!-- Email Input (Secondary) -->
        <div class="form-section">
          <label class="input-label">Enter Work Email</label>
          <ion-input
            v-model="email"
            type="email"
            placeholder="john@workemail.com"
            class="email-input"
            @keyup.enter="handleLogin"
          ></ion-input>
        </div>

        <!-- Password Input -->
        <div class="form-section">
          <label class="input-label">Password</label>
          <ion-input
            v-model="password"
            type="password"
            placeholder="Enter your password"
            class="email-input"
            @keyup.enter="handleLogin"
          ></ion-input>
        </div>

        <!-- Legal Text -->
        <p class="legal-text">
          By signing in you agree to our 
          <a href="#" class="legal-link">Privacy Policy</a> 
          and 
          <a href="#" class="legal-link">Terms of Use</a>.
        </p>

        <!-- Sign In Button -->
        <ion-button
          expand="block"
          size="large"
          @click="handleLogin"
          :disabled="!email || !password || loading"
          class="next-button"
        >
          <ion-spinner v-if="loading" name="crescent"></ion-spinner>
          <span v-else>Sign In</span>
        </ion-button>

        <!-- Create Account -->
        <div class="signup-section">
          <p class="signup-question">Don't have an account?</p>
          <ion-button
            fill="outline"
            expand="block"
            @click="$router.push('/signup')"
            class="create-account-button"
          >
            Create Your Account
          </ion-button>
        </div>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { authService } from '@/services/auth.service';
import { useAuthStore } from '@/stores/auth.store';
import {
  IonPage,
  IonContent,
  IonInput,
  IonButton,
  IonSpinner,
  toastController,
} from '@ionic/vue';

const router = useRouter();
const authStore = useAuthStore();
const email = ref('');
const password = ref('');
const loading = ref(false);

async function handleLogin() {
  if (!email.value || !password.value) {
    const toast = await toastController.create({
      message: 'Please enter email and password',
      duration: 2000,
      color: 'warning',
    });
    await toast.present();
    return;
  }

  loading.value = true;
  try {
    await authService.signIn(email.value, password.value);
    
    // Wait a moment for auth store to update and user profile to load
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Redirect based on setup status
    // Default to home tab - only redirect to setup if we're certain setup is incomplete
    const user = authStore.user;
    if (user && user.setupStep) {
      const setupStep = user.setupStep;
      // Check if setup is explicitly incomplete (not just missing/undefined)
      const isIncomplete = setupStep && 
        setupStep !== 'complete' && 
        setupStep !== 'view' && 
        setupStep !== 'slack-complete' &&
        setupStep !== 'slack-new' &&
        setupStep !== 'teams-complete' &&
        setupStep !== 'webex-complete' &&
        !(+setupStep >= 4);
      
      if (isIncomplete) {
        router.push('/setup');
      } else {
        // Setup is complete or we can't determine - go to home
        router.push('/tabs/home');
      }
    } else {
      // No user data or setupStep - default to home tab
      // Router guards will handle redirecting to setup if needed
      router.push('/tabs/home');
    }
  } catch (error: any) {
    const toast = await toastController.create({
      message: error.message || 'Login failed. Please try again.',
      duration: 3000,
      color: 'danger',
    });
    await toast.present();
  } finally {
    loading.value = false;
  }
}

async function handleGoogleLogin() {
  loading.value = true;
  try {
    await authService.signInWithGoogle();
    
    // Wait a moment for auth store to update and user profile to load
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Redirect based on setup status
    // Default to home tab - only redirect to setup if we're certain setup is incomplete
    const user = authStore.user;
    if (user && user.setupStep) {
      const setupStep = user.setupStep;
      // Check if setup is explicitly incomplete (not just missing/undefined)
      const isIncomplete = setupStep && 
        setupStep !== 'complete' && 
        setupStep !== 'view' && 
        setupStep !== 'slack-complete' &&
        setupStep !== 'slack-new' &&
        setupStep !== 'teams-complete' &&
        setupStep !== 'webex-complete' &&
        !(+setupStep >= 4);
      
      if (isIncomplete) {
        router.push('/setup');
      } else {
        // Setup is complete or we can't determine - go to home
        router.push('/tabs/home');
      }
    } else {
      // No user data or setupStep - default to home tab
      // Router guards will handle redirecting to setup if needed
      router.push('/tabs/home');
    }
  } catch (error: any) {
    const toast = await toastController.create({
      message: error.message || 'Google login failed. Please try again.',
      duration: 3000,
      color: 'danger',
    });
    await toast.present();
  } finally {
    loading.value = false;
  }
}

async function handleFacebookLogin() {
  loading.value = true;
  try {
    // TODO: Implement Facebook login
    const toast = await toastController.create({
      message: 'Facebook login is not yet implemented.',
      duration: 3000,
      color: 'info',
    });
    await toast.present();
  } finally {
    loading.value = false;
  }
}
</script>

<style scoped>
.login-content {
  --background: #ffffff;
}

.login-container {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  padding: 40px 24px;
  max-width: 400px;
  margin: 0 auto;
}

.logo-section {
  margin-bottom: 48px;
}

.trova-logo {
  font-size: 28px;
  font-weight: 600;
  color: #34a853;
  margin: 0;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  letter-spacing: -0.5px;
}

.welcome-section {
  margin-bottom: 32px;
}

.welcome-title {
  font-size: 36px;
  font-weight: 700;
  color: #34a853;
  margin: 0;
  line-height: 1.2;
}

.form-section {
  margin-bottom: 16px;
}

.input-label {
  display: block;
  font-size: 14px;
  font-weight: 500;
  color: #1a1a1a;
  margin-bottom: 8px;
}

.email-input {
  --padding-start: 16px;
  --padding-end: 16px;
  --padding-top: 14px;
  --padding-bottom: 14px;
  border: 1px solid #e0e0e0;
  border-radius: 12px;
  font-size: 16px;
  background: #ffffff;
  margin-top: 8px;
}

.email-input:focus-within {
  border-color: #34a853;
  box-shadow: 0 0 0 3px rgba(52, 168, 83, 0.1);
}

.legal-text {
  font-size: 12px;
  color: #9ca3af;
  margin: 0 0 24px 0;
  line-height: 1.5;
  text-align: center;
}

.legal-link {
  color: #6b7280;
  text-decoration: underline;
}

.next-button {
  --background: linear-gradient(135deg, #34a853 0%, #1db98a 100%);
  --color: #ffffff;
  --border-radius: 12px;
  --padding-top: 16px;
  --padding-bottom: 16px;
  height: 52px;
  font-weight: 600;
  font-size: 16px;
  text-transform: none;
  margin-bottom: 32px;
  box-shadow: 0 4px 12px rgba(52, 168, 83, 0.3);
}

.next-button:disabled {
  --background: #e5e7eb;
  --color: #9ca3af;
  box-shadow: none;
  opacity: 0.6;
}

.social-section {
  text-align: center;
  margin-bottom: 40px;
}

.social-buttons {
  display: flex;
  justify-content: center;
  gap: 20px;
}

.social-button {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.social-button:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.social-button:active:not(:disabled) {
  transform: translateY(0);
}

.social-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.facebook-button {
  background: #1877f2;
}

.google-button {
  background: #ffffff;
  border: 1px solid #e0e0e0;
}

.social-icon {
  font-size: 20px;
  font-weight: 600;
  color: #ffffff;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

.google-icon {
  color: #4285f4;
  font-size: 18px;
}

.signup-section {
  margin-top: auto;
  padding-top: 32px;
}

.signup-question {
  font-size: 16px;
  font-weight: 600;
  color: #1a1a1a;
  text-align: center;
  margin: 0 0 16px 0;
}

.create-account-button {
  --border-color: #ef4444;
  --color: #ef4444;
  --border-radius: 12px;
  --padding-top: 16px;
  --padding-bottom: 16px;
  height: 52px;
  font-weight: 600;
  font-size: 16px;
  text-transform: none;
  --background: #ffffff;
}

.create-account-button:hover {
  --background: #fef2f2;
}

/* Responsive adjustments */
@media (max-width: 480px) {
  .login-container {
    padding: 32px 20px;
  }

  .welcome-title {
    font-size: 32px;
  }
}
</style>
