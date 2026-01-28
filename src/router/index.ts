import { createRouter, createWebHistory } from '@ionic/vue-router';
import { RouteRecordRaw } from 'vue-router';
import TabsPage from '../views/TabsPage.vue';
import { requireAuth, requireSetupComplete } from './guards';

const routes: Array<RouteRecordRaw> = [
  {
    path: '/',
    redirect: '/login'
  },
  {
    path: '/org',
    redirect: (to) => {
      // Preserve all query parameters when redirecting to org-chart
      console.log('[Router] Redirecting /org to /tabs/org-chart with query:', to.query);
      return {
        path: '/tabs/org-chart',
        query: to.query
      };
    },
    meta: { requiresAuth: true },
    beforeEnter: [requireAuth, requireSetupComplete]
  },
  {
    path: '/login',
    component: () => import('@/views/auth/LoginPage.vue'),
    meta: { requiresGuest: true }
  },
  {
    path: '/signup',
    component: () => import('@/views/auth/SignupPage.vue'),
    meta: { requiresGuest: true }
  },
  {
    path: '/login/callback',
    component: () => import('@/views/auth/AuthCallbackPage.vue')
  },
  {
    path: '/logout',
    component: () => import('@/views/auth/LogoutPage.vue')
  },
  {
    path: '/setup',
    component: () => import('@/views/profile/SetupPage.vue'),
    meta: { requiresAuth: true },
    beforeEnter: requireAuth
  },
  {
    path: '/select-community',
    redirect: '/tabs/communities',
    meta: { requiresAuth: true },
    beforeEnter: [requireAuth, requireSetupComplete]
  },
  {
    path: '/map',
    redirect: (to) => {
      // Preserve query parameters when redirecting
      return {
        path: '/tabs/map',
        query: to.query
      };
    },
    meta: { requiresAuth: true },
    beforeEnter: [requireAuth, requireSetupComplete]
  },
  {
    path: '/tabs/',
    component: TabsPage,
    meta: { requiresAuth: true },
    beforeEnter: [requireAuth, requireSetupComplete],
    children: [
      {
        path: '',
        redirect: '/tabs/home'
      },
      {
        path: 'home',
        component: () => import('@/views/tabs/HomePage.vue')
      },
      {
        path: 'messages',
        component: () => import('@/views/tabs/MessagesPage.vue')
      },
      {
        path: 'discover',
        component: () => import('@/views/tabs/DiscoverPage.vue')
      },
      {
        path: 'map',
        component: () => import('@/views/tabs/MapPage.vue')
      },
      {
        path: 'communities',
        component: () => import('@/views/tabs/CommunitiesPage.vue')
      },
      {
        path: 'groups',
        component: () => import('@/views/tabs/GroupsPage.vue')
      },
      {
        path: 'groups/new',
        component: () => import('@/views/tabs/CreateGroupPage.vue')
      },
      {
        path: 'groups/:id',
        component: () => import('@/views/tabs/GroupDetailPage.vue')
      },
      {
        path: 'events',
        component: () => import('@/views/tabs/EventsPage.vue')
      },
      {
        path: 'events/new',
        name: 'create-event',
        component: () => import('@/views/tabs/CreateEventPage.vue')
      },
      {
        path: 'events/:id/edit',
        name: 'edit-event',
        component: () => import('@/views/tabs/CreateEventPage.vue')
      },
      {
        path: 'events/:id',
        name: 'event-detail',
        component: () => import('@/views/tabs/EventDetailPage.vue')
      },
      {
        path: 'profile',
        component: () => import('@/views/tabs/ProfilePage.vue')
      },
      {
        path: 'profile/:id',
        component: () => import('@/views/tabs/ProfilePage.vue')
      },
      {
        path: 'org-chart',
        component: () => import('@/views/tabs/OrgChartPage.vue')
      }
    ]
  },
  {
    path: '/communities/:communityId/console',
    component: () => import('@/views/admin/AdminConsolePage.vue'),
    meta: { requiresAuth: true },
    beforeEnter: requireAuth
  },
  {
    path: '/communities/:communityId/console/magic-intros',
    redirect: (to) => {
      // Redirect to admin console - magic intros is now a modal
      return {
        path: `/communities/${to.params.communityId}/console`,
        query: to.query
      };
    },
    meta: { requiresAuth: true },
    beforeEnter: requireAuth
  },
  {
    path: '/communities/:communityId/console/magic-intros/:date',
    redirect: (to) => {
      // Redirect to admin console - magic intros is now a modal
      return {
        path: `/communities/${to.params.communityId}/console`,
        query: to.query
      };
    },
    meta: { requiresAuth: true },
    beforeEnter: requireAuth
  },
  {
    path: '/communities/:communityId/console/skills',
    redirect: (to) => {
      // Redirect to admin console - skills is now a modal
      return {
        path: `/communities/${to.params.communityId}/console`,
        query: to.query
      };
    },
    meta: { requiresAuth: true },
    beforeEnter: requireAuth
  },
  {
    path: '/communities/:communityId/console/skills/:skillName',
    redirect: (to) => {
      // Redirect to admin console - skills is now a modal
      return {
        path: `/communities/${to.params.communityId}/console`,
        query: to.query
      };
    },
    meta: { requiresAuth: true },
    beforeEnter: requireAuth
  },
  {
    path: '/communities/:communityId/console/mentors/:type',
    redirect: (to) => {
      // Redirect to admin console - mentors is now a modal
      return {
        path: `/communities/${to.params.communityId}/console`,
        query: to.query
      };
    },
    meta: { requiresAuth: true },
    beforeEnter: requireAuth
  }
];

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes
});

// Router is ready - no global beforeEach needed, using beforeEnter on routes instead

export default router;
