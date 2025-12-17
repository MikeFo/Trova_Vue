# Deployment Guide

This guide covers how to deploy the Trova Ionic Vue application to Firebase Hosting.

## Prerequisites

1. **Install Firebase CLI**:
   ```bash
   npm install -g firebase-tools
   ```

2. **Login to Firebase**:
   ```bash
   firebase login
   ```

3. **Verify Firebase projects are accessible**:
   ```bash
   firebase projects:list
   ```
   You should see `trovainc` (production) and `trovatest1` (staging) in the list.

## Build Configuration

The project uses Vite build modes to select the correct environment:
- **Development**: `npm run dev` (uses `environment.local.ts`)
- **Staging**: `npm run build:staging` (uses `environment.staging.ts`)
- **Production**: `npm run build:prod` (uses `environment.prod.ts`)

## Deployment Steps

### Deploy to Staging

```bash
npm run deploy:staging
```

This will:
1. Build the app with staging configuration
2. Deploy to Firebase project `trovatest1`
3. Host at `https://www.trova-staging.com` (configured in Firebase Hosting)

### Deploy to Production

```bash
npm run deploy:prod
```

This will:
1. Build the app with production configuration
2. Deploy to Firebase project `trovainc`
3. Host at `https://www.trovaus.com` (configured in Firebase Hosting)

## Manual Deployment

If you need to deploy manually:

1. **Build the app**:
   ```bash
   # For staging
   npm run build:staging
   
   # For production
   npm run build:prod
   ```

2. **Deploy to Firebase**:
   ```bash
   # For staging
   firebase deploy --project staging
   
   # For production
   firebase deploy --project production
   ```

## Firebase Hosting Configuration

The `firebase.json` file configures:
- **Public directory**: `dist` (Vite build output)
- **SPA routing**: All routes redirect to `index.html` for client-side routing
- **Caching**: Optimized cache headers for static assets

## Custom Domain Setup

Custom domains are configured in the Firebase Console:
- Production: `www.trovaus.com` → `trovainc` project
- Staging: `www.trova-staging.com` → `trovatest1` project

To add or modify domains:
1. Go to Firebase Console → Hosting
2. Select the project (production or staging)
3. Add custom domain in the Hosting settings

## Environment Variables

Environment-specific configurations are in:
- `src/environments/environment.local.ts` - Local development
- `src/environments/environment.staging.ts` - Staging environment
- `src/environments/environment.prod.ts` - Production environment

The correct environment is automatically selected based on the build mode.

## Troubleshooting

### Build fails
- Ensure Node.js 18+ is installed
- Run `npm install` to ensure dependencies are up to date
- Check for TypeScript errors: `npm run lint`

### Deployment fails
- Verify Firebase CLI is logged in: `firebase login`
- Check project access: `firebase projects:list`
- Ensure the `dist` directory exists after build

### Wrong environment loaded
- Verify build mode matches deployment target
- Check `src/environments/environment.ts` is correctly selecting the environment
- Ensure `firebase.json` and `.firebaserc` are configured correctly

## CI/CD Integration

For automated deployments, you can integrate with:
- **GitHub Actions**: Use Firebase CLI in workflow
- **GitLab CI**: Add Firebase deployment step
- **CircleCI**: Configure Firebase deployment job

Example GitHub Actions workflow:
```yaml
name: Deploy
on:
  push:
    branches: [main]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm install
      - run: npm run build:prod
      - run: npm install -g firebase-tools
      - run: firebase deploy --project production --token ${{ secrets.FIREBASE_TOKEN }}
```




