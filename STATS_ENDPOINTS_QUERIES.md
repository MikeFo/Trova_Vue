# Engagement Dashboard - Stats Endpoints & Queries

This document shows what endpoints/queries are used for each metric on the Engagement Dashboard.

## Primary Metrics

### 1. Profiles Created
- **Backend Endpoint (Primary)**: `GET /communities/{communityId}/stats/engagement?startDate={startDate}&endDate={endDate}` (⚠️ **NOT IMPLEMENTED - returns 404**)
- **Fallback (Client-Side)**:
  - **Endpoint**: `POST /communities/getProfilesForUserAndCommunity` (body: `{ communityId }`)
  - **Service Method**: `profileService.getProfilesForUserAndCommunity(communityId)`
  - **Query**: Counts all profiles returned from the profiles endpoint
  - **Date Filtering**: ⚠️ **NOT AVAILABLE** - `ProfilesInit` model doesn't have `createdAt` field. Date filtering must be done on backend.

### 2. Connections Made
- **Backend Endpoint (Primary)**: `GET /communities/{communityId}/stats/engagement?startDate={startDate}&endDate={endDate}` (⚠️ **NOT IMPLEMENTED - returns 404**)
- **Fallback (Client-Side)**:
  - **Endpoint**: `GET /matches?communityId={communityId}` (tries with param first) or `GET /matches` (falls back to middleware)
  - **Service Method**: `matchService.getMatches()` or direct `apiService.get('/matches?communityId={communityId}')`
  - **Query**: Counts unique sets of people (Option 2)
    - Groups matches by `group_id`, collects all unique `user_id` and `other_user_id` for each group
    - Creates a sorted array of user IDs for each group
    - Counts distinct user sets (same people matched multiple times = 1 connection)
  - **Date Filtering**: Filters by `match.createdAt` or `match.created_at`
  - **Note**: The `/matches` endpoint uses `getCommunityId` middleware (user's current community), which may not match the admin console's selected community
  - **SQL Equivalent (Option 2)**: 
    ```sql
    WITH group_users AS (
      SELECT group_id, user_id as participant_id FROM user_match WHERE ...
      UNION
      SELECT group_id, other_user_id as participant_id FROM user_match WHERE ...
    ),
    match_sets AS (
      SELECT group_id, ARRAY_AGG(DISTINCT participant_id ORDER BY participant_id) as user_set
      FROM group_users GROUP BY group_id
    )
    SELECT COUNT(DISTINCT user_set) as unique_sets_of_people FROM match_sets;
    ```
  - **Alternative SQL (Option 1 - not used)**: `SELECT COUNT(DISTINCT group_id) FROM user_match WHERE ...` (counts each match event, even if same people matched multiple times)

### 3. Trova Chats Started
- **Backend Endpoint (Primary)**: `GET /communities/{communityId}/stats/engagement?startDate={startDate}&endDate={endDate}`
- **Fallback (Client-Side)**:
  - Query: Firebase Firestore query on `messages` collection
  - Filter: `message.text.includes('Trova')` AND `message.createdAt` within date range
  - Collection: `communities/{communityId}/messages`

## Engagement Metrics

### 4. Messages Sent
- **Backend Endpoint**: `GET /communities/{communityId}/stats/engagement?startDate={startDate}&endDate={endDate}`
- **Fallback**: Currently returns `0` (not implemented)

### 5. Events Created
- **Backend Endpoint (Primary)**: `GET /communities/{communityId}/stats/engagement?startDate={startDate}&endDate={endDate}` (⚠️ **NOT IMPLEMENTED - returns 404**)
- **Fallback (Client-Side)**:
  - **Endpoint**: `GET /events/all/{communityId}` (via `eventService.getEvents()`)
  - **Alternative Endpoints**: 
    - `GET /communities/{communityId}/events` (CommunityService - if available)
    - `GET /console/events?communityId={communityId}` (ConsoleService - if available)
  - **Service Method**: `eventService.getEvents(communityId, userId)`
  - **Query**: Counts events where `event.startDate` or `event.startDateTimeUTC` is within date range
  - **Date Filtering**: Filters by `event.startDate` or `event.startDateTimeUTC` (Event model doesn't have `createdAt`)

### 6. Events Attended
- **Backend Endpoint (Primary)**: `GET /communities/{communityId}/stats/engagement?startDate={startDate}&endDate={endDate}`
- **Fallback (Client-Side)**:
  - Endpoint: `GET /events/all/{communityId}` (via `eventService.getEvents()`)
  - Query: Sums `event.attendeeCount` or `event.attendees.length` for events in date range

### 7. Groups Created
- **Backend Endpoint (Primary)**: `GET /communities/{communityId}/stats/engagement?startDate={startDate}&endDate={endDate}`
- **Fallback (Client-Side)**:
  - **Endpoint**: `GET /groups?communityId={communityId}&userId={userId}` (via `groupService.getGroups()`)
  - **Alternative**: `GET /communities/{communityId}/groups` (if main endpoint returns 500)
  - **Service Method**: `groupService.getGroups(communityId, userId)`
  - **Query**: Counts groups where `group.createdAt` is within date range

### 8. Groups Joined
- **Backend Endpoint (Primary)**: `GET /communities/{communityId}/stats/engagement?startDate={startDate}&endDate={endDate}`
- **Fallback (Client-Side)**:
  - Endpoint: `GET /groups?communityId={communityId}&userId={userId}` (via `groupService.getGroups()`)
  - Query: Counts unique users across all groups (using `Set` of user IDs from `group.users` array or `group.memberCount`)

### 9. Daily Active Users
- **Backend Endpoint**: `GET /communities/{communityId}/stats/engagement?startDate={startDate}&endDate={endDate}`
- **Fallback**: Currently returns `0` (not implemented)

### 10. Weekly Active Users
- **Backend Endpoint**: `GET /communities/{communityId}/stats/engagement?startDate={startDate}&endDate={endDate}`
- **Fallback**: Currently returns `0` (not implemented)

### 11. Profile Completion Rate
- **Backend Endpoint (Primary)**: `GET /communities/{communityId}/stats/engagement?startDate={startDate}&endDate={endDate}` (⚠️ **NOT IMPLEMENTED - returns 404**)
- **Fallback (Client-Side)**:
  - **Endpoint**: `POST /communities/getProfilesForUserAndCommunity` (body: `{ communityId }`)
  - **Service Method**: `profileService.getProfilesForUserAndCommunity(communityId)`
  - **Query**: Calculates percentage of profiles that have:
    - `bio` (non-empty string)
    - `interests` (non-empty array)
    - `locations` (non-empty array) OR `currentLocationName` (non-empty string)

### 12. Match Response Rate
- **Backend Endpoint**: `GET /communities/{communityId}/stats/engagement?startDate={startDate}&endDate={endDate}`
- **Fallback**: Currently returns `0` (would need conversation data to calculate)

## User Actions Metrics

### 13. Opened Trova
- **Backend Endpoint**: `GET /communities/{communityId}/stats/user-actions?startDate={startDate}&endDate={endDate}`
- **Fallback**: Currently returns `0` (not implemented - would need user events/actions data)

### 14. Intros Led To Convos
- **Backend Endpoint**: `GET /communities/{communityId}/stats/user-actions?startDate={startDate}&endDate={endDate}`
- **Fallback**: Currently returns `0` (not implemented)

### 15. Avg Profile Score
- **Backend Endpoint**: `GET /communities/{communityId}/stats/user-actions?startDate={startDate}&endDate={endDate}`
- **Fallback**: Currently returns `0` (not implemented)

### 16. General Actions
- **Backend Endpoint**: `GET /communities/{communityId}/stats/user-actions?startDate={startDate}&endDate={endDate}`
- **Fallback**: Currently returns `0` (not implemented - would need user events data)

### 17. Spotlights Created
- **Backend Endpoint**: `GET /communities/{communityId}/stats/user-actions?startDate={startDate}&endDate={endDate}`
- **Fallback**: Currently returns `0` (not implemented)

### 18. Rec Walls Given
- **Backend Endpoint**: `GET /communities/{communityId}/stats/user-actions?startDate={startDate}&endDate={endDate}`
- **Fallback**: Currently returns `0` (not implemented)

### 19. Rec Walls Received
- **Backend Endpoint**: `GET /communities/{communityId}/stats/user-actions?startDate={startDate}&endDate={endDate}`
- **Fallback**: Currently returns `0` (not implemented)

## Engagement Attribution

### 20. Trova Magic Engagements
- **Backend Endpoint**: `GET /communities/{communityId}/stats/user-actions?startDate={startDate}&endDate={endDate}`
- **Fallback**: Currently returns `0` (not implemented)

### 21. Channel Pairing On Demand
- **Backend Endpoint**: `GET /communities/{communityId}/stats/user-actions?startDate={startDate}&endDate={endDate}`
- **Fallback**: Currently returns `0` (not implemented)

### 22. Channel Pairing Cadence
- **Backend Endpoint**: `GET /communities/{communityId}/stats/user-actions?startDate={startDate}&endDate={endDate}`
- **Fallback**: Currently returns `0` (not implemented)

## Skills Metrics

### 23. Total Skills
- **Backend Endpoint**: `GET /communities/{communityId}/stats/skills`
- **Fallback**: Currently returns `0` (not implemented - would need skills endpoint)

### 24. Users With Skills
- **Backend Endpoint**: `GET /communities/{communityId}/stats/skills`
- **Fallback**: Currently returns `0` (not implemented)

### 25. Users Can Mentor
- **Backend Endpoint**: `GET /communities/{communityId}/stats/skills`
- **Fallback**: Currently returns `0` (not implemented)

### 26. Users Want Mentor
- **Backend Endpoint**: `GET /communities/{communityId}/stats/skills`
- **Fallback**: Currently returns `0` (not implemented)

## Match Engagement Metrics

### 27. Trova Magic Matches
- **Backend Endpoint**: `GET /communities/{communityId}/stats/match-engagement?startDate={startDate}&endDate={endDate}`
- **Fallback (Client-Side)**:
  - Endpoint: `GET /matches` (via `matchService.getMatches()`)
  - Query: Counts matches where `match.type === 'trova_magic'` or `match.matchType === 'trova_magic'`
  - Date Filtering: Filters by `match.createdAt` or `match.created_at`

### 28. Channel Pairing Matches
- **Backend Endpoint**: `GET /communities/{communityId}/stats/match-engagement?startDate={startDate}&endDate={endDate}`
- **Fallback (Client-Side)**:
  - Endpoint: `GET /matches` (via `matchService.getMatches()`)
  - Query: Counts matches where `match.type === 'channel_pairing'` or `match.matchType === 'channel_pairing'`
  - Date Filtering: Filters by `match.createdAt` or `match.created_at`

### 29. All Matches Engaged
- **Backend Endpoint**: `GET /communities/{communityId}/stats/match-engagement?startDate={startDate}&endDate={endDate}`
- **Fallback**: Currently returns `0` (would need conversation data to determine engagement)

### 30. Match Engagement Rate
- **Backend Endpoint**: `GET /communities/{communityId}/stats/match-engagement?startDate={startDate}&endDate={endDate}`
- **Fallback**: Calculated as `(allMatchesEngaged / totalMatches) * 100` (currently 0 since allMatchesEngaged is 0)

## Channel Pairing Metrics

### 31. Channel Pairing Groups
- **Backend Endpoint**: `GET /communities/{communityId}/stats/channel-pairing?startDate={startDate}&endDate={endDate}`
- **Fallback**: Currently returns `0` (not implemented)

### 32. Channel Pairing Users
- **Backend Endpoint**: `GET /communities/{communityId}/stats/channel-pairing?startDate={startDate}&endDate={endDate}`
- **Fallback**: Currently returns `0` (not implemented)

---

## Summary

### Working Metrics (with backend endpoints or client-side fallback):
- ✅ Profiles Created
- ✅ Connections Made (matches) - **Backend endpoint implemented: `/communities/{id}/matches`**
- ✅ Events Created
- ✅ Events Attended
- ✅ Groups Created
- ✅ Groups Joined
- ✅ Profile Completion Rate
- ✅ Trova Chats Started (Firebase)
- ✅ Trova Magic Matches - **Uses `/communities/{id}/matches?type=trova_magic`**
- ✅ Channel Pairing Matches - **Uses `/communities/{id}/matches?type=channel_pairing`**

### Recently Implemented (Client-Side Calculation):
- ✅ Messages Sent - **Uses Firebase collectionGroup query on `messages/{conversationId}/conv`**
- ✅ Daily/Weekly Active Users - **Calculated from matches, events, groups, and messages activity**
- ✅ Match Response Rate - **Calculated from matches and Firebase conversations**
- ✅ All Matches Engaged - **Calculated from matches and Firebase conversations**
- ✅ Match Engagement Rate - **Calculated as percentage of engaged matches**
- ✅ Channel Pairing Groups - **Calculated from channel_pairing matches (unique group_id)**
- ✅ Channel Pairing Users - **Calculated from channel_pairing matches (unique users)**

### Not Implemented (return 0 - need backend endpoints or data structure info):
- ❌ All User Actions metrics (Opened Trova, Intros Led To Convos, Profile Score, General Actions, Spotlights, Rec Walls) - **Need backend endpoint or user_events/actions table structure**
- ❌ Engagement Attribution metrics (Trova Magic Engagements, Channel Pairing On Demand/Cadence) - **Need backend endpoint or additional match metadata**
- ❌ Skills metrics (Total Skills, Users With Skills, Users Can Mentor, Users Want Mentor) - **Need backend endpoint or skills table structure**

---

## Key Endpoints Used:

1. **Profiles**: `POST /communities/getProfilesForUserAndCommunity` (body: `{ communityId }`)
   - **Service Method**: `profileService.getProfilesForUserAndCommunity(communityId)` ✅
2. **Events**: `GET /events/all/{communityId}` (current implementation)
   - **Alternative**: `GET /communities/{communityId}/events` or `GET /console/events?communityId={communityId}` (if available)
   - **Service Method**: `eventService.getEvents(communityId, userId)`
3. **Groups**: `GET /groups?communityId={communityId}&userId={userId}` (fallback: `GET /communities/{communityId}/groups`)
   - **Service Method**: `groupService.getGroups(communityId, userId)`
4. **Matches**: `GET /communities/{communityId}/matches?startDate={startDate}&endDate={endDate}&type={type}` ✅ **PRIMARY**
   - **Fallback**: `GET /matches?communityId={communityId}` (tries with param) or `GET /matches` (falls back, uses middleware)
   - **Service Method**: `adminService.getMatchesForCommunity(communityId)`
   - **✅ Fixed**: Backend endpoint now accepts communityId parameter
5. **Trova Chats**: Firebase Firestore query on `messages` collection (filters by `message.text.includes('Trova')`)

## Current Status

**Working Metrics (with client-side fallback that actually queries data):**
- ✅ Profiles Created - Uses `POST /communities/getProfilesForUserAndCommunity` (⚠️ No date filtering - ProfilesInit has no createdAt)
- ⚠️ Connections Made - Uses `GET /matches` (counts unique `matchIndicesId` or unique pairs) - **Currently returning 0 because endpoint returns empty array**
- ✅ Events Created - Uses `GET /events/all/{communityId}` (filters by `startDate`/`startDateTimeUTC`, not `createdAt`)
- ✅ Events Attended - Uses `GET /events/all/{communityId}` (sums attendeeCount)
- ✅ Groups Created - Uses `GET /groups?communityId={communityId}&userId={userId}` (filters by `createdAt`)
- ✅ Groups Joined - Uses `GET /groups?communityId={communityId}&userId={userId}` (counts unique members)
- ✅ Profile Completion Rate - Uses `POST /communities/getProfilesForUserAndCommunity`
- ✅ Trova Chats Started - Uses Firebase Firestore query

**Recently Implemented (Client-Side Calculation):**
- ✅ Messages Sent - Uses Firebase `collectionGroup('conv')` query, filters by `communityId` and date range
- ✅ Daily/Weekly Active Users - Calculated from users who were active in matches, events, groups, or messages within last day/week
- ✅ Match Response Rate - Calculated by comparing matches to Firebase conversations (user pairs)
- ✅ All Matches Engaged - Count of matches where user pairs have conversations
- ✅ Match Engagement Rate - Percentage of matches that led to conversations
- ✅ Channel Pairing Groups - Count of unique `group_id` from channel_pairing matches
- ✅ Channel Pairing Users - Count of unique users from channel_pairing matches
- ✅ Trova Magic Matches - Uses `/communities/{id}/matches?type=trova_magic`
- ✅ Channel Pairing Matches - Uses `/communities/{id}/matches?type=channel_pairing`

**Still Need Backend Endpoints or Data Structure Info:**
- ❌ User Actions metrics (Opened Trova, Intros Led To Convos, Profile Score, General Actions, Spotlights, Rec Walls) - Need backend endpoint or table structure
- ❌ Engagement Attribution (Trova Magic Engagements, Channel Pairing On Demand/Cadence) - Need backend endpoint or match metadata
- ❌ Skills metrics - Need backend endpoint or skills table structure





