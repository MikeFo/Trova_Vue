import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import { environment } from '../environments/environment';

export class ApiService {
  private api: AxiosInstance;

  constructor() {
    this.api = axios.create({
      baseURL: environment.apiUrl,
      headers: {
        'Content-Type': 'application/json',
      },
      withCredentials: true,
    });

    this.setupInterceptors();
  }

  /**
   * Sanitize data for logging - removes sensitive fields like passwords
   */
  private sanitizeForLogging(data: any): any {
    if (!data || typeof data !== 'object') {
      return data;
    }
    
    const sanitized = { ...data };
    const sensitiveFields = ['password', 'token', 'accessToken', 'refreshToken', 'secret', 'apiKey'];
    
    sensitiveFields.forEach(field => {
      if (sanitized[field]) {
        sanitized[field] = '[REDACTED]';
      }
    });
    
    return sanitized;
  }

  private setupInterceptors(): void {
    // Request interceptor - add auth token or Slack context
    this.api.interceptors.request.use(
      async (config) => {
        try {
          const { useFirebase } = await import('../composables/useFirebase');
          const firebaseAuth = useFirebase();
          // Wait for Firebase to finish restoring auth state before checking currentUser.
          await firebaseAuth.authReady;
          if (firebaseAuth.auth?.currentUser) {
            try {
              const token = await firebaseAuth.auth.currentUser.getIdToken();
              if (token && config.headers) {
                config.headers.Authorization = token;
              }
            } catch (tokenError) {
              // Continue without token - backend might handle auth differently
            }
          } else {
            // No Firebase user - attach Slack context so backend can authorize (console, map, org chart).
            // Prefer cached validation; fallback to current URL query so we send s even if cache expired or wasn't set.
            const { slackSessionService } = await import('./slack-session.service');
            let params: { s: string; communityId: string; slackUserId: string } | null = null;
            const slack = slackSessionService.getCurrentValidation();
            if (slack?.secretId) {
              params = { s: slack.secretId, communityId: String(slack.communityId), slackUserId: slack.slackUserId };
            } else if (typeof window !== 'undefined' && window.location?.search) {
              const q = new URLSearchParams(window.location.search);
              const s = q.get('s');
              const communityId = q.get('communityId');
              const slackUserId = q.get('slackUserId');
              if (s && communityId && slackUserId) {
                params = { s, communityId, slackUserId };
              }
            }
            if (params) {
              // Only add each param if not already present (avoids duplicate query keys that can break backends)
              const existingParams = (config.params || {}) as Record<string, unknown>;
              const urlQuery =
                typeof config.url === 'string' && config.url.includes('?')
                  ? config.url.slice(config.url.indexOf('?') + 1)
                  : '';
              const inUrl = new URLSearchParams(urlQuery);
              const add = (key: 's' | 'communityId' | 'slackUserId') =>
                existingParams[key] === undefined && !inUrl.has(key);
              const slackParams: Record<string, string> = {};
              if (add('s')) slackParams.s = params.s;
              if (add('communityId')) slackParams.communityId = params.communityId;
              if (add('slackUserId')) slackParams.slackUserId = params.slackUserId;
              if (config.method === 'get' || config.method === 'GET') {
                config.params = { ...config.params, ...slackParams };
              } else if (config.data != null && typeof config.data === 'object' && !Array.isArray(config.data)) {
                const body = config.data as Record<string, unknown>;
                if (body.s === undefined) body.s = params.s;
                if (body.communityId === undefined) body.communityId = params.communityId;
                if (body.slackUserId === undefined) body.slackUserId = params.slackUserId;
                config.data = body;
              } else if (config.data == null) {
                config.data = { s: params.s, communityId: params.communityId, slackUserId: params.slackUserId };
              }
            }
          }
        } catch (error) {
          // Firebase might not be available - that's okay if backend handles auth
        }
        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );

    // Response interceptor - handle errors
    this.api.interceptors.response.use(
      (response: AxiosResponse) => response,
      async (error) => {
        if (error.response?.status === 401) {
          // Handle unauthorized - redirect to login
          // TODO: Implement auth redirect
        }
        return Promise.reject(error);
      }
    );
  }

  async get<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    try {
      const response = await this.api.get<T>(url, config);
      return response.data;
    } catch (error: any) {
      const status = error.response?.status;
      const message = error.response?.data?.message ?? error.message;
      const is404 = status === 404;
      const isNotMember422 =
        status === 422 &&
        String(error.response?.data?.error || message || '')
          .toLowerCase()
          .includes('not a member of requested community');

      // Keep console readable: don't log missing endpoints (404) or expected empty-state membership checks (422).
      if (!is404 && !isNotMember422) {
        console.error(`API GET ${url}:`, message);
      }
      // Re-throw with more context
      const enhancedError = new Error(message || 'Request failed');
      (enhancedError as any).status = status;
      (enhancedError as any).response = error.response;
      throw enhancedError;
    }
  }

  async post<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    try {
      const response = await this.api.post<T>(url, data, config);
      return response.data;
    } catch (error: any) {
      const fullUrl = `${this.api.defaults.baseURL}${url}`;
      console.error(`[API] POST ${fullUrl}:`, error.response?.data?.message ?? error.message);
      
      // Extract error message from various possible response formats
      let errorMessage = 'Request failed';
      if (error.response?.data) {
        const responseData = error.response.data;
        // Handle nested error objects
        if (responseData.message && typeof responseData.message === 'object') {
          errorMessage = JSON.stringify(responseData.message) || `Server error (${error.response.status})`;
        } else {
          errorMessage = responseData.message || 
                        responseData.error || 
                        responseData.msg ||
                        (typeof responseData === 'string' ? responseData : JSON.stringify(responseData)) ||
                        `Server error (${error.response.status})`;
        }
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      // Create error with message but preserve original error for debugging
      const enhancedError = new Error(errorMessage);
      // Attach original error details for debugging
      (enhancedError as any).originalError = error;
      (enhancedError as any).response = error.response;
      (enhancedError as any).status = error.response?.status;
      throw enhancedError;
    }
  }

  async put<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.api.put<T>(url, data, config);
    return response.data;
  }

  async patch<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    try {
      const response = await this.api.patch<T>(url, data, config);
      return response.data;
    } catch (error: any) {
      console.error(`API PATCH ${url}:`, error.response?.data?.message ?? error.message);
      throw new Error(error.response?.data?.message || error.message || 'Request failed');
    }
  }

  async delete<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.api.delete<T>(url, config);
    return response.data;
  }
}

export const apiService = new ApiService();

