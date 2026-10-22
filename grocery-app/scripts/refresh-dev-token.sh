#!/usr/bin/env bash
# Development only: signs in with the test account from .env
# and saves a fresh token to .env. Tokens expire after about an hour.
set -euo pipefail
cd "$(dirname "$0")/.."

set -a; source .env; set +a

TOKEN=$(curl -s -X POST "https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=$FIREBASE_WEB_API_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$TEST_EMAIL\",\"password\":\"$TEST_PASSWORD\",\"returnSecureToken\":true}" \
  | python3 -c "import sys, json; d = json.load(sys.stdin); print(d.get('idToken', ''))")

if [ -z "$TOKEN" ]; then
  echo "Sign-in failed. Check FIREBASE_WEB_API_KEY, TEST_EMAIL, and TEST_PASSWORD in .env"
  exit 1
fi

# Replace the old token line with the new one
sed -i '' '/^EXPO_PUBLIC_DEV_ID_TOKEN=/d' .env
echo "EXPO_PUBLIC_DEV_ID_TOKEN=$TOKEN" >> .env

echo "Saved a fresh token (${#TOKEN} characters). Now restart Expo: npx expo start -c"