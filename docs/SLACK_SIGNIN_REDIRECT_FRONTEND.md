# Slack-to-frontend auth: /slack-signin-redirect

When a user clicks Map, Console, or Org Chart in Slack and they don't already have a Firebase session, they are sent through Slack OpenID Connect and then redirected to the **frontend** at:

`{FRONTEND_BASE_URL}/slack-signin-redirect?code=...&state=...`

The **frontend** must handle this route so the user is signed in with Firebase and redirected to the right page **without** showing the normal login screen.

## Backend contract (already implemented)

- **POST** `{API_BASE_URL}/public/slack/user-signin`
- **Body (JSON):** `{ "code": "<from query param>", "redirectUri": "<exact redirect URL>" }`
  - `redirectUri` must be the full URL of the redirect page **without** query string, e.g. `http://localhost:5173/slack-signin-redirect` or `https://www.trova-staging.com/slack-signin-redirect`. It must match the redirect URI used in the Slack OAuth request.
- **Success (200):** `{ "idToken": "<firebaseCustomToken>", "existing": true|false, "email": "...", "slackUserId": "..." }`
- **Error (500):** `{ "error": "..." }`

The frontend must use `idToken` with **Firebase `signInWithCustomToken(idToken)`** to sign the user in, then redirect to the intended destination.

## What the frontend must do (Vue / any client)

1. **Route:** Define a route for `/slack-signin-redirect` (path must match what the API uses: `getBaseUrl() + '/slack-signin-redirect'`).
2. **On load:**
   - Read `code` (and optionally `state`) from the URL query.
   - If there is no `code`, redirect to `/login` (or home).
   - Build `redirectUri` = current origin + pathname (e.g. `window.location.origin + '/slack-signin-redirect'`). Use the same origin the user was sent to (e.g. `http://localhost:5173` for local).
   - **POST** to `{API_BASE_URL}/public/slack/user-signin` with body `{ code, redirectUri }`. Use the app's configured API base URL (e.g. from env).
   - If the response is 200:
     - Call Firebase `signInWithCustomToken(idToken)`.
     - Then redirect:
       - If you use `state` to carry the destination, parse it and redirect there.
       - Or call an API that returns the intended redirect (e.g. from Firestore `slackUser/{slackUserId}.redirectTo`); the backend stores this when the user clicks the button in Slack (`recordOutwardButtonClick`).
       - Otherwise redirect to a default (e.g. `/map` or `/`).
   - If the response is not 200, show an error or redirect to `/login`.
3. **Guard:** Ensure the app does **not** show the login page when the user lands on `/slack-signin-redirect` with a valid `code`; run the exchange first, then redirect.

## Redirect after sign-in

The backend stores the intended destination when the user clicks the button in Slack (e.g. `redirectTo: 'map'` in Firestore under `slackUser/{slackUserId}`). The Ionic app likely reads this (or uses `state`) to redirect to `/map`, `/console`, or `/org-chart`. The Vue app should do the same: after `signInWithCustomToken`, redirect to the stored destination or a default.

## CORS

The API must allow the frontend origin in CORS for `POST /public/slack/user-signin`. The vue-feature-flag branch already allows `http://localhost:5173`, `http://127.0.0.1:5173`, and staging origins.
