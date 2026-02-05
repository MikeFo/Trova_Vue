import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged, User as FirebaseUser, type Auth } from 'firebase/auth';
import { useFirebase } from '../composables/useFirebase';
import { apiService } from './api.service';
import { useAuthStore } from '../stores/auth.store';
import { slackSessionService } from './slack-session.service';
import type { User } from '../stores/auth.store';

export class AuthService {
  private authListenerSetup = false;

  // Lazy getter for auth store to avoid calling it before Pinia is initialized
  private get authStore() {
    return useAuthStore();
  }

  constructor() {
    // Initialize auth listener early to restore persisted auth state
    // Use setTimeout to ensure Pinia is initialized
    setTimeout(() => {
      this.setupAuthListener();
    }, 0);
  }

  private setupAuthListener() {
    if (this.authListenerSetup) return;

    try {
      const { auth } = useFirebase();
      if (auth) {
        this.authListenerSetup = true;
        // Handle Google sign-in redirect result (user returning from Google)
        // Must run before onAuthStateChanged; only resolves with a value when returning from redirect
        this.handleRedirectResult(auth);
        // Listen for auth state changes - this will fire immediately with current user if authenticated
        onAuthStateChanged(auth, async (firebaseUser: FirebaseUser | null) => {
          if (firebaseUser) {
            try {
              await this.getUserProfile();
            } catch (error) {
              console.warn('Failed to get user profile on auth state change:', error);
            }
          } else {
            this.authStore.setUser(null);
          }
        });
      }
    } catch (error) {
      console.warn('Firebase auth not available yet:', error);
      setTimeout(() => {
        if (!this.authListenerSetup) {
          this.setupAuthListener();
        }
      }, 100);
    }
  }

  /**
   * Process the result of signInWithRedirect when the user returns from Google.
   * Runs once on app load; only does work when there is a pending redirect result.
   */
  private async handleRedirectResult(auth: Auth): Promise<void> {
    try {
      const { getRedirectResult } = await import('firebase/auth');
      const result = await getRedirectResult(auth);
      if (!result?.user) return;

      const token = await result.user.getIdToken();
      const givenName = result.user.displayName?.split(' ')[0] || '';
      const familyName = result.user.displayName?.split(' ').slice(1).join(' ') || '';

      let user = await this.getUserProfile();
      if (!user || !user.id) {
        try {
          user = await apiService.post<User>('/auth/signup?setEmailAsVerified=true&setCommunityFromEmail=true', {
            fname: givenName,
            lname: familyName,
          });
          if (user?.id) {
            this.authStore.setUser(user);
            slackSessionService.clearValidation();
          }
        } catch (error: any) {
          const status = error?.status || error?.response?.status;
          const isConflictOrServerError = status === 409 || status === 500;
          if (isConflictOrServerError) {
            for (let attempt = 1; attempt <= 3; attempt++) {
              await new Promise((r) => setTimeout(r, attempt * 500));
              try {
                user = await this.getUserProfile();
                if (user?.id) {
                  this.authStore.setUser(user);
                  slackSessionService.clearValidation();
                  break;
                }
              } catch (_) {
                if (attempt === 3) break;
              }
            }
          } else {
            await new Promise((r) => setTimeout(r, 500));
            user = await this.getUserProfile();
            if (user?.id) {
              this.authStore.setUser(user);
              slackSessionService.clearValidation();
            }
          }
        }
      } else {
        this.authStore.setUser(user);
      }
    } catch (error) {
      console.warn('Redirect result handling failed:', error);
    } finally {
      this.authStore.isLoading = false;
    }
  }

  /**
   * Wait for Firebase auth state to be determined
   * Returns a promise that resolves when auth state is known
   */
  private waitForAuthState(): Promise<FirebaseUser | null> {
    return new Promise((resolve) => {
      const { auth } = useFirebase();
      if (!auth) {
        resolve(null);
        return;
      }

      // If auth state is already known (user exists), resolve immediately
      if (auth.currentUser !== null) {
        resolve(auth.currentUser);
        return;
      }

      // Otherwise, wait for onAuthStateChanged to fire
      // This will fire immediately if auth state is already determined, or when it's restored
      let resolved = false;
      const unsubscribe = onAuthStateChanged(auth, (user) => {
        if (!resolved) {
          resolved = true;
          unsubscribe();
          resolve(user);
        }
      });

      // Timeout after 2 seconds - if auth state isn't determined by then, assume no user
      setTimeout(() => {
        if (!resolved) {
          resolved = true;
          unsubscribe();
          resolve(null);
        }
      }, 2000);
    });
  }

  private ensureAuthListener() {
    if (!this.authListenerSetup) {
      this.setupAuthListener();
    }
  }

  async signIn(email: string, password: string): Promise<void> {
    this.ensureAuthListener();
    this.authStore.isLoading = true;
    
    try {
      // In production, the backend handles authentication and manages Firebase users
      // The backend authenticates, creates/retrieves Firebase user, and returns user data
      const user = await apiService.post<User>('/auth/login', {
        email,
        password,
      });
      
      if (user && user.id) {
        // Backend authenticated successfully
        this.authStore.setUser(user);
        
        // Clear Slack session validation - user is now fully authenticated
        slackSessionService.clearValidation();
        
        // Backend handles Firebase user creation/authentication server-side
        // The user object returned from backend should contain all necessary info
        // Firebase auth state will be managed by the backend
        
        return;
      } else {
        throw new Error('Invalid response from server');
      }
    } catch (error: any) {
      // Don't log sensitive information
      const errorMessage = error.response?.data?.message || 
                          error.message || 
                          'Login failed. Please check your credentials and try again.';
      
      // Provide user-friendly error messages
      if (error.response?.status === 404) {
        throw new Error('No account found with this email address.');
      } else if (error.response?.status === 401) {
        throw new Error('Incorrect password. Please try again.');
      } else if (error.response?.status === 400) {
        throw new Error('Invalid email or password.');
      } else {
        throw new Error(errorMessage);
      }
    } finally {
      this.authStore.isLoading = false;
    }
  }

  async signUp(email: string, password: string): Promise<void> {
    const { auth } = useFirebase();
    if (!auth) throw new Error('Firebase auth not initialized');

    this.authStore.isLoading = true;
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const token = await userCredential.user.getIdToken();
      
      // Create user profile in backend with automatic community assignment
      await apiService.post('/auth/signup?setCommunityFromEmail=true', {
        email,
        firebaseUid: userCredential.user.uid,
      });
      
      await this.getUserProfile();
    } catch (error: any) {
      console.error('Sign up error:', error);
      throw error;
    } finally {
      this.authStore.isLoading = false;
    }
  }

  async logout(): Promise<void> {
    const { auth } = useFirebase();
    if (!auth) throw new Error('Firebase auth not initialized');

    try {
      await signOut(auth);
      this.authStore.logout();
      // Clear Slack session validation on logout
      slackSessionService.clearValidation();
    } catch (error: any) {
      console.error('Logout error:', error);
      throw error;
    }
  }

  async getUserProfile(): Promise<User | null> {
    try {
      const user = await apiService.get<User>('/users/me');
      if (user && user.id) {
        this.authStore.setUser(user);
        // Clear Slack session validation - user is now fully authenticated
        slackSessionService.clearValidation();
        return user;
      }
      console.warn('getUserProfile: User object missing id');
      return null;
    } catch (error: any) {
      const status = error?.status || error?.response?.status;
      const message = error?.message || 'Unknown error';
      console.error(`Get user profile error (status: ${status}):`, message);
      // Don't throw - return null so calling code can handle it
      return null;
    }
  }

  async checkAuth(): Promise<boolean> {
    try {
      this.ensureAuthListener();
      const { auth } = useFirebase();
      if (!auth) return false;

      // Wait for Firebase to determine auth state (it may still be restoring from localStorage)
      // This ensures we get the correct auth state even on page refresh
      const currentUser = await this.waitForAuthState();

      if (currentUser) {
        try {
          // Fetch user profile from backend
          await this.getUserProfile();
          return true;
        } catch (error) {
          console.warn('Failed to get user profile:', error);
          // If profile fetch fails but Firebase user exists,
          // check if we already have user data in store (from previous session)
          if (this.authStore.user) {
            // We have cached user data, use it
            return true;
          }
          // No cached user data - still return true to prevent login redirect
          // The auth listener will update the store when backend is available
          // This handles the case where backend is temporarily down
          return true;
        }
      }
      return false;
    } catch (error) {
      console.warn('Auth check failed:', error);
      return false;
    }
  }

  async signInWithGoogle(): Promise<void> {
    const { auth } = useFirebase();
    if (!auth) throw new Error('Firebase auth not initialized');

    if (typeof window === 'undefined' || (window as any).Capacitor) {
      throw new Error('Mobile Google auth not yet implemented');
    }

    this.authStore.isLoading = true;
    try {
      const { GoogleAuthProvider, signInWithRedirect } = await import('firebase/auth');
      const provider = new GoogleAuthProvider();
      await signInWithRedirect(auth, provider);
      // Page will redirect to Google; when user returns, handleRedirectResult() runs
    } catch (error: any) {
      this.authStore.isLoading = false;
      console.error('Google sign in error:', error);
      throw error;
    }
  }
}

// Lazy initialization to prevent errors during module load
let _authServiceInstance: AuthService | null = null;

export function getAuthService(): AuthService {
  if (!_authServiceInstance) {
    _authServiceInstance = new AuthService();
  }
  return _authServiceInstance;
}

export const authService = getAuthService();

