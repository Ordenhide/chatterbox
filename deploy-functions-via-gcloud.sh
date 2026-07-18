#!/bin/bash

# Deploy Firebase Functions using gcloud access token
# This works around Firebase CLI authentication issues

set -e

PROJECT_ID="chatterbox-e5d10"
SERVICE_ACCOUNT_PATH="./service-account-key.json"
FUNCTIONS_DIR="./functions"

echo "🚀 Deploying Firebase Functions via gcloud..."

# Check prerequisites
if [ ! -f "$SERVICE_ACCOUNT_PATH" ]; then
  echo "❌ Error: service-account-key.json not found!"
  exit 1
fi

if ! command -v gcloud &> /dev/null; then
  echo "❌ Error: gcloud CLI not found!"
  echo "   Install: brew install google-cloud-sdk"
  exit 1
fi

# Step 1: Authenticate with service account
echo "1️⃣ Authenticating with service account..."
gcloud auth activate-service-account --key-file="$SERVICE_ACCOUNT_PATH" --quiet

# Step 2: Set project
echo "2️⃣ Setting project..."
gcloud config set project "$PROJECT_ID" --quiet

# Step 3: Install dependencies
echo "3️⃣ Installing function dependencies..."
cd "$FUNCTIONS_DIR"
npm install
cd ..

# Step 4: Get access token from gcloud (already authenticated)
echo "4️⃣ Getting access token..."
ACCESS_TOKEN=$(gcloud auth print-access-token)

# Step 5: Use Firebase CLI with access token
echo "5️⃣ Deploying functions with Firebase CLI..."
export FIREBASE_TOKEN="$ACCESS_TOKEN"
export GOOGLE_APPLICATION_CREDENTIALS="$SERVICE_ACCOUNT_PATH"

# Try Firebase CLI deployment
if npx firebase deploy --only functions --project "$PROJECT_ID" --token "$ACCESS_TOKEN"; then
  echo ""
  echo "✅ Functions deployed successfully!"
  echo ""
  echo "📋 Verify deployment:"
  echo "   npx firebase functions:list --project $PROJECT_ID"
else
  echo ""
  echo "⚠️  Firebase CLI deployment failed."
  echo ""
  echo "💡 Alternative: Deploy manually via Firebase Console"
  echo "   1. Go to https://console.firebase.google.com/project/$PROJECT_ID/functions"
  echo "   2. Click 'Get started' if first time"
  echo "   3. Functions will be deployed automatically when you push code"
  echo ""
  echo "   Or deploy from a server outside China:"
  echo "   - SSH into VPS/server outside China"
  echo "   - Clone repo and run: firebase login && firebase deploy --only functions"
  exit 1
fi
