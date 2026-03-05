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
          // Try to get Firebase token (for API authentication)
          const { useFirebase } = await import('../composables/useFirebase');
          const firebaseAuth = useFirebase();
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
            // No Firebase user - if we have a valid Slack link session, attach it to every request
            // so the backend can authorize Slack-only users (console, map, org chart).
            const { slackSessionService } = await import('./slack-session.service');
            const slack = slackSessionService.getCurrentValidation();
            if (slack && slack.secretId) {
              const params = { s: slack.secretId, communityId: String(slack.communityId), slackUserId: slack.slackUserId };
              if (config.method === 'get' || config.method === 'GET') {
                config.params = { ...config.params, ...params };
              } else if (config.data != null && typeof config.data === 'object' && !Array.isArray(config.data)) {
                config.data = { ...params, ...config.data };
              } else if (config.data == null) {
                config.data = params;
              }
            }
          }
        } catch (error) {
          // Firebase might not be available - that's okay if backend handles auth
          // Don't log as error, just continue
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
      if (error.response?.status !== 404) {
        console.error(`API GET ${url}:`, error.response?.data?.message ?? error.message);
      }
      // Re-throw with more context
      const enhancedError = new Error(error.response?.data?.message || error.message || 'Request failed');
      (enhancedError as any).status = error.response?.status;
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

