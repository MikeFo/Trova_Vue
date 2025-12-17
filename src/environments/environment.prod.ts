export const environment = {
  production: true,
  env: 'production',
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
  apiUrl: 'https://api.trovaus.com',
  siteUrl: 'https://www.trovaus.com',
  googleMapsApiFindPlaceUrl: 'https://maps.googleapis.com/maps/api/place',
  googleMapsApiKey: 'AIzaSyByxzIDhPosaIwi_sHHXSmLWdltBVKemeI',
  googleAnalyticsTrackerId: 'UA-123516927-1',
  oktaDomain: 'dev-62292605.okta.com',
  oktaClientId: '0oa4q2hnylxAJfIHR5d7',
  firebaseConfig: {
    apiKey: 'AIzaSyByxzIDhPosaIwi_sHHXSmLWdltBVKemeI',
    authDomain: 'trovainc.firebaseapp.com',
    databaseURL: 'https://trovainc.firebaseio.com',
    projectId: 'trovainc',
    storageBucket: 'trovainc.appspot.com',
    messagingSenderId: '833612711400',
    appId: '1:833612711400:web:00ff0727b4070be17bd05d',
    measurementId: 'G-80YP6SYM5W',
  },
  slackClientId: '494472210870.3358687435009',
  webexClientId:
    'Cdf4f7aebc8d6f9c2948f9d1ac419519c2b7075e819aa864e9c0053c65cb7e017',
  stripeConfig: {
    publishableKey:
      'pk_live_51M1x7NL6QjOYDPnL33CZvmrVJZNGpWMkQ4OZE6RIFyU6KtQmNRWuUaWrOKV4xHzPTvkIpOyCVSP3DqcryL8vjERt00dPhWLwQZ',
    proMonthlyPriceId: 'price_1M9vH4L6QjOYDPnLjM13DEMa',
    proYearlyPriceId: 'price_1M9vH4L6QjOYDPnLWkBTXIN8',
    premiumMonthlyPriceId: 'price_1M9vGvL6QjOYDPnLgTHe5yWx',
    premiumYearlyPriceId: 'price_1M9vGvL6QjOYDPnL0rRZQbZa',
  },
  slackAppId: 'A03AJL7CT09',
};

