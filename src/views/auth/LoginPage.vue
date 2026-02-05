<template>
  <ion-page>
    <ion-content :fullscreen="true" class="login-content">
      <div class="login-container">
        <div class="logo-section">
          <img
            v-show="!logoError"
            src="/logo.svg"
            alt="Trova"
            class="logo-img"
            @error="logoError = true"
          />
          <h1 v-show="logoError" class="trova-logo">Trova</h1>
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

        <form class="login-form" @submit.prevent="handleLogin">
          <!-- Email Input -->
          <div class="form-section">
            <label class="input-label" for="login-email">Enter Work Email</label>
            <div class="auth-input-wrapper">
              <ion-input
                id="login-email"
                v-model="email"
                type="email"
                name="email"
                autocomplete="email"
                placeholder="john@workemail.com"
                class="auth-input"
              ></ion-input>
            </div>
          </div>

          <!-- Password Input -->
          <div class="form-section">
            <label class="input-label" for="login-password">Password</label>
            <div class="auth-input-wrapper">
              <ion-input
                id="login-password"
                v-model="password"
                type="password"
                name="password"
                autocomplete="current-password"
                placeholder="Enter your password"
                class="auth-input"
              ></ion-input>
            </div>
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
            type="submit"
            expand="block"
            size="large"
            :disabled="!email || !password || loading"
            class="submit-button"
          >
            <ion-spinner v-if="loading" name="crescent"></ion-spinner>
            <span v-else>Sign In</span>
          </ion-button>
        </form>

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
const logoError = ref(false);

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
/* Logo green from public/logo.svg (.cls-1 fill) – single source for all greens on this page */
.login-content {
  --background: #ffffff;
  --trova-green: #60c19b;
  --trova-green-dark: #4dad84;
  --trova-green-rgb: 96, 193, 155;
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
  margin-bottom: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 40px;
}

.logo-img {
  height: 36px;
  width: auto;
  max-width: 160px;
  object-fit: contain;
  display: block;
}

.trova-logo {
  font-size: 28px;
  font-weight: 600;
  color: var(--trova-green);
  margin: 0;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  letter-spacing: -0.5px;
}

.welcome-section {
  margin-bottom: 28px;
}

.welcome-title {
  font-size: 22px;
  font-weight: 600;
  color: #374151;
  margin: 0;
  line-height: 1.3;
  letter-spacing: -0.01em;
}

.login-form {
  margin: 0;
}

.form-section {
  margin-bottom: 20px;
}

.input-label {
  display: block;
  font-size: 14px;
  font-weight: 500;
  color: var(--ion-text-color, #1a1a1a);
  margin-bottom: 6px;
}

/* Wrapper gives a clear visible field box (works regardless of ion-input shadow DOM) */
.auth-input-wrapper {
  border: 1px solid #9ca3af;
  border-radius: 10px;
  background: #f9fafb;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

.auth-input-wrapper:focus-within {
  border-color: var(--trova-green);
  box-shadow: 0 0 0 3px rgba(var(--trova-green-rgb), 0.2);
  background: #fff;
}

.auth-input {
  --padding-start: 14px;
  --padding-end: 14px;
  --padding-top: 12px;
  --padding-bottom: 12px;
  --border-width: 0;
  --border-style: none;
  --border-color: transparent;
  --border-radius: 10px;
  --background: transparent;
  --highlight-color: transparent;
  --highlight-color-focused: transparent;
  --highlight-color-valid: transparent;
  --highlight-color-invalid: transparent;
  font-size: 16px;
  margin-top: 0;
}

.auth-input-wrapper .auth-input {
  width: 100%;
  box-sizing: border-box;
}

.legal-text {
  font-size: 13px;
  color: var(--ion-color-medium, #6b7280);
  margin: 0 0 24px 0;
  line-height: 1.5;
  text-align: center;
}

.legal-link {
  color: var(--trova-green);
  text-decoration: underline;
}

.submit-button {
  --background: var(--trova-green);
  --color: #ffffff;
  --border-radius: 12px;
  --padding-top: 16px;
  --padding-bottom: 16px;
  height: 52px;
  font-weight: 600;
  font-size: 16px;
  text-transform: none;
  margin-bottom: 32px;
  box-shadow: 0 4px 12px rgba(var(--trova-green-rgb), 0.35);
}

.submit-button:disabled {
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
  --border-color: var(--trova-green);
  --color: var(--trova-green);
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
  --background: rgba(var(--trova-green-rgb), 0.08);
}

@media (max-width: 480px) {
  .login-container {
    padding: 32px 20px;
  }

  .welcome-title {
    font-size: 20px;
  }
}
</style>
