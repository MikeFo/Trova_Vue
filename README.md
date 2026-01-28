# Trova Ionic Vue - Modern Frontend

This is the new modern frontend for Trova, built with Ionic Vue 8 and Capacitor 7.

## Project Status

✅ **Phase 1: Foundation (COMPLETE)**
- Project structure created
- Capacitor configured with app ID: `com.trovaus.app.v2`
- Environment configurations (local, staging, production)
- Design system with modern CSS variables
- Pinia state management setup
- API service layer with interceptors
- Router with authentication guards
- Firebase composable
- Basic authentication views (Login, Signup, Callback, Logout)
- Profile setup page placeholder

## Getting Started

### Prerequisites
- Node.js 18+ (currently using Node 16 - warnings may appear)
- npm or yarn

### Installation

```bash
npm install
```

### Development

```bash
npm run dev
```

### Build

```bash
npm run build
```

### Testing

```bash
npm run test:unit
npm run test:e2e
```

## Project Structure

```
trova-ionic-vue/
├── src/
│   ├── assets/          # Images, fonts, icons
│   ├── components/      # Reusable UI components
│   │   ├── base/        # Base components
│   │   ├── forms/       # Form components
│   │   └── layout/      # Layout components
│   ├── composables/     # Vue composables (reusable logic)
│   ├── environments/    # Environment configs
│   ├── services/        # API services
│   ├── stores/          # Pinia stores
│   ├── styles/          # Global styles, design system
│   ├── views/           # Page components
│   │   ├── auth/        # Authentication pages
│   │   └── profile/     # Profile pages
│   ├── router/          # Vue Router configuration
│   └── utils/           # Utility functions
├── android/             # Capacitor Android project
├── ios/                 # Capacitor iOS project
└── capacitor.config.ts  # Capacitor configuration
```

## Next Steps

### Phase 2: Core Features Migration
1. Implement authentication service (Firebase + Okta)
2. Build profile setup wizard
3. Create main tab navigation
4. Implement core messaging features

### Phase 3: Community Features
1. Communities
2. Groups
3. Events
4. Matching/Search

### Phase 4: Advanced Features
1. Integrations (Slack, Teams, Webex)
2. Maps & Location
3. Billing
4. Notifications

## Environment Configuration

Environment files are located in `src/environments/`:
- `environment.local.ts` - Local development
- `environment.ts` - Staging (default)
- `environment.prod.ts` - Production

## Design System

The design system is defined in `src/styles/design-system.css` with:
- Modern color palette
- 8px spacing grid
- Typography scale
- Border radius system
- Shadow elevations
- Smooth transitions

## State Management

Using Pinia for state management. Stores are in `src/stores/`:
- `auth.store.ts` - Authentication state

## API Service

The API service (`src/services/api.service.ts`) provides:
- Axios instance with base configuration
- Request/response interceptors
- Automatic token injection
- Error handling

## Notes

- This project uses Node 16, but modern dependencies require Node 18+. Consider upgrading Node version.
- Capacitor plugins need to be added as features are implemented
- Firebase SDK v9+ (modular) is used for better tree-shaking
- Pushing to the `staging` branch triggers the Netlify “Vue Staging” deploy.

