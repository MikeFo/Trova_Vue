const e = import.meta.env;

export const environment = {
  production: false,
  env: 'local',
  apiUrl: '/api', // Use Vite proxy in development
  oidcConfig: {
    client_id: e.VITE_OIDC_CLIENT_ID ?? '',
    server_host: e.VITE_OIDC_SERVER_HOST ?? '',
    redirect_url: e.VITE_OIDC_REDIRECT_URL ?? 'https://www.trovaus.com/login/callback',
    end_session_redirect_url: window.location.origin + '/logout',
    scopes: 'openid profile',
    pkce: true,
    audience: 'api://default',
  },
  scheme: (e.VITE_OIDC_SCHEME ?? 'com.okta.dev-62292605:/') as string,
  siteUrl: 'http://localhost:5173',
  googleMapsApiFindPlaceUrl: 'https://maps.googleapis.com/maps/api/place',
  googleMapsApiKey: e.VITE_GOOGLE_MAPS_API_KEY ?? '',
  googleAnalyticsTrackerId: e.VITE_GOOGLE_ANALYTICS_TRACKER_ID ?? '',
  oktaDomain: e.VITE_OKTA_DOMAIN ?? '',
  oktaClientId: e.VITE_OKTA_CLIENT_ID ?? '',
  firebaseConfig: {
    apiKey: e.VITE_FIREBASE_API_KEY ?? '',
    authDomain: e.VITE_FIREBASE_AUTH_DOMAIN ?? '',
    databaseURL: e.VITE_FIREBASE_DATABASE_URL ?? '',
    projectId: e.VITE_FIREBASE_PROJECT_ID ?? '',
    storageBucket: e.VITE_FIREBASE_STORAGE_BUCKET ?? '',
    messagingSenderId: e.VITE_FIREBASE_MESSAGING_SENDER_ID ?? '',
    appId: e.VITE_FIREBASE_APP_ID ?? '',
    measurementId: e.VITE_FIREBASE_MEASUREMENT_ID ?? '',
  },
  slackClientId: e.VITE_SLACK_CLIENT_ID ?? '',
  webexClientId: e.VITE_WEBEX_CLIENT_ID ?? '',
  stripeConfig: {
    publishableKey: e.VITE_STRIPE_PUBLISHABLE_KEY ?? '',
    proMonthlyPriceId: e.VITE_STRIPE_PRO_MONTHLY_PRICE_ID ?? '',
    proYearlyPriceId: e.VITE_STRIPE_PRO_YEARLY_PRICE_ID ?? '',
    premiumMonthlyPriceId: e.VITE_STRIPE_PREMIUM_MONTHLY_PRICE_ID ?? '',
    premiumYearlyPriceId: e.VITE_STRIPE_PREMIUM_YEARLY_PRICE_ID ?? '',
  },
  slackAppId: e.VITE_SLACK_APP_ID ?? '',
};
