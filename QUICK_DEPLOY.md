# Quick Deploy Guide (China Users)

## The Issue

Firebase CLI authentication fails in China even with VPN. Firebase CLI doesn't use service account credentials directly.

## ✅ Solution: Use gcloud CLI

gcloud CLI **does** support service accounts and works better in China.

### Step 1: Install gcloud CLI

```bash
brew install google-cloud-sdk
```

### Step 2: Get Service Account Key

1. Go to [Firebase Console](https://console.firebase.google.com) (use VPN)
2. Project Settings → Service Accounts
3. Click "Generate New Private Key"
4. Save as `service-account-key.json` in project root

### Step 3: Deploy

**Option A: Use the script (easiest)**
```bash
node deploy-with-service-account.js
```

**Option B: Manual commands**
```bash
# Authenticate with service account
gcloud auth activate-service-account --key-file="./service-account-key.json"

# Set project
gcloud config set project chatterbox-e5d10

# Install dependencies
cd functions
npm install
cd ..

# Deploy
export GOOGLE_APPLICATION_CREDENTIALS="./service-account-key.json"
npx firebase deploy --only functions
```

## Alternative: Deploy from Outside China

If gcloud doesn't work either:

1. **Use a VPS/server outside China**
2. **SSH into it**
3. **Clone your repo**
4. **Deploy from there**:
   ```bash
   firebase login
   firebase deploy --only functions
   ```

## Alternative: GitHub Actions

Set up GitHub Actions to deploy automatically (runs outside China):

1. Create `.github/workflows/deploy.yml`
2. Add `FIREBASE_SERVICE_ACCOUNT` secret
3. Push to GitHub → Auto-deploys

## Verify Deployment

```bash
npx firebase functions:list
```

Should show:
- `claimSession`
- `sessionHeartbeat`

## Why This Works

- **gcloud CLI** uses service accounts natively
- **Firebase CLI** requires interactive login or CI token
- **Service account** works with gcloud but not Firebase CLI directly

## Quick Test

Try this first:
```bash
# Check if gcloud is installed
which gcloud

# If not, install it
brew install google-cloud-sdk

# Then run deployment script
node deploy-with-service-account.js
```
