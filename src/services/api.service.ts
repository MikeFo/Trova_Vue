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
    // Request interceptor - add auth token
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
                // Log for debugging (only for org chart endpoint)
                if (config.url?.includes('getOrgDataForCommunity')) {
                  console.log('[ApiService] Added Firebase auth token to org chart request');
                }
              } else {
                if (config.url?.includes('getOrgDataForCommunity')) {
                  console.warn('[ApiService] No Firebase token available for org chart request');
                }
              }
            } catch (tokenError) {
              console.warn('Failed to get Firebase token:', tokenError);
              // Continue without token - backend might handle auth differently
            }
          } else {
            if (config.url?.includes('getOrgDataForCommunity')) {
              console.warn('[ApiService] No Firebase currentUser for org chart request');
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
      // Only log non-404 errors to reduce console noise for unimplemented endpoints
      if (error.response?.status !== 404) {
        console.error(`API GET Error for ${url}:`, error);
        console.error('Response:', error.response?.data);
        console.error('Status:', error.response?.status);
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
      // Log the full URL being requested (helps verify endpoint)
      const fullUrl = `${this.api.defaults.baseURL}${url}`;
      console.log(`[API] POST Request to: ${fullUrl}`);
      
      const response = await this.api.post<T>(url, data, config);
      return response.data;
    } catch (error: any) {
      // Log the full URL that failed (helps verify endpoint)
      const fullUrl = `${this.api.defaults.baseURL}${url}`;
      console.error(`[API] POST Error for: ${fullUrl}`);
      console.error('[API] Response status:', error.response?.status);
      
      if (error.response?.status === 404) {
        console.error(`[API] Endpoint not found. Please verify the endpoint exists: ${fullUrl}`);
      }
      
      // Only log response data if it doesn't contain sensitive info
      if (error.response?.data && typeof error.response.data === 'object') {
        const sanitizedResponse = this.sanitizeForLogging(error.response.data);
        console.error('[API] Response data:', sanitizedResponse);
      }
      
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
      console.error(`API PATCH Error for ${url}:`, error);
      console.error('Response:', error.response?.data);
      console.error('Status:', error.response?.status);
      throw new Error(error.response?.data?.message || error.message || 'Request failed');
    }
  }

  async delete<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.api.delete<T>(url, config);
    return response.data;
  }
}

export const apiService = new ApiService();

