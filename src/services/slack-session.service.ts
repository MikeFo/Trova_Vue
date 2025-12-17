import { apiService } from './api.service';

export interface SlackSessionValidation {
  isValid: boolean;
  validatedAt: number;
  secretId: string;
  communityId: number;
  slackUserId: string;
}

/**
 * Service to handle Slack secretId validation as a session gate
 * Validates secretId once on initial load, then allows free navigation
 */
export class SlackSessionService {
  private validationCache: SlackSessionValidation | null = null;
  private readonly VALIDATION_CACHE_KEY = 'slack-session-validation';
  private readonly VALIDATION_DURATION = 60 * 1000; // 60 seconds in milliseconds

  /**
   * Validate secretId from URL and establish session
   * This should be called once on app load if secretId is present
   */
  async validateSecretId(
    secretId: string,
    communityId: number,
    slackUserId: string
  ): Promise<boolean> {
    try {
      // Check cache first
      const cached = this.getCachedValidation(secretId);
      if (cached && this.isValidationStillValid(cached)) {
        console.log('[SlackSessionService] Using cached validation');
        return true;
      }

      // Validate with backend by making a lightweight validation call
      // We'll use the map endpoint as the validation endpoint
      // Note: Backend may mark secretId as used, but we're caching the validation
      // so subsequent calls won't need to send secretId again
      const payload = {
        communityId,
        s: secretId,
      };

      // Make a minimal validation request
      // This validates secretId with backend
      // If backend marks it as used, that's okay - we cache the validation
      // and won't send it in subsequent calls
      await apiService.post('/communities/getProfilesForUserAndCommunity', payload);

      // If successful, cache the validation
      const validation: SlackSessionValidation = {
        isValid: true,
        validatedAt: Date.now(),
        secretId,
        communityId,
        slackUserId,
      };

      this.cacheValidation(validation);
      console.log('[SlackSessionService] SecretId validated successfully');
      return true;
    } catch (error: any) {
      console.error('[SlackSessionService] SecretId validation failed:', error);
      
      // Check if error is due to expired secretId
      const errorMessage = error.message || error.response?.data?.message || '';
      const status = error.status || error.response?.status;
      
      if (status === 401 || 
          errorMessage.toLowerCase().includes('expired') || 
          errorMessage.toLowerCase().includes('invalid') || 
          errorMessage.toLowerCase().includes('secret')) {
        return false;
      }
      
      // Other errors - rethrow
      throw error;
    }
  }

  /**
   * Check if secretId has been validated for this session
   */
  isSecretIdValidated(secretId: string): boolean {
    const cached = this.getCachedValidation(secretId);
    if (!cached) return false;
    return this.isValidationStillValid(cached);
  }

  /**
   * Check if there's any validated session (regardless of secretId)
   * Useful when navigating between pages where secretId might not be in URL
   */
  hasValidatedSession(): boolean {
    const validation = this.getCurrentValidation();
    if (!validation) return false;
    return this.isValidationStillValid(validation);
  }

  /**
   * Check if user came from Slack link (has secretId validation)
   * vs fully authenticated user (no secretId needed)
   */
  isSlackLinkUser(): boolean {
    return this.getCurrentValidation() !== null;
  }

  /**
   * Check if Slack session has expired
   */
  isSessionExpired(): boolean {
    const validation = this.getCurrentValidation();
    if (!validation) return false; // No session = not expired (might be authenticated user)
    
    const now = Date.now();
    const age = now - validation.validatedAt;
    return age >= this.VALIDATION_DURATION;
  }

  /**
   * Get cached validation if it exists and is still valid
   * @param secretId - Optional secretId to match. If not provided, returns any cached validation
   */
  private getCachedValidation(secretId?: string): SlackSessionValidation | null {
    try {
      const cached = localStorage.getItem(this.VALIDATION_CACHE_KEY);
      if (!cached) return null;

      const validation: SlackSessionValidation = JSON.parse(cached);
      
      // If secretId provided, only return if it matches
      if (secretId && validation.secretId !== secretId) return null;

      return validation;
    } catch (error) {
      console.warn('[SlackSessionService] Failed to read cached validation:', error);
      return null;
    }
  }

  /**
   * Check if cached validation is still within the 60-second window
   */
  private isValidationStillValid(validation: SlackSessionValidation): boolean {
    const now = Date.now();
    const age = now - validation.validatedAt;
    return age < this.VALIDATION_DURATION;
  }

  /**
   * Cache validation result
   */
  private cacheValidation(validation: SlackSessionValidation): void {
    try {
      localStorage.setItem(this.VALIDATION_CACHE_KEY, JSON.stringify(validation));
      this.validationCache = validation;
    } catch (error) {
      console.warn('[SlackSessionService] Failed to cache validation:', error);
    }
  }

  /**
   * Clear validation cache (e.g., on logout)
   */
  clearValidation(): void {
    try {
      localStorage.removeItem(this.VALIDATION_CACHE_KEY);
      this.validationCache = null;
    } catch (error) {
      console.warn('[SlackSessionService] Failed to clear validation:', error);
    }
  }

  /**
   * Get current validation state
   */
  getCurrentValidation(): SlackSessionValidation | null {
    if (this.validationCache && this.isValidationStillValid(this.validationCache)) {
      return this.validationCache;
    }
    
    // Try to get from cache
    const cached = this.getCachedValidation();
    if (cached && this.isValidationStillValid(cached)) {
      this.validationCache = cached;
      return cached;
    }
    
    // Cache is expired or invalid
    this.validationCache = null;
    return null;
  }
}

export const slackSessionService = new SlackSessionService();

