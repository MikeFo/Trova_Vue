#!/bin/bash
echo "Testing authentication endpoints on staging..."
echo ""
echo "1. Testing /auth/login:"
curl -X POST https://trova-api-staging.herokuapp.com/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"test"}' \
  -w "\nStatus: %{http_code}\n" \
  -s

echo ""
echo "2. Testing /auth/signin:"
curl -X POST https://trova-api-staging.herokuapp.com/auth/signin \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"test"}' \
  -w "\nStatus: %{http_code}\n" \
  -s

echo ""
echo "3. Testing /login:"
curl -X POST https://trova-api-staging.herokuapp.com/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"test"}' \
  -w "\nStatus: %{http_code}\n" \
  -s

echo ""
echo "Done! Check the status codes above."
