import { RouteLocationNormalized, NavigationGuardNext } from 'vue-router';
import { useAuthStore } from '../stores/auth.store';

/** True if this navigation has Slack link params (s, communityId, slackUserId) so we allow through without auth and let the page validate secretId. */
function hasSlackLinkParams(to: RouteLocationNormalized): boolean {
  const q = to.query;
  return Boolean(q.s && q.communityId && q.slackUserId);
}

export async function requireAuth(
  to: RouteLocationNormalized,
  from: RouteLocationNormalized,
  next: NavigationGuardNext
) {
  const authStore = useAuthStore();

  if (hasSlackLinkParams(to)) {
    next();
    return;
  }

  try {
    const { authService } = await import('../services/auth.service');
    const isAuthenticated = await authService.checkAuth();

    if (!isAuthenticated) {
      next({
        path: '/login',
        query: { redirect: to.fullPath }
      });
    } else {
      next();
    }
  } catch (error) {
    console.error('Auth guard error:', error);
    next({
      path: '/login',
      query: { redirect: to.fullPath }
    });
  }
}

export async function requireSetupComplete(
  to: RouteLocationNormalized,
  from: RouteLocationNormalized,
  next: NavigationGuardNext
) {
  const authStore = useAuthStore();

  if (hasSlackLinkParams(to)) {
    next();
    return;
  }

  try {
    const { authService } = await import('../services/auth.service');
    const isAuthenticated = await authService.checkAuth();

    if (!isAuthenticated) {
      next({
        path: '/login',
        query: { redirect: to.fullPath }
      });
      return;
    }
  } catch (error) {
    console.error('Auth check error:', error);
    next({
      path: '/login',
      query: { redirect: to.fullPath }
    });
    return;
  }

  // Try to load user profile if not available (might have failed during auth)
  if (!authStore.user) {
    try {
      const { authService } = await import('../services/auth.service');
      await authService.getUserProfile();
      // Give store a moment to update
      await new Promise(resolve => setTimeout(resolve, 100));
    } catch (error) {
      console.warn('Could not load user profile in router guard:', error);
      // Continue anyway - let the app handle it
    }
  }

  // Then check setup completion
  // Only redirect to setup if we're certain setup is incomplete
  // If user data isn't available, allow access and let the app handle it
  if (authStore.user && !authStore.isSetupComplete) {
    next({
      path: '/setup'
    });
  } else {
    next();
  }
}

