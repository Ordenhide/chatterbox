# Firebase Functions Deployment Workaround

## The Problem

Firebase CLI requires interactive authentication which fails in China, even with VPN. Service account credentials don't work directly with Firebase CLI.

## ✅ Working Solutions

### Solution 1: Use gcloud Access Token (Recommended)

This uses gcloud to get an access token and passes it to Firebase CLI:

```bash
# Install gcloud if not installed
brew install google-cloud-sdk

# Run the deployment script
./deploy-functions-via-gcloud.sh
```

Or manually:

```bash
# 1. Authenticate
gcloud auth activate-service-account --key-file="./service-account-key.json"

# 2. Get access token
export FIREBASE_TOKEN=$(gcloud auth print-access-token --key-file="./service-account-key.json")

# 3. Deploy
cd functions
npm install
cd ..
npx firebase deploy --only functions --token "$FIREBASE_TOKEN"
```

### Solution 2: Deploy from Server Outside China

If Solution 1 doesn't work:

1. **SSH into a VPS/server outside China**
2. **Clone your repository**:
   ```bash
   git clone <your-repo-url>
   cd chatterbox
   ```
3. **Install Firebase CLI**:
   ```bash
   npm install -g firebase-tools
   ```
4. **Login** (will work outside China):
   ```bash
   firebase login
   ```
5. **Deploy**:
   ```bash
   cd functions
   npm install
   cd ..
   firebase deploy --only functions
   ```

### Solution 3: GitHub Actions (Automatic)

Set up automatic deployment via GitHub Actions:

1. **Create `.github/workflows/deploy-functions.yml`**:
```yaml
name: Deploy Firebase Functions

on:
  push:
    branches: [main]
    paths:
      - 'functions/**'

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: |
          cd functions
          npm install
      
      - name: Deploy to Firebase
        uses: FirebaseExtended/action-hosting-deploy@v0
        with:
          repoToken: '${{ secrets.GITHUB_TOKEN }}'
          firebaseServiceAccount: '${{ secrets.FIREBASE_SERVICE_ACCOUNT }}'
          projectId: chatterbox-e5d10
          target: functions
```

2. **Add secret to GitHub**:
   - Go to GitHub repo → Settings → Secrets → Actions
   - Add `FIREBASE_SERVICE_ACCOUNT` secret
   - Paste entire content of `service-account-key.json`

3. **Push to GitHub** → Functions deploy automatically

### Solution 4: Manual Function Upload (Not Recommended)

Firebase Console doesn't support direct function upload. You must use CLI or CI/CD.

## Troubleshooting

### "gcloud: command not found"
```bash
brew install google-cloud-sdk
```

### "Permission denied" or "Access denied"
Make sure service account has these roles:
- **Cloud Functions Admin**
- **Firebase Admin**
- **Service Account User**

Add in Google Cloud Console → IAM & Admin → IAM

### "Billing not enabled"
Cloud Functions require Blaze plan:
1. Go to Firebase Console → Project Settings → Usage and billing
2. Upgrade to Blaze plan (pay-as-you-go, free tier available)

### "Functions deploy failed"
Check:
1. `functions/index.js` has no syntax errors ✅ (already checked)
2. `functions/package.json` is valid ✅ (already checked)
3. Service account has correct permissions
4. Billing is enabled

## Quick Test

Test if gcloud works:

```bash
# Authenticate
gcloud auth activate-service-account --key-file="./service-account-key.json"

# Test access
gcloud projects describe chatterbox-e5d10
```

If this works, then the deployment script should work too.

## Why Firebase CLI Fails

Firebase CLI uses OAuth2 flow which:
- Requires browser redirect
- Fails behind firewalls/proxies
- Doesn't support service accounts directly

gcloud CLI:
- Supports service accounts natively
- Works better in restricted networks
- Can generate access tokens for Firebase CLI

## Next Steps

1. **Try Solution 1** (gcloud access token) - easiest
2. **If that fails**, use Solution 2 (deploy from outside China)
3. **For automation**, use Solution 3 (GitHub Actions)
