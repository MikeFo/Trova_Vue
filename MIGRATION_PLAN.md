# Trova Ionic Vue Migration Plan

## ✅ Completed
- [x] Project setup (Ionic Vue + Vite)
- [x] Design system foundation
- [x] Authentication (Login/Signup with Firebase)
- [x] Profile setup wizard (7-step flow)
- [x] Home page (modern redesign)
- [x] Basic routing structure
- [x] Tab navigation structure
- [x] API service layer with interceptors
- [x] Pinia state management
- [x] Environment configuration

---

## 🎯 Phase 1: Core User Experience (Priority: HIGH)

### 1.1 Discover/Matches Page
**Status:** Basic placeholder exists
**Complexity:** High

**Features to implement:**
- [ ] Matches/Intros system
  - [ ] Swipeable match cards (IonSlides or custom)
  - [ ] Match algorithm integration
  - [ ] "Say Hi" functionality
  - [ ] Match actions (accept, pass, snooze)
  - [ ] Weekly match limits
  - [ ] Match history/seens
- [ ] Search & Filter
  - [ ] User search by attributes
  - [ ] Filter by interests, location, etc.
  - [ ] Advanced search filters
- [ ] Toggle between "Intros" and "All Members"
- [ ] User profile cards preview
- [ ] Empty states for no matches
- [ ] Match analytics/stats

**API Endpoints needed:**
- `/matches` - Get user matches
- `/matches/:id/say-hi` - Send introduction
- `/users/search` - Search users
- `/users/:id/match-actions` - Accept/pass/snooze

**Components to create:**
- `MatchCard.vue` - Swipeable match card
- `SearchUsersAttribute.vue` - Advanced user search
- `SayHiModal.vue` - Introduction modal
- `MatchFilters.vue` - Filter sidebar/modal

---

### 1.2 Messages/Conversations
**Status:** Basic placeholder exists
**Complexity:** Very High (Firebase Realtime)

**Features to implement:**
- [ ] Conversations list
  - [ ] Real-time conversation list (Firebase)
  - [ ] Unread message counts
  - [ ] Last message preview
  - [ ] Online status indicators
  - [ ] Search conversations
- [ ] Individual chat threads
  - [ ] Real-time messaging (Firebase Firestore)
  - [ ] Message input with rich text (Quill)
  - [ ] Image/video uploads
  - [ ] Message reactions
  - [ ] Typing indicators
  - [ ] Read receipts
  - [ ] Message timestamps
  - [ ] Message deletion
  - [ ] Message flags/reporting
- [ ] Group conversations
  - [ ] Create group chat
  - [ ] Add/remove participants
  - [ ] Group chat management
- [ ] Message notifications
  - [ ] Push notifications
  - [ ] In-app notifications

**API Endpoints needed:**
- `/conversations` - Get conversations list
- Firebase Firestore for real-time messaging

**Services to create:**
- `conversation.service.ts` - Conversation management
- `chat.service.ts` - Real-time chat logic
- `firebase-messaging.service.ts` - Push notifications

**Components to create:**
- `ConversationsList.vue` - Main conversations view
- `ChatThread.vue` - Individual chat view
- `MessageInput.vue` - Message composer
- `MessageBubble.vue` - Individual message display
- `CreateGroupChatModal.vue` - Group chat creation

**Dependencies to add:**
- `quill` - Rich text editor
- Firebase Firestore
- Firebase Cloud Messaging

---

### 1.3 Profile Page
**Status:** Basic placeholder exists
**Complexity:** Medium

**Features to implement:**
- [ ] View own profile
  - [ ] Profile header with photo
  - [ ] Bio/description
  - [ ] Interests/passions display
  - [ ] Location display
  - [ ] Background (education, work)
  - [ ] Intentions
- [ ] View other users' profiles
  - [ ] Public profile view
  - [ ] Match compatibility display
  - [ ] Common interests highlight
  - [ ] "Say Hi" button
  - [ ] Report/block functionality
- [ ] Edit profile
  - [ ] Edit all profile fields
  - [ ] Photo upload/edit
  - [ ] Crop image functionality
  - [ ] Save changes
- [ ] Profile navigation
  - [ ] Navigate to other user profiles
  - [ ] Profile deep linking

**API Endpoints needed:**
- `/users/me` - Get current user
- `/users/:id` - Get user by ID
- `/users/:id/profile` - Update profile
- `/users/:id/photo` - Upload photo

**Components to create:**
- `ProfileHeader.vue` - Profile photo and basic info
- `ProfileSections.vue` - Interests, background, etc.
- `EditProfileModal.vue` - Profile editing
- `PhotoUploader.vue` - Photo upload with crop
- `UserCard.vue` - Reusable user card component

---

## 🎯 Phase 2: Community Features (Priority: MEDIUM)

### 2.1 Communities Page
**Status:** Basic placeholder exists
**Complexity:** High

**Features to implement:**
- [ ] Communities list
  - [ ] Browse communities
  - [ ] Search communities
  - [ ] Filter by category
  - [ ] Join/leave communities
- [ ] Community detail view
  - [ ] Community info
  - [ ] Member list
  - [ ] Community events
  - [ ] Community resources
- [ ] Build community
  - [ ] Community creation flow
  - [ ] Community settings
  - [ ] Community branding
- [ ] Community management (for admins)
  - [ ] Edit community
  - [ ] Manage members
  - [ ] Community console/analytics

**API Endpoints needed:**
- `/communities` - List communities
- `/communities/:id` - Get community
- `/communities` - Create community
- `/communities/:id` - Update community
- `/communities/:id/join` - Join community
- `/communities/:id/members` - Get members

**Components to create:**
- `CommunitiesList.vue` - Community browsing
- `CommunityCard.vue` - Community display card
- `CommunityDetail.vue` - Full community view
- `BuildCommunityModal.vue` - Community creation
- `CommunityConsole.vue` - Admin management

---

### 2.2 Groups/Channels (Tab 2)
**Status:** Not started
**Complexity:** High

**Features to implement:**
- [ ] Groups list
  - [ ] Browse groups
  - [ ] Group categories
  - [ ] Join/leave groups
- [ ] Group detail view
  - [ ] Group info
  - [ ] Group feed/activity
  - [ ] Group members
  - [ ] Group chat/channels
- [ ] Create group
  - [ ] Group creation flow
  - [ ] Group settings
- [ ] Group management
  - [ ] Edit group
  - [ ] Manage members
  - [ ] Group permissions

**API Endpoints needed:**
- `/groups` - List groups
- `/groups/:id` - Get group
- `/groups` - Create group
- `/groups/:id` - Update group

**Components to create:**
- `GroupsList.vue` - Groups browsing
- `GroupCard.vue` - Group display
- `GroupDetail.vue` - Full group view
- `CreateGroupModal.vue` - Group creation

---

### 2.3 Events (Tab 5)
**Status:** Not started
**Complexity:** Medium

**Features to implement:**
- [ ] Events list
  - [ ] Upcoming events
  - [ ] Past events
  - [ ] Event calendar view
  - [ ] Filter events
- [ ] Event detail view
  - [ ] Event info
  - [ ] RSVP functionality
  - [ ] Event attendees
  - [ ] Event location/map
- [ ] Create event
  - [ ] Event creation form
  - [ ] Event settings
- [ ] Edit event
  - [ ] Event editing
  - [ ] Cancel event

**API Endpoints needed:**
- `/events` - List events
- `/events/:id` - Get event
- `/events` - Create event
- `/events/:id` - Update event
- `/events/:id/rsvp` - RSVP to event

**Components to create:**
- `EventsList.vue` - Events browsing
- `EventCard.vue` - Event display
- `EventDetail.vue` - Full event view
- `CreateEventModal.vue` - Event creation
- `EventCalendar.vue` - Calendar view

---

## 🎯 Phase 3: Supporting Features (Priority: MEDIUM-LOW)

### 3.1 Notifications
**Status:** Not started
**Complexity:** Medium

**Features:**
- [ ] In-app notifications
- [ ] Notification settings
- [ ] Push notifications (Firebase)
- [ ] Notification badges

---

### 3.2 Settings
**Status:** Not started
**Complexity:** Low

**Features:**
- [ ] Account settings
- [ ] Notification settings
- [ ] Privacy settings
- [ ] Billing/subscription
- [ ] Email preferences

---

### 3.3 Search
**Status:** Basic search exists
**Complexity:** Medium

**Features:**
- [ ] Global search
- [ ] Search users
- [ ] Search communities
- [ ] Search groups
- [ ] Search filters
- [ ] Recent searches

---

### 3.4 Resources
**Status:** Not started
**Complexity:** Low

**Features:**
- [ ] Resources list
- [ ] Resource categories
- [ ] Resource uploads
- [ ] Resource management

---

### 3.5 Spotlight
**Status:** Not started
**Complexity:** Medium

**Features:**
- [ ] Spotlight view
- [ ] Featured users
- [ ] Spotlight management (admin)

---

## 🎯 Phase 4: Advanced Features (Priority: LOW)

### 4.1 Map View
**Status:** Not started
**Complexity:** Medium

**Features:**
- [ ] User location map
- [ ] Community locations
- [ ] Event locations
- [ ] Location-based discovery

---

### 4.2 Video/Audio
**Status:** Not started
**Complexity:** High

**Features:**
- [ ] Video calls
- [ ] Audio calls
- [ ] Video messages

---

### 4.3 Integrations
**Status:** Not started
**Complexity:** High

**Features:**
- [ ] Slack integration
- [ ] Teams integration
- [ ] Webex integration
- [ ] Okta SSO
- [ ] Google OAuth (already done)

---

## 📋 Implementation Order Recommendation

### Sprint 1-2: Core Messaging
1. Conversations list (Firebase)
2. Chat thread view
3. Real-time messaging
4. Message input

### Sprint 3-4: Discover/Matches
1. Match card component
2. Swipe functionality
3. Match actions
4. User search

### Sprint 5-6: Profile
1. Profile view
2. Profile editing
3. Photo upload
4. User profile cards

### Sprint 7-8: Communities
1. Communities list
2. Community detail
3. Join/leave functionality
4. Community creation

### Sprint 9-10: Groups & Events
1. Groups list & detail
2. Events list & detail
3. Create/edit functionality
4. RSVP/attendance

### Sprint 11+: Polish & Advanced
1. Notifications
2. Settings
3. Search improvements
4. Integrations

---

## 🔧 Technical Considerations

### State Management
- Use Pinia stores for:
  - `conversations.store.ts` - Conversation state
  - `matches.store.ts` - Matches state
  - `communities.store.ts` - Communities state
  - `profile.store.ts` - Profile state (extend auth.store)

### Services to Create
- `match.service.ts` - Match operations
- `conversation.service.ts` - Conversation CRUD
- `chat.service.ts` - Real-time chat
- `community.service.ts` - Community operations
- `group.service.ts` - Group operations
- `event.service.ts` - Event operations
- `notification.service.ts` - Notifications

### Firebase Integration
- Firestore for real-time messaging
- Realtime Database for presence
- Cloud Storage for images
- Cloud Messaging for push notifications

### Component Architecture
- Keep components modular and reusable
- Use composition API throughout
- Create shared components library
- Implement proper loading states
- Add error boundaries

### Performance
- Lazy load routes
- Virtual scrolling for long lists
- Image optimization
- Caching strategies
- Debounce search inputs

---

## 📝 Notes
- All features should follow the modern design system
- Maintain API compatibility with existing backend
- Test on both iOS and Android
- Ensure accessibility compliance
- Follow Vue 3 + Ionic Vue best practices

