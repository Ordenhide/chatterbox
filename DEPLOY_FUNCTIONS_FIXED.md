# Fixed: Deploy Firebase Functions from China

## The Problem

Firebase CLI doesn't use `GOOGLE_APPLICATION_CREDENTIALS` for deployment. It requires either:
1. Interactive login (`firebase login`)
2. CI token (`firebase login:ci`)
3. gcloud CLI with service account

## Solution Options

### Option 1: Use CI Token (Easiest)

1. **Get CI token** (one-time setup):
   ```bash
   npx firebase login:ci
   ```
   This will open a browser. After authentication, it will output a token.

2. **Save the token**:
   ```bash
   export FIREBASE_TOKEN="your-token-here"
   ```

3. **Deploy**:
   ```bash
   cd functions
   npm install
   cd ..
   npx firebase deploy --only functions --token "$FIREBASE_TOKEN"
   ```

4. **Make it permanent** (add to `~/.zshrc` or `~/.bashrc`):
   ```bash
   echo 'export FIREBASE_TOKEN="your-token-here"' >> ~/.zshrc
   source ~/.zshrc
   ```

### Option 2: Use gcloud CLI (Best for Service Account)

1. **Install gcloud CLI**:
   ```bash
   brew install google-cloud-sdk
   ```

2. **Authenticate with service account**:
   ```bash
   export GOOGLE_APPLICATION_CREDENTIALS="./service-account-key.json"
   gcloud auth activate-service-account --key-file="./service-account-key.json"
   gcloud config set project chatterbox-e5d10
   ```

3. **Deploy**:
   ```bash
   cd functions
   npm install
   cd ..
   npx firebase deploy --only functions
   ```

### Option 3: Use Deployment Script

I've created a script that tries all methods:

```bash
./deploy-functions.sh
```

This script will:
1. Try gcloud CLI if available
2. Try FIREBASE_TOKEN if set
3. Fall back to interactive login

### Option 4: Manual Deployment via Firebase Console (Not Recommended)

Firebase Console doesn't support function deployment. You must use CLI.

## Quick Fix: Get CI Token Now

Since you're using VPN, run:

```bash
cd /Users/xiaohanliu/Documents/chatterbox
npx firebase login:ci
```

This will:
1. Open browser window
2. Ask you to authenticate
3. Output a token like: `1//abc123...`

Then save it and use:

```bash
export FIREBASE_TOKEN="1//abc123..."
npx firebase deploy --only functions --token "$FIREBASE_TOKEN"
```

## Why Service Account Doesn't Work

Firebase CLI uses its own authentication system, not `GOOGLE_APPLICATION_CREDENTIALS`. The service account is for:
- Firebase Admin SDK (server-side)
- gcloud CLI
- Direct API calls

But NOT for Firebase CLI deployment.

## Recommended Approach

**For China users**: Use CI token method (Option 1)
- Get token once (with VPN)
- Use token for all deployments
- Token doesn't expire (unless revoked)

## Verify Deployment

After deployment, check:
```bash
npx firebase functions:list
```

You should see:
- `claimSession`
- `sessionHeartbeat`

## Troubleshooting

### "Token expired"
Get a new token:
```bash
npx firebase login:ci
```

### "Permission denied"
Make sure your account has:
- Firebase Admin permissions
- Cloud Functions Admin role

### "Functions deploy failed"
Check:
1. Billing is enabled (Blaze plan required)
2. Functions code has no syntax errors
3. Node.js version matches (18+)
