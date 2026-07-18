# Final Solution: Deploy Firebase Functions

## The Reality

**Firebase CLI doesn't support service account authentication for deployment.** It requires:
- Interactive OAuth login (fails in China)
- CI token from `firebase login:ci` (also fails in China)

## ✅ Working Solutions

### Solution 1: GitHub Actions (Best for China Users)

GitHub Actions runs outside China, so Firebase authentication works.

**Setup:**

1. **Add secrets to GitHub**:
   - Go to your GitHub repo → Settings → Secrets and variables → Actions
   - Add these secrets:
     - `FIREBASE_SERVICE_ACCOUNT`: Paste entire content of `service-account-key.json`
     - `FIREBASE_TOKEN`: Get from `firebase login:ci` (run this once with VPN, or get from someone outside China)

2. **Push the workflow file**:
   ```bash
   git add .github/workflows/deploy-functions.yml
   git commit -m "Add GitHub Actions for function deployment"
   git push
   ```

3. **Deploy**:
   - Go to GitHub repo → Actions tab
   - Click "Deploy Firebase Functions"
   - Click "Run workflow"
   - Or just push changes to `functions/` folder

**To get FIREBASE_TOKEN** (one-time, with VPN):
```bash
npx firebase login:ci
# Copy the token output
```

### Solution 2: Deploy from VPS/Server Outside China

1. **SSH into server** (DigitalOcean, AWS, etc.)
2. **Clone repo**:
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

### Solution 3: Get CI Token Once (With VPN)

If you can get VPN working temporarily:

1. **Get CI token**:
   ```bash
   npx firebase login:ci
   ```
   This outputs a token like: `1//abc123...`

2. **Save token**:
   ```bash
   export FIREBASE_TOKEN="1//abc123..."
   ```

3. **Deploy**:
   ```bash
   cd functions
   npm install
   cd ..
   npx firebase deploy --only functions --token "$FIREBASE_TOKEN"
   ```

4. **Make permanent**:
   Add to `~/.zshrc`:
   ```bash
   export FIREBASE_TOKEN="1//abc123..."
   ```

### Solution 4: Ask Someone Outside China

Have someone outside China:
1. Clone your repo
2. Run `firebase login:ci`
3. Send you the token
4. You use the token to deploy

## Why Service Account Doesn't Work

Firebase CLI uses OAuth2 flow which:
- Requires browser redirect
- Doesn't support service accounts for deployment
- Only supports service accounts for Admin SDK (server-side)

The `GOOGLE_APPLICATION_CREDENTIALS` environment variable works for:
- ✅ Firebase Admin SDK
- ✅ gcloud CLI
- ✅ Direct API calls
- ❌ Firebase CLI deployment

## Recommended Approach

**For China users**: Use **GitHub Actions** (Solution 1)
- Set up once
- Automatic deployment on push
- No VPN needed
- Free for public repos

## Quick Start: GitHub Actions

1. **Create the workflow file** (already created: `.github/workflows/deploy-functions.yml`)

2. **Add secrets**:
   - `FIREBASE_SERVICE_ACCOUNT`: Content of `service-account-key.json`
   - `FIREBASE_TOKEN`: Get from `firebase login:ci` (with VPN, one-time)

3. **Push and deploy**:
   ```bash
   git add .github/workflows/deploy-functions.yml
   git commit -m "Add GitHub Actions deployment"
   git push
   ```

4. **Trigger deployment**:
   - Go to GitHub → Actions
   - Click "Deploy Firebase Functions"
   - Click "Run workflow"

## Verify Deployment

After deployment:
```bash
npx firebase functions:list
```

Should show:
- `claimSession`
- `sessionHeartbeat`

## Troubleshooting

### "FIREBASE_TOKEN secret not found"
Add it in GitHub repo → Settings → Secrets → Actions

### "Functions deploy failed"
Check:
1. Billing enabled (Blaze plan)
2. Service account has Cloud Functions Admin role
3. Functions code has no errors

### "Workflow not running"
Make sure:
1. Workflow file is in `.github/workflows/`
2. File is named `deploy-functions.yml`
3. You pushed to `main` or `master` branch

## Summary

**Best option**: GitHub Actions
- Works from China
- Automatic
- No VPN needed after setup

**Quick option**: Get CI token once with VPN, use it forever

**Manual option**: Deploy from server outside China
