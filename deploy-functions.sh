#!/bin/bash

# Firebase Functions Deployment Script
# Supports both service account and CI token methods

set -e

PROJECT_ID="chatterbox-e5d10"
FUNCTIONS_DIR="./functions"
SERVICE_ACCOUNT_PATH="./service-account-key.json"

echo "🚀 Deploying Firebase Functions..."

# Check if service account exists
if [ -f "$SERVICE_ACCOUNT_PATH" ]; then
    echo "📋 Service account found: $SERVICE_ACCOUNT_PATH"
    
    # Method 1: Try using gcloud CLI (if available)
    if command -v gcloud &> /dev/null; then
        echo "✅ Using gcloud CLI with service account..."
        export GOOGLE_APPLICATION_CREDENTIALS="$SERVICE_ACCOUNT_PATH"
        gcloud auth activate-service-account --key-file="$SERVICE_ACCOUNT_PATH"
        gcloud config set project "$PROJECT_ID"
        
        # Deploy using gcloud
        cd "$FUNCTIONS_DIR"
        npm install
        cd ..
        
        # Use Firebase CLI with gcloud credentials
        npx firebase deploy --only functions --project "$PROJECT_ID"
        exit 0
    else
        echo "⚠️  gcloud CLI not found. Install it for service account support:"
        echo "   brew install google-cloud-sdk"
        echo ""
        echo "Or use CI token method (see below)"
    fi
fi

# Method 2: Use CI token
if [ -n "$FIREBASE_TOKEN" ]; then
    echo "✅ Using FIREBASE_TOKEN environment variable..."
    cd "$FUNCTIONS_DIR"
    npm install
    cd ..
    npx firebase deploy --only functions --token "$FIREBASE_TOKEN" --project "$PROJECT_ID"
    exit 0
fi

# Method 3: Interactive login
echo "📝 No service account or token found. Using interactive login..."
echo ""
echo "This will open a browser window for authentication."
echo "If you're in China, you may need VPN."
echo ""
read -p "Press Enter to continue..."

cd "$FUNCTIONS_DIR"
npm install
cd ..
npx firebase login
npx firebase deploy --only functions --project "$PROJECT_ID"
