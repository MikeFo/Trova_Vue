# How to Verify the /auth/login Endpoint

## Current Configuration

- **Base URL (dev)**: `/api` (proxies to `https://trova-api-staging.herokuapp.com`)
- **Endpoint being called**: `/auth/login`
- **Full URL**: `https://trova-api-staging.herokuapp.com/auth/login`

## Methods to Verify

### 1. Check Browser Network Tab

1. Open your browser's Developer Tools (F12 or Cmd+Option+I)
2. Go to the **Network** tab
3. Try to log in with email/password
4. Look for the request to `/api/auth/login` or `auth/login`
5. Check:
   - **Request URL**: What's the full URL being called?
   - **Status Code**: Is it 404, 401, 500, etc.?
   - **Response**: What does the backend return?

### 2. Test Endpoint Directly with curl

```bash
# Test if endpoint exists
curl -X POST https://trova-api-staging.herokuapp.com/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"test123"}'

# Check what endpoints are available (if backend has a health/status endpoint)
curl https://trova-api-staging.herokuapp.com/health
```

### 3. Check Alternative Endpoint Names

The endpoint might be named differently. Common variations:
- `/auth/login` (current)
- `/auth/signin`
- `/login`
- `/auth/authenticate`
- `/users/login`

### 4. Check Signup Endpoint (for comparison)

The signup endpoint `/auth/signup` is being used successfully. Compare:
- What's the exact path for signup?
- Does it work? (If yes, login might use a similar pattern)

### 5. Check Backend API Documentation

- Look for API docs in your backend repository
- Check for route definitions in backend code
- Look for OpenAPI/Swagger documentation

### 6. Check Production App

Since production works, you can:
1. Open production app in browser
2. Check Network tab during login
3. See what endpoint production actually calls
4. Compare with staging endpoint

## Quick Test Script

You can also add this temporary test in your browser console:

```javascript
// Test different endpoint variations
const endpoints = [
  '/auth/login',
  '/auth/signin', 
  '/login',
  '/auth/authenticate'
];

endpoints.forEach(async (endpoint) => {
  try {
    const response = await fetch(`/api${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'test@test.com', password: 'test' })
    });
    console.log(`${endpoint}: ${response.status} ${response.statusText}`);
  } catch (error) {
    console.log(`${endpoint}: Error - ${error.message}`);
  }
});
```

## What to Look For

1. **404 Not Found**: Endpoint doesn't exist at that path
2. **401 Unauthorized**: Endpoint exists but credentials are wrong
3. **400 Bad Request**: Endpoint exists but request format is wrong
4. **500 Server Error**: Endpoint exists but has a server error

## Next Steps

Once you identify the correct endpoint:
1. Update `src/services/auth.service.ts` line 111 with the correct path
2. Test the login flow
3. Remove this verification file

