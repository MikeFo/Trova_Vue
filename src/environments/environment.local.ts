export const environment = {
  production: false,
  env: 'local',
  // Point at staging API so login/auth work without a local backend. For a local API, use apiUrl: '/api' and set VITE_API_TARGET in vite proxy.
  apiUrl: 'https://trova-api-staging.herokuapp.com',
  oidcConfig: {
    client_id: '0oa4q2hnylxAJfIHR5d7',
    server_host: 'https://dev-62292605.okta.com/oauth2/default',
    redirect_url: 'https://www.trovaus.com/login/callback',
    end_session_redirect_url: window.location.origin + '/logout',
    scopes: 'openid profile',
    pkce: true,
    audience: 'api://default',
  },
  scheme: 'com.okta.dev-62292605:/',
  siteUrl: 'http://localhost:5173',
  googleMapsApiFindPlaceUrl: 'https://maps.googleapis.com/maps/api/place',
  googleMapsApiKey: 'AIzaSyByxzIDhPosaIwi_sHHXSmLWdltBVKemeI',
  googleAnalyticsTrackerId: 'UA-123516927-1',
  oktaDomain: 'dev-62292605.okta.com',
  oktaClientId: '0oa4q2hnylxAJfIHR5d7',
  firebaseConfig: {
    apiKey: 'AIzaSyApRP_32kFsundQD_Mg_Ku7KEKQl7wiEIo',
    authDomain: 'trovatest1.firebaseapp.com',
    databaseURL: 'https://trovatest1.firebaseio.com',
    projectId: 'trovatest1',
    storageBucket: 'trovatest1.appspot.com',
    messagingSenderId: '847854126512',
    appId: '1:847854126512:web:834ab59204075cb4898275',
    measurementId: 'G-CB2TGDWF80',
  },
  slackClientId: '494472210870.4259976258198',
  webexClientId:
    'Cdf4f7aebc8d6f9c2948f9d1ac419519c2b7075e819aa864e9c0053c65cb7e017',
  stripeConfig: {
    publishableKey:
      'pk_test_51M1x7NL6QjOYDPnLaSTxfzLZOUXwx2XUVkd5qEE4vxC9G3a3ZrsX8I0CT4tgF2u4pbFfi8FUvbQmxTa8tyHtbcIg00O30c3x3P',
    proMonthlyPriceId: 'price_1M9v6AL6QjOYDPnLtorGdr8g',
    proYearlyPriceId: 'price_1M9uyyL6QjOYDPnLk4CY2wIS',
    premiumMonthlyPriceId: 'price_1M9uxoL6QjOYDPnLh7dFELo7',
    premiumYearlyPriceId: 'price_1M9uxoL6QjOYDPnL4PkP8eQG',
  },
  slackAppId: 'A04MLT6AAKH',
};

