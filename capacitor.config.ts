import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.trovaus.app.v2',
  appName: 'trova',
  webDir: 'dist',
  bundledWebRuntime: false,
  npmClient: 'npm',
  ios: {
    backgroundColor: '#ffffff',
    minVersion: '12',
    allowsLinkPreview: false
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 0
    },
    GoogleAuth: {
      scopes: ['profile', 'email'],
      serverClientId: '833612711400-njment6q6i4fu2j62q6ido9a6rovaa81.apps.googleusercontent.com',
      forceCodeForRefreshToken: true
    }
  },
  cordova: {}
};

export default config;

